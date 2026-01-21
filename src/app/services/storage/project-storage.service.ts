import { Injectable, inject, signal, computed } from '@angular/core';
import { CloudStorageService } from './cloud-storage.service';
import { LocalStorageService } from './local-storage.service';
import { Project, ProjectMetadata } from '../../common/data.model';
import { TreeNode } from 'primeng/api';

export interface ActiveProject {
    key: string;
    storageType: 'local' | 'cloud';
}

//Integrates local and cloud project storage and tracks which project is currently active
@Injectable({
    providedIn: 'root'
})
export class ProjectStorageService {
    //Services
    private cloudStorage = inject(CloudStorageService);
    private localStorage = inject(LocalStorageService);

    // Local storage keys
    private readonly ACTIVE_PROJECT_KEY = 'activeProject';
    private readonly SAVED_PROJECTS_KEY = 'savedProjects';
    public generateKeyFromName(projectName: string): string { // Generates a project key for saving to local or cloud storage
        if (!projectName || projectName.trim() === '') {
            return 'autosave';
        }
        return projectName.replace(/[:']/g, '').replace(/\s+/g, '-').toLowerCase();
    }

    // Signal for changes to project list
    public projectListVersion = signal<number>(0);
    public projectListChanged = computed(() => this.projectListVersion());

    /************************************
     ********** ACTIVE PROJECT **********
     ************************************/
    // Signal for current active project
    private activeProject = signal<ActiveProject | null>(this.getActiveProject());
    public currentActive = computed(() => this.activeProject());

    // Get active project key from local storage (used on initial app load)
    getActiveProject(): ActiveProject | null {
        const stored = this.localStorage.getData(this.ACTIVE_PROJECT_KEY);
        if (!stored) return null;

        try {
            const parsed = JSON.parse(stored);
            // Validate structure
            if (parsed.key && (parsed.storageType === 'local' || parsed.storageType === 'cloud')) {
                return parsed as ActiveProject;
            }
            return null;
        } catch (error) {
            console.error('Failed to parse active project:', error);
            return null;
        }
    }

    // Set active project (used when switching projects)
    setActiveProject(key: string, storageType: 'local' | 'cloud'): void {
        const activeProject: ActiveProject = { key, storageType };
        this.localStorage.saveData(this.ACTIVE_PROJECT_KEY, JSON.stringify(activeProject));
        this.activeProject.set(activeProject);
        console.log('Active project set:', activeProject);
    }

    // Clear active project (used when starting new project)
    clearActiveProject(): void {
        this.localStorage.removeData(this.ACTIVE_PROJECT_KEY);
        this.activeProject.set(null);
        console.log('Active project cleared');
    }

    // Tracks if active project exists (true unless working in autosave file)
    hasActiveProject(): boolean {
        return this.getActiveProject() !== null;
    }

    /************************************
     *********** SAVE PROJECT ***********
     ************************************/

    // Save to either local or cloud based on project.storageType (returns true if successful)
    async saveProject(project: Project): Promise<boolean> {
        try {
            const newKey = this.generateKeyFromName(project.projectName);
            const storageType = project.storageType;

            //Get old key (in case of project rename)
            const oldActiveProject = this.getActiveProject();
            const oldKey = oldActiveProject?.key;

            console.log(`Saving project "${newKey}" to ${storageType} storage...`);

            if (storageType === 'cloud') {
                // Save to cloud
                const success = await this.saveToCloud(project, newKey);
                if (!success) {
                    console.error('Cloud save failed');
                    return false;
                }
                this.setActiveProject(newKey, storageType);
            } else {
                // Save to local
                this.saveToLocal(project, newKey);
                // If key changed, delete the old one
                if (oldKey && oldKey !== newKey) {
                    console.log(`Key changed from "${oldKey}" to "${newKey}", deleting old key`);
                    this.deleteLocalProject(oldKey);
                }
                this.setActiveProject(newKey, storageType);
            }

            console.log(`Project "${newKey}" saved successfully to ${storageType}`);
            return true;

        } catch (error) {
            console.error('Failed to save project:', error);
            return false;
        }
    }

    // Save project to local storage
    private saveToLocal(project: Project, key: string): void {
        // Remove circular TreeNode references
        const projectToSave = this.prepareProjectForSave(project);

        console.group('=== SAVE TO LOCAL DEBUG ===');
        console.log('1. Storage Key:', key);
        console.log('2. Full Project Data:', JSON.stringify(projectToSave, null, 2));

        // Save to localStorage
        this.localStorage.saveData(key, JSON.stringify(projectToSave));

        // Update project list for local projects
        this.updateLocalProjectList(key, project);
        this.projectListVersion.update(v => v + 1);

        // After save, retrieve and log what's actually stored
        console.log('3. Retrieved from localStorage:', this.localStorage.getData(key));
        console.log('4. Active Project:', this.localStorage.getData(this.ACTIVE_PROJECT_KEY));
        console.log('5. All Saved Projects:', this.localStorage.getData(this.SAVED_PROJECTS_KEY));
        console.groupEnd();
    }

    // Save project to cloud storage (including the extra data that we save separately for local projcts for display purposes)
    private async saveToCloud(project: Project, key: string): Promise<boolean> {
        // Remove circular TreeNode references
        const projectToSave = this.prepareProjectForSave(project);

        // Add key & update storageLocation
        const updatedProject = {
            ...projectToSave,
            key: key,
            storageLocation: 'cloud' as const
        };

        // Save to cloud (returns cloud ID or null)
        const savedId = await this.cloudStorage.saveProject(updatedProject, project.id);
        if (savedId) {
            this.projectListVersion.update(v => v + 1);
        }
        return savedId !== null;

    }

    // Remove circular TreeNode references from project data
    public prepareProjectForSave(project: Project): Project {
        return {
            ...project,
            projectData: this.removeParents(project.projectData)
        };
    }

    // Remove circular TreeNode references from TreeNodes
    private removeParents(nodes: TreeNode[]): TreeNode[] {
        return nodes.map(node => {
            const { parent, ...rest } = node;
            return {
                ...rest,
                children: node.children ? this.removeParents(node.children) : []
            };
        });
    }

    // Update list of local projects in localStorage
    public updateLocalProjectList(key: string, project: Project): void {
        const savedProjects = JSON.parse(this.localStorage.getData('savedProjects') || '[]');
        const existingIndex = savedProjects.findIndex((p: any) => p.key === key);

        const projectEntry: ProjectMetadata = {
            id: project.id,
            key,
            projectName: project.projectName,
            phase: project.phase,
            inScopePages: project.inScopePages,
            baselinePages: project.baselinePages,
            lastModified: project.lastModified,
            storageType: 'local',
            collaborators: project.collaborators || [],
            github: project.github
        };

        if (existingIndex >= 0) {
            savedProjects[existingIndex] = projectEntry;
        } else {
            savedProjects.push(projectEntry);
        }

        // Sort by most recent
        savedProjects.sort((a: any, b: any) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

        this.localStorage.saveData('savedProjects', JSON.stringify(savedProjects));

        console.log('Project list updated:', savedProjects);
    }


    /************************************
     *********** LOAD PROJECTS **********
     ************************************/

    getProjectList(): ProjectMetadata[] {
        // Get local projects
        const localProjects = this.getLocalProjectList();

        // Get cloud projects
        const cloudProjects = this.cloudStorage.projects();

        // Combine and sort by timestamp (most recent first)
        return [...localProjects, ...cloudProjects]
            .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    }

    public getLocalProjectList(): ProjectMetadata[] {
        const saved = this.localStorage.getData('savedProjects');
        if (!saved) return [];

        try {
            const projects = JSON.parse(saved);
            // Convert timestamp back to Date object
            return projects.map((p: any) => ({
                ...p,
                lastModified: new Date(p.lastModified),
                storageType: 'local' as const
            }));
        } catch (error) {
            console.error('Failed to parse local projects:', error);
            return [];
        }
    }

    /************************************
    ********** SWITCH PROJECTS **********
    ************************************/

    // Gets project from local or cloud storage (caller will need to update project-state)
    async loadProject(key: string, storageType: 'local' | 'cloud'): Promise<Project | null> {
        console.log(`Loading project: ${key} from ${storageType}`);

        try {
            let project: Project | null = null;

            if (storageType === 'local') {
                project = await this.loadFromLocal(key);
            } else {
                project = await this.loadFromCloud(key);
            }

            if (!project) {
                console.error('Failed to load project');
                return null;
            }

            // Set as active project
            this.setActiveProject(key, storageType);

            console.log(`Project "${key}" loaded successfully`);
            return project;

        } catch (error) {
            console.error('Failed to load project:', error);
            return null;
        }
    }

    /**
     * Load project from local storage
     */
    private async loadFromLocal(key: string): Promise<Project | null> {
        const stored = this.localStorage.getData(key);
        if (!stored) {
            console.error(`No project found with key: ${key}`);
            return null;
        }

        try {
            const project = JSON.parse(stored);

            // Convert timestamps back to Date objects
            return {
                ...project,
                created: new Date(project.created),
                lastModified: new Date(project.lastModified),
                lastSaved: new Date(project.lastSaved),
                lastExported: new Date(project.lastExported),
                storageType: 'local' as const
            };
        } catch (error) {
            console.error('Failed to parse project:', error);
            return null;
        }
    }

    /**
     * Load project from cloud storage
     */
    private async loadFromCloud(projectId: string): Promise<Project | null> {
        const cloudProject = await this.cloudStorage.getProject(projectId);
        if (!cloudProject) return null;

        // CloudProject should already be in the correct format
        // Just ensure storageType is set correctly
        return {
            ...cloudProject,
            storageType: 'cloud' as const
        };
    }

    /************************************
    *********** DELETE PROJECT **********
    ************************************/

    /**
     * Delete a project from local or cloud storage
     */
    async deleteProject(key: string, storageType: 'local' | 'cloud'): Promise<boolean> {
        try {
            if (storageType === 'local') {
                const success = this.deleteLocalProject(key);
                if (success) {
                    this.projectListVersion.update(v => v + 1); // Notify that project list has changed
                }
                return success;
            } else {
                const success = await this.cloudStorage.deleteProject(key);
                if (success) {
                    this.projectListVersion.update(v => v + 1); // Notify that project list has changed
                }
                return success;
            }
        } catch (error) {
            console.error('Failed to delete project:', error);
            return false;
        }
    }

    /**
     * Delete a local project
     */
    private deleteLocalProject(key: string): boolean {
        // Remove project data
        this.localStorage.removeData(key);

        // Remove from savedProjects list
        const savedProjects = JSON.parse(this.localStorage.getData('savedProjects') || '[]');
        const updatedProjects = savedProjects.filter((p: any) => p.key !== key);
        this.localStorage.saveData('savedProjects', JSON.stringify(updatedProjects));

        console.log(`Local project "${key}" deleted`);
        return true;
    }

    /*******************************************
    *********** BACKGROUND OPERATIONS **********
    ********************************************/

    // Loads project data without setting it as active
    async loadProjectData(key: string, storageType: 'local' | 'cloud'): Promise<Project | null> {
        try {
            if (storageType === 'local') {
                return await this.loadFromLocal(key);
            } else {
                return await this.loadFromCloud(key);
            }
        } catch (error) {
            console.error(`Failed to load project data for ${key}:`, error);
            return null;
        }
    }

    /************************************
    *********** EXPORT PROJECT **********
    ************************************/


    /************************************
     ********** IMPORT PROJECT **********
     ************************************/


}