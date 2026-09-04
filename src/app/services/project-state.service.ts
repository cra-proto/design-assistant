import { computed, effect, inject, Injectable, signal } from '@angular/core';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslateService } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';

import { ProjectStorageService } from '../services/storage/project-storage.service';
import { AirtableService } from './data-sources/airtable.service';
import { UpdService } from './data-sources/upd.service';
import { VanityService } from './data-sources/vanity.service';
import { FetchService } from './fetch.service';
import { CollaboratorService } from './github/collaborator.service';
import { ExportGitHubService } from './github/export-github.service';
import { UsageService } from './usage.service';

import { version as appVersion } from '../../../package.json';
import { environment } from '../../environments/environment';
import {
  FlattenedTreeNode,
  GitHubRepo,
  GitHubUser,
  LangData,
  MetadataReview,
  PageTemplate,
  Project,
  ProjectPhase,
  ProjectTreeNodeData,
  SourceVersion,
  TableColumn,
  TreeNodeAction,
  TreeNodeData,
} from '../common/data.model';

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
  private readonly translate = inject(TranslateService);
  private readonly projectStorageService = inject(ProjectStorageService);
  private readonly collaboratorService = inject(CollaboratorService);
  private readonly fetchService = inject(FetchService);
  private readonly airtableService = inject(AirtableService);
  private readonly updService = inject(UpdService);
  private readonly vanityService = inject(VanityService);
  private readonly usageService = inject(UsageService);
  private readonly exportGitHubService = inject(ExportGitHubService);

  private readonly currentLang = signal<string>(this.translate.currentLang() ?? 'en');

  // Main project state
  private readonly project = signal<Project>({
    id: this.generateId(),
    key: '',
    version: appVersion,
    projectName: '',
    phase: ProjectPhase.Draft,
    created: new Date(),
    lastModified: new Date(),
    lastSaved: new Date(),
    lastExported: null,
    lastDownloaded: null,
    storageType: 'local',
    repoType: 'github',
    collaborators: this.collaboratorService.getInitialCollaborators(),
    baselinePages: 0,
    inScopePages: 0,
    github: {
      owner: environment.defaultOrg,
      repo: '',
      branch: 'main',
      hasBaselineRepo: false,
    },
    projectData: [],
  });

  public readonly getProject = computed(() => this.project());

  public readonly getGitHub = computed(() => this.project().github);

  // Track save status
  private readonly saveStatus = signal<SaveStatus>('saved');
  public readonly getSaveStatus = computed(() => this.saveStatus());

  // Set autosave delay
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly AUTO_SAVE_DELAY = 10000; // 30 seconds
  private readonly MAX_UNSAVED_DURATION = 5 * 60 * 1000; // 5 minutes

  // Loading states for project versions
  public readonly refreshing = signal<{ prototype: boolean; live: boolean; baseline: boolean }>({
    prototype: false,
    live: false,
    baseline: false,
  });

  constructor() {
    // Autosave after a delay if there are changes
    effect(() => {
      const currentProject = this.project();
      const hasChanges = currentProject.lastModified > currentProject.lastSaved;
      if (hasChanges) {
        // Check if user has permission to save
        if (currentProject.storageType === 'cloud' && !this.collaboratorService.canEditProject(currentProject)) {
          console.log('Converting cloud project to local...');
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
    this.translate.onLangChange.subscribe((e) => this.currentLang.set(e.lang));
  }

  // Helper to generate unique project ID
  private generateId(): string {
    return `project_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Set entire project
  public setProject(project: Project) {
    this.project.set(project);
  }

  // Update project metadata
  public setProjectName(name: string) {
    this.project.update((curr) => ({
      ...curr,
      projectName: name,
      lastModified: new Date(),
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

  public setProjectPhase(phase: ProjectPhase) {
    this.project.update((curr) => ({
      ...curr,
      phase: phase,
      lastModified: new Date(),
    }));
  }

  public setGitHubRepo(gitHubData: Partial<GitHubRepo>) {
    this.project.update((curr) => ({
      ...curr,
      github: { ...curr.github, ...gitHubData },
      lastModified: new Date(),
    }));
    // Sync repo to name if not set
    if (this.project().github.repo && !this.project().projectName) {
      const name = this.project()
        .github.repo.replace(/-/g, ' ')
        .replace(/^./, (char) => char.toUpperCase());
      this.setProjectName(name);
    }
  }

  public setCollaborators(collaborators: GitHubUser[]) {
    this.project.update((curr) => ({
      ...curr,
      collaborators,
      lastModified: new Date(),
    }));
  }

  public setStorageType(type: 'local' | 'cloud') {
    this.project.update((curr) => ({
      ...curr,
      storageType: type,
      lastModified: new Date(),
    }));
  }

  public setRepoType(type: 'local' | 'github') {
    this.project.update((curr) => ({
      ...curr,
      repoType: type,
      lastModified: new Date(),
    }));
  }

  public setPageSha(path: string, sha: string, version: 'prototype' | 'baseline' = 'prototype', lang: 'en' | 'fr' = 'en'): void {
    const tree = this.getProjectTree();
    const node = this.findNodeByPath(tree, path, lang);

    if (node?.data) {
      if (!node.data[version][lang].githubSha) {
        node.data[version][lang].githubSha = {};
      }
      node.data[version][lang].githubSha = sha;
      this.project.update((p) => ({
        ...p,
        lastModified: new Date(),
        projectData: [...p.projectData],
      }));
    }
  }

  public setMetadataReview(path: string, review: MetadataReview, promptConfig?: object): void {
    const tree = this.getProjectTree();
    const lang = this.fetchService.getLang(path) ?? 'en';
    const node = this.findNodeByPath(tree, path, lang);

    if (node?.data) {
      node.data.metadataReview = review;
      this.project.update((p) => ({
        ...p,
        lastModified: new Date(),
        projectData: [...p.projectData],
      }));
      this.usageService.trackMetadata(
        this.project().id,
        this.project().org ?? 'DEFAULT',
        this.project().storageType,
        path,
        node.data.metadata?.description,
        node.data.metadata?.descriptionFR,
        node.data.metadata?.keywords,
        node.data.metadata?.keywordsFR,
        review,
        promptConfig ?? {},
        !promptConfig,
      );
    }
  }

  public setExportDate(): void {
    this.project.update((p) => ({
      ...p,
      lastModified: new Date(),
      lastExported: new Date(),
    }));
  }

  public setDownloadDate(): void {
    this.project.update((p) => ({
      ...p,
      lastModified: new Date(),
      lastDownloaded: new Date(),
    }));
  }

  public setModifiedDate(): void {
    this.project.update((p) => ({
      ...p,
      lastModified: new Date(),
    }));
  }

  // Get project tree
  public readonly getProjectTree = computed(() => this.project().projectData);

  public setProjectTree(tree: TreeNode<ProjectTreeNodeData>[]) {
    const baselineCount = this.countPages('baseline');
    const inScopeCount = this.countPages('inScope');
    this.project.update((curr) => ({
      ...curr,
      baselinePages: baselineCount,
      inScopePages: inScopeCount,
      projectData: tree,
      lastModified: new Date(),
    }));
  }

  // Count pages
  private countPages(mode: 'inScope' | 'baseline' = 'inScope'): number {
    let count = 0;
    const traverse = (nodes: TreeNode<ProjectTreeNodeData>[]) => {
      for (const node of nodes) {
        if (mode === 'inScope' && node.data?.status.inScope) count++;
        else if (mode === 'baseline') {
          count++;
        }
        if (node.children?.length) traverse(node.children);
      }
    };
    traverse(this.project().projectData);
    return count;
  }

  public setScope(paths: string[], lang: 'en' | 'fr' = 'en'): void {
    const currentTree = this.project().projectData;
    const traverse = (nodes: TreeNode<TreeNodeData>[]) => {
      for (const node of nodes) {
        if (node.data?.path[lang] && paths.includes(node.data.path[lang])) {
          node.data.status.inScope = true;
        }
        if (node.children?.length) traverse(node.children);
      }
    };
    traverse(this.project().projectData);
    this.setProjectTree(currentTree);
  }

  // Check if URL already exists in tree
  public urlExists(url: string): boolean {
    const urlLang = this.fetchService.getLang(url);
    if (!urlLang) return false;
    const urlPath = this.fetchService.generatePath(url);
    const search = (nodes: TreeNode<TreeNodeData>[]): boolean => {
      for (const node of nodes) {
        if (node.data?.path[urlLang] === urlPath) return true;
        if (node.children?.length && search(node.children)) return true;
      }
      return false;
    };
    return search(this.project().projectData);
  }

  // TODO: refactor getAllUrls and getAllPages to use new data structure
  public getAllPages(lang: 'en' | 'fr', urlVersion: SourceVersion = 'protoGH', scope: 'all' | 'inScope' = 'all'): { label: string; path: string; url: string }[] {
    const version = urlVersion.startsWith('proto') ? 'prototype' : urlVersion.startsWith('base') ? 'baseline' : 'live';
    const pages: { label: string; path: string; url: string }[] = [];
    const traverse = (nodes: TreeNode<TreeNodeData>[]) => {
      for (const node of nodes) {
        const path = node.data?.path?.[lang] ?? '';
        const h1 = node.data?.[version]?.[lang]?.h1;
        const url = this.fetchService.generateUrl(path, urlVersion, this.project().github.owner, this.project().github.repo);
        if (scope === 'inScope' && path && h1 && url && node.data?.status.inScope) {
          pages.push({ label: h1, path: path, url: url });
        } else if (scope === 'all' && path && h1 && url) {
          pages.push({ label: h1, path: path, url: url });
        }
        if (node.children?.length) traverse(node.children);
      }
    };
    traverse(this.project().projectData);
    return pages;
  }

  public getPairedPages(
    urlVersion: SourceVersion = 'protoGH',
    scope: 'all' | 'inScope' = 'all',
  ): { en: { label: string; path: string; url: string; group: string }; fr: { label: string; path: string; url: string; group: string }; status: string }[] {
    console.log('UPDATE', urlVersion);
    const version = urlVersion.startsWith('proto') ? 'prototype' : urlVersion.startsWith('base') ? 'baseline' : 'live';
    const pages: { en: { label: string; path: string; url: string; group: string }; fr: { label: string; path: string; url: string; group: string }; status: string }[] = [];
    const traverse = (nodes: TreeNode<TreeNodeData>[]) => {
      for (const node of nodes) {
        const enPath = node.data?.path?.en ?? '';
        const enH1 = node.data?.[version]?.en?.h1;
        const enSection = node.data?.[version]?.en?.doubleH1 ?? '';
        const enUrl = this.fetchService.generateUrl(enPath, urlVersion, this.project().github.owner, this.project().github.repo);
        const frPath = node.data?.path?.fr ?? '';
        const frH1 = node.data?.[version]?.fr?.h1;
        const frSection = node.data?.[version]?.fr?.doubleH1 ?? '';
        const frUrl = this.fetchService.generateUrl(frPath, urlVersion, this.project().github.owner, this.project().github.repo);
        const status = !node.data?.status.inScope ? 'isBaseline' : node.data?.status.isNew ? 'isNew' : node.data?.status.isROT ? 'isROT' : node.data?.status.isMoved ? 'isMoved' : '';
        if (scope === 'inScope' && node.data?.status?.inScope && enPath && enH1 && enUrl && frPath && frH1 && frUrl) {
          pages.push({
            en: { label: enH1, path: enPath, url: enUrl, group: enSection },
            fr: { label: frH1, path: frPath, url: frUrl, group: frSection },
            status: status,
          });
        } else if (scope === 'all' && enPath && enH1 && enUrl && frPath && frH1 && frUrl) {
          pages.push({
            en: { label: enH1, path: enPath, url: enUrl, group: enSection },
            fr: { label: frH1, path: frPath, url: frUrl, group: frSection },
            status: status,
          });
        } else {
          console.log({
            en: { label: enH1, path: enPath, url: enUrl, group: enSection },
            fr: { label: frH1, path: frPath, url: frUrl, group: frSection },
            status: status,
          });
        }
        if (node.children?.length) traverse(node.children);
      }
    };
    traverse(this.project().projectData);
    return pages;
  }

  //Template options
  public readonly templateOptions = computed(() =>
    Object.values(PageTemplate)
      .map((key) => ({ value: key, label: this.translate.instant(key) }))
      .sort((a, b) => a.label.localeCompare(b.label, this.translate.currentLang())),
  );

  //TreeNode lookup
  public findNodeByPath(nodes: TreeNode[], path: string, lang: 'en' | 'fr' = 'en'): TreeNode | null {
    for (const node of nodes) {
      const nodeUrl = node.data.path[lang];
      if (nodeUrl === path) {
        return node;
      }
      if (node.children) {
        const found = this.findNodeByPath(node.children, path, lang);
        if (found) return found;
      }
    }
    return null;
  }

  // Get project state for saving (with circular references removed)
  public getProjectToSave(): Project {
    const currentProject = this.project();
    return {
      ...currentProject,
      projectData: this.projectStorageService.removeParents(currentProject.projectData),
    };
  }

  /**
   * Save project (manual or auto-save)
   * Cancels any pending auto-save timer
   */
  public async saveProject(): Promise<boolean> {
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
      this.project.update((curr) => ({
        ...curr,
        lastSaved: new Date(),
      }));

      const project = this.project();
      const success = await this.projectStorageService.saveProject(project);

      if (success) {
        // Wait 2 seconds before showing "saved" status
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.saveStatus.set('saved');
        console.log('Project saved successfully');
        return true;
      } else {
        // Rollback lastSaved on failure
        this.project.update((curr) => ({
          ...curr,
          lastSaved: previousLastSaved,
        }));
        this.saveStatus.set('error');
        console.error('Failed to save project');
        return false;
      }
    } catch (error) {
      // Rollback lastSaved on error
      this.project.update((curr) => ({
        ...curr,
        lastSaved: previousLastSaved,
      }));
      this.saveStatus.set('error');
      console.error('Error saving project:', error);
      return false;
    }
  }

  /**
   * Check if there are unsaved changes
   */
  private hasUnsavedChanges(): boolean {
    const project = this.project();
    return project.lastModified > project.lastSaved;
  }

  /**
   * Save if there are unsaved changes (used before project switch or app close)
   */
  private async saveIfNeeded(): Promise<boolean> {
    if (this.hasUnsavedChanges()) {
      return await this.saveProject();
    }
    return true; // No save needed
  }

  // Export as JSON
  public exportProjectAsJson() {
    const project = this.getProjectToSave();
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const filename = project.github.repo ?? project.projectName ?? project.id;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  // Import from JSON
  public importProjectFromJson(jsonString: string): boolean {
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

  // Reset project
  public async resetProject() {
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
      lastDownloaded: null,
      storageType: 'local',
      repoType: 'github',
      collaborators: this.collaboratorService.getInitialCollaborators(),
      baselinePages: 0,
      inScopePages: 0,
      github: {
        owner: environment.defaultOrg,
        repo: '',
        branch: 'main',
        hasBaselineRepo: false,
      },
      projectData: [],
    });

    await this.saveProject();
    console.log('Project reset');
  }

  public flattenTree(): FlattenedTreeNode[] {
    const tree = this.project().projectData;
    const flatNodes: FlattenedTreeNode[] = [];

    const walk = (nodes: TreeNode<TreeNodeData>[]) => {
      for (const node of nodes) {
        const data = node.data;
        if (!data) continue;
        const lang = data.lang ?? 'en';
        flatNodes.push({
          //English
          enPath: data.path.en,
          enH1: data.prototype?.en.h1 ?? '',
          enDoubleH1: data.prototype?.en.doubleH1 ?? '',
          enVanity: data.vanity?.en ?? [],
          //French
          frPath: data.path.fr,
          frH1: data.prototype?.fr.h1 ?? '',
          frDoubleH1: data.prototype?.fr.doubleH1 ?? '',
          frVanity: data.vanity?.fr ?? [],
          //Status
          inScope: data.status.inScope,
          isNew: data.status.isNew,
          isMoved: data.status.isMoved,
          isROT: data.status.isROT,
          isArchived: data.prototype?.en.isArchived ?? data.prototype?.fr.isArchived ?? false,
          noindex: data.prototype?.en.noindex ?? data.prototype?.fr.noindex ?? false,
          //Actions
          actions: this.computeActions(data),
          //Problems
          isOrphan: data.live?.en.isOrphan ?? data.live?.fr.isOrphan ?? false,
          //Notes
          issue: data.notes?.issue ?? '',
          solution: data.notes?.solution ?? '',
          //Data
          template: data.prototype?.[lang].template ?? '',
          linksToPortal: data.live?.en.linksToPortal ?? data.live?.fr.linksToPortal ?? false,
          hasChatbot: data.live?.en.hasChatbot ?? data.live?.fr.hasChatbot ?? false,
          task: data.task?.[lang] ?? [],
          visits: data.visits?.[lang] ?? undefined,
          updLink: '',
          wordCount: data.live?.[lang].wordCount,
          fleschKincaid: data.prototype?.[lang].fleschKincaid,
          gunningFog: data.prototype?.[lang].gunningFog,
          linkCount: data.live?.[lang].linkCount,
          phoneNumbers: [...new Set([...(data.live?.en.phoneNumbers ?? []), ...(data.live?.fr.phoneNumbers ?? [])])],
          lastModified: data.live?.[lang]?.lastModified ? new Date(data.live[lang]!.lastModified!) : undefined,
          lastPublished: data.live?.[lang]?.lastPublished ? new Date(data.live[lang]!.lastPublished!) : undefined,
          //Owner
          owner: data.live?.[lang].owner ?? '',
          email: data.live?.[lang].email ?? '',
          //Metadata (prototype)
          titleEN: data.prototype?.en.title ?? '',
          descriptionEN: data.prototype?.en.description ?? '',
          keywordsEN: data.prototype?.en.keywords ?? '',
          titleFR: data.prototype?.fr.title ?? '',
          descriptionFR: data.prototype?.fr.description ?? '',
          keywordsFR: data.prototype?.fr.keywords ?? '',
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

  public readonly treeTableColumns = computed<TableColumn[]>(() => {
    const lang = this.currentLang().startsWith('fr') ? 'fr' : 'en';
    const enPrimary = lang !== 'fr' ? true : false;
    const frPrimary = lang === 'fr' ? true : false;

    const enData: TableColumn[] = [
      { field: 'enH1', label: this.translate.instant('inventory.header.enH1'), type: 'text', frozen: enPrimary, group: 'english', visibleByDefault: enPrimary, dataSection: ['prototype', 'en', 'h1'] },
      { field: 'enDoubleH1', label: this.translate.instant('inventory.header.enDoubleH1'), type: 'text', group: 'english', visibleByDefault: false, dataSection: ['prototype', 'en', 'doubleH1'] },
      { field: 'enPath', label: this.translate.instant('inventory.header.enPath'), type: 'url', group: 'english', visibleByDefault: false, dataSection: ['path', 'en'] },
      { field: 'enVanity', label: this.translate.instant('inventory.header.enVanity'), type: 'array', group: 'english', visibleByDefault: false, dataSection: ['vanity', 'en'] },
    ];
    const frData: TableColumn[] = [
      { field: 'frH1', label: this.translate.instant('inventory.header.frH1'), type: 'text', frozen: frPrimary, group: 'french', visibleByDefault: frPrimary, dataSection: ['prototype', 'fr', 'h1'] },
      { field: 'frDoubleH1', label: this.translate.instant('inventory.header.frDoubleH1'), type: 'text', group: 'french', visibleByDefault: false, dataSection: ['prototype', 'fr', 'doubleH1'] },
      { field: 'frPath', label: this.translate.instant('inventory.header.frPath'), type: 'url', group: 'french', visibleByDefault: false, dataSection: ['path', 'fr'] },
      { field: 'frVanity', label: this.translate.instant('inventory.header.frVanity'), type: 'array', group: 'french', visibleByDefault: false, dataSection: ['vanity', 'fr'] },
    ];

    const order = lang === 'fr' ? [frData, enData] : [enData, frData];

    const langColumns = order.flat();

    return [
      ...langColumns,
      //Status
      { field: 'inScope', label: this.translate.instant('inventory.header.inScope'), type: 'boolean', group: 'status', visibleByDefault: true, dataSection: ['status', 'inScope'] },
      { field: 'isNew', label: this.translate.instant('inventory.header.isNew'), type: 'boolean', group: 'status', visibleByDefault: true, dataSection: ['status', 'isNew'] },
      { field: 'isMoved', label: this.translate.instant('inventory.header.isMoved'), type: 'boolean', group: 'status', visibleByDefault: true, dataSection: ['status', 'isMoved'] },
      { field: 'isROT', label: this.translate.instant('inventory.header.isROT'), type: 'boolean', group: 'status', visibleByDefault: true, dataSection: ['status', 'isROT'] },
      {
        field: 'isArchived',
        label: this.translate.instant('inventory.header.archiveStatus'),
        type: 'boolean',
        group: 'status',
        visibleByDefault: true,
        dataSection: ['prototype', 'lang', 'isArchived'],
      },
      { field: 'noindex', label: this.translate.instant('inventory.header.noindex'), type: 'boolean', group: 'status', visibleByDefault: true, dataSection: ['prototype', 'lang', 'noindex'] },
      //Actions
      { field: 'actions', label: this.translate.instant('inventory.header.actions'), type: 'tags', group: 'actions', visibleByDefault: false, dataSection: [] },
      //Notes
      { field: 'issue', label: this.translate.instant('inventory.header.issue'), type: 'textArea', group: 'notes', visibleByDefault: false, dataSection: ['notes', 'issue'] },
      { field: 'solution', label: this.translate.instant('inventory.header.solution'), type: 'textArea', group: 'notes', visibleByDefault: false, dataSection: ['notes', 'solution'] },
      //Problems
      { field: 'isOrphan', label: this.translate.instant('inventory.header.isOrphan'), type: 'boolean', group: 'problems', visibleByDefault: true, dataSection: ['prototype', 'lang', 'isOrphan'] },
      //ADD 404's!!!
      //Data
      { field: 'template', label: this.translate.instant('inventory.header.template'), type: 'template', group: 'pageData', visibleByDefault: true, dataSection: ['prototype', 'lang', 'template'] },
      { field: 'linksToPortal', label: this.translate.instant('inventory.header.linksToPortal'), type: 'boolean', group: 'pageData', visibleByDefault: false, dataSection: [] },
      { field: 'hasChatbot', label: this.translate.instant('inventory.header.hasChatbot'), type: 'boolean', group: 'pageData', visibleByDefault: false, dataSection: [] },
      { field: 'task', label: this.translate.instant('inventory.header.task'), type: 'array', group: 'pageData', visibleByDefault: false, dataSection: [] },
      { field: 'visits', label: this.translate.instant('inventory.header.visits'), type: 'number', group: 'pageData', visibleByDefault: true, dataSection: [] },
      { field: 'updLink', label: this.translate.instant('inventory.header.updLink'), type: 'upd', group: 'pageData', visibleByDefault: true, dataSection: [] },
      { field: 'fleschKincaid', label: this.translate.instant('common.readability.fleschKincaid'), type: 'number', group: 'pageData', visibleByDefault: true, dataSection: [] },
      { field: 'gunningFog', label: this.translate.instant('common.readability.gunningFog'), type: 'number', group: 'pageData', visibleByDefault: false, dataSection: [] },
      { field: 'wordCount', label: this.translate.instant('inventory.header.wordCount'), type: 'number', group: 'pageData', visibleByDefault: true, dataSection: [] },
      { field: 'linkCount', label: this.translate.instant('inventory.header.linkCount'), type: 'number', group: 'pageData', visibleByDefault: false, dataSection: [] },
      { field: 'phoneNumbers', label: this.translate.instant('inventory.header.phoneNumbers'), type: 'array', group: 'pageData', visibleByDefault: false, dataSection: [] },
      { field: 'lastModified', label: this.translate.instant('inventory.header.lastModified'), type: 'date', group: 'pageData', visibleByDefault: true, dataSection: [] },
      { field: 'lastPublished', label: this.translate.instant('inventory.header.lastPublished'), type: 'date', group: 'pageData', visibleByDefault: false, dataSection: [] },
      //Owner
      { field: 'owner', label: this.translate.instant('inventory.header.owner'), type: 'text', group: 'owner', visibleByDefault: true, dataSection: [] },
      { field: 'email', label: this.translate.instant('inventory.header.email'), type: 'text', group: 'owner', visibleByDefault: false, dataSection: [] },
      //Metadata & AI metadata
      { field: 'titleEN', label: this.translate.instant('inventory.header.titleEN'), type: 'text', group: 'metadata', visibleByDefault: false, dataSection: [] },
      { field: 'titleFR', label: this.translate.instant('inventory.header.titleFR'), type: 'text', group: 'metadata', visibleByDefault: false, dataSection: [] },
      { field: 'descriptionEN', label: this.translate.instant('inventory.header.descriptionEN'), type: 'longText', group: 'metadata', visibleByDefault: false, dataSection: [] },
      { field: 'aiDescriptionEN', label: this.translate.instant('inventory.header.ai.descriptionEN'), type: 'aiText', group: 'metadata', visibleByDefault: false, dataSection: [] },
      { field: 'descriptionFR', label: this.translate.instant('inventory.header.descriptionFR'), type: 'longText', group: 'metadata', visibleByDefault: false, dataSection: [] },
      { field: 'aiDescriptionFR', label: this.translate.instant('inventory.header.ai.descriptionFR'), type: 'aiText', group: 'metadata', visibleByDefault: false, dataSection: [] },
      { field: 'keywordsEN', label: this.translate.instant('inventory.header.keywordsEN'), type: 'longText', group: 'metadata', visibleByDefault: false, dataSection: [] },
      { field: 'aiKeywordsEN', label: this.translate.instant('inventory.header.ai.keywordsEN'), type: 'aiText', group: 'metadata', visibleByDefault: false, dataSection: [] },
      { field: 'keywordsFR', label: this.translate.instant('inventory.header.keywordsFR'), type: 'longText', group: 'metadata', visibleByDefault: false, dataSection: [] },
      { field: 'aiKeywordsFR', label: this.translate.instant('inventory.header.ai.keywordsFR'), type: 'aiText', group: 'metadata', visibleByDefault: false, dataSection: [] },
      //AI Metadata
      { field: 'aiModel', label: this.translate.instant('inventory.header.ai.model'), type: 'text', group: 'metadata', visibleByDefault: false, dataSection: [] },
      { field: 'aiGeneratedAt', label: this.translate.instant('inventory.header.ai.date'), type: 'date', group: 'metadata', visibleByDefault: false, dataSection: [] },
    ];
  });

  private computeActions(data: TreeNodeData): TreeNodeAction[] {
    const actions: TreeNodeAction[] = [];
    const isNew = data.status.isNew;
    const isROT = data.status.isROT;
    const is404Proto = data.prototype?.en.is404;
    const is404Live = data.live?.en.is404;

    const isMoved = data.status.isMoved;
    const parentProto = data.prototype?.en.parentPath;
    const parentLive = data.live?.en.parentPath;

    //console.log(isMoved)
    //console.log(parentProto);
    //console.log(parentLive);

    if (isROT && !is404Live) {
      actions.push({ key: marker('actions.isROT.unpublish'), severity: 'danger' });
    } else if (isNew) {
      if (!is404Live) {
        actions.push({ key: marker('actions.isNew.monitor'), severity: 'secondary' });
      } else if (is404Proto) {
        actions.push({ key: marker('actions.isNew.createProto'), severity: 'info' });
      } else if (!is404Proto) {
        actions.push({ key: marker('actions.isNew.createLive'), severity: 'info' });
      }
    } else if (isMoved && parentProto !== parentLive) {
      actions.push({ key: marker('actions.isMoved.movePage'), severity: 'warn' });
    }
    return actions;
  }

  public exportTreeAsCsv() {
    const tree = this.project().projectData;
    const rows: string[] = [];
    const lang = this.detectPrimaryLanguage();

    // Headers
    rows.push(
      [
        //English
        this.translate.instant('inventory.header.enH1'),
        this.translate.instant('inventory.header.enDoubleH1'),
        this.translate.instant('inventory.header.enPath'),
        this.translate.instant('inventory.header.enVanity'),
        //French
        this.translate.instant('inventory.header.frH1'),
        this.translate.instant('inventory.header.frPath'),
        this.translate.instant('inventory.header.frDoubleH1'),
        this.translate.instant('inventory.header.frVanity'),
        //Status
        this.translate.instant('inventory.header.inScope'),
        this.translate.instant('inventory.header.isNew'),
        this.translate.instant('inventory.header.isMoved'),
        this.translate.instant('inventory.header.isROT'),
        this.translate.instant('inventory.header.archiveStatus'),
        this.translate.instant('inventory.header.noindex'),
        //Notes
        this.translate.instant('inventory.header.issue'),
        this.translate.instant('inventory.header.solution'),
        //Data
        this.translate.instant('inventory.header.template'),
        this.translate.instant('inventory.header.linksToPortal'),
        this.translate.instant('inventory.header.hasChatbot'),
        this.translate.instant('inventory.header.task'),
        this.translate.instant('inventory.header.visits'),
        this.translate.instant('common.readability.gradeLevel'),
        this.translate.instant('inventory.header.wordCount'),
        this.translate.instant('inventory.header.linkCount'),
        this.translate.instant('inventory.header.lastModified'),
        this.translate.instant('inventory.header.lastPublished'),
        //Owner
        this.translate.instant('inventory.header.owner'),
        this.translate.instant('inventory.header.email'),
        //Metadata
        this.translate.instant('inventory.header.titleEN'),
        this.translate.instant('inventory.header.titleFR'),
        this.translate.instant('inventory.header.descriptionEN'),
        this.translate.instant('inventory.header.descriptionFR'),
        this.translate.instant('inventory.header.keywordsEN'),
        this.translate.instant('inventory.header.keywordsFR'),
        //Move info
        this.translate.instant('inventory.header.originalParentEN'),
        this.translate.instant('inventory.header.newParentEN'),
        this.translate.instant('inventory.header.originalParentFR'),
        this.translate.instant('inventory.header.newParentFR'),
      ].join(','),
    );

    const walk = (nodes: TreeNode<TreeNodeData>[]) => {
      for (const node of nodes) {
        const data = node.data;
        if (!data) continue;
        const yes = this.translate.instant('common.yes');
        const no = this.translate.instant('common.no');

        rows.push(
          [
            //English
            JSON.stringify(data.prototype?.en?.h1 ?? ''),
            JSON.stringify(data.prototype?.en?.doubleH1 ?? ''),
            data.path?.en ?? '',
            JSON.stringify(data.vanity?.en?.join('; ') ?? ''),
            //French
            JSON.stringify(data.prototype?.fr?.h1 ?? ''),
            JSON.stringify(data.prototype?.fr?.doubleH1 ?? ''),
            data.path?.fr ?? '',
            JSON.stringify(data.vanity?.fr?.join('; ') ?? ''),
            //Status
            data.status?.inScope ? yes : no,
            data.status?.isNew ? yes : no,
            data.status?.isMoved ? yes : no,
            data.status?.isROT ? yes : no,
            data.prototype?.en?.isArchived || data.prototype?.fr?.isArchived ? yes : no,
            data.prototype?.en?.noindex || data.prototype?.fr?.noindex ? yes : no,
            //Notes
            JSON.stringify(data.notes?.issue ?? ''),
            JSON.stringify(data.notes?.solution ?? ''),
            //Data
            this.translate.instant(data.prototype?.[lang]?.template ?? ''),
            data.prototype?.en?.linksToPortal || data.prototype?.fr?.linksToPortal ? yes : no,
            data.prototype?.en?.hasChatbot || data.prototype?.fr?.hasChatbot ? yes : no,
            JSON.stringify(data.task?.[lang]?.join('; ') ?? ''),
            data.visits?.[lang] ?? -1,
            Math.min(data.prototype?.[lang]?.fleschKincaid ?? -1, data.prototype?.[lang]?.gunningFog ?? -1),
            data.prototype?.[lang]?.wordCount ?? -1,
            data.prototype?.[lang]?.linkCount ?? -1,
            data.live?.[lang]?.lastModified ? new Date(data.live[lang].lastModified).toISOString().slice(0, 10) : '',
            data.live?.[lang]?.lastPublished ? new Date(data.live[lang].lastPublished).toISOString().slice(0, 10) : '',
            //Owner
            JSON.stringify(data.prototype?.[lang]?.owner ?? ''),
            JSON.stringify(data.prototype?.[lang]?.email ?? ''),
            //Metadata
            JSON.stringify(data.prototype?.en?.title ?? ''),
            JSON.stringify(data.prototype?.fr?.title ?? ''),
            JSON.stringify(data.prototype?.en?.description ?? ''),
            JSON.stringify(data.prototype?.fr?.description ?? ''),
            JSON.stringify(data.prototype?.en?.keywords ?? ''),
            JSON.stringify(data.prototype?.fr?.keywords ?? ''),
            //Move info
            data.prototype?.en?.parentPath !== data.live?.en?.parentPath ? (data.live?.en?.parentPath ?? '') : '',
            data.prototype?.en?.parentPath !== data.live?.en?.parentPath ? (data.prototype?.en?.parentPath ?? '') : '',
            data.prototype?.fr?.parentPath !== data.live?.fr?.parentPath ? (data.live?.fr?.parentPath ?? '') : '',
            data.prototype?.fr?.parentPath !== data.live?.fr?.parentPath ? (data.prototype?.fr?.parentPath ?? '') : '',
          ].join(','),
        );

        if (node.children?.length) {
          walk(node.children);
        }
      }
    };

    walk(tree);

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const proj = this.project();
    const filename = proj.github.repo ?? proj.projectName ?? proj.id;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-content-inventory.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  //For tree testing in Optimal Workshop or similar tools
  public exportAsTreeCsv() {
    const tree = this.project().projectData;
    const lang = this.detectPrimaryLanguage();

    // Calculate max depth
    const getMaxDepth = (nodes: TreeNode<TreeNodeData>[], depth = 0): number => {
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
    const walk = (nodes: TreeNode<TreeNodeData>[], depth: number) => {
      for (const node of nodes) {
        const data = node.data;
        if (!data) continue;

        // Create a row with empty cells up to current depth
        const row: string[] = new Array(maxDepth + 1).fill('');
        row[depth] = `"${data.prototype?.[lang].h1 ?? ''}"`;

        rows.push(row.join(','));

        if (node.children?.length) {
          walk(node.children, depth + 1);
        }
      }
    };

    walk(tree, 0);

    const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const proj = this.project();
    const filename = proj.github.repo ?? proj.projectName ?? proj.id;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-tree-testing.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  // Generate url fragment (for repo names and new pages)
  public generateUrlFragment(h1: string): string {
    // Words to remove (common articles, prepositions, conjunctions)
    const stopWords = [
      // English
      'a',
      'an',
      'the',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      // French
      'le',
      'la',
      'les',
      'un',
      'une',
      'des',
      'de',
      'du',
      'et',
      'ou',
      'mais',
      'dans',
      'sur',
      'a',
      'au',
      'aux',
      'pour',
      'avec',
    ];

    return h1
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
      .replace(/\b(?:l|d|n|s|c|j|m|t|qu)'/gi, '') // Remove French contractions (l', d', n', s', c', j', m', t', qu')
      .toLowerCase() // Lowercase for the url
      .replace(/[^\w\s-]/g, '') // Remove punctuation except hyphens
      .split(/\s+/) // Split on whitespace
      .filter((word) => word.length > 0 && !stopWords.includes(word)) // Remove stop words and empty strings
      .join('-'); // Join with hyphens
  }

  public deleteNodes(selectedPages: FlattenedTreeNode[], canDeleteRoot = false) {
    const projectTree = this.getProjectTree();
    const lang = this.detectPrimaryLanguage();

    for (const page of selectedPages) {
      const path = lang === 'fr' ? page.frPath : page.enPath;
      const nodeToDelete = this.findNodeByPath(projectTree, path, lang);

      if (!nodeToDelete) {
        console.warn(`Node not found for URL: ${path}`);
        continue;
      }

      //console.log('Node to delete:', nodeToDelete);

      // Root-level (don't delete the root!!!)
      const rootIndex = this.project().projectData.findIndex((n) => n === nodeToDelete);
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
          const childIndex = children.findIndex((c) => c === nodeToDelete);
          if (childIndex > -1) {
            children.splice(childIndex, 1);
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
  public checkDeletionImpact(selectedPages: FlattenedTreeNode[]): { url: string; h1: string; inScope: boolean }[] {
    const projectTree = this.getProjectTree();
    const lang = this.detectPrimaryLanguage();
    const selectedUrls = new Set(lang === 'fr' ? selectedPages.map((p) => p.frPath) : selectedPages.map((p) => p.enPath));
    const additionalPages: { url: string; h1: string; inScope: boolean }[] = [];

    for (const page of selectedPages) {
      const path = lang === 'fr' ? page.frPath : page.enPath;
      const nodeToDelete = this.findNodeByPath(projectTree, path, lang);
      if (!nodeToDelete) continue;

      const descendants = this.collectAllDescendants(nodeToDelete);
      for (const desc of descendants) {
        const url = desc.data?.path[lang];
        if (url && !selectedUrls.has(url)) {
          additionalPages.push({
            url,
            h1: desc.data?.prototype?.[lang].h1 ?? '',
            inScope: desc.data?.status.inScope ?? false,
          });
          selectedUrls.add(url);
        }
      }
    }

    return additionalPages;
  }

  // Used to check if child pages will be deleted during a delete operation
  private collectAllDescendants(node: TreeNode<TreeNodeData>): TreeNode<TreeNodeData>[] {
    const descendants: TreeNode<TreeNodeData>[] = [];

    const collect = (n: TreeNode<TreeNodeData>) => {
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

  deleteNode(nodeToDelete: TreeNode) {
    const projectTree = this.getProjectTree();

    // Root-level
    const rootIndex = this.project().projectData.findIndex((n) => n === nodeToDelete);
    if (rootIndex > -1) {
      projectTree.splice(rootIndex, 1);
      console.log('Deleted root node at index:', rootIndex);
    }

    // Child node
    const findAndDelete = (nodes: TreeNode[]): boolean => {
      for (const node of nodes) {
        const children: TreeNode[] = node.children ?? [];
        const childIndex = children.findIndex((c) => c === nodeToDelete);
        if (childIndex > -1) {
          children.splice(childIndex, 1);
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

    //TODO: mark parent is not isCrawled... nodeToDelete.parent?.data.url
    this.setProjectTree(projectTree);
  }

  //Store settings for inventory table
  public selectedInventoryView: 'table' | 'tree' = 'table';

  // Get breadcrumb chain by url
  public getBreadcrumbChain(path: string, lang: 'en' | 'fr' = 'en'): { title: string; link: string }[] {
    const breadcrumbs: { title: string; link: string }[] = [];

    const findAndBuildChain = (nodes: TreeNode<TreeNodeData>[], targetPath: string, ancestors: TreeNode<TreeNodeData>[] = []): boolean => {
      for (const node of nodes) {
        // When URL is found, build breadcrumb from collected ancestors
        if (node.data?.path[lang] === targetPath) {
          for (const ancestor of ancestors) {
            if (ancestor.data?.path[lang]) {
              const url = this.fetchService.generateUrl(ancestor.data.path[lang], 'live');
              const h1 = ancestor.data.live?.[lang].h1;
              breadcrumbs.push({
                title: h1 ?? '',
                link: url ?? '',
              });
            }
          }
          return true;
        }
        // When URL not found, add current node to ancestors and recurse into children
        else if (node.children?.length) {
          const found = findAndBuildChain(node.children, targetPath, [...ancestors, node]);
          if (found) return true;
        }
      }
      return false;
    };

    findAndBuildChain(this.project().projectData, path);
    return breadcrumbs;
  }

  public async refreshNode(node: TreeNode, urlVersion: SourceVersion, fetchLive = false) {
    const version = urlVersion.startsWith('proto') ? 'prototype' : urlVersion.startsWith('base') ? 'baseline' : 'live';
    const source = fetchLive ? 'live' : urlVersion;
    const sourceType = source.endsWith('UT') ? 'local' : source.endsWith('GH') ? 'github' : 'live';
    const data = node.data as TreeNodeData;
    const { owner, repo, branch } = this.project().github;
    // URLs to fetch content from
    const enUrl = this.fetchService.generateUrl(data.path.en, source, owner, repo);
    const frUrl = this.fetchService.generateUrl(data.path.fr, source, owner, repo);
    console.log(`Refreshing ${enUrl}`);
    // Live URLs for json, airtable & UPD lookups
    const liveEnUrl = this.fetchService.generateUrl(data.path.en, 'live');
    const liveFrUrl = this.fetchService.generateUrl(data.path.fr, 'live');
    // Load UPD, Airtable, & vanity data
    await this.updService.fetchData();
    await this.airtableService.fetchTasks();
    await this.vanityService.fetchData();

    // Fetch EN
    if (enUrl) {
      try {
        const doc = sourceType !== 'local' ? await this.fetchService.fetchContent(enUrl, 'both', 2, 'none') : this.fetchService.stringToDoc(await this.fetchService.fetchViaProxy(enUrl));
        const pageData = await this.fetchService.extractPageMetadata(doc, enUrl);

        const jsonData = await (async () => {
          try {
            return liveEnUrl ? await this.fetchService.fetchPageJSON(liveEnUrl) : undefined;
          } catch {
            return undefined;
          }
        })();

        const parentUrl = pageData.parentPath ? this.fetchService.generateUrl(pageData.parentPath, source, owner, repo) : undefined;
        const parentDoc = await (async () => {
          try {
            return parentUrl && sourceType !== 'local'
              ? await this.fetchService.fetchContent(parentUrl, 'both', 2, 'none')
              : parentUrl && sourceType !== 'local'
                ? this.fetchService.stringToDoc(await this.fetchService.fetchViaProxy(parentUrl))
                : undefined;
          } catch {
            return undefined;
          }
        })();
        const parentLinks = parentDoc && liveEnUrl ? this.fetchService.getLinks(parentDoc, liveEnUrl) : undefined;

        const lastModified = source !== 'live' ? await this.exportGitHubService.getLastModified(enUrl, owner, repo, branch, this.exportGitHubService.token() ?? undefined) : undefined;

        const updated: Partial<LangData> = {
          h1: pageData.h1,
          doubleH1: pageData.doubleH1,
          //Content
          contentHash: pageData.contentHash,
          lastChecked: pageData.lastChecked,
          //Metadata
          title: pageData.title,
          description: pageData.description,
          keywords: pageData.keywords,
          //Status
          is404: false,
          ...(parentLinks ? { isOrphan: !parentLinks.some((link) => this.getPath(link) === this.getPath(liveEnUrl ?? '')) } : {}),
          noindex: pageData.noindex ?? false,
          isArchived: pageData.isArchived ?? false,
          linksToPortal: pageData.linksToPortal ?? false,
          hasChatbot: pageData.hasChatbot ?? false,
          //Data
          parentPath: pageData.parentPath,
          wordCount: pageData.wordCount,
          linkCount: pageData.linkCount,
          template: jsonData?.isFreestyle ? PageTemplate.Freestyle : pageData.template,
          fleschKincaid: pageData.fleschKincaid,
          gunningFog: pageData.gunningFog,
          ...(source === 'live' && jsonData
            ? {
                //jrc:content.json
                owner: jsonData?.owner,
                email: jsonData?.email,
                lastPublished: jsonData?.lastPublished,
                lastModified: jsonData?.lastModified,
              }
            : {
                lastModified: lastModified,
              }),
        };

        data[version]!.en = { ...data[version]!.en, ...updated };
      } catch {
        data[version]!.en = { ...data[version]!.en, lastChecked: new Date().toISOString(), is404: true };
      }
    }

    // Fetch FR
    if (frUrl) {
      try {
        const doc = sourceType !== 'local' ? await this.fetchService.fetchContent(frUrl, 'both', 2, 'none') : this.fetchService.stringToDoc(await this.fetchService.fetchViaProxy(frUrl));
        const pageData = await this.fetchService.extractPageMetadata(doc, frUrl);

        const jsonData = await (async () => {
          try {
            return liveFrUrl ? await this.fetchService.fetchPageJSON(liveFrUrl) : undefined;
          } catch {
            return undefined;
          }
        })();

        const parentUrl = pageData.parentPath ? this.fetchService.generateUrl(pageData.parentPath, source, owner, repo) : undefined;
        const parentDoc = await (async () => {
          try {
            return parentUrl && sourceType !== 'local'
              ? await this.fetchService.fetchContent(parentUrl, 'both', 2, 'none')
              : parentUrl && sourceType !== 'local'
                ? this.fetchService.stringToDoc(await this.fetchService.fetchViaProxy(parentUrl))
                : undefined;
          } catch {
            return undefined;
          }
        })();
        const parentLinks = parentDoc && liveFrUrl ? this.fetchService.getLinks(parentDoc, liveFrUrl) : undefined;

        const lastModified = source !== 'live' ? await this.exportGitHubService.getLastModified(frUrl, owner, repo, branch, this.exportGitHubService.token() ?? undefined) : undefined;

        const updated: Partial<LangData> = {
          h1: pageData.h1,
          doubleH1: pageData.doubleH1,
          //Content
          contentHash: pageData.contentHash,
          lastChecked: pageData.lastChecked,
          //Metadata
          title: pageData.title,
          description: pageData.description,
          keywords: pageData.keywords,
          //Status
          is404: false,
          ...(parentLinks ? { isOrphan: !parentLinks.some((link) => this.getPath(link) === this.getPath(liveFrUrl ?? '')) } : {}),
          noindex: pageData.noindex ?? false,
          isArchived: pageData.isArchived ?? false,
          linksToPortal: pageData.linksToPortal ?? false,
          hasChatbot: pageData.hasChatbot ?? false,
          //Data
          parentPath: pageData.parentPath,
          wordCount: pageData.wordCount,
          linkCount: pageData.linkCount,
          template: jsonData?.isFreestyle ? PageTemplate.Freestyle : pageData.template,
          fleschKincaid: pageData.fleschKincaid,
          gunningFog: pageData.gunningFog,
          ...(source === 'live' && jsonData
            ? {
                //jrc:content.json
                owner: jsonData?.owner,
                email: jsonData?.email,
                lastPublished: jsonData?.lastPublished,
                lastModified: jsonData?.lastModified,
              }
            : {
                lastModified: lastModified,
              }),
        };

        data[version]!.fr = { ...data[version]!.fr, ...updated };
      } catch {
        data[version]!.fr = { ...data[version]!.fr, lastChecked: new Date().toISOString(), is404: true };
      }
    }
    // Other data sources
    data.visits = {
      en: this.updService.findVisitsByUrl(liveEnUrl.replace('https://', '')) ?? -1,
      fr: this.updService.findVisitsByUrl(liveFrUrl.replace('https://', '')) ?? -1,
    };
    data.task = {
      en: this.airtableService.findTaskNamesByUrl(liveEnUrl, 'en'),
      fr: this.airtableService.findTaskNamesByUrl(liveFrUrl, 'fr'),
    };
    data.vanity = {
      en: this.vanityService.findVanitiesByDestination(liveEnUrl ?? ''),
      fr: this.vanityService.findVanitiesByDestination(liveFrUrl ?? ''),
    };
    this.setModifiedDate();
  }

  public async refreshAll(nodes: TreeNode[], urlVersion: SourceVersion, onlyNeverChecked = false, fetchLive = false) {
    const version = urlVersion.startsWith('proto') ? 'prototype' : urlVersion.startsWith('base') ? 'baseline' : 'live';
    for (const node of nodes) {
      const needsRefresh = onlyNeverChecked ? !node.data?.[version]?.en?.lastChecked || !node.data?.[version]?.fr?.lastChecked : true;
      if (needsRefresh) {
        await this.refreshNode(node, urlVersion, fetchLive);
      }
      if (node.children?.length) {
        await this.refreshAll(node.children, urlVersion, onlyNeverChecked, fetchLive);
      }
    }
  }

  public getPath(url: string, live = true): string {
    try {
      let pathName = new URL(url).pathname;
      if (!live) {
        pathName = '/' + pathName.split('/').slice(2).join('/');
      }
      return pathName;
    } catch {
      return url;
    }
  }

  //TODO: automate whatever we can!
  public createNode(parent: TreeNode, url?: string): TreeNode {
    const date = Date.now().toString();
    const parentPathEN = parent.data?.path?.en ?? '.html';
    const parentPathFR = parent.data?.path?.fr ?? '.html';

    const placeholderPathEN = url && this.fetchService.getLang(url) === 'en' ? this.fetchService.generatePath(url) : parentPathEN.replace('.html', `/new-page-${date}.html`);
    const placeholderPathFR = url && this.fetchService.getLang(url) === 'fr' ? this.fetchService.generatePath(url) : parentPathFR.replace('.html', `/nouvelle-page-${date}.html`);

    const placeholderH1EN =
      url
        ?.split('/')
        .pop()
        ?.replace('.html', '')
        .replace(/-/g, ' ')
        .replace(/^./, (c) => c.toUpperCase()) || 'New page';
    const placeholderH1FR =
      url
        ?.split('/')
        .pop()
        ?.replace('.html', '')
        .replace(/-/g, ' ')
        .replace(/^./, (c) => c.toUpperCase()) || 'Nouvelle page';

    const enData: LangData = {
      h1: placeholderH1EN,
      doubleH1: parent.data?.prototype.en.doubleH1 ?? undefined,
      //Content
      contentHash: undefined,
      lastChecked: undefined,
      githubSha: undefined,
      //Metadata
      title: '',
      description: '',
      keywords: '',
      //Status
      is404: true,
      isOrphan: false,
      noindex: false,
      isArchived: false,
      linksToPortal: false,
      hasChatbot: false,
      //jrc:content.json
      owner: parent.data.prototype.en.owner ?? '',
      email: parent.data.prototype.en.email ?? '',
      lastPublished: undefined,
      lastModified: undefined,
      //Data
      parentPath: parentPathEN,
      wordCount: 0,
      linkCount: 0,
      fleschKincaid: 0,
      gunningFog: 0,
      phoneNumbers: [],
      template: PageTemplate.Content,
      // Data from problem assistant
      problem: undefined,
    };

    const frData: LangData = {
      ...enData,
      h1: placeholderH1FR,
      doubleH1: parent.data?.prototype.fr.doubleH1 ?? undefined,
      parentPath: parentPathFR,
    };

    const lang = parent.data.lang;

    const data: TreeNodeData = {
      lang: lang,
      path: { en: placeholderPathEN, fr: placeholderPathFR },
      task: { en: [], fr: [] },
      visits: { en: -1, fr: -1 },
      vanity: { en: [], fr: [] },
      status: {
        inScope: true,
        isNew: true,
        isMoved: false,
        isROT: false,
      },
      baseline: { en: enData, fr: frData },
      live: { en: enData, fr: frData },
      prototype: { en: enData, fr: frData },
      metadataReview: undefined,
      notes: undefined,
      isContainer: false,
      isCrawled: false,
    };

    const node: TreeNode = {
      label: lang === 'fr' ? 'Nouvelle page' : 'New Page',
      data: data,
      expanded: true,
      children: [],
      parent,
    };

    parent.children = parent.children ?? [];
    parent.children.push(node);
    this.setProjectTree([...this.getProjectTree()]);
    return node;
  }

  // Get first URL from project to determine primary language
  public detectPrimaryLanguage(): 'en' | 'fr' {
    const nodes = this.getProjectTree();
    if (nodes.length > 0 && nodes[0].children && nodes[0].children.length > 0) {
      if (nodes[0].children[0].data.lang) {
        return nodes[0].children[0].data.lang;
      }
      //Fallback for older method of storing primary lang (can be removed when all projects converted)
      const firstUrl = nodes[0].children[0].data?.url ?? '';
      return firstUrl.includes('/en/') || firstUrl.includes('/en.html') ? 'en' : 'fr';
    }
    return 'en'; // fallback
  }

  // Move a node to a different parent
  public moveNode(node: TreeNode, newParent: TreeNode): 'success' | 'circular' {
    // Guard against circular moves
    if (node === newParent || this.isAncestor(newParent, node)) {
      return 'circular';
    }

    //const tree = [...this.getProjectTree()];

    // Remove from current parent
    if (node.parent) {
      node.parent.children = node.parent.children?.filter((c) => c !== node) ?? [];
    } else {
      const tree = this.getProjectTree();
      const index = tree.indexOf(node);
      if (index > -1) tree.splice(index, 1);
    }

    // Add to new parent
    newParent.children = newParent.children ?? [];
    newParent.children.push(node);
    node.parent = newParent;

    this.applyMoveResult(node, newParent);
    //this.setProjectTree(tree);
    return 'success';
  }

  private isAncestor(node: TreeNode, potentialAncestor: TreeNode): boolean {
    let current = node.parent;
    while (current) {
      if (current === potentialAncestor) return true;
      current = current.parent;
    }
    return false;
  }

  public applyMoveResult(node: TreeNode, newParent: TreeNode | undefined): void {
    const previousMoveStatus = node.data.status.isMoved;
    const pathParent = this.resolveNonContainerParent(newParent);

    // Update prototype parentUrls
    node.data.prototype.en.parentPath = pathParent?.data?.path.en ?? '';
    node.data.prototype.fr.parentPath = pathParent?.data?.path.fr ?? '';

    // Compare normalized prototype parentUrls to baseline parentUrls
    const enMoved = this.getPath(node.data.prototype.en.parentPath) !== this.getPath(node.data.baseline.en.parentPath ?? '');
    const frMoved = this.getPath(node.data.prototype.fr.parentPath) !== this.getPath(node.data.baseline.fr.parentPath ?? '');
    node.data.status.isMoved = enMoved || frMoved;

    if (previousMoveStatus !== node.data.status.isMoved) {
      this.setModifiedDate();
    }
  }

  private resolveNonContainerParent(node: TreeNode | undefined): TreeNode | undefined {
    let current = node;
    while (current?.data?.isContainer) {
      current = current.parent;
    }
    return current;
  }

  // Reorder a node among its siblings
  public reorderNode(node: TreeNode, direction: 'left' | 'right'): 'success' | 'no-parent' | 'at-boundary' {
    if (!node.parent) return 'no-parent';

    const siblings = node.parent.children ?? [];
    const index = siblings.indexOf(node);

    if (direction === 'left' && index === 0) return 'at-boundary';
    if (direction === 'right' && index === siblings.length - 1) return 'at-boundary';

    const swapIndex = direction === 'left' ? index - 1 : index + 1;
    [siblings[swapIndex], siblings[index]] = [siblings[index], siblings[swapIndex]];

    this.setProjectTree([...this.getProjectTree()]);
    this.setModifiedDate();
    return 'success';
  }

  public getSiblings(node: TreeNode): TreeNode[] {
    if (!node.parent) return [];
    return node.parent.children ?? [];
  }

  // Clone so we don't edit the working copy if the IA tree
  public cloneTree(nodes: TreeNode[]): TreeNode[] {
    const clonedTree = structuredClone(nodes);
    this.projectStorageService.rebuildParents(clonedTree, undefined);
    return clonedTree;
  }

  // Restore moved pages to their original position and remove new pages
  public getBaselineTree(nodes: TreeNode[], mode: 'full' | 'custom' = 'full'): TreeNode[] {
    // Clone so we don't edit the working copy if the IA tree
    const clonedTree = this.cloneTree(nodes);
    const lang = this.detectPrimaryLanguage();

    // Restore root node if it was moved
    if (mode === 'full') {
      const root = this.findNodeWhere(clonedTree, (n) => n.data?.baseline?.[lang]?.parentPath == null);
      if (root?.parent) {
        root.parent.children = root.parent.children?.filter((c) => c !== root) ?? [];
        root.parent = undefined;
        clonedTree.unshift(root);
      }
    }

    // Check for moved nodes and keep processing until no more are found
    let hasMovedNodes = true;
    while (hasMovedNodes) {
      const movedNodes: { node: TreeNode; originalParentUrl: string }[] = [];
      this.collectMovedNodes(clonedTree, movedNodes, true, mode);

      if (movedNodes.length === 0) {
        hasMovedNodes = false;
      }

      // Move each moved node back under its original parent
      for (const { node, originalParentUrl } of movedNodes) {
        const originalParent =
          originalParentUrl === ''
            ? null // Root level
            : this.findNodeByPath(clonedTree, originalParentUrl, lang);

        if (originalParent) {
          originalParent.children ??= [];
          originalParent.children.push(node);
          node.parent = originalParent;
        }
      }
    }
    this.removeNewPages(clonedTree);
    return clonedTree;
  }

  // Remove ROT pages
  public getFinalTree(nodes: TreeNode[]): TreeNode[] {
    // Clone so we don't edit the working copy if the IA tree
    const clonedTree = this.cloneTree(nodes);
    // Remove ROT
    this.removeROTPages(clonedTree);
    return clonedTree;
  }

  // Remove collapsed or hidden pages
  public getDisplayTree(nodes: TreeNode[], collapsedUrls: Set<string>, hiddenUrls: Set<string>, navUrls: Map<string, string[]>): TreeNode[] {
    const clonedTree = this.cloneTree(nodes);
    if (navUrls.size > 0) this.applyNavState(clonedTree, navUrls);
    if (hiddenUrls.size > 0) this.applyHiddenState(clonedTree, hiddenUrls);
    if (collapsedUrls.size > 0) this.applyCollapsedState(clonedTree, collapsedUrls);
    return clonedTree;
  }

  private collectMovedNodes(nodes: TreeNode[], movedNodes: { node: TreeNode; originalParentUrl: string }[], isTopLevel = false, mode: 'full' | 'custom' = 'full'): void {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const lang = this.detectPrimaryLanguage();
      const currentParentPath = node.parent?.data?.path[lang] ?? '';
      const originalParentPath = this.getPath(node.data?.baseline?.[lang]?.parentPath, false) ?? '';

      // Skip moving top level node for custom trees
      if (isTopLevel && mode === 'custom' && i === 0) {
        if (node.children?.length) {
          this.collectMovedNodes(node.children, movedNodes, false, mode);
        }
        continue;
      }

      // Check if this node has been moved
      if (currentParentPath !== originalParentPath) {
        // Remove from current position (with all children attached)
        movedNodes.push({
          node: node,
          originalParentUrl: originalParentPath,
        });
        nodes.splice(i, 1);
      } else if (node.children?.length) {
        // Only traverse children if THIS node hasn't moved
        this.collectMovedNodes(node.children, movedNodes);
      }
    }
  }

  private removeNewPages(nodes: TreeNode[]): void {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.data?.status.isNew) {
        nodes.splice(i, 1);
      } else if (node.children?.length) {
        this.removeNewPages(node.children);
      }
    }
  }

  private removeROTPages(nodes: TreeNode[]): void {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.data?.status.isROT) {
        nodes.splice(i, 1);
      } else if (node.children?.length) {
        this.removeROTPages(node.children);
      }
    }
  }

  public findNodeWhere(nodes: TreeNode[], condition: (node: TreeNode) => boolean): TreeNode | null {
    for (const node of nodes) {
      if (condition(node)) return node;
      if (node.children?.length) {
        const found = this.findNodeWhere(node.children, condition);
        if (found) return found;
      }
    }
    return null;
  }

  private applyCollapsedState(nodes: TreeNode[], collapsedUrls: Set<string>): void {
    const lang = this.detectPrimaryLanguage();
    for (const node of nodes) {
      if (collapsedUrls.has(node.data?.path[lang])) {
        node.data.collapsedChildren = node.children ?? [];
        node.children = [];
      } else if (node.children?.length) {
        this.applyCollapsedState(node.children, collapsedUrls);
      }
    }
  }

  private applyHiddenState(nodes: TreeNode[], hiddenUrls: Set<string>): void {
    const lang = nodes[0].data.lang;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (hiddenUrls.has(node.data?.path[lang])) {
        if (node.parent) {
          node.parent.data.hiddenChildrenUrls = node.parent.data.hiddenChildrenUrls ?? [];
          node.parent.data.hiddenChildrenUrls.push(node.data.path[lang]);
        }
        nodes.splice(i, 1);
      } else if (node.children?.length) {
        this.applyHiddenState(node.children, hiddenUrls);
      }
    }
  }

  private applyNavState(nodes: TreeNode[], navUrls: Map<string, string[]>): void {
    const lang = nodes[0]?.data.lang;
    const root = this.project().projectData;
    for (const node of nodes) {
      const path = node.data?.path[lang];
      if (navUrls.has(path)) {
        const linkedPaths = navUrls.get(path)!;
        const rescueNodes = linkedPaths
          .map((linkedPath) => this.findNodeByPath(root, linkedPath, lang))
          .filter((match): match is TreeNode => !!match)
          .map((match) => this.duplicateNode(match, node));
        node.children = [...(node.children ?? []), ...rescueNodes];
      }
      if (node.children?.length) {
        this.applyNavState(node.children, navUrls);
      }
    }
  }

  private duplicateNode(node: TreeNode, newParent: TreeNode): TreeNode {
    const clone = structuredClone(node); // doesn't share references with original node
    clone.children = []; // leaves children behind
    clone.parent = newParent; // sets parent reference
    const prefixLangData = (langData: LangData, prefix: string) => ({
      ...langData,
      h1: `${prefix}${langData.h1}`,
    });
    clone.data = {
      ...clone.data,
      live: {
        en: prefixLangData(clone.data.live.en, 'Rescue: '),
        fr: prefixLangData(clone.data.live.fr, 'Sauvetage : '),
      },
      baseline: {
        en: prefixLangData(clone.data.baseline.en, 'Rescue: '),
        fr: prefixLangData(clone.data.baseline.fr, 'Sauvetage : '),
      },
      prototype: {
        en: prefixLangData(clone.data.prototype.en, 'Rescue: '),
        fr: prefixLangData(clone.data.prototype.fr, 'Sauvetage : '),
      },
      isNavChild: true, // not editable, different colour
    };
    return clone;
  }
}
