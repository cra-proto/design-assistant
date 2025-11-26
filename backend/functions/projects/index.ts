import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || "design-assistant-projects";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://dzdzuh78hslou.cloudfront.net';


interface Project {
    id: string;
    key: string;
    name: string;
    owner: string;
    repo: string;
    branch: string;
    pages: number;
    phase: string;
    timestamp: number;
    collaborators: Array<{
        githubId: string;
        login: string;
        name: string;
        avatarUrl: string;
    }>;
    content: string; // JSON stringified project data
    isPublic: boolean;
    createdAt: number;
    updatedAt: number;
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Credentials': '*',
    'Content-Type': 'application/json',
};

// Get user info from GitHub token
async function getUserFromToken(token: string) {
    const response = await fetch('https://api.github.com/user', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        }
    });

    if (!response.ok) {
        throw new Error('Invalid token');
    }

    return response.json();
}

// List all public projects (no auth required)
export const listProjects = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        // Scan for all public projects
        const result = await docClient.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'isPublic = :public',
            ExpressionAttributeValues: {
                ':public': true
            },
            ProjectionExpression: 'id, #k, #n, #o, repo, pages, phase, #t, collaborators',
            ExpressionAttributeNames: {
                '#k': 'key',
                '#n': 'name',
                '#o': 'owner',
                '#t': 'timestamp'
            }
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(result.Items || [])
        };
    } catch (error) {
        console.error('Error listing projects:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to list projects' })
        };
    }
};

// Get a specific project (no auth required for public projects)
export const getProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const projectId = event.pathParameters?.id;

        if (!projectId) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Project ID required' })
            };
        }

        const result = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { id: projectId }
        }));

        if (!result.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Project not found' })
            };
        }

        // Check if project is public or user is authorized
        const authHeader = event.headers.Authorization;
        if (!result.Item.isPublic && authHeader) {
            try {
                const token = authHeader.replace('Bearer ', '');
                const user: any = await getUserFromToken(token);
                const isCollaborator = result.Item.collaborators?.some(
                    (c: any) => c.githubId === user.id.toString()
                );

                if (!isCollaborator) {
                    // Return limited info for non-collaborators
                    return {
                        statusCode: 200,
                        headers: corsHeaders,
                        body: JSON.stringify({
                            ...result.Item,
                            content: undefined // Don't send content to non-collaborators
                        })
                    };
                }
            } catch {
                // Invalid token, treat as public access
                if (!result.Item.isPublic) {
                    return {
                        statusCode: 403,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Access denied' })
                    };
                }
            }
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(result.Item)
        };
    } catch (error) {
        console.error('Error getting project:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to get project' })
        };
    }
};

// Create or update project (requires auth)
export const saveProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const authHeader = event.headers.Authorization;
        if (!authHeader) {
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Authorization required' })
            };
        }

        const token = authHeader.replace('Bearer ', '');
        const user: any = await getUserFromToken(token);
        const projectData = JSON.parse(event.body || '{}');

        const now = Date.now();

        // Create project object
        const project: Project = {
            id: projectData.id || uuidv4(),
            key: projectData.gitHubData?.repo || projectData.key || 'untitled',
            name: projectData.name || projectData.gitHubData?.repo || 'Untitled Project',
            owner: projectData.gitHubData?.owner || user.login,
            repo: projectData.gitHubData?.repo || '',
            branch: projectData.gitHubData?.branch || 'main',
            pages: projectData.pages || 0,
            phase: projectData.phase || 'Draft',
            timestamp: now,
            collaborators: projectData.collaborators || [{
                githubId: user.id.toString(),
                login: user.login,
                name: user.name || user.login,
                avatarUrl: user.avatar_url
            }],
            content: JSON.stringify(projectData), // Store the entire project state
            isPublic: projectData.isPublic !== false, // Default to public
            createdAt: projectData.createdAt || now,
            updatedAt: now
        };

        // Check if user is authorized to update (must be a collaborator)
        if (projectData.id) {
            const existing = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { id: projectData.id }
            }));

            if (existing.Item) {
                const isCollaborator = existing.Item.collaborators?.some(
                    (c: any) => c.githubId === user.id.toString()
                );

                if (!isCollaborator) {
                    return {
                        statusCode: 403,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Not authorized to update this project' })
                    };
                }

                // Preserve original creator and creation date
                project.createdAt = existing.Item.createdAt;
                project.collaborators = existing.Item.collaborators;
            }
        }

        // Save to DynamoDB
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: project
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                id: project.id,
                message: 'Project saved successfully'
            })
        };
    } catch (error) {
        console.error('Error saving project:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to save project' })
        };
    }
};

// Delete project (requires auth)
export const deleteProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
        const authHeader = event.headers.Authorization;
        if (!authHeader) {
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Authorization required' })
            };
        }

        const token = authHeader.replace('Bearer ', '');
        const user: any = await getUserFromToken(token);
        const projectId = event.pathParameters?.id;

        if (!projectId) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Project ID required' })
            };
        }

        // Check if user is authorized
        const existing = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { id: projectId }
        }));

        if (!existing.Item) {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Project not found' })
            };
        }

        const isCollaborator = existing.Item.collaborators?.some(
            (c: any) => c.githubId === user.id.toString()
        );

        if (!isCollaborator) {
            return {
                statusCode: 403,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Not authorized to delete this project' })
            };
        }

        // Delete from DynamoDB
        await docClient.send(new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { id: projectId }
        }));

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Project deleted successfully' })
        };
    } catch (error) {
        console.error('Error deleting project:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Failed to delete project' })
        };
    }
};

// Main handler that routes to appropriate function
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.log('Request:', {
        method: event.httpMethod,
        path: event.path,
        headers: event.headers
    });

    // Handle CORS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        // Route based on path and method
        if (event.path === '/projects' || event.path === '/production/projects') {
            if (event.httpMethod === 'GET') {
                return listProjects(event);
            } else if (event.httpMethod === 'POST') {
                return saveProject(event);
            }
        } else if (event.path.includes('/projects/')) {
            const pathParts = event.path.split('/');
            const projectId = pathParts[pathParts.length - 1];

            // Set the path parameters if not already set
            if (!event.pathParameters) {
                event.pathParameters = { id: projectId };
            }

            if (event.httpMethod === 'GET') {
                return getProject(event);
            } else if (event.httpMethod === 'PUT') {
                return saveProject(event);
            } else if (event.httpMethod === 'DELETE') {
                return deleteProject(event);
            }
        }

        return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Not found' })
        };
    } catch (error) {
        console.error('Handler error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};