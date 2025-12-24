import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, of, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { GitHubAuthService } from '../github/github-auth.service';
import { LocalProject } from '../../common/data.model';

export interface CloudProject {
    id: string;
    key: string;
    name: string;
    owner: string;
    repo: string;
    pages: number;
    phase: string;
    timestamp: number;
    collaborators: Array<{
        githubId: string;
        login: string;
        name: string;
        avatarUrl: string;
    }>;
    content?: string; // Full project data (only when fetching specific project)
    isPublic: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class CloudStorageService {
    private http = inject(HttpClient);
    private authService = inject(GitHubAuthService);

    private readonly API_URL = `${environment.apiUrl}/projects`;

    // Signal for cloud projects
    private cloudProjects = signal<CloudProject[]>([]);
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
     * Load all public projects (no auth required)
     */
    async loadProjects(): Promise<void> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const projects = await firstValueFrom(
                this.http.get<CloudProject[]>(this.API_URL, {
                    headers: this.getHeaders()
                }).pipe(
                    catchError(error => {
                        console.error('Failed to load projects:', error);
                        this.error.set('Failed to load cloud projects');
                        return of([]);
                    })
                )
            );

            this.cloudProjects.set(projects);
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Get a specific project with full content
     */
    async getProject(projectId: string): Promise<CloudProject | null> {
        this.loading.set(true);
        this.error.set(null);

        try {
            const project = await firstValueFrom(
                this.http.get<CloudProject>(`${this.API_URL}/${projectId}`, {
                    headers: this.getHeaders()
                }).pipe(
                    catchError(error => {
                        console.error('Failed to get project:', error);
                        this.error.set('Failed to load project');
                        return of(null);
                    })
                )
            );

            return project;
        } finally {
            this.loading.set(false);
        }
    }

    /**
     * Save project to cloud (requires auth)
     */
    async saveProject(projectState: LocalProject, projectId?: string): Promise<string | null> {
        if (!this.authService.isAuthenticated()) {
            this.error.set('Authentication required to save projects');
            return null;
        }

        // Validate that we have a repository name
        if (!projectState.key) {
            this.error.set('Repository name is required. Please set up your GitHub repository first.');
            return null;
        }

        this.loading.set(true);
        this.error.set(null);

        try {
            // Count in-scope pages
            let pages = 0;
            const countPages = (nodes: any[]): void => {
                for (const node of nodes) {
                    if (node.data?.isUserAdded) pages++;
                    if (node.children?.length) countPages(node.children);
                }
            };
            if (projectState.pages) {
                //countPages(projectState.pages);
            }

            const payload = {
                id: projectId,
                key: projectState.key,
                name: projectState.key.replace(/-/g, ' ').replace(/^\w/, (c: string) => c.toUpperCase()),
                gitHubData: projectState.timestamp,
                pages,
                phase: 'Draft',
                isPublic: true,
                //...projectState  
            };

            console.log('Saving project payload:', payload);

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

            // Refresh project list
            await this.loadProjects();

            return response.id;
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
    canEdit(project: CloudProject): boolean {
        if (!this.authService.isAuthenticated()) return false;

        const user = this.authService.user();
        if (!user) return false;

        return project.collaborators.some(c => c.githubId === user.id.toString());
    }
}