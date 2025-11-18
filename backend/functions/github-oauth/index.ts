import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import axios from 'axios';

interface GitHubOAuthSecret {
    client_id: string;
    client_secret: string;
}

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || "ca-central-1" });
const SECRET_NAME = process.env.SECRET_NAME || "prod/design-assistant/GitHub-OAuth";


async function getGitHubCredentials(): Promise<GitHubOAuthSecret> {
    const response = await secretsClient.send(
        new GetSecretValueCommand({
            SecretId: "prod/design-assistant/GitHub-OAuth",
        })
    );

    return JSON.parse(response.SecretString!) as GitHubOAuthSecret;
}

export const getAuthUrl = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const { client_id } = await getGitHubCredentials();
        const redirectUri = process.env.REDIRECT_URI || 'https://dzdzuh78hslou.cloudfront.net/auth/callback';

        const authUrl = `https://github.com/login/oauth/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user`;

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*', // Configure this properly for production
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ authUrl }),
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
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
                body: JSON.stringify({ error: 'Missing code parameter' }),
            };
        }

        const { client_id, client_secret } = await getGitHubCredentials();

        // Exchange code for access token
        const tokenResponse = await axios.post(
            'https://github.com/login/oauth/access_token',
            {
                client_id,
                client_secret,
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
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tokenResponse.data),
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to exchange code for token' }),
        };
    }
};