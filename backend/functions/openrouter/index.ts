import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import axios, { AxiosError } from 'axios';

interface APIKeySecrets {
    openrouter: {
        paid: string;
        free: string;
    };
    airtable: {
        token: string;
        baseId: string;
        tableId: string;
    };
}

interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface OpenRouterRequest {
    models: string[];           // Array for fallback support
    systemPrompt: string;       // Passed in from Angular
    content: string;            // Text, HTML, JSON — whatever the task needs
    temperature?: number;       // Optional, defaults to 0 for deterministic output
}

export interface OpenRouterResponse {
    id: string;
    model: string;              // Which model actually responded (useful with fallbacks)
    choices: {
        message: ChatMessage;
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

const secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || "ca-central-1" });
const SECRET_NAME = process.env.SECRET_NAME || "prod/design-assistant/api-keys";

let cachedApiKey: string | null = null;

async function getOpenRouterKey(): Promise<string> {
    if (cachedApiKey) return cachedApiKey;

    const response = await secretsClient.send(
        new GetSecretValueCommand({ SecretId: SECRET_NAME })
    );

    if (!response.SecretString) throw new Error('Secret not found');

    const secrets = JSON.parse(response.SecretString) as APIKeySecrets;
    cachedApiKey = secrets.openrouter.paid;
    return cachedApiKey;
}

const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (event: any): Promise<any> => {

    // Parse & validate request body
    let body: OpenRouterRequest;
    try {
        body = JSON.parse(event.body || '{}');
    } catch {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Invalid JSON in request body' })
        };
    }

    const { models, systemPrompt, content, temperature = 0 } = body;

    if (!models?.length || !systemPrompt || content === undefined) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'models, systemPrompt, and content are required' })
        };
    }

    // Call OpenRouter
    try {
        const apiKey = await getOpenRouterKey();

        const payload = {
            models, // OpenRouter fallback array
            messages: [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user', content: typeof content === 'string'
                        ? content
                        : JSON.stringify(content) // Safely handles objects
                },
            ],
            temperature,
            provider: {
                allow_fallbacks: true,
            },
        };

        const response = await axios.post<OpenRouterResponse>(
            'https://openrouter.ai/api/v1/chat/completions',
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.ALLOWED_ORIGIN || '',
                    'X-Title': 'AIDA - AI Design Assistant',
                },
                timeout: 25000, // 25s, under Lambda's 30s timeout
            }
        );

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(response.data)
        };

    } catch (error) {
        const axiosError = error as AxiosError;

        // Surface OpenRouter's error message if available
        const upstreamError = axiosError.response?.data
            ? JSON.stringify(axiosError.response.data)
            : axiosError.message;

        console.error('OpenRouter error:', upstreamError);

        return {
            statusCode: axiosError.response?.status || 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'OpenRouter request failed', detail: upstreamError })
        };
    }
};
