import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
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
        isUpdate,
        projectId, pageUrl,
        orgId, storageType, userId,
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

    const timestamp = generatedAt ?? new Date().toISOString();

    if (isUpdate) {
        await docClient.send(new UpdateCommand({
            TableName: USAGE_TABLE,
            Key: {
                pk: `metadata#${projectId}`,
                sk: `${pageUrl}#${timestamp}`
            },
            UpdateExpression: `SET 
        orgId = :orgId,
        storageType = :storageType,
        statusDescEN = :statusDescEN,
        statusDescFR = :statusDescFR,
        statusKeywordsEN = :statusKeywordsEN,
        statusKeywordsFR = :statusKeywordsFR,
        finalDescEN = :finalDescEN,
        finalDescFR = :finalDescFR,
        finalKeywordsEN = :finalKeywordsEN,
        finalKeywordsFR = :finalKeywordsFR,
        lastUpdated = :lastUpdated`,
            ExpressionAttributeValues: {
                ':orgId': orgId ?? 'DEFAULT',
                ':storageType': storageType ?? 'local',
                ':statusDescEN': statusDescEN,
                ':statusDescFR': statusDescFR,
                ':statusKeywordsEN': statusKeywordsEN,
                ':statusKeywordsFR': statusKeywordsFR,
                ':finalDescEN': finalDescEN,
                ':finalDescFR': finalDescFR,
                ':finalKeywordsEN': finalKeywordsEN,
                ':finalKeywordsFR': finalKeywordsFR,
                ':lastUpdated': new Date().toISOString()
            }
        }));
    } else {
        const promptVersion = promptConfig
            ? await getOrCreatePromptVersion(promptConfig)
            : null;

        await docClient.send(new PutCommand({
            TableName: USAGE_TABLE,
            Item: {
                pk: `metadata#${projectId}`,
                sk: `${pageUrl}#${timestamp}`,
                feature: 'metadata',
                projectId,
                orgId: orgId ?? 'DEFAULT',
                storageType: storageType ?? 'local',
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
    }

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Usage tracked successfully', projectId })
    };
}

async function getUsageStats(): Promise<APIGatewayProxyResult> {
    const corsHeaders = getCorsHeaders();

    const result = await docClient.send(new ScanCommand({
        TableName: USAGE_TABLE
    }));

    const items = result.Items ?? [];

    // Users
    const uniqueUsersTotal = new Set(items.map(i => i.userId)).size;
    const uniqueUsersGitHub = new Set(items.filter(i => !i.userId?.startsWith('user_')).map(i => i.userId)).size;
    const uniqueUsersAnonymous = new Set(items.filter(i => i.userId?.startsWith('user_')).map(i => i.userId)).size;

    // Generations by feature
    const totalGenerations = items.length;
    const metadataGenerations = items.filter(i => i.pk?.startsWith('metadata#')).length;
    const pageGenerations = items.filter(i => i.pk?.startsWith('page#')).length;

    // Projects
    const uniqueProjects = new Set(items.map(i => i.pk?.split('#')[1])).size;
    const localProjects = new Set(items.filter(i => i.storageType === 'local').map(i => i.pk?.split('#')[1])).size;
    const cloudProjects = new Set(items.filter(i => i.storageType === 'cloud').map(i => i.pk?.split('#')[1])).size;

    // URLs
    const uniqueUrls = new Set(items.map(i => i.pageUrl)).size;
    const enUrls = new Set(items.filter(i => i.pageUrl?.includes('/en/')).map(i => i.pageUrl)).size;
    const frUrls = new Set(items.filter(i => i.pageUrl?.includes('/fr/')).map(i => i.pageUrl)).size;


    // Orgs
    const uniqueOrgCount = new Set(items.map(i => i.orgId)).size;

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            uniqueUsersTotal,
            uniqueUsersGitHub,
            uniqueUsersAnonymous,
            totalGenerations,
            metadataGenerations,
            pageGenerations,
            uniqueProjects,
            localProjects,
            cloudProjects,
            uniqueUrls,
            enUrls,
            frUrls,
            uniqueOrgCount,
        })
    };
}

async function getFeatureItems(feature: string): Promise<APIGatewayProxyResult> {
    const corsHeaders = getCorsHeaders();

    const result = await docClient.send(new ScanCommand({
        TableName: USAGE_TABLE,
        FilterExpression: 'feature = :feature',
        ExpressionAttributeValues: { ':feature': feature }
    }));

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ items: result.Items ?? [] })
    };
}

async function updateUserId(body: any): Promise<APIGatewayProxyResult> {
    const corsHeaders = getCorsHeaders();
    const { tempUserId, githubUserId } = body;

    if (!tempUserId || !githubUserId) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'tempUserId and githubUserId are required' })
        };
    }

    // Scan for all records with tempUserId
    const result = await docClient.send(new ScanCommand({
        TableName: USAGE_TABLE,
        FilterExpression: 'userId = :tempUserId',
        ExpressionAttributeValues: { ':tempUserId': tempUserId }
    }));

    const items = result.Items ?? [];

    if (items.length === 0) {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'No records found for this user', updated: 0 })
        };
    }

    // Update each matching record
    await Promise.all(items.map(item =>
        docClient.send(new UpdateCommand({
            TableName: USAGE_TABLE,
            Key: { pk: item.pk, sk: item.sk },
            UpdateExpression: 'SET userId = :githubUserId',
            ExpressionAttributeValues: { ':githubUserId': githubUserId }
        }))
    ));

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'User ID updated successfully', updated: items.length })
    };
}

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
    const corsHeaders = getCorsHeaders();
    const httpMethod = event.requestContext?.http?.method || event.httpMethod;

    if (httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    if (httpMethod === 'GET') {
        const feature = event.queryStringParameters?.feature;
        if (feature) {
            return getFeatureItems(feature);
        }
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
            case 'update-user':
                return updateUserId(body);
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

