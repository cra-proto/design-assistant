import { Injectable, inject } from '@angular/core';
import { GitHubUser } from '../common/data.model';
import { ProjectStorageService } from './storage/project-storage.service';
import { LocalStorageService } from './storage/local-storage.service';
import { ProjectMetadata } from '../common/data.model';

@Injectable({
    providedIn: 'root'
})
export class CollaboratorService {
    private projectStorage = inject(ProjectStorageService);
    private localStorage = inject(LocalStorageService);

    // Add current user to all local projects without collaborators 
    async addCurrentUserToLocalProjects(user: GitHubUser): Promise<void> {
        console.log('Adding current user to local projects as collaborator:', user.login);

        // Get list of all local projects
        const savedProjects = this.projectStorage.getLocalProjectList();

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

    //NOTE - avatars will always return images due to GitHub identicons
    //       we can add parameter s=40 to get a 40x40 image for custom images and default size identicons
    //       use that to strip out identicons and display initials instead or get rid of the functions below

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
}