// MINIMAL TEST VERSION - Use this to verify Lambda is working at all
// Replace backend/functions/projects/index.ts temporarily with this

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const ALLOWED_ORIGINS = [
    'https://dzdzuh78hslou.cloudfront.net',
    'http://localhost:4200'
];

function getCorsHeaders(origin?: string): Record<string, string> {
    const requestOrigin = origin || '';
    const allowedOrigin = ALLOWED_ORIGINS.includes(requestOrigin)
        ? requestOrigin
        : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'Content-Type': 'application/json',
    };
}

export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
    const corsHeaders = getCorsHeaders(event.headers?.origin || event.headers?.Origin);

    // Handle both v1.0 and v2.0 payload formats
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.requestContext?.http?.path || event.rawPath;

    console.log('=== LAMBDA INVOKED ===');
    console.log('Method:', httpMethod);
    console.log('Path:', path);
    console.log('Origin:', event.headers?.origin || event.headers?.Origin);
    console.log('Full event:', JSON.stringify(event, null, 2));

    // Handle OPTIONS
    if (httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS request');
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    // Handle GET
    if (httpMethod === 'GET' && path?.includes('/projects')) {
        console.log('Handling GET /projects');
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: 'Lambda is working!',
                projects: [],
                timestamp: new Date().toISOString()
            })
        };
    }

    // Handle POST
    if (httpMethod === 'POST' && path?.includes('/projects')) {
        console.log('Handling POST /projects');
        console.log('Body:', event.body);
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                message: 'Lambda received POST!',
                id: 'test-123',
                receivedData: event.body ? JSON.parse(event.body) : null
            })
        };
    }

    // Default response
    console.log('No matching route');
    return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
            error: 'Not found',
            path: path,
            method: httpMethod
        })
    };
};