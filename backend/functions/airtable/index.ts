import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';
import { gzipSync } from 'zlib';

interface AirtableSecret {
    token: string;
    baseId: string;
    tableId: string;
}

interface APIKeySecrets {
    openrouter: {
        paid: string;
        free: string;
    };
    airtable: AirtableSecret;
}

interface AirtableRecord {
    id: string;
    createdTime: string;
    fields: {
        'Unique ID'?: number;
        'Task'?: string;
        'Task FR'?: string;
        'Main URL'?: string;
        'Url (from Pages)'?: string[];
    };
}

interface AirtableResponse {
    records: AirtableRecord[];
    offset?: string;
}

interface TransformedTask {
    id: number;
    taskNameEN: string;
    taskNameFR: string;
    urlsEN: string[];
    urlsFR: string[];
}

const secretsClient = new SecretsManagerClient({
    region: process.env.AWS_REGION || "ca-central-1"
});
const SECRET_NAME = process.env.SECRET_NAME || "prod/design-assistant/api-keys";

async function getAirtableCredentials(): Promise<AirtableSecret> {
    const response = await secretsClient.send(
        new GetSecretValueCommand({
            SecretId: SECRET_NAME,
        })
    );

    if (!response.SecretString) {
        throw new Error('Secret not found');
    }

    const secrets = JSON.parse(response.SecretString) as APIKeySecrets;
    return secrets.airtable;
}

/**
 * Fetch all records from Airtable, handling pagination
 */
async function fetchAllRecords(token: string, baseId: string, tableId: string): Promise<AirtableRecord[]> {
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
    const allRecords: AirtableRecord[] = [];
    let offset: string | undefined;

    console.log('Starting to fetch all records from Airtable...');

    do {
        const response = await axios.get<AirtableResponse>(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            params: offset ? { offset } : {}
        });

        allRecords.push(...response.data.records);
        offset = response.data.offset;

        console.log(`Fetched ${response.data.records.length} records (total so far: ${allRecords.length})`);

        if (offset) {
            console.log('More records available, fetching next page...');
        }
    } while (offset);

    console.log(`Finished fetching all records. Total: ${allRecords.length}`);
    return allRecords;
}

/**
 * Extract URLs from a comma-separated string or array
 */
function extractUrls(urlSource: string | string[] | undefined): string[] {
    if (!urlSource) return [];

    // If it's already an array, return it
    if (Array.isArray(urlSource)) {
        return urlSource.filter(url => url && url.trim().length > 0);
    }

    // If it's a string, split by comma
    return urlSource
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
}

/**
 * Categorize URLs into English and French based on /en/ and /fr/ patterns
 */
function categorizeUrls(urls: string[]): { en: string[], fr: string[] } {
    const enUrls = new Set<string>();
    const frUrls = new Set<string>();

    urls.forEach(url => {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('canada.ca/en')) {
            enUrls.add(url);
        } else if (lowerUrl.includes('canada.ca/fr')) {
            frUrls.add(url);
        }
    });

    return {
        en: Array.from(enUrls),
        fr: Array.from(frUrls)
    };
}

/**
 * Transform Airtable records to the format needed for the Angular app
 */
function transformRecords(records: AirtableRecord[]): TransformedTask[] {
    const tasks: TransformedTask[] = [];
    let skippedCount = 0;

    for (const record of records) {
        const fields = record.fields;

        const taskNameEN = fields['Task']?.trim();
        const taskNameFR = fields['Task FR']?.trim();
        const uniqueId = fields['Unique ID'];
        const mainUrl = fields['Main URL'];
        const lookupPages = fields['Url (from Pages)'];

        // Skip records without task name or unique ID
        if (!taskNameEN || uniqueId === undefined) {
            skippedCount++;
            continue;
        }

        // Combine all URLs
        const allUrls = [
            ...extractUrls(mainUrl),
            ...extractUrls(lookupPages)
        ];

        // Categorize URLs
        const categorized = categorizeUrls(allUrls);

        // Skip tasks with no valid URLs
        if (categorized.en.length === 0 && categorized.fr.length === 0) {
            skippedCount++;
            continue;
        }

        tasks.push({
            id: uniqueId,
            taskNameEN: taskNameEN,
            taskNameFR: taskNameFR || '',
            urlsEN: categorized.en,
            urlsFR: categorized.fr
        });
    }

    console.log(`Transformed ${tasks.length} tasks (skipped ${skippedCount} tasks with missing data or no valid URLs)`);

    // Log some stats
    const totalEnUrls = tasks.reduce((sum, task) => sum + task.urlsEN.length, 0);
    const totalFrUrls = tasks.reduce((sum, task) => sum + task.urlsFR.length, 0);
    console.log(`  - Total EN URLs: ${totalEnUrls}`);
    console.log(`  - Total FR URLs: ${totalFrUrls}`);

    return tasks;
}

export const getRecords = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('=== getRecords STARTED ===');

    try {
        console.log('Fetching Airtable credentials...');
        const { token, baseId, tableId } = await getAirtableCredentials();
        console.log('Got Airtable credentials');

        // Fetch all records (handles pagination)
        const allRecords = await fetchAllRecords(token, baseId, tableId);

        // Transform to required format
        console.log('Transforming records...');
        const transformedTasks = transformRecords(allRecords);

        console.log('=== getRecords COMPLETED SUCCESSFULLY ===');

        // Convert to JSON string
        const jsonBody = JSON.stringify(transformedTasks);
        const uncompressedSize = Buffer.byteLength(jsonBody, 'utf8');

        // Compress with gzip
        const compressedBody = gzipSync(jsonBody);
        const compressedSize = compressedBody.length;

        console.log(`Response size: ${uncompressedSize} bytes uncompressed, ${compressedSize} bytes compressed (${Math.round(compressedSize / uncompressedSize * 100)}% of original)`);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
                'Access-Control-Allow-Headers': 'Content-Type, Accept-Encoding',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Content-Type': 'application/json',
                'Content-Encoding': 'gzip',
            },
            body: compressedBody.toString('base64'),
            isBase64Encoded: true,
        };
    } catch (error) {
        console.error('=== ERROR in getRecords ===');
        console.error('Error:', error);

        // Enhanced error logging for Airtable-specific errors
        if (axios.isAxiosError(error)) {
            console.error('Airtable API Error:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });
        }

        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: 'Failed to fetch Airtable records',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
        };
    }
};