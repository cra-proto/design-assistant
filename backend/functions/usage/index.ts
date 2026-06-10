import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import * as crypto from 'crypto';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true }
});

const USAGE_TABLE = process.env.USAGE_TABLE_NAME || "design-assistant-usage";
const PROMPTS_TABLE = process.env.PROMPTS_TABLE_NAME || "design-assistant-prompts";

function getCorsHeaders(): Record<string, string> {
    return { 'Content-Type': 'application/json' };
}

// Get or create a prompt version from its config
async function getOrCreatePromptVersion(promptConfig: object): Promise<number> {
    const promptHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(promptConfig))
        .digest('hex')
        .substring(0, 16);

    // Check if this prompt hash already exists
    const existing = await docClient.send(new GetCommand({
        TableName: PROMPTS_TABLE,
        Key: { promptHash }
    }));

    if (existing.Item) {
        return existing.Item.version as number;
    }

    // Get current max version
    const all = await docClient.send(new ScanCommand({
        TableName: PROMPTS_TABLE,
        ProjectionExpression: '#v',
        ExpressionAttributeNames: { '#v': 'version' }
    }));

    const maxVersion = all.Items?.reduce((max, item) =>
        Math.max(max, item.version as number), 0) ?? 0;
    const newVersion = maxVersion + 1;

    // Save new prompt
    await docClient.send(new PutCommand({
        TableName: PROMPTS_TABLE,
        Item: {
            promptHash,
            version: newVersion,
            prompt: JSON.stringify(promptConfig),
            firstSeenAt: new Date().toISOString()
        }
    }));

    return newVersion;
}

// Track metadata usage
async function trackMetadata(body: any): Promise<APIGatewayProxyResult> {
    const corsHeaders = getCorsHeaders();

    const {
        projectId, pageUrl,
        org, userId,
        model, promptConfig, generatedAt,
        originalDescEN, originalDescFR, originalKeywordsEN, originalKeywordsFR,
        aiDescEN, aiDescFR, aiKeywordsEN, aiKeywordsFR,
        finalDescEN, finalDescFR, finalKeywordsEN, finalKeywordsFR,
        statusDescEN, statusDescFR, statusKeywordsEN, statusKeywordsFR
    } = body;

    if (!projectId || !pageUrl) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'projectId and pageUrl are required' })
        };
    }

    const promptVersion = promptConfig
        ? await getOrCreatePromptVersion(promptConfig)
        : null;

    const timestamp = generatedAt ?? new Date().toISOString();

    await docClient.send(new PutCommand({
        TableName: USAGE_TABLE,
        Item: {
            pk: `metadata#${projectId}`,
            sk: `${pageUrl}#${timestamp}`,
            feature: 'metadata',
            projectId,
            org: org ?? 'DEFAULT',
            userId: userId ?? 'anonymous',
            pageUrl,
            model,
            promptVersion,
            originalDescEN, originalDescFR,
            originalKeywordsEN, originalKeywordsFR,
            aiDescEN, aiDescFR,
            aiKeywordsEN, aiKeywordsFR,
            finalDescEN, finalDescFR,
            finalKeywordsEN, finalKeywordsFR,
            statusDescEN, statusDescFR,
            statusKeywordsEN, statusKeywordsFR,
            lastUpdated: new Date().toISOString()
        }
    }));

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Usage tracked successfully', promptVersion })
    };
}

async function getUsageStats(): Promise<APIGatewayProxyResult> {
    const corsHeaders = getCorsHeaders();

    const result = await docClient.send(new ScanCommand({
        TableName: USAGE_TABLE
    }));

    const items = result.Items ?? [];

    // Aggregate stats
    const uniqueUrls = new Set(items.map(i => i.pageUrl)).size;
    const totalGenerations = items.length;

    // Status counts across all 4 fields
    const statusFields = ['statusDescEN', 'statusDescFR', 'statusKeywordsEN', 'statusKeywordsFR'];
    const statusCounts: Record<string, number> = {};
    for (const item of items) {
        for (const field of statusFields) {
            const status = item[field];
            if (status) statusCounts[status] = (statusCounts[status] ?? 0) + 1;
        }
    }

    // Model breakdown
    const modelCounts: Record<string, number> = {};
    for (const item of items) {
        if (item.model) modelCounts[item.model] = (modelCounts[item.model] ?? 0) + 1;
    }

    // Prompt version breakdown
    const promptCounts: Record<string, number> = {};
    for (const item of items) {
        if (item.promptVersion != null) {
            const key = `v${item.promptVersion}`;
            promptCounts[key] = (promptCounts[key] ?? 0) + 1;
        }
    }

    // Status breakdown per model+prompt combo
    const comboCounts: Record<string, Record<string, number>> = {};
    for (const item of items) {
        const comboKey = `${item.model ?? 'unknown'} / prompt v${item.promptVersion ?? '?'}`;
        if (!comboCounts[comboKey]) comboCounts[comboKey] = {};
        for (const field of statusFields) {
            const status = item[field];
            if (status) {
                comboCounts[comboKey][status] = (comboCounts[comboKey][status] ?? 0) + 1;
            }
        }
    }

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            totalGenerations,
            uniqueUrls,
            statusCounts,
            modelCounts,
            promptCounts,
            comboCounts,
            items
        })
    };
}

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
    const corsHeaders = getCorsHeaders();
    const httpMethod = event.requestContext?.http?.method || event.httpMethod;

    if (httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    if (httpMethod === 'GET') {
        return getUsageStats();
    }

    if (httpMethod !== 'POST') {
        return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        let bodyText = event.body;
        if (event.isBase64Encoded && bodyText) {
            bodyText = Buffer.from(bodyText, 'base64').toString('utf-8');
        }
        const body = JSON.parse(bodyText || '{}');
        const feature = body.feature;

        switch (feature) {
            case 'metadata':
                return trackMetadata(body);
            default:
                return {
                    statusCode: 400,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: `Unknown feature: ${feature}` })
                };
        }
    } catch (error) {
        console.error('Usage tracking error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to track usage' })
        };
    }
};

