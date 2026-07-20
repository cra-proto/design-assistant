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
import { ExportGitHubService } from '../../../services/github/export-github.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { FetchService } from '../../../services/fetch.service';
import { GitHubAuthService } from '../../../services/github/github-auth.service';
import { UsageService } from '../../../services/usage.service';
import { HtmlNormalizationService } from '../../../services/html-normalization.service';

//Components
import { SetupRepoComponent } from '../../../components/setup-repo/setup-repo.component';
import { SignInBannerComponent } from '../../../components/sign-in/sign-in-banner/sign-in-banner.component';
import { BookmarkletComponent } from '../../../components/bookmarklet/bookmarklet.component';

import { CDTS_TEMPLATE_ENG, CDTS_TEMPLATE_FRA, EXIT_PAGE_TEMPLATE_ENG, EXIT_PAGE_TEMPLATE_FRA, LINK_DETOUR_JS } from '../../../common/cdts.template';
import { environment } from '../../../../environments/environment';

enum ExportStatus {
  ExportNew = 'exportPages.export.status.addToGitHub', // Export - New page
  ExportOverwrite = 'exportPages.export.status.overwrite', // Export - Existing page
  SkipNew = 'exportPages.export.status.skipNew', // Skip export - New page
  SkipOverwrite = 'exportPages.export.status.skipOverwrite', // Skip export - Existing page
  AddToProject = 'exportPages.export.status.addToProject', // Add GitHub only page to project
  OppLanguage = 'exportPages.export.status.addOppLangToProject' // Add GitHub only page to project (converts to primary language)
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
    SetupRepoComponent, SignInBannerComponent, BookmarkletComponent],
  templateUrl: './export.component.html',
  styles: ``
})
export class ExportComponent implements OnInit {
  private projectState = inject(ProjectStateService);
  public authService = inject(GitHubAuthService);
  public exportGitHubService = inject(ExportGitHubService);
  private fetchService = inject(FetchService);
  public translate = inject(TranslateService);
  private router = inject(Router)
  private usageService = inject(UsageService);
  private htmlNormalizationService = inject(HtmlNormalizationService)

  defaultOrg = environment.defaultOrg;
  readonly ExportStatus = ExportStatus;

  //Signals
  projectData = this.projectState.getProject;

  filesTable = signal<FileStatus[]>([]);
  exportMessage = signal<ExportMessage | null>(null);
  repoType = signal<'local' | 'github'>(this.projectData().repoType);

  markForTranslation() {
    marker('exportPages.settings.description.prototype');
    marker('exportPages.settings.description.baseline');
    marker('exportPages.export.status.addOppLangToProject');
    marker('exportPages.export.status.addToGitHub');
    marker('exportPages.export.status.addToProject');
    marker('exportPages.export.status.skipNew');
    marker('exportPages.export.status.skipOverwrite');
    marker('exportPages.export.status.overwrite');
    marker('exportPages.export.progress.gatherPages');
    marker('exportPages.export.progress.checkGitHub');
    marker('exportPages.export.progress.setupRepo');
    marker('exportPages.export.progress.exportPages');
    marker('exportPages.export.progress.setupRedirects');
  }

  constructor() {
    // Watch for changes to repo settings and run compareFiles()
    effect(async () => {
      void this.exportGitHubService.token(); // track signal
      const owner = this.projectData().github.owner;
      const repo = this.projectData().github.repo;
      const repoType = this.projectData().repoType;
      //Update repoType signal
      if (repoType) {
        this.repoType.set(repoType);
      }
      //Update table when owner or repo changes
      untracked(() => this.compareFiles());
    });
  }

  // Computed signals
  gitHubData = computed(() => this.projectData().github);

  projectTable = computed(() => this.filesTable().filter(f => f.path.startsWith('en') || f.path.startsWith('fr')));
  templateTable = computed(() => this.filesTable().filter(f => !f.path.startsWith('en') && !f.path.startsWith('fr')));

  projectFileCount = computed(() => this.projectTable().filter(f => f.status !== ExportStatus.AddToProject && f.status !== ExportStatus.OppLanguage).length);
  templateFileCount = computed(() => this.templateTable().length);

  newCount = computed(() => this.filesTable().filter(f => f.status === ExportStatus.ExportNew).length);
  updatedCount = computed(() => this.filesTable().filter(f => f.status === ExportStatus.ExportOverwrite).length);

  // Initialize table and connection status
  async ngOnInit() {
    //await this.compareFiles();
  }

  // Template visiblity controls
  // If a repo is configured (and overlay is closed), show the repo settings as a secondary task instead of a card
  @ViewChild('settingsOverlay') settingsOverlay!: Popover;
  hasRepoConfig(): boolean {
    const hasGithubData = !!(this.projectData().github.owner && this.projectData().github.repo && this.projectData().github.branch);
    return hasGithubData || this.settingsOverlay?.overlayVisible;
  }

  //Export language options
  selectedExportLanguage: 'en' | 'fr' | 'both' = 'en';

  get exportLanguageOptions() {
    const primaryLang = this.projectState.detectPrimaryLanguage();
    const enLabel = { label: this.translate.instant('common.language.english'), value: 'en' }
    const frLabel = { label: this.translate.instant('common.language.french'), value: 'fr' }
    const bothLabel = { label: this.translate.instant('common.both'), value: 'both' }
    if (primaryLang === 'en') { return [enLabel, frLabel, bothLabel] }
    else { return [frLabel, enLabel, bothLabel] }
  }

  // Export target options
  selectedExportTarget: 'prototype' | 'baseline' = 'prototype';

  get exportTargetOptions() {
    return [
      { label: this.translate.instant('common.version.prototype'), value: 'prototype' },
      { label: this.translate.instant('common.version.baseline'), value: 'baseline' }
    ];
  }

  // Open targeted GitHub repo
  openRepo() {
    let modifier = '';
    if (this.selectedExportTarget === 'baseline') { modifier = '-baseline'; };
    const url = `https://github.com/${this.projectData().github.owner}/${this.projectData().github.repo}${modifier}`;
    window.open(url, '_blank');
  }

  //CDTS template files
  cdtsFiles = ['source/data/exclude-redirect-links.json', 'source/exit-intent-e.html', 'source/exit-intent-f.html']
  //Jekyll template files
  jekyllUpdateFiles = ["404.html", "_includes/*", "index.html", "source/data/exclude-redirect-links.json", "source/exit-intent-e.html", "source/exit-intent-f.html"];
  jekyllSkipFiles = ["_config.yml", "README.md", "robots.txt"];

  // Populate files table (and compare project files with GitHub or UT)
  private compareFilesRequestId = 0;
  async compareFiles() {
    const requestId = ++this.compareFilesRequestId
    if (!this.repoType()) this.projectData().repoType ? this.repoType.set(this.projectData().repoType) : this.repoType.set("github");

    const lang = this.selectedExportLanguage;
    const scope = this.selectedExportTarget === 'prototype' ? 'inScope' : 'all';

    const enPages = this.projectState.getAllPages("en", this.selectedExportTarget, scope).map(p => p.path);
    const frPages = this.projectState.getAllPages("fr", this.selectedExportTarget, scope).map(p => p.path);

    const projectPaths = [
      ...(lang === 'en' ? enPages : lang === 'fr' ? frPages : [...enPages, ...frPages]),
      ...this.cdtsFiles
    ];

    // Local mode
    if (this.repoType() === 'local') {
      if (requestId !== this.compareFilesRequestId) return;
      this.filesTable.set(projectPaths.map(path => ({ path, status: ExportStatus.ExportNew })));
      return;
    }

    // GitHub mode
    const owner = this.gitHubData().owner;
    const repo = this.selectedExportTarget === 'prototype' ? this.gitHubData().repo : `${this.gitHubData().repo}-baseline`;
    const branch = this.gitHubData().branch;
    const token = this.exportGitHubService.token();

    const githubPages: Map<string, string> = (owner && this.gitHubData().repo)
      ? await this.exportGitHubService.getRepoTree(owner, repo, branch, token)
      : new Map();

    // Only show GitHub files in AIDA if they match these patterns 
    const langs = lang === 'both' ? ['en', 'fr'] : [lang];
    const langPatterns = langs.flatMap(lang => [new RegExp(`^${lang}\\/.*`), new RegExp(`^${lang}\\.html`)]);

    const githubFilePatterns = [
      /^_config\.yml$/,
      /^index\.html$/,
      /^README\.md$/,
      /^robots\.txt$/,
      /^source\/data\/exclude-redirect-links\.json$/,
      /^source\/exit-intent-e\.html$/,
      /^source\/exit-intent-f\.html$/,
      /^404\.html$/,
      ...langPatterns
    ];

    const filteredGithubPages = new Map(
      [...githubPages].filter(([path]) => githubFilePatterns.some((pattern) => pattern.test(path)))
    );

    const hasIncludes = ([...githubPages.keys()].some(p => p.startsWith('_includes/')));

    //Add Jekyll template files to project export list
    [...this.jekyllUpdateFiles, ...this.jekyllSkipFiles].forEach(file => {
      projectPaths.push(file);
    });

    //De-dupe paths (project files and pre-existing GitHub files)
    const allPaths = new Set<string>([
      ...projectPaths,
      ...filteredGithubPages.keys(),
    ]);

    //Table data
    const table: FileCompareRow[] = [];
    for (const path of allPaths) {
      // Get path language for node lookup
      const pathLang = this.fetchService.getLang(path);
      const node = pathLang ? this.projectState.findNodeByPath(this.projectState.getProjectTree(), path, pathLang) : null

      // Status indicators
      const inExport = projectPaths.some(url => url === path);
      const inGitHub = filteredGithubPages.has(path);

      const isAutoUpdateFile = this.jekyllUpdateFiles.some(url => url === path);
      const isAlwaysSkipFile = this.jekyllSkipFiles.some(url => url === path);

      const isRot = node?.data?.status?.isROT === true;

      const githubOnlyOppLang = inGitHub && !inExport && pathLang !== null && pathLang !== this.projectState.detectPrimaryLanguage();

      let status: FileCompareRow['status'];

      if (path === '_includes/*') {
        if (hasIncludes) status = ExportStatus.ExportOverwrite
        else status = ExportStatus.ExportNew
      }
      else if (githubOnlyOppLang) {
        status = ExportStatus.OppLanguage;
      }
      else if (isRot) {
        status = inGitHub ? ExportStatus.SkipOverwrite : ExportStatus.SkipNew;
      }
      else if (inExport && inGitHub) {
        if (isAutoUpdateFile) status = ExportStatus.ExportOverwrite;
        else if (isAlwaysSkipFile) status = ExportStatus.SkipOverwrite;
        else {
          const storedSha = pathLang ? node?.data?.[this.selectedExportTarget][pathLang].githubSha : null;
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
    if (requestId !== this.compareFilesRequestId) return; // guard against multiple runs
    this.filesTable.set(table);
  }

  // File table button configuration & getters
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
    return `${config.icon} ${config.text}`;
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

  // Export progress
  exportProgress = signal<ExportProgress | null>(null);

  /*_________________________________________*/
  /****** HTML ZIP SPECIFIC FUNCTIONS *******/

  async exportToFile() {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const repo = this.selectedExportTarget === 'prototype' ? this.gitHubData().repo : `${this.gitHubData().repo}-baseline`;
    const scope = this.selectedExportTarget === 'prototype' ? "inScope" : "all"
    const date = new Date().toISOString().split('T')[0];

    const projectPaths = this.projectTable().filter(item => item.status === ExportStatus.ExportNew || item.status === ExportStatus.ExportOverwrite).map(item => item.path);
    const templatePaths = this.templateTable().filter(item => item.status === ExportStatus.ExportNew || item.status === ExportStatus.ExportOverwrite).map(item => item.path);

    for (const path of projectPaths) {
      const url = this.fetchService.generateUrl(path, "live");
      const lang = this.fetchService.getLang(url);
      if (!lang) continue;
      const node = this.projectState.findNodeByPath(this.projectState.getProjectTree(), path, lang)

      const h1 = node?.data.prototype[lang].h1;
      const doubleH1 = node?.data.prototype[lang].doubleH1;

      //Medadata
      const title = doubleH1 ? `${h1}: ${doubleH1}` : h1
      const description = node?.data.prototype[lang].description;
      const keywords = node?.data.prototype[lang].keywords;
      const robots = node?.data.prototype[lang].noindex ? 'noindex, nofollow' : 'index, follow';

      const enUrl = this.fetchService.generateUrl(node?.data.path.en, "live");
      const frUrl = this.fetchService.generateUrl(node?.data.path.fr, "live");

      const breadcrumbs = this.projectState.getBreadcrumbChain(path, lang).map(b => `{ title: "${b.title}", href: "${b.link}" }`).join(', ');;

      const header = doubleH1 ? `<p class="lead mrgn-tp-md mrgn-bttm-0 text-muted">${doubleH1}</p>
<h1 property="name" id="wb-cont" dir="ltr" class="mrgn-tp-0">${h1}</h1>` : `<h1 property="name" id="wb-cont" dir="ltr">${h1}</h1>`

      const depth = "../".repeat(path.split("/").length - 1);

      //Content (TODO: subway templates)
      //const template = node?.data.prototype[lang].template;
      const doc = await this.fetchService.fetchContent(url, "both");
      const { content, styles, scripts } = await this.htmlNormalizationService.cleanContentForCdts(doc);

      const html = this.buildCdtsPage(lang === 'fr' ? CDTS_TEMPLATE_FRA : CDTS_TEMPLATE_ENG, {
        TITLE: title ?? '',
        DESCRIPTION: description ?? '',
        KEYWORDS: keywords ?? '',
        ROBOTS: robots,
        ENGLISH: enUrl ?? '',
        FRENCH: frUrl ?? '',
        BREADCRUMBS: breadcrumbs,
        HEADER: header ?? '',
        CONTENT: content,
        MODIFIED: date,
        STYLES: styles,
        SCRIPTS: scripts,
        REPO: repo,
        DEPTH: depth
      });

      zip.file(`${repo}/${path}`, html);
    }

    //Redirect files
    for (const path of templatePaths) {
      if (path === this.cdtsFiles[0]) {
        let allPagePaths;
        if (this.selectedExportLanguage === "both") {
          const enPages = this.projectState.getAllPages("en", "live", scope).map(page => page.path)
          const frPages = this.projectState.getAllPages("fr", "live", scope).map(page => page.path)
          allPagePaths = new Set([...enPages, ...frPages]);
        }
        else { allPagePaths = new Set(this.projectState.getAllPages(this.selectedExportLanguage, "live", scope).map(page => page.path)); }
        // Format redirect
        const redirects = [...allPagePaths].map(path => ({
          origin: `https://www.canada.ca/${path}`,
          destination: `/test/AIDA/${repo}/${path}`
        }));
        const redirectsJson = JSON.stringify(redirects, null, 2);
        zip.file(`${repo}/${path}`, redirectsJson)
      }
      else {
        const html = this.buildCdtsPage(path === this.cdtsFiles[1] ? EXIT_PAGE_TEMPLATE_ENG : EXIT_PAGE_TEMPLATE_FRA, {
          MODIFIED: date,
          REPO: repo
        });
        zip.file(`${repo}/${path}`, html);
      }
      //TODO: Check if this is needed for UT or not. Might be able to link directly to file.
      const html = this.buildCdtsPage(LINK_DETOUR_JS, {});
      zip.file(`${repo}/source/scripts/external-link-detour.js`, html);
    }
    //Track exports
    const pageCountEN = projectPaths.filter(p => p.startsWith('en/') || p === 'en.html').length;
    const pageCountFR = projectPaths.filter(p => p.startsWith('fr/') || p === 'fr.html').length;
    this.usageService.trackExport(this.projectData().id, this.projectData().org ?? 'DEFAULT', this.projectData().storageType, this.projectData().repoType, `${repo}`, this.selectedExportTarget, pageCountEN, pageCountFR);
    //Download zip file
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aida-html-export-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  buildCdtsPage(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
      (html, [key, value]) => html.replaceAll(`{{${key}}}`, value),
      template
    );
  }

  /*_________________________________________*/
  /****** GITHUB SPECIFIC FUNCTIONS *********/

  //Get in-scope URLs and page content (used by export fxn)
  private async getUrlandContent(node: TreeNode, lang: 'en' | 'fr' = 'en'): Promise<PageData[]> {
    const pages: PageData[] = [];
    const path = node.data?.path[lang];
    const url = this.fetchService.generateUrl(path, "live");

    const repo = this.selectedExportTarget === 'prototype'
      ? this.gitHubData().repo
      : `${this.gitHubData().repo}-baseline`;

    if (path && repo) {
      try {
        // Extract path and filename
        const filename = path.split("/").pop() || 'index.html';

        // Check if skipped or new
        const fileRow = this.filesTable().find(f => f.path === path);
        const isSkipped = !fileRow || fileRow?.status === ExportStatus.SkipNew || fileRow?.status === ExportStatus.SkipOverwrite;
        const isNew = node?.data?.status?.isNew === true;

        // Set content
        if (!isSkipped) {
          if (isNew) {
            const breadcrumbs = this.projectState.getBreadcrumbChain(node.data.path[lang], lang).slice(1);
            const content = this.exportGitHubService.formatNewPageAsJekyll(node, breadcrumbs, this.gitHubData().owner, repo, lang)
            pages.push({ url, path, filename, content });
          }
          else {
            const doc = await this.fetchService.fetchContent(url, "prod");
            const breadcrumbs = this.selectedExportTarget === 'prototype'
              ? this.projectState.getBreadcrumbChain(node.data.path[lang], lang).slice(1)
              : undefined; //baseline uses live breadcrumb
            const content = await this.exportGitHubService.formatDocumentAsJekyll(doc, url, this.gitHubData().owner, repo, breadcrumbs);
            pages.push({ url, path, filename, content });
          }
        }
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
    const scope = this.selectedExportTarget === "prototype" ? "inScope" : "all"

    // Step 1: Gather all in-scope or baseline URLs and their content
    this.exportProgress.set({ step: 'exportPages.export.progress.gatherPages', progress: 5, });
    let nodes = this.projectState.getProjectTree();
    if (this.selectedExportTarget === 'baseline') {
      nodes = this.projectState.getBaselineTree(nodes, "full");
    }

    let exportPages: PageData[] = [];
    if (this.selectedExportLanguage === 'both') {
      const enPages = await this.getUrlandContent(nodes[0], 'en');
      const frPages = await this.getUrlandContent(nodes[0], 'fr');
      exportPages = [...enPages, ...frPages];
    }
    else {
      exportPages = await this.getUrlandContent(nodes[0], this.selectedExportLanguage);
    }

    // Step 2: Check for templates files to include
    setTimeout(() => { this.exportProgress.set({ step: 'exportPages.export.progress.checkGitHub', progress: 10 }); }, 1000);
    const templateFilesToExport = this.templateTable()
      .filter(f => f.status === ExportStatus.ExportNew || f.status === ExportStatus.ExportOverwrite)
      .map(f => f.path);

    // Step 3: Set up repo (create it if it doesn't exist, add template files)
    setTimeout(() => { this.exportProgress.set({ step: 'exportPages.export.progress.setupRepo', progress: 20 }); }, 1000);
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

    // Step 4: Export each page to GitHub
    const existingFiles = await this.exportGitHubService.getRepoTree(owner, repo, branch, token);
    const progressPerFile = 60 / exportPages.length;

    for (const [index, page] of exportPages.entries()) {
      try {
        this.exportProgress.set({ step: 'exportPages.export.progress.exportPages', progress: 30 + (index * progressPerFile), });
        const result = await this.exportGitHubService.exportToGitHub(owner, repo, branch, page.path, page.filename, page.content, token, existingFiles, true);
        //Store SHA with project data
        if (result?.content?.sha) {
          const pathLang = page.path.startsWith('en/') || page.path.endsWith('en.html') ? 'en' : 'fr';
          this.projectState.setPageSha(page.path, result.content.sha, this.selectedExportTarget, pathLang);
        }
      } catch (error) {
        console.error(`Error exporting ${page.path}:`, error);
      }
    }
    // Step 5: Add redirect & index file
    setTimeout(() => { this.exportProgress.set({ step: 'exportPages.export.progress.setupRedirects', progress: 90 }); }, 1000);
    // Get GitHub paths
    const githubPages: Map<string, string> = await this.exportGitHubService.getRepoTree(owner, repo, branch, token);
    const githubContentPages = [...githubPages.keys()].filter(path =>
      path.startsWith('en/') || path.startsWith('fr/')
    );
    // Combine project paths with existing GitHub paths for redirects
    const enPages = this.projectState.getAllPages("en", "live", scope)
    const frPages = this.projectState.getAllPages("fr", "live", scope)
    const allPagePaths = new Set([
      ...enPages.map(page => page.path),
      ...frPages.map(page => page.path),
      ...githubContentPages
    ]);
    // Format redirect
    const redirects = [...allPagePaths].map(path => ({
      origin: `https://www.canada.ca/${path}`,
      destination: `/${repo}/${path}`
    }));
    const redirectsJson = JSON.stringify(redirects, null, 2);
    await this.exportGitHubService.exportToGitHub(owner, repo, branch, "source/data/exclude-redirect-links.json", "exclude-redirect-links.json", redirectsJson, token, githubPages, true);

    setTimeout(() => { this.exportProgress.set({ step: 'common.complete', progress: 100 }); }, 1000);
    console.log("Page export complete.");
    this.projectState.setExportDate();
    const pageCountEN = exportPages.filter(p => p.path.startsWith('en/') || p.path === 'en.html').length;
    const pageCountFR = exportPages.filter(p => p.path.startsWith('fr/') || p.path === 'fr.html').length;
    this.usageService.trackExport(this.projectData().id, this.projectData().org ?? 'DEFAULT', this.projectData().storageType, this.projectData().repoType, `${owner}/${repo}`, this.selectedExportTarget, pageCountEN, pageCountFR);
    setTimeout(() => this.exportProgress.set(null), 5000);
    this.compareFiles();
  }

}
