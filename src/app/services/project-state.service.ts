import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { Project, ProjectMetadata, ProjectPhase, GitHubRepo, GitHubUser, ProjectTreeNodeData, FlattenedTreeNode, TableColumn, MetadataReview } from '../common/data.model';
import { TreeNode } from 'primeng/api';
import { environment } from '../../environments/environment';
import { TranslateService } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { version as appVersion } from '../../../package.json'

import { ProjectStorageService } from '../services/storage/project-storage.service';
import { CollaboratorService } from './collaborator.service';
import { FetchService } from './fetch.service';
import { AirtableService } from './airtable.service';
import { UpdService } from './upd.service';

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

@Injectable({ providedIn: 'root' })
export class ProjectStateService {
    private translate = inject(TranslateService);
    private projectStorageService = inject(ProjectStorageService);
    private collaboratorService = inject(CollaboratorService);
    private fetchService = inject(FetchService);
    private airtableService = inject(AirtableService);
    private updService = inject(UpdService);

    // Main project state
    private project = signal<Project>({
        id: this.generateId(),
        key: '',
        version: appVersion,
        projectName: '',
        phase: ProjectPhase.Draft,
        created: new Date(),
        lastModified: new Date(),
        lastSaved: new Date(),
        lastExported: null,
        storageType: 'local',
        collaborators: this.collaboratorService.getInitialCollaborators(),
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
                // Check if user has permission to save
                if (currentProject.storageType === 'cloud' && !this.collaboratorService.canEditProject(currentProject)) {
                    console.log("Converting cloud project to local...");
                    this.setStorageType('local');
                }
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
        console.log('Difference:', diff);

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
        // Sync name to repo if not set
        if (name && !this.project().github.repo) {
            let repo = this.generateUrlFragment(name);
            const currentYear = new Date().getFullYear().toString();
            if (!/[-_]?\d{4}$/.test(repo)) {
                repo = `${repo}-${currentYear}`;
            }
            this.setGitHubRepo({ repo });
        }
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
        // Sync repo to name if not set
        if (this.project().github.repo && !this.project().projectName) {
            const name = this.project().github.repo.replace(/-/g, ' ').replace(/^./, char => char.toUpperCase());
            this.setProjectName(name);
        }
    }

    setCollaborators(collaborators: GitHubUser[]) {
        this.project.update(curr => ({
            ...curr,
            collaborators,
            lastModified: new Date()
        }));
    }

    setStorageType(type: 'local' | 'cloud') {
        this.project.update(curr => ({
            ...curr,
            storageType: type,
            lastModified: new Date()
        }));
    }

    setPageSha(url: string, sha: string, mode: 'prototype' | 'baseline' = 'prototype'): void {
        const tree = this.getProjectTree();
        const node = this.findNodeByUrl(tree, url);

        if (node?.data) {
            if (!node.data.sha) {
                node.data.sha = {};
            }
            node.data.sha[mode] = sha;
            this.project.update(p => ({
                ...p,
                lastModified: new Date(),
                projectData: [...p.projectData]
            }));
        }
    }

    setMetadataReview(url: string, review: MetadataReview): void {
        const tree = this.getProjectTree();
        const node = this.findNodeByUrl(tree, url);

        if (node?.data) {
            node.data.metadataReview = review;
            this.project.update(p => ({
                ...p,
                lastModified: new Date(),
                projectData: [...p.projectData]
            }));
        }
    }

    setExportDate(): void {
        this.project.update(p => ({
            ...p,
            lastModified: new Date(),
            lastExported: new Date()
        }));
    }

    setModifiedDate(): void {
        this.project.update(p => ({
            ...p,
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
            const success = await this.projectStorageService.saveProject(project);

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
            if (project.version !== appVersion) {
                console.warn(`Project version (${project.version}) differs from app version (${appVersion}). Some features may not work correctly.`);
                //return false;
            }

            // Convert date strings back to Date objects
            project.created = new Date(project.created);
            project.lastModified = new Date(project.lastModified);
            project.lastSaved = new Date(project.lastSaved);
            project.lastExported = project.lastExported ? new Date(project.lastExported) : null;

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

            if (project.version !== appVersion) {
                console.warn('Incompatible project version. Import skipped.');
                return false;
            }

            // Convert date strings back to Date objects
            project.created = new Date(project.created);
            project.lastModified = new Date(project.lastModified);
            project.lastSaved = new Date(project.lastSaved);
            project.lastExported = project.lastExported ? new Date(project.lastExported) : null;

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
    async resetProject() {
        // Save current project if needed before resetting
        this.saveIfNeeded();

        this.project.set({
            id: this.generateId(),
            key: 'autosave',
            version: appVersion,
            projectName: '',
            phase: ProjectPhase.Draft,
            created: new Date(),
            lastModified: new Date(),
            lastSaved: new Date(),
            lastExported: null,
            storageType: 'local',
            collaborators: this.collaboratorService.getInitialCollaborators(),
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

        await this.saveProject();
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
                    doubleH1: data.doubleH1 || '',
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
                    linksToPortal: data.status.linksToPortal,
                    noindex: data.status.noindexEN && data.status.noindexFR ? 'both'
                        : data.status.noindexEN ? 'en-only'
                            : data.status.noindexFR ? 'fr-only'
                                : 'none',
                    archiveStatus: data.status.archiveStatus,
                    //Data
                    template: data.metadata?.template || '',
                    task: data.metadata?.task || [],
                    visits: data.metadata?.visits ?? undefined,
                    wordCount: data.metadata?.wordCount,
                    lastModified: data.metadata?.lastModified,
                    lastPublished: data.metadata?.lastPublished,
                    //Owner
                    owner: data.metadata?.owner || '',
                    email: data.metadata?.email || '',
                    //Metadata
                    titleEN: data.metadata?.title || '',
                    descriptionEN: data.metadata?.description || '',
                    keywordsEN: data.metadata?.keywords || '',
                    titleFR: data.metadata?.titleFR || '',
                    descriptionFR: data.metadata?.descriptionFR || '',
                    keywordsFR: data.metadata?.keywordsFR || '',
                    //AI Metadata
                    aiDescriptionEN: data.metadataReview?.en.description,
                    aiKeywordsEN: data.metadataReview?.en.keywords,
                    aiDescriptionFR: data.metadataReview?.fr.description,
                    aiKeywordsFR: data.metadataReview?.fr.keywords,
                    aiModel: data.metadataReview?.model,
                    aiGeneratedAt: data.metadataReview?.generatedAt,
                });

                if (node.children?.length) {
                    walk(node.children);
                }
            }
        };

        walk(tree);
        return flatNodes;
    }

    markForTranslation() {
        marker('inventory.header.h1');
        marker('inventory.header.doubleH1');
        marker('inventory.header.url');
        marker('inventory.header.oppTitle');
        marker('inventory.header.oppUrl');
        marker('inventory.header.prototypeUrl');
        marker('inventory.header.inScope');
        marker('inventory.header.isOrphan');
        marker('inventory.header.isNew');
        marker('inventory.header.isMoved');
        marker('inventory.header.isROT');
        marker('inventory.header.linksToPortal');
        marker('inventory.header.archiveStatus');
        marker('inventory.header.noindex');
        marker('inventory.header.owner');
        marker('inventory.header.email');
        marker('inventory.header.template');
        marker('inventory.header.task');
        marker('inventory.header.visits');
        marker('inventory.header.wordCount');
        marker('inventory.header.lastModified');
        marker('inventory.header.lastPublished');
        marker('inventory.header.titleEN');
        marker('inventory.header.descriptionEN');
        marker('inventory.header.keywordsEN');
        marker('inventory.header.titleFR');
        marker('inventory.header.descriptionFR');
        marker('inventory.header.keywordsFR');
        marker('inventory.header.ai.descriptionEN');
        marker('inventory.header.ai.keywordsEN');
        marker('inventory.header.ai.descriptionFR');
        marker('inventory.header.ai.keywordsFR');
        marker('inventory.header.ai.model');
        marker('inventory.header.ai.date');
    }

    // NOTE: Add new translation keys to the markForTranslation() method above
    getTreeTableColumns(): TableColumn[] {
        return [
            //Current Language
            { field: 'h1', translationKey: 'inventory.header.h1', type: 'text', frozen: true, group: 'page', visibleByDefault: true },
            { field: 'doubleH1', translationKey: 'inventory.header.doubleH1', type: 'text', group: 'page', visibleByDefault: false },
            { field: 'url', translationKey: 'inventory.header.url', type: 'url', group: 'page', visibleByDefault: false },
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
            { field: 'linksToPortal', translationKey: 'inventory.header.linksToPortal', type: 'boolean', group: 'status', visibleByDefault: true },
            { field: 'archiveStatus', translationKey: 'inventory.header.archiveStatus', type: 'archive', group: 'status', visibleByDefault: true },
            { field: 'noindex', translationKey: 'inventory.header.noindex', type: 'noindex', group: 'status', visibleByDefault: true },
            //Data
            { field: 'template', translationKey: 'inventory.header.template', type: 'text', group: 'pageData', visibleByDefault: true },
            { field: 'task', translationKey: 'inventory.header.task', type: 'array', group: 'pageData', visibleByDefault: false },
            { field: 'visits', translationKey: 'inventory.header.visits', type: 'number', group: 'pageData', visibleByDefault: true },
            { field: 'wordCount', translationKey: 'inventory.header.wordCount', type: 'number', group: 'pageData', visibleByDefault: true },
            { field: 'lastModified', translationKey: 'inventory.header.lastModified', type: 'date', group: 'pageData', visibleByDefault: true },
            { field: 'lastPublished', translationKey: 'inventory.header.lastPublished', type: 'date', group: 'pageData', visibleByDefault: false },
            //Owner
            { field: 'owner', translationKey: 'inventory.header.owner', type: 'text', group: 'owner', visibleByDefault: true },
            { field: 'email', translationKey: 'inventory.header.email', type: 'text', group: 'owner', visibleByDefault: false },
            //Metadata & AI metadata
            { field: 'titleEN', translationKey: 'inventory.header.titleEN', type: 'text', group: 'metadata', visibleByDefault: false },
            { field: 'descriptionEN', translationKey: 'inventory.header.descriptionEN', type: 'longText', group: 'metadata', visibleByDefault: false },
            { field: 'aiDescriptionEN', translationKey: 'inventory.header.ai.descriptionEN', type: 'aiText', group: 'metadata', visibleByDefault: false },
            { field: 'keywordsEN', translationKey: 'inventory.header.keywordsEN', type: 'longText', group: 'metadata', visibleByDefault: false },
            { field: 'aiKeywordsEN', translationKey: 'inventory.header.ai.keywordsEN', type: 'aiText', group: 'metadata', visibleByDefault: false },
            { field: 'titleFR', translationKey: 'inventory.header.titleFR', type: 'text', group: 'metadata', visibleByDefault: false },
            { field: 'descriptionFR', translationKey: 'inventory.header.descriptionFR', type: 'longText', group: 'metadata', visibleByDefault: false },
            { field: 'aiDescriptionFR', translationKey: 'inventory.header.ai.descriptionFR', type: 'aiText', group: 'metadata', visibleByDefault: false },
            { field: 'keywordsFR', translationKey: 'inventory.header.keywordsFR', type: 'longText', group: 'metadata', visibleByDefault: false },
            { field: 'aiKeywordsFR', translationKey: 'inventory.header.ai.keywordsFR', type: 'aiText', group: 'metadata', visibleByDefault: false },
            //AI Metadata
            { field: 'aiModel', translationKey: 'inventory.header.ai.model', type: 'text', group: 'metadata', visibleByDefault: false },
            { field: 'aiGeneratedAt', translationKey: 'inventory.header.ai.date', type: 'date', group: 'metadata', visibleByDefault: false },
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
            'Portal link',
            'Archived',
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
                    data.status.linksToPortal ? 'Yes' : 'No',
                    data.status.archiveStatus ?? '',
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
        a.download = `${filename}-content-inventory.csv`;
        a.click();

        URL.revokeObjectURL(url);
    }

    //For tree testing in Optimal Workshop or similar tools
    exportAsTreeCsv() {
        const tree = this.project().projectData;

        // Calculate max depth
        const getMaxDepth = (nodes: TreeNode<ProjectTreeNodeData>[], depth = 0): number => {
            let maxDepth = depth;
            for (const node of nodes) {
                if (node.children?.length) {
                    maxDepth = Math.max(maxDepth, getMaxDepth(node.children, depth + 1));
                }
            }
            return maxDepth;
        };

        const maxDepth = getMaxDepth(tree);
        const rows: string[] = [];

        // Generate headers
        const headers: string[] = [];
        for (let i = 0; i <= maxDepth; i++) {
            if (i === 0) {
                headers.push('Top level');
            } else if (i === 1) {
                headers.push('2nd level');
            } else if (i === 2) {
                headers.push('3rd level');
            } else {
                headers.push(`${i + 1}th level`);
            }
        }
        rows.push(headers.join(','));

        // Walk tree and build rows
        const walk = (nodes: TreeNode<ProjectTreeNodeData>[], depth: number) => {
            for (const node of nodes) {
                const data = node.data;
                if (!data) continue;

                // Create a row with empty cells up to current depth
                const row: string[] = new Array(maxDepth + 1).fill('');
                row[depth] = `"${data.h1 ?? ''}"`;

                rows.push(row.join(','));

                if (node.children?.length) {
                    walk(node.children, depth + 1);
                }
            }
        };

        walk(tree, 0);

        const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const proj = this.project();
        const filename = proj.github.repo || proj.projectName || proj.id;
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}-tree-testing.csv`;
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

    // Generate url fragment (for repo names and new pages)
    public generateUrlFragment(h1: string): string {
        // Words to remove (common articles, prepositions, conjunctions)
        const stopWords = [
            // English
            'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
            // French
            'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'et', 'ou', 'mais', 'dans', 'sur', 'a', 'au', 'aux', 'pour', 'avec'
        ];

        return h1
            .normalize('NFD')                            // Decompose accented characters
            .replace(/[\u0300-\u036f]/g, '')             // Remove accent marks
            .replace(/\b(?:l|d|n|s|c|j|m|t|qu)'/gi, '')  // Remove French contractions (l', d', n', s', c', j', m', t', qu')
            .toLowerCase()                               // Lowercase for the url
            .replace(/[^\w\s-]/g, '')                    // Remove punctuation except hyphens
            .split(/\s+/)                                // Split on whitespace
            .filter(word => word.length > 0 && !stopWords.includes(word)) // Remove stop words and empty strings
            .join('-');                                  // Join with hyphens
    }

    deleteNode(selectedPages: FlattenedTreeNode[], canDeleteRoot = false) {
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

    // Check for child pages that will be deleted (so component UI can display a warning)
    checkDeletionImpact(selectedPages: FlattenedTreeNode[]): { url: string, h1: string, inScope: boolean }[] {
        const projectTree = this.getProjectTree();
        const selectedUrls = new Set(selectedPages.map(p => p.url));
        const additionalPages: { url: string, h1: string, inScope: boolean }[] = [];

        for (const page of selectedPages) {
            const nodeToDelete = this.findNodeByUrl(projectTree, page.url);
            if (!nodeToDelete) continue;

            const descendants = this.collectAllDescendants(nodeToDelete);
            for (const desc of descendants) {
                const url = desc.data?.url;
                if (url && !selectedUrls.has(url)) {
                    additionalPages.push({
                        url,
                        h1: desc.data?.h1 || '',
                        inScope: desc.data?.status.inScope || false
                    });
                    selectedUrls.add(url);
                }
            }
        }

        return additionalPages;
    }

    // Used to check if child pages will be deleted during a delete operation
    private collectAllDescendants(node: TreeNode<ProjectTreeNodeData>): TreeNode<ProjectTreeNodeData>[] {
        const descendants: TreeNode<ProjectTreeNodeData>[] = [];

        const collect = (n: TreeNode<ProjectTreeNodeData>) => {
            if (n.children) {
                for (const child of n.children) {
                    descendants.push(child);
                    collect(child);
                }
            }
        };

        collect(node);
        return descendants;
    }

    //Store settings for inventory table
    selectedInventoryView: 'table' | 'tree' = 'table';

    // Get breadcrumb chain by url
    getBreadcrumbChain(url: string): { title: string; link: string }[] {
        const breadcrumbs: { title: string; link: string }[] = [];

        const findAndBuildChain = (
            nodes: TreeNode<ProjectTreeNodeData>[],
            targetUrl: string,
            ancestors: TreeNode<ProjectTreeNodeData>[] = []
        ): boolean => {
            for (const node of nodes) {
                // When URL is found, build breadcrumb from collected ancestors
                if (node.data?.url === targetUrl) {
                    for (const ancestor of ancestors) {
                        if (ancestor.data?.url) {
                            breadcrumbs.push({
                                title: ancestor.data.h1 || ancestor.label || "",
                                link: ancestor.data.url
                            });
                        }
                    }
                    return true;
                }
                // When URL not found, add current node to ancestors and recurse into children
                else if (node.children?.length) {
                    const found = findAndBuildChain(node.children, targetUrl, [...ancestors, node]);
                    if (found) return true;
                }
            }
            return false;
        };

        findAndBuildChain(this.project().projectData, url);
        return breadcrumbs;
    }


    // Refresh page data
    public async refreshData(url: string, oppUrl: string, mode: 'status' | 'data' | 'owner' | 'metadata' | 'all') {

        const node = this.findNodeByUrl(this.getProjectTree(), url);
        if (!node) {
            console.error('Node not found for URL:', url);
            return;
        }

        const urlLang = url.includes('/en/') ? 'en' : 'fr';

        let metadata;
        if (mode === 'status' || mode === 'data' || mode === 'metadata' || mode === 'all') {
            const doc = await this.fetchService.fetchContent(url, "prod", 3, "none", false);
            metadata = this.fetchService.extractPageMetadata(doc, url);
            console.log("Metadata", metadata);
        }

        let oppMetadata;
        if (mode === 'metadata' || mode === 'all') {
            oppMetadata = await this.fetchService.getOppMetadata(oppUrl);
            console.log("Opp Metadata", oppMetadata);
        }

        let jsonData;
        if (mode === 'data' || mode === 'owner' || mode === 'all') {
            const fields = ['gcContributor', 'gcBranch', 'gcLastPublished', 'gcModifiedIsOverridden', 'gcModifiedOverride', 'cq:lastModified', 'cq:template'];
            jsonData = await this.fetchService.fetchJSON(url, fields);
            console.log("Ownership data", jsonData);
        }

        let task, visits;
        if (mode === 'data' || mode === 'all') {
            const currentLang = this.translate.currentLang?.startsWith('fr') ? 'fr' : 'en';
            await this.airtableService.fetchTasks();
            task = this.airtableService.findTaskNamesByUrl(url, currentLang);
            console.log("Task data", task);

            await this.updService.fetchData();
            visits = this.updService.findVisitsByUrl(url.replace('https://', ''));
            console.log("Visits", visits);
        }

        // Update node - use new data if fetched AND available, otherwise keep existing
        if (node.data?.status) {
            // STATUS MODE
            node.data.status.linksToPortal = ((mode === 'status' || mode === 'all') && metadata?.linksToPortal !== undefined) ? metadata.linksToPortal : node.data.status.linksToPortal;
            node.data.status.archiveStatus = ((mode === 'status' || mode === 'all') && metadata?.isArchived !== undefined) ? (metadata.isArchived ? 'archived' : 'current') : node.data.status.archiveStatus;
            node.data.status.noindexEN = ((mode === 'status' || mode === 'all') && metadata?.noindex !== undefined) ? (urlLang === 'en' ? metadata.noindex : oppMetadata?.noindex) : node.data.status.noindexEN;
            node.data.status.noindexFR = ((mode === 'status' || mode === 'all') && metadata?.noindex !== undefined) ? (urlLang === 'fr' ? metadata.noindex : oppMetadata?.noindex) : node.data.status.noindexFR;
            //TODO: IA ORPHAN!
        }
        if (node.data?.metadata) {
            // DATA MODE
            node.data.metadata.template = ((mode === 'data' || mode === 'all') && metadata?.template) ? (jsonData?.['cq:template']?.includes('freestyle') ? 'freestyle' : metadata.template) : node.data.metadata.template;
            node.data.metadata.wordCount = ((mode === 'data' || mode === 'all') && metadata?.wordCount !== undefined) ? metadata.wordCount : node.data.metadata.wordCount;
            node.data.metadata.lastPublished = ((mode === 'data' || mode === 'all') && jsonData?.['gcLastPublished']) ? new Date(jsonData['gcLastPublished']) : node.data.metadata.lastPublished;
            node.data.metadata.lastModified = ((mode === 'data' || mode === 'all') && jsonData) ? (jsonData['gcModifiedIsOverridden'] === 'true' && jsonData['gcModifiedOverride'] ? new Date(jsonData['gcModifiedOverride']) : jsonData['cq:lastModified'] ? new Date(jsonData['cq:lastModified']) : '') : node.data.metadata.lastModified;
            node.data.metadata.task = ((mode === 'data' || mode === 'all') && task) ? task : node.data.metadata.task;
            node.data.metadata.visits = ((mode === 'data' || mode === 'all') && visits !== undefined && visits !== -1) ? visits : node.data.metadata.visits;

            // OWNER MODE
            node.data.metadata.owner = ((mode === 'owner' || mode === 'all') && jsonData?.['gcContributor']) ? jsonData['gcContributor'] : node.data.metadata.owner;
            node.data.metadata.email = ((mode === 'owner' || mode === 'all') && jsonData?.['gcBranch']) ? jsonData['gcBranch'] : node.data.metadata.email;

            // METADATA MODE
            node.data.metadata.title = ((mode === 'metadata' || mode === 'all') && (metadata?.title || oppMetadata?.title)) ? (urlLang === 'en' ? metadata?.title : oppMetadata?.title) : node.data.metadata.title;
            node.data.metadata.description = ((mode === 'metadata' || mode === 'all') && (metadata?.description || oppMetadata?.description)) ? (urlLang === 'en' ? metadata?.description : oppMetadata?.description) : node.data.metadata.description;
            node.data.metadata.keywords = ((mode === 'metadata' || mode === 'all') && (metadata?.keywords || oppMetadata?.keywords)) ? (urlLang === 'en' ? metadata?.keywords : oppMetadata?.keywords) : node.data.metadata.keywords;
            node.data.metadata.titleFR = ((mode === 'metadata' || mode === 'all') && (metadata?.title || oppMetadata?.title)) ? (urlLang === 'fr' ? metadata?.title : oppMetadata?.title) : node.data.metadata.titleFR;
            node.data.metadata.descriptionFR = ((mode === 'metadata' || mode === 'all') && (metadata?.description || oppMetadata?.description)) ? (urlLang === 'fr' ? metadata?.description : oppMetadata?.description) : node.data.metadata.descriptionFR;
            node.data.metadata.keywordsFR = ((mode === 'metadata' || mode === 'all') && (metadata?.keywords || oppMetadata?.keywords)) ? (urlLang === 'fr' ? metadata?.keywords : oppMetadata?.keywords) : node.data.metadata.keywordsFR;
        }

        this.setModifiedDate();
    }
}