import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Project, ProjectMetadata, ProjectPhase, CurrentPhase, PageMeta, PageStatus, GitHubRepo, GitHubUser, ProjectTreeNodeData, FlattenedTreeNode, TableColumn } from '../common/data.model';
import { TreeNode } from 'primeng/api';
import { environment } from '../../environments/environment';
import { FileUploadHandlerEvent } from 'primeng/fileupload';

import { ProjectStorageService } from '../services/storage/project-storage.service';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/*
Should contain:

Private signal/observable holding current Project object
Public readonly signals for components to consume
Methods to update project data
Methods to add/remove/modify tree nodes
Methods to mark pages for editing
Computed signals for stats (page counts, problem counts, etc.)
Auto-save effect with debouncing
NO persistence logic (that goes to ProjectStorageService)*/

@Injectable({
    providedIn: 'root'
})
export class ProjectStateService {
    private projectStorage = inject(ProjectStorageService);

    // Main project state
    private project = signal<Project>({
        id: this.generateId(),
        key: '',
        version: 1.0,
        projectName: '',
        phase: ProjectPhase.Draft,
        created: new Date(),
        lastModified: new Date(),
        lastSaved: new Date(),
        lastExported: new Date(),
        storageType: 'local',
        collaborators: [],
        baselinePages: 0,
        inScopePages: 0,
        github: {
            owner: environment.defaultOrg,
            repo: '',
            branch: 'main',
            hasBaselineRepo: false
        },
        projectData: []
    });

    getProject = computed(() => this.project());

    // Track save status
    private saveStatus = signal<SaveStatus>('saved');
    public getSaveStatus = computed(() => this.saveStatus());

    // Set autosave delay
    private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
    private readonly AUTO_SAVE_DELAY = 10000; // 30 seconds
    private readonly MAX_UNSAVED_DURATION = 5 * 60 * 1000 // 5 minutes

    constructor() {
        // Autosave after a delay if there are changes
        effect(() => {
            const currentProject = this.project();
            const hasChanges = currentProject.lastModified > currentProject.lastSaved;
            if (hasChanges) {
                this.saveStatus.set('unsaved');
                // Calculate time since last save and save if exceeding the limit
                const timeSinceLastSave = currentProject.lastModified.getTime() - currentProject.lastSaved.getTime();
                const shouldForceSave = timeSinceLastSave >= this.MAX_UNSAVED_DURATION;
                if (shouldForceSave) {
                    this.saveProject();
                    return;
                }
                // Save after short delay (resets on each change)
                if (this.autoSaveTimer) {
                    clearTimeout(this.autoSaveTimer);
                }
                this.autoSaveTimer = setTimeout(() => {
                    this.saveProject();
                }, this.AUTO_SAVE_DELAY);
            }
        });
    }

    // Helper to generate unique project ID
    private generateId(): string {
        return `project_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    // Set entire project
    setProject(project: Project) {
        console.log('Setting project:', project.projectName);
        console.log('lastModified:', project.lastModified);
        console.log('lastSaved:', project.lastSaved);
        console.log('Are they equal?', project.lastModified.getTime() === project.lastSaved.getTime());
        const diff = project.lastSaved.getTime() - project.lastModified.getTime();
        console.log('Difference:', diff),

            this.project.set(project);
        console.log('Project set successfully');
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

    setStorageLocation(location: 'local' | 'cloud') {
        this.project.update(curr => ({
            ...curr,
            storageLocation: location,
            lastModified: new Date()
        }));
    }

    // Get project tree
    getProjectTree = computed(() => this.project().projectData);

    setProjectTree(tree: TreeNode<ProjectTreeNodeData>[]) {
        const baselineCount = this.countPages('baseline')
        const inScopeCount = this.countPages('inScope')
        this.project.update(curr => ({
            ...curr,
            baselinePages: baselineCount,
            inScopePages: inScopeCount,
            projectData: tree,
            lastModified: new Date()
        }));
    }

    // Count pages
    private countPages(mode: 'inScope' | 'baseline' = 'inScope'): number {
        let count = 0;
        const traverse = (nodes: TreeNode<ProjectTreeNodeData>[]) => {
            for (const node of nodes) {
                if (mode === 'inScope' && node.data?.status.inScope) count++;
                else if (mode === 'baseline') { count++ }
                if (node.children?.length) traverse(node.children);
            }
        };
        traverse(this.project().projectData);
        return count;
    }

    setScope(urls: string[]): void {
        const currentTree = this.project().projectData;
        const traverse = (nodes: TreeNode<ProjectTreeNodeData>[]) => {
            for (const node of nodes) {
                if (node.data?.url && urls.includes(node.data.url)) {
                    node.data.status.inScope = true;
                }
                if (node.children?.length) traverse(node.children);
            }
        };
        traverse(this.project().projectData);
        this.setProjectTree(currentTree);
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
    getAllUrls(mode: 'all' | 'inScope' = 'all'): Set<string> {
        const urls = new Set<string>();
        const traverse = (nodes: TreeNode<ProjectTreeNodeData>[]) => {
            for (const node of nodes) {
                if (mode === 'inScope' && node.data?.url && node.data?.status.inScope) urls.add(node.data.url)
                else if (mode === 'all' && node.data?.url) urls.add(node.data.url);
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
                if (node.data?.status.inScope && !existing.data?.status.inScope) {
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

    //TreeNode lookup
    findNodeByUrl(nodes: TreeNode[], url: string): TreeNode | null {
        for (const node of nodes) {
            if (node.data?.url === url) {
                return node;
            }
            if (node.children) {
                const found = this.findNodeByUrl(node.children, url);
                if (found) return found;
            }
        }
        return null;
    }

    // Get project state for saving (with circular references removed)
    getProjectToSave(): Project {
        const currentProject = this.project();
        return {
            ...currentProject,
            projectData: this.removeParents(currentProject.projectData)
        };
    }

    /**
     * Save project (manual or auto-save)
     * Cancels any pending auto-save timer
     */
    async saveProject(): Promise<boolean> {
        // Cancel pending auto-save
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }

        // Update status to saving
        this.saveStatus.set('saving');

        // Store the current lastSaved in case we need to rollback
        const previousLastSaved = this.project().lastSaved;

        try {
            // Update lastSaved
            this.project.update(curr => ({
                ...curr,
                lastSaved: new Date()
            }));

            const project = this.project();
            const success = await this.projectStorage.saveProject(project);

            if (success) {
                // Wait 2 seconds before showing "saved" status
                await new Promise(resolve => setTimeout(resolve, 2000));
                this.saveStatus.set('saved');
                console.log('Project saved successfully');
                return true;
            } else {
                // Rollback lastSaved on failure
                this.project.update(curr => ({
                    ...curr,
                    lastSaved: previousLastSaved
                }));
                this.saveStatus.set('error');
                console.error('Failed to save project');
                return false;
            }
        } catch (error) {
            // Rollback lastSaved on error
            this.project.update(curr => ({
                ...curr,
                lastSaved: previousLastSaved
            }));
            this.saveStatus.set('error');
            console.error('Error saving project:', error);
            return false;
        }
    }

    /**
     * Check if there are unsaved changes
     */
    hasUnsavedChanges(): boolean {
        const project = this.project();
        return project.lastModified > project.lastSaved;
    }

    /**
     * Save if there are unsaved changes (used before project switch or app close)
     */
    async saveIfNeeded(): Promise<boolean> {
        if (this.hasUnsavedChanges()) {
            return await this.saveProject();
        }
        return true; // No save needed
    }


    // Load from localStorage
    loadFromLocalStorage(projectKey?: string): boolean {
        let key = projectKey;

        // If no key provided, load most recent project
        if (!key) {
            const projects: ProjectMetadata[] = JSON.parse(localStorage.getItem('savedProjects') || '[]');
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
            project.lastSaved = new Date(project.lastSaved);
            project.lastExported = new Date(project.lastExported);

            this.project.set(project);
            this.saveStatus.set('saved'); // Just loaded, no changes yet

            console.log('Project loaded from localStorage:', key);
            return true;
        } catch (error) {
            console.error('Failed to load project from localStorage:', error);
            return false;
        }
    }

    // Export as JSON
    exportProjectAsJson() {
        const project = this.getProjectToSave();
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
            project.lastSaved = new Date(project.lastSaved);
            project.lastExported = new Date(project.lastExported);

            this.project.set(project);
            this.saveProject(); // Auto-save imported project

            console.log('Project imported successfully');
            return true;
        } catch (error) {
            console.error('Failed to import project:', error);
            return false;
        }
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


    // Reset project
    resetProject() {
        // Save current project if needed before resetting
        this.saveIfNeeded();

        this.project.set({
            id: this.generateId(),
            key: 'autosave',
            version: 1.0,
            projectName: '',
            phase: ProjectPhase.Draft,
            created: new Date(),
            lastModified: new Date(),
            lastSaved: new Date(),
            lastExported: new Date(),
            storageType: 'local',
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

        this.saveStatus.set('saved');
        console.log('Project reset');
    }


    flattenTree(): FlattenedTreeNode[] {
        const tree = this.project().projectData;
        const flatNodes: FlattenedTreeNode[] = [];

        const walk = (nodes: TreeNode<ProjectTreeNodeData>[]) => {
            for (const node of nodes) {
                const data = node.data;
                if (!data) continue;
                flatNodes.push({
                    //Current language
                    h1: data.h1 || '',
                    url: data.url || '',
                    //Opposite language
                    oppTitle: data.metadata?.oppTitle || '',
                    oppUrl: data.metadata?.oppUrl || '',
                    //Github
                    prototypeUrl: this.generatePrototypeUrl(data.url) || '',
                    //Status
                    inScope: data.status.inScope,
                    isOrphan: data.status.isOrphan,
                    isNew: data.status.isNew,
                    isMoved: data.status.isMoved,
                    isROT: data.status.isROT,
                    //Data
                    template: data.metadata?.template || '',
                    task: data.metadata?.task || '',
                    visits: data.metadata?.visits || 0,
                    //Owner
                    owner: data.metadata?.owner || '',
                    email: data.metadata?.email || '',
                    //Metadata
                    title: data.metadata?.title || '',
                    description: data.metadata?.description || '',
                    keywords: data.metadata?.keywords || '',
                });

                if (node.children?.length) {
                    walk(node.children);
                }
            }
        };

        walk(tree);
        return flatNodes;
    }

    getTreeTableColumns(): TableColumn[] {
        return [
            //Current Language
            { field: 'h1', translationKey: 'inventory.header.h1', type: 'text', frozen: true, group: 'page', visibleByDefault: true },
            { field: 'url', translationKey: 'inventory.header.url', type: 'url', group: 'page', visibleByDefault: true },
            //Opposite Language
            { field: 'oppTitle', translationKey: 'inventory.header.oppTitle', type: 'text', group: 'oppPage', visibleByDefault: false },
            { field: 'oppUrl', translationKey: 'inventory.header.oppUrl', type: 'url', group: 'oppPage', visibleByDefault: false },
            //GitHub
            { field: 'prototypeUrl', translationKey: 'inventory.header.prototypeUrl', type: 'url', group: 'github', visibleByDefault: false },
            //Status
            { field: 'inScope', translationKey: 'inventory.header.inScope', type: 'boolean', group: 'status', visibleByDefault: true },
            { field: 'isOrphan', translationKey: 'inventory.header.isOrphan', type: 'boolean', group: 'status', visibleByDefault: true },
            { field: 'isNew', translationKey: 'inventory.header.isNew', type: 'boolean', group: 'status', visibleByDefault: true },
            { field: 'isMoved', translationKey: 'inventory.header.isMoved', type: 'boolean', group: 'status', visibleByDefault: true },
            { field: 'isROT', translationKey: 'inventory.header.isROT', type: 'boolean', group: 'status', visibleByDefault: true },
            //Owner
            { field: 'owner', translationKey: 'inventory.header.owner', type: 'text', group: 'owner', visibleByDefault: true },
            { field: 'email', translationKey: 'inventory.header.email', type: 'text', group: 'owner', visibleByDefault: false },
            //Data
            { field: 'template', translationKey: 'inventory.header.template', type: 'text', group: 'pageData', visibleByDefault: true },
            { field: 'task', translationKey: 'inventory.header.task', type: 'text', group: 'pageData', visibleByDefault: true },
            { field: 'visits', translationKey: 'inventory.header.visits', type: 'text', group: 'pageData', visibleByDefault: true },
            //Metadata
            { field: 'title', translationKey: 'inventory.header.title', type: 'text', group: 'metadata', visibleByDefault: false },
            { field: 'description', translationKey: 'inventory.header.description', type: 'longText', group: 'metadata', visibleByDefault: false },
            { field: 'keywords', translationKey: 'inventory.header.keywords', type: 'longText', group: 'metadata', visibleByDefault: false },
        ];
    }

    exportTreeAsCsv() {
        const tree = this.project().projectData;
        const rows: string[] = [];

        // Headers
        rows.push([
            //Current language
            'Page Title (h1)',
            'URL',
            //Opposite language
            'Opposite Language Title',
            'Opposite Language URL',
            //GitHub
            'Prototype Url',
            //Status
            'In Scope',
            'Is Orphan',
            'Is New',
            'Is Moved',
            'Is ROT',
            //Owner
            'Owner',
            'Email',
            //Data
            'Template',
            'Task',
            'Visits (last 52 weeks)',
            //Metadata
            'Title',
            'Description',
            'Keywords',
            //Move info
            'Original Parent URL',
        ].join(','));

        const walk = (nodes: TreeNode<ProjectTreeNodeData>[], parentUrl: string | null = null) => {
            for (const node of nodes) {
                const data = node.data;
                if (!data) continue;

                rows.push([
                    //Current language
                    `"${data.h1 || ''}"`,
                    data.url || '',
                    //Opposite language
                    `"${data.metadata?.oppTitle || ''}"`,
                    data.metadata?.oppUrl || '',
                    //GitHub
                    this.generatePrototypeUrl(data.url),
                    //Status
                    data.status.inScope ? 'Yes' : 'No',
                    data.status.isOrphan ? 'Yes' : 'No',
                    data.status.isNew ? 'Yes' : 'No',
                    data.status.isMoved ? 'Yes' : 'No',
                    data.status.isROT ? 'Yes' : 'No',
                    //Owner
                    data.metadata?.owner || '',
                    data.metadata?.email || '',
                    //Data
                    data.metadata?.template || '',
                    data.metadata?.task || '',
                    data.metadata?.visits || '',
                    //Metadata
                    data.metadata?.title || '',
                    data.metadata?.description || '',
                    data.metadata?.keywords || '',
                    //Move info
                    data.originalParent || '',

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
        if (!owner || !repo) { return ''; }
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

    deleteNode(selectedPages: FlattenedTreeNode[], canDeleteRoot: boolean = false) {
        const projectTree = this.getProjectTree();

        for (const page of selectedPages) {
            const nodeToDelete = this.findNodeByUrl(projectTree, page.url)

            if (!nodeToDelete) {
                console.warn(`Node not found for URL: ${page.url}`);
                continue;
            }

            console.log('Node to delete:', nodeToDelete);


            // Root-level (don't delete the root!!!)
            const rootIndex = this.project().projectData.findIndex(n => n === nodeToDelete)
            if (rootIndex > -1) {
                if (!canDeleteRoot) {
                    console.warn('Cannot delete root node.');
                    continue;
                }
                projectTree.splice(rootIndex, 1);
                console.log('Deleted root node at index:', rootIndex);
                continue;
            }


            // Child node
            const findAndDelete = (nodes: TreeNode[]): boolean => {
                for (const node of nodes) {
                    const children: TreeNode[] = node.children ?? [];
                    const childIndex = children.findIndex(c => c === nodeToDelete);
                    if (childIndex > -1) {
                        children.splice(childIndex, 1);
                        node.children = children.length ? children : undefined;
                        return true;
                    }
                    // recurse into grandchildren
                    if (children.length && findAndDelete(children)) {
                        return true;
                    }
                }
                return false;
            };
            findAndDelete(projectTree);
        }
        this.setProjectTree(projectTree);
    }

}