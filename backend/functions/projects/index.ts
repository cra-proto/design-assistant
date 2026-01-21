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
    version: string;
    projectName: string;
    created: number;
    lastModified: number;
    lastSaved: number;
    lastExported: number;
    phase: string;
    inScopePages: number;
    baselinePages: number;
    collaborators: Array<{
        id: number;
        login: string;
        name: string;
        avatar_url: string;
        email: string | null;
    }>;
    github: {
        owner: string;
        repo: string;
        branch: string;
        hasBaselineRepo: boolean;
    };
    storageType: string;
    content: string; // JSON stringified projectData TreeNode[] (if filesize becomes an issue, replace with reference to S3 bucket)
}

// Function to get CORS headers based on request origin
function getCorsHeaders(): Record<string, string> {
    return {
        'Content-Type': 'application/json',
    };
}

// Get user info from GitHub token (user must be in collaborator list for save/delete functions)
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
    const corsHeaders = getCorsHeaders();

    try {
        console.log('Listing projects from table:', TABLE_NAME);

        // Scan for all public projects
        const result = await docClient.send(new ScanCommand({
            TableName: TABLE_NAME,
            ProjectionExpression: 'id, #k, projectName, lastModified, phase, inScopePages, collaborators, github',
            ExpressionAttributeNames: {
                '#k': 'key',
            }
        }));

        console.log('Found projects:', result.Items?.length || 0);

        // Transform to match ProjectMetadata interface
        const projects = result.Items?.map(item => ({
            id: item.id,
            key: item.key,
            projectName: item.projectName,
            lastModified: item.lastModified,
            phase: item.phase,
            inScopePages: item.inScopePages,
            collaborators: item.collaborators || [],
            github: item.github,
            storageType: 'cloud',
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

// Get a specific project (no auth required)
export const getProject = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const corsHeaders = getCorsHeaders();

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
    const corsHeaders = getCorsHeaders();

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
            version: projectData.version,
            projectName: projectData.projectName,
            created: projectData.created,
            lastModified: projectData.lastModified,
            lastSaved: now,
            lastExported: projectData.lastExported,
            phase: projectData.phase,
            inScopePages: projectData.inScopePages,
            baselinePages: projectData.baselinePages,
            collaborators: projectData.collaborators?.map((c: any) => ({
                id: c.id,
                login: c.login,
                name: c.name || c.login,
                avatar_url: c.avatar_url,
                email: c.email || null
            })) || [],
            github: projectData.github,
            storageType: 'cloud',
            content: JSON.stringify(projectData), // Store the entire project state
        };

        console.log('Project to save:', JSON.stringify(project, null, 2));
        console.log('Project to save:', {
            id: project.id,
            key: project.key,
            projectName: project.projectName,
            inScopePages: project.inScopePages,
            collaborators: project.collaborators,
            github: project.github
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
                    (c: any) => c.id === user.id
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
                project.created = existing.Item.created;
            } else {
                // NEW PROJECT (add user to collaborators if missing so they have permission to edit this new file)
                console.log('New project - checking if user is in incoming collaborators list');
                const hasCurrentUser = project.collaborators.some(
                    (c: any) => c.id === user.id
                );

                if (!hasCurrentUser) {
                    console.log('User not in collaborators, adding them');
                    project.collaborators.push({
                        id: user.id,
                        login: user.login,
                        name: user.name || user.login,
                        avatar_url: user.avatar_url,
                        email: user.email || null
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
    const corsHeaders = getCorsHeaders();

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
            (c: any) => c.id === user.id
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
    const corsHeaders = getCorsHeaders();

    const httpMethod = event.requestContext?.http?.method || event.httpMethod;
    const path = event.requestContext?.http?.path || event.rawPath || event.path;

    console.log('Request:', {
        method: httpMethod,
        path: path
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
        // Route based on path and method
        if (path === '/projects') {
            if (httpMethod === 'GET') {
                return listProjects(event);
            } else if (httpMethod === 'POST') {
                return saveProject(event);
            }
        } else if (path?.startsWith('/projects/')) {
            const projectId = path.split('/').pop();

            // Ensure pathParameters exists
            if (!event.pathParameters) {
                event.pathParameters = { id: projectId };
            }

            if (httpMethod === 'GET') {
                return getProject(event);
            } else if (httpMethod === 'PUT') {
                return saveProject(event);
            } else if (httpMethod === 'DELETE') {
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