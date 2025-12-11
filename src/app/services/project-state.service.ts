import { Injectable, signal, computed, inject } from '@angular/core';
import { Project, ProjectPhase, CurrentPhase, PageMeta, PageStatus, GitHubRepo, GitHubUser } from '../common/data.model';
import { TreeNode } from 'primeng/api';
import { environment } from '../../environments/environment';
import { FileUploadHandlerEvent } from 'primeng/fileupload';

import { CloudStorageService } from '../services/cloud-storage.service';


export interface ProjectTreeNodeData extends PageMeta, PageStatus { }

export interface SavedProject {
    key: string;
    timestamp: number;
    pages: number;
    phase: ProjectPhase;
    local: boolean;
}

/*
Should contain:

Private signal/observable holding current Project object
Public readonly signals for components to consume
Methods to update project data
Methods to add/remove/modify tree nodes
Methods to mark pages for editing
Computed signals for stats (page counts, problem counts, etc.)
NO persistence logic (that goes elsewhere)*/




@Injectable({
    providedIn: 'root'
})
export class ProjectStateService {
    private cloudStorage = inject(CloudStorageService);

    // Main project state
    private project = signal<Project>({
        id: this.generateId(),
        version: 1.0,
        projectName: '',
        phase: ProjectPhase.Draft,
        created: new Date(),
        lastModified: new Date(),
        storageLocation: 'browser',
        collaborators: [],
        baselinePages: 0,
        inScopePages: 0,
        github: {
            owner: 'cra-design',
            repo: '',
            branch: 'main',
            hasBaselineRepo: false
        },
        projectData: []
    });

    getProject = computed(() => this.project());

    // Helper to generate unique project ID
    private generateId(): string {
        return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Update project metadata
    setProjectName(name: string) {
        this.project.update(curr => ({
            ...curr,
            projectName: name,
            lastModified: new Date()
        }));
    }

    setProjectPhase(phase: ProjectPhase) {
        this.project.update(curr => ({
            ...curr,
            phase: phase,
            lastModified: new Date()
        }));
    }

    setGitHubRepo(gitHubData: Partial<GitHubRepo>) {
        this.project.update(curr => ({
            ...curr,
            github: { ...curr.github, ...gitHubData },
            lastModified: new Date()
        }));
    }

    setCollaborators(collaborators: GitHubUser[]) {
        this.project.update(curr => ({
            ...curr,
            collaborators,
            lastModified: new Date()
        }));
    }

    setStorageLocation(location: 'browser' | 'cloud') {
        this.project.update(curr => ({
            ...curr,
            storageLocation: location,
            lastModified: new Date()
        }));
    }

    // Get project tree
    getProjectTree = computed(() => this.project().projectData);

    setProjectTree(tree: TreeNode<ProjectTreeNodeData>[]) {
        this.project.update(curr => ({
            ...curr,
            projectData: tree,
            lastModified: new Date()
        }));
    }

    // Cloud project tracking
    private cloudProjectId = signal<string | null>(null);
    getCloudProjectId = computed(() => this.cloudProjectId());
    setCloudProjectId(id: string | null) {
        this.cloudProjectId.set(id);
    }

    // Count in-scope pages
    countInScopePages(): number {
        let count = 0;
        const traverse = (nodes: TreeNode<ProjectTreeNodeData>[]) => {
            for (const node of nodes) {
                if (node.data?.inScope) count++;
                if (node.children?.length) traverse(node.children);
            }
        };
        traverse(this.project().projectData);
        return count;
    }

    // Check if URL already exists in tree
    urlExists(url: string): boolean {
        const search = (nodes: TreeNode<ProjectTreeNodeData>[]): boolean => {
            for (const node of nodes) {
                if (node.data?.url === url) return true;
                if (node.children?.length && search(node.children)) return true;
            }
            return false;
        };
        return search(this.project().projectData);
    }

    // Get all URLs in tree (for duplicate checking)
    getAllUrls(): Set<string> {
        const urls = new Set<string>();
        const traverse = (nodes: TreeNode<ProjectTreeNodeData>[]) => {
            for (const node of nodes) {
                if (node.data?.url) urls.add(node.data.url);
                if (node.children?.length) traverse(node.children);
            }
        };
        traverse(this.project().projectData);
        return urls;
    }

    // Merge new pages into existing tree
    mergePages(newPages: TreeNode<ProjectTreeNodeData>[]) {
        const currentTree = this.project().projectData;
        const merged = this.mergeTreeNodes(currentTree, newPages);
        this.project.update(curr => ({
            ...curr,
            projectData: merged,
            lastModified: new Date()
        }));
    }

    // Recursive merge helper
    private mergeTreeNodes(
        current: TreeNode<ProjectTreeNodeData>[],
        incoming: TreeNode<ProjectTreeNodeData>[]
    ): TreeNode<ProjectTreeNodeData>[] {
        const map = new Map<string, TreeNode<ProjectTreeNodeData>>();

        // Add current nodes to map
        for (const node of current) {
            if (node.data?.url) {
                map.set(node.data.url, node);
            }
        }

        // Merge incoming nodes
        for (const node of incoming) {
            const url = node.data?.url;
            if (!url) continue;

            if (!map.has(url)) {
                // New node, add it
                map.set(url, node);
            } else {
                // Node exists, merge children and update if user added
                const existing = map.get(url)!;

                // If incoming is in-scope but existing wasn't, update it
                if (node.data?.inScope && !existing.data?.inScope) {
                    existing.data = { ...existing.data, ...node.data };
                }

                // Merge children
                if (node.children?.length) {
                    existing.children = this.mergeTreeNodes(
                        existing.children || [],
                        node.children
                    );
                }
            }
        }

        return Array.from(map.values());
    }

    // Get project state for saving (with circular references removed)
    getProjectState(): Project {
        const currentProject = this.project();
        return {
            ...currentProject,
            projectData: this.removeParents(currentProject.projectData)
        };
    }

    // Remove circular parent references for serialization
    private removeParents(nodes: TreeNode<ProjectTreeNodeData>[]): TreeNode<ProjectTreeNodeData>[] {
        return nodes.map(node => {
            const { parent, ...rest } = node;
            return {
                ...rest,
                children: node.children ? this.removeParents(node.children) : []
            };
        });
    }

    // Update project list in localStorage
    private updateProjectList(key: string) {
        const savedProjects: SavedProject[] = JSON.parse(localStorage.getItem('savedProjects') || '[]');
        const existingIndex = savedProjects.findIndex(p => p.key === key);
        const proj = this.project();
        const timestamp = proj.lastModified.getTime();
        const pages = this.countInScopePages();
        const local = proj.storageLocation === 'browser';
        const phase = proj.phase;

        if (existingIndex >= 0) {
            savedProjects[existingIndex].timestamp = timestamp;
            savedProjects[existingIndex].pages = pages;
            savedProjects[existingIndex].phase = phase;
            savedProjects[existingIndex].local = local;
        } else {
            savedProjects.push({ key, timestamp, pages, local, phase });
        }

        savedProjects.sort((a, b) => b.timestamp - a.timestamp);
        localStorage.setItem('savedProjects', JSON.stringify(savedProjects));

        console.groupCollapsed('Project list saved to localStorage');
        console.table(savedProjects.map(p => ({
            project: p.key,
            pages: p.pages,
            phase: p.phase,
            modified: new Date(p.timestamp).toLocaleString()
        })));
        console.groupEnd();
    }

    // Save to localStorage
    saveToLocalStorage() {
        const project = this.getProjectState();
        const key = project.github.repo || project.projectName || project.id;

        localStorage.setItem(key, JSON.stringify(project));
        this.updateProjectList(key);

        console.groupCollapsed('Project saved to localStorage');
        console.log('Key:', key);
        console.log('Project name:', project.projectName);
        console.log('Phase:', project.phase);
        console.log('Tree nodes:', project.projectData.length);
        console.log('In-scope pages:', this.countInScopePages());
        console.groupEnd();
    }

    // Load from localStorage
    loadFromLocalStorage(projectKey?: string): boolean {
        let key = projectKey;

        // If no key provided, load most recent project
        if (!key) {
            const projects: SavedProject[] = JSON.parse(localStorage.getItem('savedProjects') || '[]');
            if (projects.length === 0) {
                console.warn('No projects found in localStorage');
                return false;
            }
            key = projects[0].key;
        }

        const saved = localStorage.getItem(key);
        if (!saved) {
            console.warn(`No project found for key: ${key}`);
            return false;
        }

        try {
            const project: Project = JSON.parse(saved);

            // Version check
            if (project.version !== 1.0) {
                console.warn('Incompatible project version. Load skipped.');
                return false;
            }

            // Convert date strings back to Date objects
            project.created = new Date(project.created);
            project.lastModified = new Date(project.lastModified);

            this.project.set(project);

            console.log('Project loaded from localStorage:', key);
            return true;
        } catch (error) {
            console.error('Failed to load project from localStorage:', error);
            return false;
        }
    }

    // Export as JSON
    exportProjectAsJson() {
        const project = this.getProjectState();
        const data = JSON.stringify(project, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const filename = project.github.repo || project.projectName || project.id;
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    // Import from JSON
    importProjectFromJson(jsonString: string): boolean {
        try {
            const project: Project = JSON.parse(jsonString);

            if (project.version !== 1.0) {
                console.warn('Incompatible project version. Import skipped.');
                return false;
            }

            // Convert date strings back to Date objects
            project.created = new Date(project.created);
            project.lastModified = new Date(project.lastModified);

            this.project.set(project);
            this.saveToLocalStorage();

            console.log('Project imported successfully');
            return true;
        } catch (error) {
            console.error('Failed to import project:', error);
            return false;
        }
    }

    /* Save to cloud
    async saveToCloud(): Promise<boolean> {
        try {
            const project = this.getProjectState();
            const projectId = this.cloudProjectId() || undefined;

            const savedId = await this.cloudStorage.saveProject(project, projectId);

            if (savedId) {
                this.cloudProjectId.set(savedId);
                this.setStorageLocation('cloud');
                console.log('Project saved to cloud with ID:', savedId);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to save to cloud:', error);
            return false;
        }
    }*/

    // Load from cloud
    async loadFromCloud(projectId: string): Promise<boolean> {
        try {
            const cloudProject = await this.cloudStorage.getProject(projectId);

            if (!cloudProject || !cloudProject.content) {
                console.error('Project not found or has no content');
                return false;
            }

            const project: Project = JSON.parse(cloudProject.content);

            if (project.version !== 1.0) {
                console.warn('Incompatible project version. Load skipped.');
                return false;
            }

            // Convert date strings back to Date objects
            project.created = new Date(project.created);
            project.lastModified = new Date(project.lastModified);
            project.storageLocation = 'cloud';

            this.project.set(project);
            this.cloudProjectId.set(projectId);
            this.saveToLocalStorage();

            console.log('Project loaded from cloud:', projectId);
            return true;
        } catch (error) {
            console.error('Failed to load from cloud:', error);
            return false;
        }
    }

    // Reset project
    resetProject() {
        this.project.set({
            id: this.generateId(),
            version: 1.0,
            projectName: '',
            phase: ProjectPhase.Draft,
            created: new Date(),
            lastModified: new Date(),
            storageLocation: 'browser',
            collaborators: [],
            baselinePages: 0,
            inScopePages: 0,
            github: {
                owner: '',
                repo: '',
                branch: 'main',
                hasBaselineRepo: false
            },
            projectData: []
        });
        this.cloudProjectId.set(null);
        console.log('Project reset');
    }

    // Export tree as CSV
    exportTreeAsCsv() {
        const tree = this.project().projectData;
        const rows: string[] = [];

        // Headers
        rows.push([
            'Page Title (h1)',
            'URL',
            'Opposite Language URL',
            'In Scope',
            'Is Orphan',
            'Is Crawled',
            'Is New',
            'Is Moved',
            'Is ROT',
            'Is Container',
            'Baseline Parent URL'
        ].join(','));

        const walk = (nodes: TreeNode<ProjectTreeNodeData>[], parentUrl: string | null = null) => {
            for (const node of nodes) {
                const data = node.data;
                if (!data) continue;

                rows.push([
                    `"${data.h1 || ''}"`,
                    data.url || '',
                    data.oppUrl || '',
                    data.inScope ? 'Yes' : 'No',
                    data.isOrphan ? 'Yes' : 'No',
                    data.isCrawled ? 'Yes' : 'No',
                    data.isNew ? 'Yes' : 'No',
                    data.isMoved ? 'Yes' : 'No',
                    data.isROT ? 'Yes' : 'No',
                    data.isContainer ? 'Yes' : 'No',
                    data.baselineParent || ''
                ].join(','));

                if (node.children?.length) {
                    walk(node.children, data.url);
                }
            }
        };

        walk(tree);

        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const proj = this.project();
        const filename = proj.github.repo || proj.projectName || proj.id;
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}-tree.csv`;
        a.click();

        URL.revokeObjectURL(url);
    }

    // Generate prototype URL from production URL
    generatePrototypeUrl(productionUrl: string, type: 'current' | 'baseline' = 'current'): string {
        const { owner, repo } = this.project().github;

        if (!owner || !repo) {
            return '';
        }

        try {
            const url = new URL(productionUrl);
            const path = url.pathname; // e.g., /en/revenue-agency/services/tax/individuals.html

            const repoSuffix = type === 'baseline' ? `${repo}-baseline` : repo;
            const prototypeUrl = `https://${owner}.github.io/${repoSuffix}${path}`;

            return prototypeUrl;
        } catch (error) {
            console.error('Failed to generate prototype URL:', error);
            return '';
        }
    }
}