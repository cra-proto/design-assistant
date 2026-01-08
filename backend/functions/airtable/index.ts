import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';

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

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || "ca-central-1" });
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

export const getRecords = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('=== getRecords STARTED ===');
    try {
        console.log('Fetching Airtable credentials...');
        const { token, baseId, tableId } = await getAirtableCredentials();
        console.log('Got Airtable credentials');

        // Airtable Web API endpoint
        const url = `https://api.airtable.com/v0/${baseId}/${tableId}`;
        console.log('Calling Airtable API...');

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            // Get all records (Airtable paginates at 100 by default)
            // For proof of concept, we'll get first page
            params: {
                // You can add pageSize, offset, view, etc. here later
            }
        });

        console.log('Successfully fetched records:', response.data.records?.length || 0);

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(response.data),
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