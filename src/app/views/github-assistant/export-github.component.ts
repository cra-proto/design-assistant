import { Component, OnInit, inject, signal, computed, effect, ViewChild, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { Router } from '@angular/router';

//PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TreeNode } from 'primeng/api';
import { MessageModule } from 'primeng/message';
import { ChipModule } from 'primeng/chip';
import { TooltipModule } from 'primeng/tooltip';
import { PopoverModule, Popover } from 'primeng/popover';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DividerModule } from 'primeng/divider';
import { PanelModule } from 'primeng/panel';
import { ProgressBarModule } from 'primeng/progressbar';

//Services
import { ExportGitHubService } from '../../services/github/export-github.service';
import { ProjectStateService } from '../../services/project-state.service';
import { FetchService } from '../../services/fetch.service';
import { GitHubAuthService } from '../../services/github/github-auth.service';
import { UserSettingsService } from '../../services/user-settings.service';
import { environment } from '../../../environments/environment';

//Components
import { SetupRepoComponent } from '../../components/setup-repo/setup-repo.component';
import { PatComponent } from "../../components/sign-in/pat.component";
import { BookmarkletComponent } from '../../components/bookmarklet/bookmarklet.component';


type ConnectionStatus = 'checking' | 'connected' | 'warning' | 'error' | 'missing';

enum ExportStatus {
  ExportNew = 'github.export.status.addToGitHub', // Export - New page
  ExportOverwrite = 'github.export.status.overwrite', // Export - Existing page
  SkipNew = 'github.export.status.skipNew', // Skip export - New page
  SkipOverwrite = 'github.export.status.skipOverwrite', // Skip export - Existing page
  AddToProject = 'github.export.status.addToProject', // Add GitHub only page to project
  OppLanguage = 'github.export.status.addOppLangToProject' // Add GitHub only page to project (converts to primary language)
}

interface FileStatus {
  path: string;
  status: ExportStatus;
}

interface ExportProgress {
  step: string;
  progress: number; // 0-100
}


export interface PageData {
  url: string;
  path: string;
  filename: string;
  content: string;
}

interface FileCompareRow {
  path: string;
  status: ExportStatus;
  newer?: 'aida' | 'github' | 'same';
}




interface ExportMessage {
  severity: 'success' | 'info' | 'warn' | 'error';
  text: string;
}


@Component({
  selector: 'aida-export-github',
  imports: [CommonModule, FormsModule, TranslateModule,
    MessageModule, ButtonModule, TooltipModule, PopoverModule, SelectButtonModule, DividerModule,
    TableModule, ChipModule, PanelModule, ProgressBarModule,
    SetupRepoComponent, PatComponent, BookmarkletComponent],
  templateUrl: './export-github.component.html',
  styles: ``
})
export class ExportGithubComponent implements OnInit {
  private projectState = inject(ProjectStateService);
  public authService = inject(GitHubAuthService);
  public exportGitHubService = inject(ExportGitHubService);
  private fetchService = inject(FetchService);
  public translate = inject(TranslateService);
  private settingsService = inject(UserSettingsService);
  private router = inject(Router)

  defaultOrg = environment.defaultOrg;

  readonly ExportStatus = ExportStatus;

  username = computed(() => this.exportGitHubService.user()?.name || this.exportGitHubService.user()?.login || 'User');

  //Signals
  projectData = this.projectState.getProject;
  connectionStatus = signal<ConnectionStatus>('checking');
  showDisclaimer = signal<boolean>(false);

  filesTable = signal<FileStatus[]>([]);
  exportMessage = signal<ExportMessage | null>(null);

  pat = signal<string>(this.exportGitHubService.pat);
  precheckInProgress = signal<boolean>(false);

  markForTranslation() {
    marker('github.connect.export.description.prototype');
    marker('github.connect.export.description.baseline');
    marker('github.export.status.addOppLangToProject');
    marker('github.export.status.addToGitHub');
    marker('github.export.status.addToProject');
    marker('github.export.status.skipNew');
    marker('github.export.status.skipOverwrite');
    marker('github.export.status.overwrite');
    marker('github.connect.export.toggle.prototype');
    marker('github.connect.export.toggle.baseline');
    marker('github.export.progress.step1');
    marker('github.export.progress.step2');
    marker('github.export.progress.step3');
    marker('github.export.progress.step4');
    marker('github.export.progress.step5');
    marker('github.export.progress.step6');
  }

  constructor() {
    // Watch for changes to token or repo settings and run validateConnection
    effect(async () => {
      const token = this.exportGitHubService.token();
      const owner = this.projectData().github.owner;
      const repo = this.projectData().github.repo;
      //Update table when owner or repo changes
      if (owner && repo) {
        untracked(() => this.compareFiles());
      }
      // Only run precheck if we have a token and repo configured
      if (token && owner && repo) {
        untracked(() => this.validateConnection());
        //console.warn("Running validation again!")
      } else if (!token) {
        // No authentication method available
        this.connectionStatus.set('missing');
      }
    });
  }

  //Validate token and repo access
  private async validateConnection(): Promise<void> {
    this.precheckInProgress.set(true);
    this.connectionStatus.set('checking');
    this.showDisclaimer.set(false);

    const token = this.exportGitHubService.token();
    const owner = this.projectData().github.owner;
    const repo = this.projectData().github.repo;

    const result = await this.exportGitHubService.validateToken(token, owner, repo);

    console.log('Validation result:', result);
    console.log('showDisclaimer value:', result.showDisclaimer);

    if (!result.valid) {
      this.connectionStatus.set('error');
      //console.error('Token validation failed:', result.error);
    } else if (result.repoExists && !result.hasRepoAccess) {
      this.connectionStatus.set('warning');
      //console.warn(`No write access to ${owner}/${repo}`);
    } else if (!result.repoExists && !result.canCreateRepo) {
      this.connectionStatus.set('warning');
      //console.warn(`Cannot create repo in ${owner}`);
    } else {
      this.connectionStatus.set('connected');
      this.showDisclaimer.set(result.showDisclaimer ?? false);
      //if (result.showDisclaimer) {
      //  console.warn('Connected to GitHub but PAT scope cannot be verified. Please ensure PAT has appropriate scopes.');
      //}
    }
    this.precheckInProgress.set(false);
  }

  // Computed signals
  gitHubData = computed(() => this.projectData().github);

  projectTable = computed(() => this.filesTable().filter(f => f.path.startsWith('en') || f.path.startsWith('fr')));
  templateTable = computed(() => this.filesTable().filter(f => !f.path.startsWith('en') && !f.path.startsWith('fr')));

  inScopePageCount = computed(() => this.projectData().inScopePages);
  baselinePageCount = computed(() => this.projectData().baselinePages);
  projectFileCount = computed(() => this.projectTable().length);
  templateFileCount = computed(() => this.templateTable().length);

  newCount = computed(() => this.filesTable().filter(f => f.status === ExportStatus.ExportNew).length);
  updatedCount = computed(() => this.filesTable().filter(f => f.status === ExportStatus.ExportOverwrite).length);

  // Open targeted GitHub repo
  openRepo() {
    let modifier = '';
    if (this.selectedExportTarget === 'baseline') { modifier = '-baseline'; };
    const url = `https://github.com/${this.projectData().github.owner}/${this.projectData().github.repo}${modifier}`;
    window.open(url, '_blank');
  }

  // Status message colors & icons
  private getStatusTextColor(status: ConnectionStatus): string {
    const isDark = this.settingsService.darkMode();

    const colorMap: Record<ConnectionStatus, string> = {
      'connected': isDark ? 'text-green-400' : 'text-green-500',
      'warning': isDark ? 'text-yellow-400' : 'text-yellow-500',
      'error': isDark ? 'text-red-400' : 'text-red-500',
      'missing': isDark ? 'text-red-400' : 'text-red-500',
      'checking': isDark ? 'text-blue-400' : 'text-blue-500',
    };

    return colorMap[status] || '';
  }

  getStatusIcons = computed(() => {
    const status = this.connectionStatus();
    const iconMap: Record<ConnectionStatus, string> = {
      'connected': 'pi-check-circle',
      'warning': 'pi-exclamation-triangle',
      'error': 'pi-times-circle',
      'missing': 'pi-times-circle',
      'checking': 'pi-spin pi-spinner'
    };

    return `pi ${iconMap[status]} ${this.getStatusTextColor(status)} text-2xl`;
  });

  getTitleClasses = computed(() => {
    const status = this.connectionStatus();
    return `font-semibold my-0 ${this.getStatusTextColor(status)}`;
  });

  getBgClasses = computed(() => {
    const status = this.connectionStatus();
    const isDark = this.settingsService.darkMode();

    const baseClasses = 'flex align-items-center gap-2 p-3 border-round-md mb-3';

    const bgMap: Record<ConnectionStatus, string> = {
      'connected': isDark ? 'bg-green-950' : 'bg-green-50',
      'warning': isDark ? 'bg-yellow-950' : 'bg-yellow-50',
      'error': isDark ? 'bg-red-950' : 'bg-red-50',
      'missing': isDark ? 'bg-red-950' : 'bg-red-50',
      'checking': isDark ? 'bg-blue-950' : 'bg-blue-50'
    };

    return `${baseClasses} ${bgMap[status]}`;
  });
  // End of status message colors & icons

  // Initialize table and connection status
  async ngOnInit() {
    await this.compareFiles();
    await this.validateConnection();
  }

  // Show repo settings as secondary task button & overlay (if data exists or overlay is open)
  // Otherwise, show as primary task card in place of data card
  @ViewChild('settingsOverlay') settingsOverlay!: Popover;
  showSettingsButton(): boolean {
    const hasGithubData = !!(this.projectData().github.owner && this.projectData().github.repo && this.projectData().github.branch);
    return hasGithubData || this.settingsOverlay?.overlayVisible;
  }

  //Get in-scope URLs and page content (used by export fxn)
  private async getUrlandContent(node: TreeNode, lang: 'primary' | 'opposite' = 'primary'): Promise<PageData[]> {
    const pages: PageData[] = [];
    const url = lang === 'primary' ? node.data?.url : node.data?.metadata?.oppUrl;

    const scope = this.selectedExportTarget === 'prototype'
      ? node?.data?.status.inScope && url
      : url

    const repo = this.selectedExportTarget === 'prototype'
      ? this.gitHubData().repo
      : `${this.gitHubData().repo}-baseline`;

    if (scope && repo) {
      try {
        // Extract path and filename
        const path = new URL(url).pathname.replace(/^\/+/, "");
        const filename = path.split("/").pop() || "index.html";

        // Check if skipped or new
        const fileRow = this.filesTable().find(f => f.path === path);
        const isSkipped = fileRow?.status === ExportStatus.SkipNew ||
          fileRow?.status === ExportStatus.SkipOverwrite;
        const isNew = node?.data?.status?.isNew === true;

        // Set content
        let content: string;
        if (isSkipped) { content = '<!-- Skipped file -->'; }
        else if (isNew) {
          const breadcrumbs = this.projectState.getBreadcrumbChain(node.data.url, lang).slice(1);
          content = this.exportGitHubService.formatNewPageAsJekyll(node, breadcrumbs, this.gitHubData().owner, repo, lang)
        }
        else {
          const doc = await this.fetchService.fetchContent(url, "prod");
          const breadcrumbs = this.selectedExportTarget === 'prototype'
            ? this.projectState.getBreadcrumbChain(node.data.url, lang).slice(1)
            : undefined;
          content = await this.exportGitHubService.formatDocumentAsJekyll(doc, url, this.gitHubData().owner, repo, breadcrumbs);
        }
        pages.push({ url, path, filename, content });
      } catch (error) {
        console.error(`Error fetching content for ${url}:`, error);
      }
    }
    // recurse into children
    if (node?.children) {
      for (const child of node.children) {
        const childPages = await this.getUrlandContent(child, lang);
        pages.push(...childPages);
      }
    }
    return pages;
  }

  // Main export function (DO NOT REMOVE TIMEOUTS, THEY GIVE ENOUGH TIME FOR SHA TO UPDATE BETWEEN EXPORTS)
  async exportProjectToGitHub() {
    const owner = this.gitHubData().owner;
    const repo = this.selectedExportTarget === 'prototype'
      ? this.gitHubData().repo
      : `${this.gitHubData().repo}-baseline`;
    const branch = this.gitHubData().branch;
    const token = this.exportGitHubService.token();
    const projectName = this.projectData().projectName;

    // Step 1: Gather all in-scope or baseline URLs and their content
    this.exportProgress.set({ step: 'github.export.progress.step1', progress: 5, });
    const nodes = this.projectState.getProjectTree();

    let pages: PageData[] = [];
    if (this.selectedExportLanguage === 'primary') {
      pages = await this.getUrlandContent(nodes[0], 'primary');
    } else if (this.selectedExportLanguage === 'opposite') {
      pages = await this.getUrlandContent(nodes[0], 'opposite');
    } else { // 'both'
      const primaryPages = await this.getUrlandContent(nodes[0], 'primary');
      const oppositePages = await this.getUrlandContent(nodes[0], 'opposite');
      pages = [...primaryPages, ...oppositePages];
    }
    console.log('Exporting pages to GitHub:', pages);

    // Step 2: Add paths and filenames for GitHub and filter out any skipped pages
    setTimeout(() => { this.exportProgress.set({ step: 'github.export.progress.step2', progress: 10 }); }, 1000);
    const allPages = pages.map(p => {
      let path = new URL(p.url).pathname;
      path = path.replace(/^\/+/, ""); // strip leading slashes
      const lastSegment = path.split("/").pop() || "index.html";
      return { url: p.url, path, content: p.content, filename: lastSegment };
    });

    const exportPages = allPages.filter(page => {
      const fileRow = this.filesTable().find(f => f.path === page.path);
      return fileRow?.status !== ExportStatus.SkipNew && fileRow?.status !== ExportStatus.SkipOverwrite;
    });

    console.log("Exporting pages to GitHub:", exportPages);

    // Step 3: Check for templates files to include
    setTimeout(() => { this.exportProgress.set({ step: 'github.export.progress.step3', progress: 15 }); }, 1000);
    const templateFilesToExport = this.templateTable()
      .filter(f => f.status === ExportStatus.ExportNew || f.status === ExportStatus.ExportOverwrite)
      .map(f => f.path);

    // Step 4: Set up repo (create it if it doesn't exist, add template files)
    setTimeout(() => { this.exportProgress.set({ step: 'github.export.progress.step4', progress: 20 }); }, 1000);
    const setupResult = await this.exportGitHubService.setupRepo(owner, repo, branch, token, projectName, templateFilesToExport, nodes);

    //Show failure message
    if (!setupResult.success && setupResult.error?.status === 403) {
      // Read-only token error
      this.exportMessage.set({
        severity: 'error',
        text: this.translate.instant('github.export.error.readOnlyToken'),
      });
      return;
    } else if (!setupResult.success) {
      // Other errors
      this.exportMessage.set({
        severity: 'error',
        text: setupResult.error?.message || this.translate.instant('github.export.error.other'),
      });
      return;
    }

    // Step 5: Export each page to GitHub
    const existingFiles = await this.exportGitHubService.getRepoTree(owner, repo, branch, token);
    const progressPerFile = 60 / exportPages.length;
    const primaryLang = this.projectState.detectPrimaryLanguage();

    for (const [index, page] of exportPages.entries()) {
      try {
        this.exportProgress.set({ step: 'github.export.progress.step5', progress: 30 + (index * progressPerFile), });
        const result = await this.exportGitHubService.exportToGitHub(owner, repo, branch, page.path, page.filename, page.content, token, existingFiles, true);
        //Store SHA with project data
        if (result?.content?.sha) {
          const pathLang = page.path.startsWith('en/') || page.path.endsWith('en.html') ? 'en' : 'fr';
          const lang = pathLang === primaryLang ? 'primary' : 'opposite';
          this.projectState.setPageSha(page.url, result.content.sha, this.selectedExportTarget, lang);
        }
      } catch (error) {
        console.error(`Error exporting ${page.path}:`, error);
      }
    }
    // Step 6: Add redirect & index file
    setTimeout(() => { this.exportProgress.set({ step: 'github.export.progress.step6', progress: 90 }); }, 1000);
    // Get GitHub paths
    const githubPages: Map<string, string> = await this.exportGitHubService.getRepoTree(owner, repo, branch, token);
    const githubContentPages = [...githubPages.keys()].filter(path =>
      path.startsWith('en/') || path.startsWith('fr/')
    );
    // Combine with exported paths (allPages)
    const allPagePaths = new Set([
      ...allPages.map(page => page.path),
      ...githubContentPages
    ]);
    // Format redirect
    const redirects = [...allPagePaths].map(path => ({
      origin: `https://www.canada.ca/${path}`,
      destination: `/${repo}/${path}`
    }));
    const redirectsJson = JSON.stringify(redirects, null, 2);
    await this.exportGitHubService.exportToGitHub(owner, repo, branch, "source/data/exclude-redirect-links.json", "exclude-redirect-links.json", redirectsJson, token, existingFiles, true);

    setTimeout(() => { this.exportProgress.set({ step: 'common.complete', progress: 100 }); }, 1000);
    console.log("Page export complete.");
    this.projectState.setExportDate();
    setTimeout(() => this.exportProgress.set(null), 5000);
    this.compareFiles();
  }

  //Create file list
  async compareFiles() {
    const owner = this.gitHubData().owner;
    const repo = this.selectedExportTarget === 'prototype'
      ? this.gitHubData().repo
      : `${this.gitHubData().repo}-baseline`;
    const branch = this.gitHubData().branch;
    const token = this.exportGitHubService.token();

    const scope = this.selectedExportTarget === 'prototype' ? "inScope" : "all"

    const relativeUrls = (urls: Set<string>) =>
      [...urls].map(url => url.replace("https://www.canada.ca/", ""));

    const pages = relativeUrls(this.projectState.getAllUrls(scope, 'primary'));
    const oppPages = relativeUrls(this.projectState.getAllUrls(scope, 'opposite'));

    // Build project paths based on selected export language
    let projectPaths: string[] = [];
    if (this.selectedExportLanguage === 'primary') {
      projectPaths = pages;
    } else if (this.selectedExportLanguage === 'opposite') {
      projectPaths = oppPages;
    } else {
      projectPaths = [...pages, ...oppPages];
    }

    const githubPages: Map<string, string> = await this.exportGitHubService.getRepoTree(owner, repo, branch, token);

    // Only show GitHub files in AIDA if they match these patterns 
    const githubFilePatterns = [
      /^_config\.yml$/,
      /^index\.html$/,
      /^README\.md$/,
      /^robots\.txt$/,
      /^_includes\/header\/header\.html$/,
      /^_includes\/headers-includes\/sitesearch\.html$/,
      /^_includes\/resources-inc\/footer\.html$/,
      /^source\/data\/exclude-redirect-links\.json$/,
      /^source\/exit-intent-e\.html$/,
      /^source\/exit-intent-f\.html$/,
      /^404\.html$/,
    ];

    // Add language-specific GitHub file patterns (based on export mode)
    const primaryLang = this.projectState.detectPrimaryLanguage();
    const oppositeLang = primaryLang === 'en' ? 'fr' : 'en';

    if (this.selectedExportLanguage === 'primary') {
      githubFilePatterns.push(new RegExp(`^${primaryLang}\/.*`));
    } else if (this.selectedExportLanguage === 'opposite') {
      githubFilePatterns.push(new RegExp(`^${oppositeLang}\/.*`));
    } else { // 'both'
      githubFilePatterns.push(/^en\/.*/);
      githubFilePatterns.push(/^fr\/.*/);
    }

    const filteredGithubPages = new Map(
      [...githubPages].filter(([path]) =>
        githubFilePatterns.some((pattern) => pattern.test(path))
      )
    );

    // Jekyll files created or copied by the Design Assistant
    const jekyllUpdateFiles: { path: string; content: string }[] = [
      { path: "404.html", content: "<!-- 404 page -->" }, //copied from core-prototype
      { path: "_includes/header/header.html", content: "<!-- header -->" }, //copied from core-prototype
      { path: "_includes/headers-includes/sitesearch.html", content: "<!-- sitesearch -->" }, //copied from core-prototype
      { path: "_includes/resources-inc/footer.html", content: "<!-- footer -->" }, //copied from core-prototype
      { path: "source/exit-intent-e.html", content: "<!-- exit intent - english -->" }, //copied from core-prototype
      { path: "source/exit-intent-f.html", content: "<!-- exit intent - french -->" }, //copied from core-prototype
      { path: "source/data/exclude-redirect-links.json", content: "<!-- redirects -->" }, //generated for all pages in repo
      { path: "index.html", content: "<!-- sitemap -->" }, //generated for all pages in repo
    ];

    const jekyllSkipFiles: { path: string; content: string }[] = [
      { path: "_config.yml", content: "<!-- config -->" }, //genertated
      { path: "README.md", content: "<!-- readme -->" }, //generated
      { path: "robots.txt", content: "<!-- robots -->" }, //generated
    ];

    // Add all Jekyll files to export list
    [...jekyllUpdateFiles, ...jekyllSkipFiles].forEach(file => {
      projectPaths.push(file.path);
    });

    //De-dupe paths
    const allPaths = new Set<string>([
      ...projectPaths,
      ...filteredGithubPages.keys(),
    ]);

    console.log('Project paths:', projectPaths);
    console.log('Filtered GitHub pages:', [...filteredGithubPages.keys()]);
    console.log('All paths (combined):', [...allPaths]);

    //Table data
    const table: FileCompareRow[] = [];
    for (const path of allPaths) {
      const inExport = projectPaths.some(url => url === path);
      const inGitHub = filteredGithubPages.has(path);
      const isAutoUpdateFile = jekyllUpdateFiles.some(f => f.path === path);
      const isAlwaysSkipFile = jekyllSkipFiles.some(f => f.path === path);

      // Get path language for node lookup
      const pathLang = path.startsWith('en/') || path.endsWith('en.html') ? 'en' :
        path.startsWith('fr/') || path.endsWith('fr.html') ? 'fr' : null;

      //Check ROT status & skip by default
      const fullUrl = `https://www.canada.ca/${path}`;
      let node: TreeNode | null = null;
      if (pathLang === primaryLang) {
        node = this.projectState.findNodeByUrl(this.projectState.getProjectTree(), fullUrl, 'primary');
      } else if (pathLang === oppositeLang) {
        node = this.projectState.findNodeByUrl(this.projectState.getProjectTree(), fullUrl, 'opposite');
      }
      const isRot = node?.data?.status?.isROT === true;

      const shouldIgnorePage = inGitHub && !inExport && pathLang !== null && pathLang !== primaryLang;

      console.log(`Path: ${path}, inExport: ${inExport}, inGitHub: ${inGitHub}, isRot: ${isRot}, shouldIgnore: ${shouldIgnorePage}`);

      let status: FileCompareRow['status'];

      if (shouldIgnorePage) {
        status = ExportStatus.OppLanguage;
      }
      else if (isRot) {
        status = inGitHub ? ExportStatus.SkipOverwrite : ExportStatus.SkipNew;
      }
      else if (inExport && inGitHub) {
        if (isAutoUpdateFile) status = ExportStatus.ExportOverwrite;
        else if (isAlwaysSkipFile) status = ExportStatus.SkipOverwrite;
        else {
          let storedSha: string | undefined;
          if (pathLang === primaryLang) {
            storedSha = node?.data?.sha?.[this.selectedExportTarget];
          } else if (pathLang === oppositeLang) {
            storedSha = node?.data?.oppSha?.[this.selectedExportTarget];
          }
          const githubSha = filteredGithubPages.get(path);
          status = storedSha && storedSha === githubSha
            ? ExportStatus.ExportOverwrite  // SHA matches - refresh content
            : ExportStatus.SkipOverwrite;   // No SHA or mismatch - skip by default
        }
      }
      else if (inExport) status = ExportStatus.ExportNew;
      else status = ExportStatus.AddToProject;

      table.push({ path, status });
    }

    this.filesTable.set(table);
  }

  colorConfig: Record<string, { icon: string, background: string, text: string }> = {
    [ExportStatus.SkipNew]: {
      icon: 'pi pi-angle-double-right',
      background: 'bg-green-100 hover:bg-green-200',
      text: 'text-green-900'
    },
    [ExportStatus.SkipOverwrite]: {
      icon: 'pi pi-angle-double-right',
      background: 'bg-blue-100 hover:bg-blue-200',
      text: 'text-blue-900'
    },
    [ExportStatus.ExportOverwrite]: {
      icon: 'pi pi-refresh',
      background: 'bg-blue-500 hover:bg-blue-600',
      text: 'text-blue-50'
    },
    [ExportStatus.ExportNew]: {
      icon: 'pi pi-plus',
      background: 'bg-green-500 hover:bg-green-600',
      text: 'text-green-50'
    },
    [ExportStatus.AddToProject]: {
      icon: 'pi pi-github',
      background: 'bg-primary-500 hover:bg-primary-600',
      text: 'text-primary-50'
    },
    [ExportStatus.OppLanguage]: {
      icon: 'pi pi-github',
      background: 'bg-primary-100 hover:bg-primary-200',
      text: 'text-primary-900'
    }
  };

  getIcon(status: ExportStatus): string {
    const config = this.colorConfig[status];
    return `${config.icon} ${config.text}` || '';
  }

  getBgAndText(status: ExportStatus): string {
    const config = this.colorConfig[status];
    return `${config.background} ${config.text}`;
  }

  toggleUpdate(file: FileCompareRow) {
    switch (file.status) {
      case ExportStatus.SkipNew:
        file.status = ExportStatus.ExportNew;
        break;
      case ExportStatus.ExportNew:
        file.status = ExportStatus.SkipNew;
        break;
      case ExportStatus.SkipOverwrite:
        file.status = ExportStatus.ExportOverwrite;
        break;
      case ExportStatus.ExportOverwrite:
        file.status = ExportStatus.SkipOverwrite;
        break;
      // AddToProject handled separately
    }
    this.filesTable.set([...this.filesTable()]); // triggers UI refresh
  }

  setAll(mode: 'export' | 'skip', table: 'project' | 'template') {
    const targetFiles = table === 'project' ? this.projectTable() : this.templateTable();
    const targetPaths = new Set(targetFiles.map(f => f.path));

    const updated = this.filesTable().map(file => {
      // Skip files that are AddToProject or not in the table
      if (file.status === ExportStatus.AddToProject || !targetPaths.has(file.path)) {
        return file;
      }

      // For new pages: set to either ExportNew or SkipNew
      if (file.status === ExportStatus.SkipNew || file.status === ExportStatus.ExportNew) {
        return { ...file, status: mode === 'export' ? ExportStatus.ExportNew : ExportStatus.SkipNew };
      }

      // For overwrite pages: set to either ExportOverwrite or SkipOverwrite
      if (file.status === ExportStatus.SkipOverwrite || file.status === ExportStatus.ExportOverwrite) {
        return { ...file, status: mode === 'export' ? ExportStatus.ExportOverwrite : ExportStatus.SkipOverwrite };
      }

      return file;
    });
    this.filesTable.set(updated);
  }

  //Progress
  exportProgress = signal<ExportProgress | null>(null);

  //Add to project
  async addToProject(file: FileCompareRow) {
    let url = `https://www.canada.ca/${file.path}`;
    if (file.status === ExportStatus.OppLanguage) {
      try {
        const doc = await this.fetchService.fetchContent(url);
        const htmlLang = doc.documentElement.getAttribute('lang');
        const metaLang = doc.querySelector('meta[name="dcterms.language"]')?.getAttribute('content');
        const normalizedMetaLang = metaLang === 'eng' ? 'en' : metaLang === 'fra' ? 'fr' : null;
        const urlLang = url.includes('/en/') ? 'en' : url.includes('/fr/') ? 'fr' : null;
        const currentLang = htmlLang || normalizedMetaLang || urlLang || 'en'; // default to en
        const oppLang = currentLang === 'en' ? 'fr' : 'en';
        const oppUrl = doc.querySelector(`link[rel="alternate"][hreflang="${oppLang}"]`)?.getAttribute('href') || '';
        if (!oppUrl) {
          console.error('No opposite language link found for:', url);
          return;
        }
        url = oppUrl;
      } catch (error) {
        console.error('Error fetching page:', error);
        return; // or show an error message to the user
      }
    }
    this.router.navigate(['/import-page'], {
      queryParams: { url: url }
    });
  }


  // Export target options
  selectedExportTarget: 'prototype' | 'baseline' = 'prototype';

  get exportTargetOptions() {
    return [
      { label: this.translate.instant('github.connect.export.toggle.prototype'), value: 'prototype' },
      { label: this.translate.instant('github.connect.export.toggle.baseline'), value: 'baseline' }
    ];
  }

  //Export language options
  selectedExportLanguage: 'primary' | 'opposite' | 'both' = 'primary';

  get exportLanguageOptions() {
    const primaryLang = this.projectState.detectPrimaryLanguage();
    const primaryLabel = primaryLang === 'en'
      ? this.translate.instant('common.language.english')
      : this.translate.instant('common.language.french');
    const oppositeLabel = primaryLang === 'en'
      ? this.translate.instant('common.language.french')
      : this.translate.instant('common.language.english');

    return [
      { label: primaryLabel, value: 'primary' },
      { label: oppositeLabel, value: 'opposite' },
      { label: this.translate.instant('common.both'), value: 'both' }
    ];
  }

}
