import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v4 as uuidv4 } from 'uuid';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "ca-central-1" });
const docClient = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.TABLE_NAME || "design-assistant-projects";

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:4200'];

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

// Function to get CORS headers based on request origin
function getCorsHeaders(origin?: string): Record<string, string> {
    return {
        'Content-Type': 'application/json',
    };
}

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
    const corsHeaders = getCorsHeaders(event.headers?.origin || event.headers?.Origin);

    try {
        console.log('Listing projects from table:', TABLE_NAME);

        // Scan for all public projects
        const result = await docClient.send(new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: 'isPublic = :public',
            ExpressionAttributeValues: {
                ':public': true
            },
            ProjectionExpression: 'id, #k, #n, #o, repo, pages, phase, #t, collaborators, github',
            ExpressionAttributeNames: {
                '#k': 'key',
                '#n': 'name',
                '#o': 'owner',
                '#t': 'timestamp'
            }
        }));

        console.log('Found projects:', result.Items?.length || 0);

        // Transform to match ProjectMetadata interface
        const projects = result.Items?.map(item => ({
            id: item.id,
            key: item.key,
            projectName: item.name,
            phase: item.phase,
            inScopePages: item.pages,
            lastModified: item.timestamp,
            storageType: 'cloud',
            collaborators: item.collaborators || [],
            github: {
                owner: item.owner,
                repo: item.repo,
                branch: item.branch || 'main',
                hasBaselineRepo: false
            }
        })) || [];

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(projects || [])
        };
    } catch (error) {
        console.error('Error listing projects:', error);
        console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Failed to list projects',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};

// Get a specific project (no auth required for public projects)
export const getProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const corsHeaders = getCorsHeaders(event.headers?.origin || event.headers?.Origin);

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
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
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

        // Parse the stored content back to full project structure
        const fullProject = JSON.parse(result.Item.content);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(fullProject)
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
    const corsHeaders = getCorsHeaders(event.headers?.origin || event.headers?.Origin);

    try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        if (!authHeader) {
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Authorization required' })
            };
        }

        console.log('Auth header present, validating token...');
        const token = authHeader.replace('Bearer ', '');
        const user: any = await getUserFromToken(token);
        console.log('User authenticated:', user.login);

        // Parse body - handle both base64 encoded (v2.0) and plain text (v1.0)
        let bodyText = event.body;
        if (event.isBase64Encoded && bodyText) {
            bodyText = Buffer.from(bodyText, 'base64').toString('utf-8');
        }

        console.log('Request body:', bodyText);
        const projectData = JSON.parse(bodyText || '{}');
        console.log('Parsed project data:', JSON.stringify(projectData, null, 2));

        // Validate required fields for DynamoDB GSI
        const name = projectData.projectName || projectData.key || '';
        const owner = projectData.gitHubData?.owner || projectData.owner || user.login;

        if (!name || name.trim() === '') {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({
                    error: 'Project name is required',
                    details: 'Please specify a name for this project'
                })
            };
        }

        const now = Date.now();

        // Create project object
        const project: Project = {
            id: projectData.id || uuidv4(),
            key: projectData.key,
            name: projectData.projectName,
            owner: projectData.github.owner,
            repo: projectData.github.repo,
            branch: projectData.github.branch || 'main',
            pages: projectData.inScopePages,
            phase: projectData.phase,
            timestamp: projectData.lastModified,
            collaborators: projectData.collaborators || [],
            content: JSON.stringify(projectData), // Store the entire project state
            isPublic: projectData.isPublic !== false, // Default to public
            createdAt: projectData.created || now,
            updatedAt: now
        };

        console.log('Project to save:', JSON.stringify(project, null, 2));
        console.log('Project to save:', {
            id: project.id,
            key: project.key,
            name: project.name,
            owner: project.owner,
            repo: project.repo,
            pages: project.pages
        });


        // Check if user is authorized to update (must be a collaborator)
        if (projectData.id) {
            console.log('Checking existing project:', projectData.id);
            const existing = await docClient.send(new GetCommand({
                TableName: TABLE_NAME,
                Key: { id: projectData.id }
            }));

            if (existing.Item) {
                // EXISTING PROJECT - check if user is collaborator in cloud version
                console.log('Found existing project in DynamoDB');
                const isCollaborator = existing.Item.collaborators?.some(
                    (c: any) => c.githubId === user.id.toString()
                );

                if (!isCollaborator) {
                    console.log('User not in collaborator list');
                    return {
                        statusCode: 403,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Not authorized to update this project' })
                    };
                }

                // Preserve original creator and creation date
                project.createdAt = existing.Item.createdAt;
            } else {
                // NEW PROJECT (add user to collaborators if missing so they have permission to edit this new file)
                console.log('New project - checking if user is in incoming collaborators list');
                const hasCurrentUser = project.collaborators.some(
                    (c: any) => c.githubId === user.id.toString()
                );

                if (!hasCurrentUser) {
                    console.log('User not in collaborators, adding them');
                    project.collaborators.push({
                        githubId: user.id.toString(),
                        login: user.login,
                        name: user.name || user.login,
                        avatarUrl: user.avatar_url
                    });
                }
            }
        }
        // Save to DynamoDB
        console.log('Saving to DynamoDB...');
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: project
        }));

        console.log('Project saved successfully:', project.id);

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
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Failed to save project',
                details: error instanceof Error ? error.message : 'Unknown error'
            })
        };
    }
};

// Delete project (requires auth)
export const deleteProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const corsHeaders = getCorsHeaders(event.headers?.origin || event.headers?.Origin);

    try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
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
export const handler = async (event: any): Promise<APIGatewayProxyResult> => {
    const corsHeaders = getCorsHeaders(event.headers?.origin || event.headers?.Origin);

    // Handle both v1.0 and v2.0 payload formats
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.requestContext?.http?.path || event.rawPath;
    const pathParameters = event.pathParameters;

    console.log('Request:', {
        method: httpMethod,
        path: path,
        origin: event.headers?.origin || event.headers?.Origin,
        headers: event.headers
    });

    // Handle CORS preflight requests
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        // Create a normalized event object for our handler functions
        const normalizedEvent: APIGatewayProxyEvent = {
            ...event,
            httpMethod: httpMethod,
            path: path,
            pathParameters: pathParameters
        } as APIGatewayProxyEvent;

        // NORMALIZE PATH - Remove stage prefix (/production or /dev)
        const normalizedPath = path.replace(/^\/(production|dev)/, '');
        console.log('Normalized path:', normalizedPath);

        // Route based on path and method
        if (normalizedPath === '/projects') {
            if (httpMethod === 'GET') {
                return listProjects(normalizedEvent);
            } else if (httpMethod === 'POST') {
                return saveProject(normalizedEvent);
            }
        } else if (path?.includes('/projects/')) {
            const pathParts = path.split('/');
            const projectId = pathParts[pathParts.length - 1];

            // Set the path parameters if not already set
            if (!normalizedEvent.pathParameters) {
                normalizedEvent.pathParameters = { id: projectId };
            }

            if (httpMethod === 'GET') {
                return getProject(normalizedEvent);
            } else if (httpMethod === 'PUT') {
                return saveProject(normalizedEvent);
            } else if (httpMethod === 'DELETE') {
                return deleteProject(normalizedEvent);
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