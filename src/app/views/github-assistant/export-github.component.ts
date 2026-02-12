import { Component, OnInit, inject, signal, computed, effect, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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

//Services
import { ExportGitHubService } from '../../services/github/export-github.service';
import { ProjectStateService } from '../../services/project-state.service';
import { FetchService } from '../../services/fetch.service';
import { GitHubAuthService } from '../../services/github/github-auth.service';
import { ThemeService } from '../../services/theme.service';
import { environment } from '../../../environments/environment';

//Components
import { SetupRepoComponent } from '../../components/setup-repo/setup-repo.component';
import { PatComponent } from "../../components/sign-in/pat.component";

export interface PageData {
  url: string;
  content: string;
}

interface FileCompareRow {
  path: string;
  location: 'update' | 'skip' | 'new page' | 'github only';
  newer?: 'export' | 'github' | 'same';
}

interface ExportTarget {
  label: string;
  value: 'prototype' | 'baseline';
}

interface FileStatus {
  path: string;
  location: 'update' | 'skip' | 'new page' | 'github only';
}

interface ExportMessage {
  severity: 'success' | 'info' | 'warn' | 'error';
  text: string;
}


@Component({
  selector: 'aida-export-github',
  imports: [CommonModule, FormsModule, TranslateModule,
    MessageModule, ButtonModule, TooltipModule, PopoverModule, SelectButtonModule, DividerModule,
    TableModule, ChipModule,
    SetupRepoComponent, PatComponent],
  templateUrl: './export-github.component.html',
  styles: ``
})
export class ExportGithubComponent implements OnInit {
  private projectState = inject(ProjectStateService);
  public authService = inject(GitHubAuthService);
  public exportGitHubService = inject(ExportGitHubService);
  private fetchService = inject(FetchService);
  public translate = inject(TranslateService);
  private themeService = inject(ThemeService);

  defaultOrg = environment.defaultOrg;

  url = "test";
  username = computed(() => this.exportGitHubService.user()?.name || this.exportGitHubService.user()?.login || 'User');

  //Signals
  projectData = this.projectState.getProject;
  connectionStatus = signal<'checking' | 'connected' | 'unverified' | 'warning' | 'error' | 'missing'>('checking');
  showDisclaimer = signal<boolean>(false);

  filesTable = signal<FileStatus[]>([]);
  exportMessage = signal<ExportMessage | null>(null);

  pat = signal<string>(this.exportGitHubService.pat);
  precheckInProgress = signal<boolean>(false);

  constructor() {
    // Watch for changes to token or repo settings and run validateConnection
    effect(async () => {
      const token = this.exportGitHubService.token();
      const owner = this.projectData().github.owner;
      const repo = this.projectData().github.repo;
      console.log("Effect triggered: token or repo changed.", { token, owner, repo });
      // Only run precheck if we have a token and repo configured
      if (token && owner && repo) {
        await this.validateConnection();
        console.warn("Running validation again!")
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
      console.error('Token validation failed:', result.error);
    } else if (result.repoExists && !result.hasRepoAccess) {
      this.connectionStatus.set('warning');
      console.warn(`No write access to ${owner}/${repo}`);
    } else if (!result.repoExists && !result.canCreateRepo) {
      this.connectionStatus.set('warning');
      console.warn(`Cannot create repo in ${owner}`);
    } else {
      this.connectionStatus.set('connected');
      this.showDisclaimer.set(result.showDisclaimer ?? false);
      if (result.showDisclaimer) {
        console.warn('Connected to GitHub but PAT scope cannot be verified. Please ensure PAT has appropriate scopes.');
      }
    }
    this.precheckInProgress.set(false);
  }

  // Computed signals
  gitHubData = computed(() => this.projectData().github);
  inScopePageCount = computed(() => this.projectData().inScopePages);
  baselinePageCount = computed(() => this.projectData().baselinePages);
  jekyllFileCount = computed(() => this.filesTable().filter(f => !f.path.startsWith('en/') && !f.path.startsWith('fr/')).length);
  newCount = computed(() => this.filesTable().filter(f => f.location === 'new page').length);
  updatedCount = computed(() => this.filesTable().filter(f => f.location === 'update').length);
  skippedCount = computed(() => this.filesTable().filter(f => f.location === 'skip').length);
  githubOnlyCount = computed(() => this.filesTable().filter(f => f.location === 'github only').length);

  //Check if project is loaded
  get projectLoaded(): boolean {
    const name = this.projectData().projectName;
    return !!name;
  }

  openRepo() {
    let modifier = '';
    if (this.selectedExportTarget === 'baseline') { modifier = '-baseline'; };
    const url = `https://github.com/${this.projectData().github.owner}/${this.projectData().github.repo}${modifier}`;
    window.open(url, '_blank');
  }

  statusClasses = computed(() => {
    const status = this.connectionStatus();
    const isDark = this.themeService.darkMode();

    const baseClasses = 'flex align-items-center gap-2 p-3 border-round-md mb-3';

    const bgMap = {
      'connected': isDark ? 'bg-green-900' : 'bg-green-50',
      'unverified': isDark ? 'bg-blue-900' : 'bg-blue-50',
      'warning': isDark ? 'bg-yellow-900' : 'bg-yellow-50',
      'error': isDark ? 'bg-red-900' : 'bg-red-50',
      'missing': isDark ? 'bg-red-900' : 'bg-red-50',
      'checking': isDark ? 'bg-blue-900' : 'bg-blue-50'
    };

    return `${baseClasses} ${bgMap[status]}`;
  });

  titleClasses = computed(() => {
    const status = this.connectionStatus();
    const isDark = this.themeService.darkMode();

    const colorMap = {
      'connected': isDark ? 'text-green-300' : 'text-green-700',
      'unverified': '',
      'warning': isDark ? 'text-yellow-300' : 'text-yellow-700',
      'error': isDark ? 'text-red-300' : 'text-red-700',
      'missing': isDark ? 'text-red-300' : 'text-red-700',
      'checking': ''
    };

    return `font-semibold my-0 ${colorMap[status]}`;
  });

  exportTargetOptions: ExportTarget[] = [
    { label: 'Prototype', value: 'prototype' },
    { label: 'Baseline', value: 'baseline' }
  ];
  selectedExportTarget: 'prototype' | 'baseline' = 'prototype';
  showTokenHelp = false;

  repos: string[] = [];
  filteredRepos: string[] = [];
  ownerError = '';
  showHelp = false;

  async ngOnInit() {
    //this.projectState.loadFromLocalStorage();
    await this.compareFiles(this.gitHubData().owner, this.gitHubData().repo, this.gitHubData().branch, this.exportGitHubService.token());
    //temp
    this.projectData().lastExported = new Date();
    await this.validateConnection();
  }

  // Show repo settings as secondary task button & overlay (if data exists or overlay is open)
  // Otherwise, show as primary task card in place of data card
  @ViewChild('settingsOverlay') settingsOverlay!: Popover;
  showSettingsButton(): boolean {
    const hasGithubData = !!(this.projectData().github.owner && this.projectData().github.repo && this.projectData().github.branch);
    return hasGithubData || this.settingsOverlay?.overlayVisible;
  }

  //Get in-scope URLs and page content
  private async getUrlandContent(node: TreeNode): Promise<PageData[]> {
    const pages: PageData[] = [];
    if (node?.data?.status.inScope && node?.data?.url && !this.gitHubData().repo) {
      try {
        const doc = await this.fetchService.fetchContent(node.data.url, "prod");
        const jekyllFormatted = await this.exportGitHubService.formatDocumentAsJekyll(doc, node.data.url, this.gitHubData().owner, this.gitHubData().repo);
        pages.push({ url: node.data.url, content: jekyllFormatted });
      } catch (error) {
        console.error(`Error fetching content for ${node.data.url}:`, error);
      }
    }
    // recurse into children
    if (node?.children) {
      for (const child of node.children) {
        const childPages = await this.getUrlandContent(child);
        pages.push(...childPages);
      }
    }
    return pages;
  }

  async exportProjectToGitHub(owner: string, repo: string, branch: string, token: string, overwrite = false) {

    //Step 0: Save current GitHub data to state
    this.projectState.setGitHubRepo({ owner, repo, branch });
    this.projectState.saveProject();

    // Step 1: Gather all in-scope URLs and their content
    const nodes = this.projectState.getProjectTree();
    const pages: PageData[] = await this.getUrlandContent(nodes[0]);
    console.log('Exporting pages to GitHub:', pages);

    // Step 2: Find common path prefix
    function getCommonPrefix(urls: string[]): string {
      const paths = urls.map(url => new URL(url).pathname.split("/").filter(Boolean));
      const first = paths[0];
      const prefix: string[] = [];

      for (let i = 0; i < first.length; i++) {
        const segment = first[i];
        if (paths.every(p => p[i] === segment)) {
          prefix.push(segment);
        } else {
          break;
        }
      }
      if (prefix.length) {
        const last = prefix[prefix.length - 1];
        if (/\.[a-z0-9]+$/i.test(last)) { // ends with file extension
          prefix.pop();
        }
      }
      return "/" + prefix.join("/");
    }

    const urls = pages.map(page => page.url);
    const commonRoot = getCommonPrefix(urls);
    console.log("Detected common root:", commonRoot);

    // Step 3: Trim common root from urls for GitHub paths
    const exportPages = pages.map(p => {
      let path = new URL(p.url).pathname;
      //comment out this if statement if we want paths to start at /en & /fr
      //if (path.startsWith(commonRoot)) {
      //  path = path.slice(commonRoot.length);
      //}
      path = path.replace(/^\/+/, ""); // strip leading slashes
      const lastSegment = path.split("/").pop() || "index.html";
      //console.log(`Mapping URL ${p.url} to path ${path}, filename ${lastSegment}`);
      return { url: p.url, path, content: p.content, filename: lastSegment };
    });

    console.log("Exporting pages to GitHub:", exportPages);

    // Step 4: Check existing files in repo
    const existingFiles = await this.exportGitHubService.getRepoTree(owner, repo, branch, token);
    //console.warn("Existing files in repo:", existingFiles);

    // Step 5: Set up repo (create it if it doesn't exist, add _config.yml and copy over core files)
    await this.exportGitHubService.setupRepo(owner, repo, branch, token, existingFiles, nodes);

    console.log("Repository setup complete.");


    // Step 6: Export each page to GitHub
    const redirects: { origin: string; destination: string }[] = [];
    for (const page of exportPages) {
      try {
        const result = await this.exportGitHubService.exportToGitHub(owner, repo, branch, page.path, page.filename, page.content, token, existingFiles, overwrite);
        //console.log(`Successfully exported ${page.path}:`, result);
        redirects.push({ origin: page.url, destination: `/${repo}/${page.path}` });
      } catch (error) {
        console.error(`Error exporting ${page.path}:`, error);
      }
    }
    // Step 5: Add redirect file
    const redirectsJson = JSON.stringify(redirects, null, 2);
    await this.exportGitHubService.exportToGitHub(owner, repo, branch, "source/data/exclude-redirect-links.json", "exclude-redirect-links.json", redirectsJson, token, existingFiles, overwrite);

    console.log("Page export complete.");
  }

  //Create file list


  async compareFiles(owner: string, repo: string, branch: string, token?: string) {
    console.log("Compare!")

    const scope = this.selectedExportTarget === 'prototype' ? "inScope" : "all"
    const pages = this.projectState.getAllUrls(scope);
    console.log(pages);

    const projectPaths = [...pages].map(url => url.replace("https://www.canada.ca/", ""));

    const githubPages: Map<string, string> = await this.exportGitHubService.getRepoTree(owner, repo, branch, token);

    const githubFilePatterns = [
      /^_config\.yml$/,
      /^index\.html$/,
      /^README\.md$/,
      /^_includes\/header\/header\.html$/,
      /^_includes\/resources-inc\/footer\.html$/,
      /^source\/data\/exclude-redirect-links\.json$/,
      /^source\/exit-intent-e\.html$/,
      /^source\/exit-intent-f\.html$/,
      /^404\.html$/,
      /^en\/.*/,   // anything under /en/
      /^fr\/.*/,   // anything under /fr/
    ];

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
      { path: "source/data/exclude-redirect-links.json", content: "<!-- redirects -->" }, //generated for all pages in repo
    ];

    const jekyllSkipFiles: { path: string; content: string }[] = [
      { path: "_config.yml", content: "<!-- config -->" }, //genertated
      { path: "README.md", content: "<!-- readme -->" }, //generated
    ];

    // Add all Jekyll files to export list
    [...jekyllUpdateFiles, ...jekyllSkipFiles].forEach(file => {
      projectPaths.join(file.path);
    });

    //De-dupe paths
    const allPaths = new Set<string>([
      ...projectPaths,
      ...filteredGithubPages.keys(),
    ]);

    console.log(allPaths);

    //Table data
    const table: FileCompareRow[] = [];
    for (const path of allPaths) {
      const inExport = projectPaths.some(url => url === path);
      const inGitHub = filteredGithubPages.has(path);
      const isAutoUpdateFile = jekyllUpdateFiles.some(f => f.path === path);
      const isAlwaysSkipFile = jekyllSkipFiles.some(f => f.path === path);

      let location: FileCompareRow['location'];
      if (inExport && inGitHub) {
        if (isAutoUpdateFile) location = 'update';
        else if (isAlwaysSkipFile) location = 'skip';
        else location = 'skip';
      }
      else if (inExport) location = 'new page';
      else location = 'github only';

      table.push({ path, location });
    }

    this.filesTable.set(table);
  }

  /*getIcon(location: string): string {
    switch (location) {
      case 'skip': return 'pi pi-angle-double-right';
      case 'update': return 'pi pi-refresh';
      case 'new page': return 'pi pi-file-plus';
      case 'github only': return 'pi pi-github';
      default: return '';
    }
  }
*/
  colorConfig: Record<string, { icon: string, darkBg: string, lightBg: string, darkText: string, lightText: string, inverseText: string, lightHover: string, darkHover: string }> = {
    'skip': { icon: 'pi pi-angle-double-right', darkBg: 'bg-gray-200 hover:bg-gray-300', darkText: 'text-gray-900', lightBg: 'bg-gray-50 hover:bg-gray-100', lightText: 'text-gray-500', inverseText: 'text-black', lightHover: 'hover:bg-gray-50 border-round-lg', darkHover: 'hover:bg-gray-200 border-round-lg hover:text-black-alpha-90' },
    'update': { icon: 'pi pi-refresh', darkBg: 'bg-primary-500 hover:bg-primary-600', darkText: 'text-primary-50', lightBg: 'bg-primary-50 hover:bg-primary-100', lightText: 'text-primary-500', inverseText: 'text-white', lightHover: 'hover:bg-primary-50 border-round-lg', darkHover: 'hover:bg-primary-500 border-round-lg' },
    'new page': { icon: 'pi pi-file-plus', darkBg: 'bg-yellow-400 hover:bg-yellow-600', darkText: 'text-yellow-900', lightBg: 'bg-yellow-50 hover:bg-yellow-100', lightText: 'text-yellow-800', inverseText: 'text-black', lightHover: 'hover:bg-yellow-50 border-round-lg', darkHover: 'hover:bg-yellow-400 border-round-lg hover:text-black-alpha-90' },
    'github only': { icon: 'pi pi-github', darkBg: 'bg-blue-400 hover:bg-blue-500', darkText: 'text-blue-50', lightBg: 'bg-blue-50 hover:bg-blue-100', lightText: 'text-blue-400', inverseText: 'text-white', lightHover: 'hover:bg-blue-50 border-round-lg', darkHover: 'hover:bg-blue-400 border-round-lg' },
  };

  getIcon(location: string): string {
    return this.colorConfig[location]?.icon || '';
  }

  getBgAndText(location: string, mode: 'alwaysDark' | 'followTheme' | 'bgOnly' | 'textOnly' | 'hoverOnly' | 'inverseText'): string {
    const config = this.colorConfig[location];
    if (mode === 'alwaysDark') { return `${config.darkBg} ${config.inverseText}` } //chips are always dark mode
    else if (mode === 'bgOnly') { return this.themeService.darkMode() ? config.darkBg : config.lightBg }
    else if (mode === 'textOnly') { return this.themeService.darkMode() ? config.darkText : config.lightText }
    else if (mode === 'hoverOnly') { return this.themeService.darkMode() ? config.darkHover : config.lightHover }
    else if (mode === 'inverseText') { return this.themeService.darkMode() ? config.inverseText : 'text-black' }
    else return this.themeService.darkMode() ? `${config?.darkBg} ${config?.darkText}` : `${config?.lightBg} ${config?.lightText}`
  }

  toggleUpdate(file: FileCompareRow) {
    if (file.location === 'skip') {
      file.location = 'update';
    } else if (file.location === 'update') {
      file.location = 'skip';
    }
    this.filesTable.set([...this.filesTable()]); // triggers UI refresh
  }

  setAll(target: 'skip' | 'update') {
    const updated = this.filesTable().map(file => {
      if (file.location === 'skip' || file.location === 'update') {
        return { ...file, location: target };
      }
      return file;
    });
    this.filesTable.set(updated);
  }

  //TESTING



  isExporting = signal(false);
  //exportMessage = signal<{ severity: string; text: string } | null>(null);

}
