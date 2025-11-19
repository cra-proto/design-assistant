import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';

interface GitHubOAuthSecret {
    GH_BASIC_CLIENT_ID: string;
    GH_BASIC_SECRET_ID: string;
}

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || "ca-central-1" });
const SECRET_NAME = process.env.SECRET_NAME || "prod/design-assistant/GitHub-OAuth";

async function getGitHubCredentials(): Promise<GitHubOAuthSecret> {
    const response = await secretsClient.send(
        new GetSecretValueCommand({
            SecretId: SECRET_NAME,
        })
    );

    if (!response.SecretString) {
        throw new Error('Secret not found');
    }

    return JSON.parse(response.SecretString) as GitHubOAuthSecret;
}

export const getAuthUrl = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { GH_BASIC_CLIENT_ID } = await getGitHubCredentials();
        const redirectUri = process.env.REDIRECT_URI || 'https://dzdzuh78hslou.cloudfront.net/auth/callback';

        const authUrl = `https://github.com/login/oauth/authorize?client_id=${GH_BASIC_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo user`;

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ authUrl }),
        };
    } catch (error) {
        console.error('Error generating auth URL:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: 'Internal server error' }),
        };
    }
};

export const handleCallback = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { code } = JSON.parse(event.body || '{}');

        if (!code) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Missing code parameter' }),
            };
        }

        const { GH_BASIC_CLIENT_ID, GH_BASIC_SECRET_ID } = await getGitHubCredentials();

        // Exchange code for access token
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id: GH_BASIC_CLIENT_ID,
                client_secret: GH_BASIC_SECRET_ID,
                code,
            },
            {
                headers: {
                    Accept: 'application/json',
                },
            }
        );

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tokenResponse.data),
        };
    } catch (error) {
        console.error('Error exchanging code for token:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                error: 'Failed to exchange code for token',
                details: error instanceof Error ? error.message : 'Unknown error'
            }),
        };
    }
};