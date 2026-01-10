import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, of, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GitHubAuthService } from '../github/github-auth.service';
import { Project, ProjectMetadata } from '../../common/data.model';
import { TreeNode } from 'primeng/api';

@Injectable({
    providedIn: 'root'
})
export class CloudStorageService {
    private http = inject(HttpClient);
    private authService = inject(GitHubAuthService);;

    private readonly API_URL = `${environment.dynamodbFunctionUrl}/projects`;

    // Signal for cloud project metadata (for list view)
    private cloudProjects = signal<ProjectMetadata[]>([]);
    public projects = computed(() => this.cloudProjects());

    // Loading states
    private loading = signal(false);
    public isLoading = computed(() => this.loading());

    // Error state
    private error = signal<string | null>(null);
    public errorMessage = computed(() => this.error());

    /**
     * Get headers with optional auth token
     */
    private getHeaders(): HttpHeaders {
        const token = this.authService.getToken();
        let headers = new HttpHeaders({
            'Content-Type': 'application/json'
        });

        if (token) {
            headers = headers.set('Authorization', `Bearer ${token}`);
        }

        return headers;
    }

    /**
     * Load all public project metadata (without full projectData)
     * Used for displaying project lists
     */
    async loadProjects(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const projects = await firstValueFrom(
                this.http.get<ProjectMetadata[]>(this.API_URL, {
                    headers: this.getHeaders()
                }).pipe(
                    catchError(error => {
                        console.error('Failed to load projects:', error);
                        this.error.set('Failed to load cloud projects');
                        return of([]);
                    })
                )
            );

            // Convert timestamps back to Dates and ensure storageType is set
            const convertedProjects: ProjectMetadata[] = projects.map(p => ({
                ...p,
                lastModified: new Date(p.lastModified),
                storageType: 'cloud' as const
            }));

            this.cloudProjects.set(convertedProjects);
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Get a specific project with full content (including projectData)
     */
    async getProject(projectId: string): Promise<Project | null> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const project = await firstValueFrom(
                this.http.get<Project>(`${this.API_URL}/${projectId}`, {
                    headers: this.getHeaders()
                }).pipe(
                    catchError(error => {
                        console.error('Failed to get project:', error);
                        this.error.set('Failed to load project');
                        return of(null);
                    })
                )
            );

            if (!project) return null;

            // Convert timestamps back to Dates
            const convertedProject: Project = {
                ...project,
                created: new Date(project.created),
                lastModified: new Date(project.lastModified),
                lastSaved: new Date(project.lastSaved),
                lastExported: new Date(project.lastExported),
                storageType: 'cloud' as const
            };

            return convertedProject;
        } finally {
            this.loading.set(false);
        }
    }

    // Generates a project key for saving to local or cloud storage
    public generateKeyFromName(projectName: string): string {
        if (!projectName || projectName.trim() === '') {
            return 'autosave';
        }
        return projectName.replace(/[:']/g, '').replace(/\s+/g, '-').toLowerCase();
    }

    /**
     * Save project to cloud (requires auth)
     * @param project The full project to save
     * @param projectId Optional - provide for updates, omit for new projects
     * @returns The project ID if successful, null if failed
     */
    async saveProject(project: Project, projectId?: string): Promise<string | null> {
        if (!this.authService.isAuthenticated()) {
            this.error.set('Authentication required to save projects');
            return null;
        }

        // Validate that we have required fields
        if (!project.projectName && !project.github.repo) {
            this.error.set('Project name or repository name is required');
            return null;
        }

        this.loading.set(true);
        this.error.set(null);

        try {
            // Prepare the payload
            // Convert Date objects to timestamps for JSON serialization
            const payload = {
                id: project.id,
                key: this.generateKeyFromName(project.projectName),
                projectName: project.projectName,
                version: project.version,
                phase: project.phase,
                created: project.created instanceof Date ? project.created.getTime() : project.created,
                lastModified: project.lastModified instanceof Date ? project.lastModified.getTime() : project.lastModified,
                lastSaved: project.lastSaved instanceof Date ? project.lastSaved.getTime() : project.lastSaved,
                lastExported: project.lastExported instanceof Date ? project.lastExported.getTime() : project.lastExported,
                storageType: 'cloud' as const,
                collaborators: project.collaborators?.map(c => ({
                    githubId: c.id.toString(),
                    login: c.login,
                    name: c.name || c.login,
                    avatarUrl: c.avatar_url
                })),
                baselinePages: project.baselinePages,
                inScopePages: project.inScopePages,
                github: project.github,
                projectData: project.projectData // Full tree structure
            };

            console.log('Saving project to cloud:', payload.key);

            const url = projectId ? `${this.API_URL}/${projectId}` : this.API_URL;
            const method = projectId ? 'PUT' : 'POST';

            const response = await firstValueFrom(
                this.http.request<{ id: string; message: string }>(method, url, {
                    body: payload,
                    headers: this.getHeaders()
                }).pipe(
                    catchError(error => {
                        console.error('Failed to save project:', error);

                        // Extract error message from response
                        let errorMsg = 'Failed to save project to cloud';
                        if (error.error?.error) {
                            errorMsg = error.error.error;
                        }
                        if (error.error?.details) {
                            errorMsg += ': ' + error.error.details;
                        }

                        this.error.set(errorMsg);
                        throw error;
                    })
                )
            );

            // Refresh project list (without full projectData)
            await this.loadProjects();

            return response.id;
        } catch (error) {
            return null;
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Delete project from cloud (requires auth)
     */
    async deleteProject(projectId: string): Promise<boolean> {
        if (!this.authService.isAuthenticated()) {
            this.error.set('Authentication required to delete projects');
            return false;
        }

        this.loading.set(true);
        this.error.set(null);

        try {
            await firstValueFrom(
                this.http.delete(`${this.API_URL}/${projectId}`, {
                    headers: this.getHeaders()
                }).pipe(
                    catchError(error => {
                        console.error('Failed to delete project:', error);
                        this.error.set('Failed to delete project');
                        throw error;
                    })
                )
            );

            // Refresh project list
            await this.loadProjects();

            return true;
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Check if user can edit a project
     */
    canEdit(project: ProjectMetadata): boolean {
        if (!this.authService.isAuthenticated()) return false;

        const user = this.authService.user();
        if (!user) return false;

        return project.collaborators.some(c => c.id === user.id);
    }

}