import { Injectable, inject } from '@angular/core';
import { GitHubUser } from '../common/data.model';
import { ProjectStorageService } from './storage/project-storage.service';
import { LocalStorageService } from './storage/local-storage.service';
import { ProjectMetadata, Project } from '../common/data.model';
import { ExportGitHubService } from './github/export-github.service';

@Injectable({
    providedIn: 'root'
})
export class CollaboratorService {
    private projectStorage = inject(ProjectStorageService);
    private localStorage = inject(LocalStorageService);
    private exportGithub = inject(ExportGitHubService);

    // Check if current user is a collaborator
    canEditProject(project: ProjectMetadata | Project): boolean {
        const currentUser = this.exportGithub.user(); // OAuth or PAT
        if (!currentUser) return false;
        return project.collaborators.some(c => c.id === currentUser.id);
    }

    // Get current user to add to new projects
    getInitialCollaborators(): GitHubUser[] {
        const currentUser = this.exportGithub.user();
        return currentUser ? [currentUser] : [];
    }

    // Add current user to all local projects without collaborators 
    async addCurrentUserToLocalProjects(user: GitHubUser): Promise<void> {
        console.log('Adding current user to local projects as collaborator:', user.login);

        // Get list of all local projects
        const savedProjects = this.projectStorage.getLocalProjectList('saved');
        for (const metadata of savedProjects) {
            // Only process projects with empty collaborators
            if (!metadata.collaborators || metadata.collaborators.length === 0) {
                await this.addUserToProject(metadata.key, user);
            }
        }

        console.log('Finished adding user to local projects');
    }

    // Add current user to specific project
    private async addUserToProject(projectKey: string, user: GitHubUser): Promise<void> {
        try {
            // Load the full project
            const project = await this.projectStorage.loadProjectData(projectKey, 'local');

            if (!project) {
                console.warn(`Could not load project ${projectKey}`);
                return;
            }

            // Add user to collaborators
            project.collaborators = [user];
            project.lastModified = new Date();

            // Save back to localStorage
            const projectToSave = this.projectStorage.prepareProjectForSave(project); // Remove circular TreeNode references
            this.localStorage.saveData(projectKey, JSON.stringify(projectToSave)); // Save
            this.projectStorage.updateLocalProjectList(projectKey, project); // Update local storage list
            this.projectStorage.projectListVersion.update(v => v + 1); // Update signal

            console.log(`Added ${user.login} as collaborator to project ${projectKey}`);
        } catch (error) {
            console.error(`Failed to add user to project ${projectKey}:`, error);
        }
    }

    addCollaborators(project: Project, collabs: GitHubUser[]): Project {
        console.log(`Adding/updating ${collabs.length} collaborator(s) for project ${project.projectName}`);

        const updatedCollaborators = [...project.collaborators];
        let addedCount = 0;
        let updatedCount = 0;

        collabs.forEach(newCollab => {
            const existingIndex = updatedCollaborators.findIndex(existing => existing.id === newCollab.id);

            if (existingIndex !== -1) {
                // Update existing collaborator with fresh data
                updatedCollaborators[existingIndex] = newCollab;
                updatedCount++;
                console.log(`Updated collaborator: ${newCollab.login}`);
            } else {
                // Add new collaborator
                updatedCollaborators.push(newCollab);
                addedCount++;
                console.log(`Added new collaborator: ${newCollab.login}`);
            }
        });

        console.log(`Added ${addedCount}, updated ${updatedCount} collaborator(s)`);

        return {
            ...project,
            collaborators: updatedCollaborators,
            lastModified: new Date()
        };

    }

    removeCollaborator(project: Project, collab: GitHubUser): Project {
        console.log(`Removing ${collab.login} from project ${project.projectName}`);
        const originalCount = project.collaborators.length;
        const updatedCollaborators = project.collaborators = project.collaborators.filter(c => c.id !== collab.id);

        // Check if anything was actually removed
        if (updatedCollaborators.length === originalCount) {
            console.warn(`Collaborator ${collab.login} not found in project`);
            return project;
        }

        return {
            ...project,
            collaborators: updatedCollaborators,
            lastModified: new Date()
        };
    }

    //NOTE - avatars will always return images due to GitHub identicons
    //       we can add parameter s=40 to get a 40x40 image for custom images and default size identicons
    //       use that to strip out identicons and display initials instead or get rid of the functions below

    // Collaborator avatar - Get initials
    getCollaboratorName(collab: GitHubUser): string {
        return collab.name ? collab.name : collab.login
    }

    // Collaborator avatar - Get initials
    getCollaboratorInitials(collab: GitHubUser): string {
        if (collab.name) {
            const nameParts = collab.name.trim().split(/\s+/);
            if (nameParts.length >= 2) {
                // First and last initial
                return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
            } else {
                // Single name - use first 2 chars
                return collab.name.substring(0, 2).toUpperCase();
            }
        }
        // Fallback to login (first 2 chars)
        return collab.login.substring(0, 2).toUpperCase();
    }

    // Collaborator avatar - Assign colors to user ids (same user will always be same color)
    getCollaboratorColorClass(collab: GitHubUser): string {
        const colors = [
            'bg-primary text-white',
            'bg-blue-500 text-white',
            'bg-green-500 text-white',
            'bg-yellow-500 text-black-alpha-90',
            'bg-cyan-500 text-black-alpha-90',
            'bg-pink-500 text-white',
            'bg-indigo-500 text-white',
            'bg-teal-500 text-black-alpha-90',
            'bg-orange-500 text-black-alpha-90',
        ];

        return colors[collab.id % colors.length];
    }

    // Collaborator avatar - test users
    public testCollaborators: GitHubUser[] = [
        {
            login: 'amber',
            id: 12345,
            avatar_url: '',
            name: 'Amber L',
            email: 'amber@email.com'
        },
        {
            login: 'miguel',
            id: 67890,
            avatar_url: '',
            name: 'Miguel B',
            email: 'miguel@email.com'
        },
        {
            login: 'naomi',
            id: 24680,
            avatar_url: '',
            name: 'Naomi H',
            email: 'naomi@email.com'
        },
        {
            login: 'parissa',
            id: 13579,
            avatar_url: '',
            name: 'Parissa N',
            email: 'parissa@email.com'
        },
        {
            login: 'Rosa',
            id: 11111,
            avatar_url: '',
            name: 'Rosa Z',
            email: 'rosa@email.com'
        }
    ];

    // Get list of org members (for adding as collaborators)
    public async getOrgMembers(org: string): Promise<GitHubUser[]> {
        const token = this.exportGithub.token();

        if (!token) {
            console.warn('No GitHub token available');
            return [];
        }

        try {
            const response = await fetch(`https://api.github.com/orgs/${org}/members?per_page=100`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json'
                }
            });

            if (!response.ok) {
                console.error(`Failed to fetch org members: ${response.status}`);
                return [];
            }

            const members = await response.json();

            // Map to GitHubUser format (note: org members API returns limited info, name & email may be null)
            return members.map((member: GitHubUser) => ({
                login: member.login,
                id: member.id,
                avatar_url: member.avatar_url,
                name: member.name || null,
                email: member.email || null
            }));
        } catch (error) {
            console.error('Error fetching org members:', error);
            return [];
        }
    }

    // Get detailed user information
    public async getUserDetails(username: string): Promise<GitHubUser | null> {
        const token = this.exportGithub.token();

        if (!token) {
            console.warn('No GitHub token available');
            return null;
        }

        try {
            const response = await fetch(`https://api.github.com/users/${username}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/vnd.github+json'
                }
            });

            if (!response.ok) {
                console.error(`Failed to fetch user details for ${username}: ${response.status}`);
                return null;
            }

            const userData = await response.json();
            return {
                login: userData.login,
                id: userData.id,
                avatar_url: userData.avatar_url,
                name: userData.name || null,
                email: userData.email || null
            };
        } catch (error) {
            console.error(`Error fetching user details for ${username}:`, error);
            return null;
        }
    }

    // Get collaborator emails (for requesting access)
    getCollaboratorEmails(collabs: GitHubUser[]): (string | null)[] {
        return collabs
            .filter(collab => collab.email && collab.email.trim() !== '')
            .map(collab => collab.email) || [];
    }
}