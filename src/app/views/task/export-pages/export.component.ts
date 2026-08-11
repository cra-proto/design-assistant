import { Component, inject, signal, computed, effect, ViewChild, untracked, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
import { FetchService, urlVersion } from '../../../services/fetch.service';
import { GitHubAuthService } from '../../../services/github/github-auth.service';
import { UsageService } from '../../../services/usage.service';
import { HtmlNormalizationService } from '../../../services/html-normalization.service';

//Components
import { SetupRepoComponent } from '../../../components/setup-repo/setup-repo.component';
import { SignInBannerComponent } from '../../../components/sign-in/sign-in-banner/sign-in-banner.component';
import { BookmarkletComponent } from '../../../components/bookmarklet/bookmarklet.component';
import { ProjectSettingsComponent } from "../../../components/project-settings/project-settings.component";

import { CDTS_TEMPLATE_ENG, CDTS_TEMPLATE_FRA, EXIT_PAGE_TEMPLATE_ENG, EXIT_PAGE_TEMPLATE_FRA, INDEX_PAGE_TEMPLATE_ENG, INDEX_PAGE_TEMPLATE_FRA, LINK_DETOUR_JS } from '../../../common/cdts.template';
import { environment } from '../../../../environments/environment';
import { ProjectCacheService } from '../../../services/project-cache.service';

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
  imports: [CommonModule, FormsModule, TranslatePipe,
    MessageModule, ButtonModule, TooltipModule, PopoverModule, SelectButtonModule, DividerModule,
    TableModule, ChipModule, PanelModule, ProgressBarModule,
    SetupRepoComponent, SignInBannerComponent, BookmarkletComponent, ProjectSettingsComponent],
  templateUrl: './export.component.html',
  styles: ``
})
export class ExportComponent implements OnInit {
  public projectState = inject(ProjectStateService);
  public authService = inject(GitHubAuthService);
  public exportGitHubService = inject(ExportGitHubService);
  private fetchService = inject(FetchService);
  public translate = inject(TranslateService);
  private router = inject(Router)
  private usageService = inject(UsageService);
  private htmlNormalizationService = inject(HtmlNormalizationService);
  public projectCache = inject(ProjectCacheService);

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
      void this.projectData().github.owner; // track signal
      void this.projectData().github.repo; // track signal
      void this.projectCache.selectedLang(); // track signal
      void this.projectCache.selectedVersion(); // track signal
      const repoType = this.projectData().repoType;
      //Update repoType signal
      if (repoType) {
        this.repoType.set(repoType);
      }
      //Update table when owner or repo changes
      untracked(() => this.compareFiles());
    });
  }

  ngOnInit() {
    this.projectCache.checkGitHubStatus();
  }

  // Computed signals
  gitHubData = computed(() => this.projectData().github);

  projectTable = computed(() => this.filesTable().filter(f => f.path.startsWith('en') || f.path.startsWith('fr')));
  templateTable = computed(() => this.filesTable().filter(f => !f.path.startsWith('en') && !f.path.startsWith('fr')));

  projectFileCount = computed(() => this.projectTable().filter(f => f.status !== ExportStatus.AddToProject && f.status !== ExportStatus.OppLanguage).length);
  templateFileCount = computed(() => this.templateTable().length);

  newCount = computed(() => this.filesTable().filter(f => f.status === ExportStatus.ExportNew).length);
  updatedCount = computed(() => this.filesTable().filter(f => f.status === ExportStatus.ExportOverwrite).length);

  // Template visiblity controls
  // If a repo is configured (and overlay is closed), show the repo settings as a secondary task instead of a card
  @ViewChild('settingsOverlay') settingsOverlay!: Popover;
  hasRepoConfig(): boolean {
    const hasGithubData = !!(this.projectData().github.owner && this.projectData().github.repo && this.projectData().github.branch);
    return hasGithubData || this.settingsOverlay?.overlayVisible;
  }

  //Export context based on user selections above
  get exportContext() {
    const source = this.projectCache.selectedSource();

    const repo = this.projectCache.selectedVersion() === 'prototype'
      ? this.gitHubData().repo
      : `${this.gitHubData().repo}-baseline`;

    const scope: 'inScope' | 'all' = this.projectCache.selectedVersion() === 'prototype' ? 'inScope' : 'all';

    return { source, repo, scope };
  };

  // Open targeted GitHub repo
  openRepo() {
    let modifier = '';
    if (this.projectCache.selectedVersion() === 'baseline') { modifier = '-baseline'; };
    const url = `https://github.com/${this.projectData().github.owner}/${this.projectData().github.repo}${modifier}`;
    window.open(url, '_blank');
  }

  //CDTS template files
  cdtsFiles = ['source/data/exclude-redirect-links.json', 'source/scripts/external-link-detour.js', 'source/exit-intent-e.html', 'source/exit-intent-f.html', 'index.html']
  //Jekyll template files
  jekyllUpdateFiles = ["404.html", "_includes/*", "index.html", "source/data/exclude-redirect-links.json", "source/exit-intent-e.html", "source/exit-intent-f.html"];
  jekyllSkipFiles = ["_config.yml", "README.md", "robots.txt"];

  // Populate files table (and compare project files with GitHub or UT)
  private compareFilesRequestId = 0;
  async compareFiles() {
    const requestId = ++this.compareFilesRequestId
    if (!this.repoType()) {
      this.repoType.set(this.projectData().repoType ?? "github");
    }

    const lang = this.projectCache.selectedLang();
    const { source, repo, scope } = this.exportContext;

    const enPages = this.projectState.getAllPages("en", source, scope).map(p => p.path);
    const frPages = this.projectState.getAllPages("fr", source, scope).map(p => p.path);

    const projectPaths = [...(lang === 'en' ? enPages : lang === 'fr' ? frPages : [...enPages, ...frPages])];

    // Local mode
    if (this.repoType() === 'local') {
      if (requestId !== this.compareFilesRequestId) return;
      const localPaths = [...projectPaths, ...this.cdtsFiles];
      this.filesTable.set(localPaths.map(path => ({ path, status: ExportStatus.ExportNew })));
      return;
    }

    // GitHub mode
    const owner = this.gitHubData().owner;
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
          const storedSha = pathLang ? node?.data?.[this.projectCache.selectedVersion()][pathLang].githubSha : null;
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

    const { source, repo, scope } = this.exportContext;
    const date = new Date().toISOString().split('T')[0];
    const aidaLang = this.translate.currentLang()?.startsWith('fr') ? 'fr' : 'en';

    const projectPaths = this.projectTable().filter(item => item.status === ExportStatus.ExportNew || item.status === ExportStatus.ExportOverwrite).map(item => item.path);
    const templatePaths = this.templateTable().filter(item => item.status === ExportStatus.ExportNew || item.status === ExportStatus.ExportOverwrite).map(item => item.path);

    for (const path of projectPaths) {
      const url = this.fetchService.generateUrl(path, source, this.gitHubData().owner, repo); //Source for fetching content
      const lang = this.fetchService.getLang(url);
      if (!lang) continue;
      const node = this.projectState.findNodeByPath(this.projectState.getProjectTree(), path, lang)

      const h1 = node?.data.prototype[lang].h1;
      const doubleH1 = node?.data.prototype[lang].doubleH1;

      //Metadata
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

      //Defaults for new or unavailable pages
      const isNewPage = node?.data.status.isNew ?? false;
      let content = '';
      let styles = '';
      let scripts = '';
      let subject = '';
      let altLangPage = '';

      try {
        const retries = isNewPage ? 1 : 2;
        const doc = !source.endsWith("UT")
          ? await this.fetchService.fetchContent(url, "both", retries)
          : this.fetchService.stringToDoc(await this.fetchService.fetchViaProxy(url));
        if (!doc) {
          throw new Error(`No document returned for ${url}`);
        }
        ({ content, styles, scripts } = await this.htmlNormalizationService.cleanContentForCdts(doc));
        subject = (doc.querySelector('meta[name="dcterms.subject"]') as HTMLMetaElement)?.content.trim() || "";
        altLangPage = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="alternate"]')).find(link => link.getAttribute("hreflang") !== lang)?.href || "";
      } catch (error) {
        if (isNewPage) {
          console.warn(`New page "${path}" is 404. Creating blank template.`, error);
        } else {
          console.error(`Existing page "${path}" is unexpectedly 404. Creating blank template instead.`, error);
        }
      }

      try {
        const html = this.buildCdtsPage(lang === 'fr' ? CDTS_TEMPLATE_FRA : CDTS_TEMPLATE_ENG, {
          TITLE: title ?? '',
          DESCRIPTION: description ?? '',
          KEYWORDS: keywords ?? '',
          SUBJECT: subject ?? '',
          ALTLINK: altLangPage ?? '',
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
      } catch (error) {
        console.error(`Failed to zip page "${path}":`, error);
      }
    }

    //Redirect files
    for (const path of templatePaths) {
      if (path === this.cdtsFiles[0]) {
        //Collect page paths for redirects
        const lang = this.projectCache.selectedLang();
        let allPagePaths;
        if (lang === "both") {
          const enPages = this.projectState.getAllPages("en", "live", scope).map(page => page.path)
          const frPages = this.projectState.getAllPages("fr", "live", scope).map(page => page.path)
          allPagePaths = new Set([...enPages, ...frPages]);
        }
        else { allPagePaths = new Set(this.projectState.getAllPages(lang, "live", scope).map(page => page.path)); }
        // Format redirect
        const redirects = [...allPagePaths].map(path => ({
          origin: `https://www.canada.ca/${path}`,
          destination: `/test/AIDA/${repo}/${path}`
        }));
        const redirectsJson = JSON.stringify(redirects, null, 2);
        zip.file(`${repo}/${path}`, redirectsJson)
      }
      else if (path === this.cdtsFiles[1]) {
        const html = this.buildCdtsPage(LINK_DETOUR_JS, {});
        zip.file(`${repo}/${path}`, html);
      }
      else if (path === this.cdtsFiles[2] || path === this.cdtsFiles[3]) {
        const html = this.buildCdtsPage(path === this.cdtsFiles[2] ? EXIT_PAGE_TEMPLATE_ENG : EXIT_PAGE_TEMPLATE_FRA, {
          MODIFIED: date,
          REPO: repo
        });
        zip.file(`${repo}/${path}`, html);
      }
      else if (path === this.cdtsFiles[4]) {
        const html = this.buildCdtsPage(aidaLang === 'en' ? INDEX_PAGE_TEMPLATE_ENG : INDEX_PAGE_TEMPLATE_FRA, {
          MODIFIED: date,
          CONTENT: projectPaths ? this.buildCdtsIndex(new Set(projectPaths)) : '',
          REPO: repo
        });
        //console.log(await this.htmlNormalizationService.formatHtml(html))
        zip.file(`${repo}/${path}`, await this.htmlNormalizationService.formatHtml(html));
      }
      else console.warn("Unhandled template file")
    }
    //Update date
    this.projectState.setDownloadDate();
    //Track exports
    const pageCountEN = projectPaths.filter(p => p.startsWith('en/') || p === 'en.html').length;
    const pageCountFR = projectPaths.filter(p => p.startsWith('fr/') || p === 'fr.html').length;
    this.usageService.trackExport(this.projectData().id, this.projectData().org ?? 'DEFAULT', this.projectData().storageType, this.projectData().repoType, `${repo}`, this.projectCache.selectedVersion(), pageCountEN, pageCountFR);
    //Download zip file
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aida-html-export-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  buildCdtsPage(template: string, vars: Record<string, string>): string {
    return Object.entries(vars).reduce(
      (html, [key, value]) => html.replaceAll(`{{${key}}}`, () => value),
      template
    );
  }

  //Create index page for CDTS template
  buildCdtsIndex(paths: Set<string>) {
    //Include GitHub link if previously exported
    const showGithubLink = !!this.projectState.getProject().lastExported && !!this.gitHubData().owner && !!this.gitHubData().repo;
    const { repo, scope } = this.exportContext;
    const githubLinkHtml = showGithubLink
      ? `<div class="mrgn-tp-md">
            <div class="row">
                <ul class="toc lst-spcd col-md-12">
                    <li class="col-md-4 col-sm-6"><a class="list-group-item active" href="https://github.com/${this.gitHubData().owner}/${repo}" target="_blank">${this.translate.instant('project.github._title')}</a></li>
                </ul>
            </div>
         </div>\n`
      : '';
    //Include GitHub usernames if available
    const collaboratorNames = !!this.projectData().collaborators?.length;
    const collaboratorHtml = collaboratorNames
      ? `<section class="gc-contributors">
         <h2 class="h3">${this.translate.instant('collaborators.project')}</h2>
         <ul>${this.projectData().collaborators.map(collab => ` <li> ${collab.login}</li>`).join('')}</ul>
         </section>\n`
      : '';
    //EXPORTED_BY will be filled out via .ps1 extraction tool
    const exporterHtml = `<p class="gc-byline">${this.translate.instant('exportPages.exportedBy')} {{EXPORTED_BY}}</p>`
    //Paired pages
    const exportedPairs = this.projectState.getPairedPages("live", scope).filter(pair => paths.has(pair.en.path) || paths.has(pair.fr.path));
    //Labels
    const viewCanada = this.translate.instant('common.viewOnCanada');
    const viewUPD = this.translate.instant('common.viewOnUPD');
    //const viewAIDA = this.translate.instant('common.viewOnAIDA');
    const ungroupedCaption = this.translate.instant('exportPages.ungroupedPages');

    //Table status map
    const statusClassMap: Record<string, string> = {
      isBaseline: ' class="active"',
      isNew: ' class="success"',
      isROT: ' class="danger"',
      isMoved: ' class="warning"',
    };

    //Table headers
    const headers = this.projectCache.selectedLang() === 'en'
      ? [this.translate.instant('common.language.englishPages')]
      : this.projectCache.selectedLang() === 'fr'
        ? [this.translate.instant('common.language.frenchPages')]
        : [this.translate.instant('common.language.englishPages'), this.translate.instant('common.language.frenchPages')];
    const headerHtml = headers.map(h => `<th>${h}</th>`).join('\n                  ');

    //Row builder for a set of pairs
    const buildRows = (pairsList: typeof exportedPairs) => pairsList.map(pair => {
      const rowStatus = statusClassMap[pair.status] ?? '';
      const enCell = paths.has(pair.en.path)
        ? `<a href="${this.fetchService.generateUrl(pair.en.path, "protoUT", this.gitHubData().owner, repo)}" target="_blank"
              data-versions='[
                {"label": "${viewCanada}", "href":"${pair.en.url}"},
                {"label": "${viewUPD}", "href":"${this.fetchService.generateUrl(pair.en.path, "upd")}"}
              ]'>${pair.en.label ?? pair.en.path}</a>`
        : `<i class="fa fa-minus"></i>`;
      const frCell = paths.has(pair.fr.path)
        ? `<a href="${this.fetchService.generateUrl(pair.fr.path, "protoUT", this.gitHubData().owner, repo)}" target="_blank"
              data-versions='[
                {"label": "${viewCanada}", "href":"${pair.fr.url}"},
                {"label": "${viewUPD}", "href":"${this.fetchService.generateUrl(pair.fr.path, "upd")}"}
              ]'>${pair.fr.label ?? pair.fr.path}</a>`
        : `<i class="fa fa-minus"></i>`;
      const cells = this.projectCache.selectedLang() === 'en'
        ? [enCell]
        : this.projectCache.selectedLang() === 'fr'
          ? [frCell]
          : [enCell, frCell];
      return `
        <tr>
            ${cells.map(cell => `<td${rowStatus}>${cell}</td>`).join('\n        ')}
        </tr>`;
    }).join('');

    //Table builder for a group
    const buildTable = (caption: string, isVisibleCaption: boolean, pairsList: typeof exportedPairs) => `
      <table class="table table-hover">
          <caption${isVisibleCaption ? '' : ' class="wb-inv"'}>${caption}</caption>
          <thead>
              <tr>
                  ${headerHtml}
              </tr>
          </thead>
          <tbody>${buildRows(pairsList)}
          </tbody>
      </table>`;

    //Group pairs by section title, preserving traversal order; ungrouped pairs go last
    const groupedPairs = new Map<string, typeof exportedPairs>();
    const ungroupedPairs: typeof exportedPairs = [];
    exportedPairs.forEach(pair => {
      const groupKey = this.translate.currentLang()?.startsWith('fr') ? pair.fr.group : pair.en.group;
      if (groupKey) {
        if (!groupedPairs.has(groupKey)) groupedPairs.set(groupKey, []);
        groupedPairs.get(groupKey)!.push(pair);
      } else {
        ungroupedPairs.push(pair);
      }
    });

    //Table HTML
    const tablesHtml = [
      ...Array.from(groupedPairs.entries()).map(([groupTitle, pairsList]) => buildTable(groupTitle, true, pairsList)),
      ...(ungroupedPairs.length ? [buildTable(ungroupedCaption, true, ungroupedPairs)] : []),
    ].join('\n');

    //Content HTML
    return `${exporterHtml}${githubLinkHtml}${tablesHtml}${collaboratorHtml}`;

  }

  /*_________________________________________*/
  /****** GITHUB SPECIFIC FUNCTIONS *********/

  //Get in-scope URLs and page content (used by export fxn)
  private async getUrlandContent(node: TreeNode, lang: 'en' | 'fr' = 'en', owner: string, repo: string, source: urlVersion): Promise<PageData[]> {
    const pages: PageData[] = [];
    const path = node.data?.path[lang];
    const url = this.fetchService.generateUrl(path, source, owner, repo);

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
            const doc = !source.endsWith('UT')
              ? await this.fetchService.fetchContent(url, "both")
              : this.fetchService.stringToDoc(await this.fetchService.fetchViaProxy(url));
            const breadcrumbs = this.projectCache.selectedVersion() === 'prototype'
              ? this.projectState.getBreadcrumbChain(node.data.path[lang], lang).slice(1)
              : undefined; //baseline uses live breadcrumb
            const content = await this.exportGitHubService.formatDocumentAsJekyll(doc, url, this.gitHubData().owner, repo, breadcrumbs);
            //console.log(url);
            //console.log(doc);
            //console.log(content);
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
        const childPages = await this.getUrlandContent(child, lang, owner, repo, source);
        pages.push(...childPages);
      }
    }
    return pages;
  }

  // Main export function (DO NOT REMOVE TIMEOUTS, THEY GIVE ENOUGH TIME FOR SHA TO UPDATE BETWEEN EXPORTS)
  async exportProjectToGitHub() {
    const { source, repo, scope } = this.exportContext;
    const owner = this.gitHubData().owner;
    const branch = this.gitHubData().branch;
    const token = this.exportGitHubService.token();
    const projectName = this.projectData().projectName;
    const cacheVersion = this.projectCache.selectedVersion();
    const version = cacheVersion === 'live' ? 'prototype' : cacheVersion;
    console.log(source)
    console.log(repo)
    console.log(scope)

    // Step 1: Gather all in-scope or baseline URLs and their content
    this.exportProgress.set({ step: 'exportPages.export.progress.gatherPages', progress: 5, });
    let nodes = this.projectState.getProjectTree();
    if (version === 'baseline') {
      nodes = this.projectState.getBaselineTree(nodes, "full");
    }

    let exportPages: PageData[] = [];
    const lang = this.projectCache.selectedLang();
    if (lang === 'both') {
      const enPages = await this.getUrlandContent(nodes[0], 'en', owner, repo, source);
      const frPages = await this.getUrlandContent(nodes[0], 'fr', owner, repo, source);
      exportPages = [...enPages, ...frPages];
    }
    else {
      exportPages = await this.getUrlandContent(nodes[0], lang, owner, repo, source);
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
          this.projectState.setPageSha(page.path, result.content.sha, version, pathLang);
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
    this.usageService.trackExport(this.projectData().id, this.projectData().org ?? 'DEFAULT', this.projectData().storageType, this.projectData().repoType, `${owner}/${repo}`, version, pageCountEN, pageCountFR);
    setTimeout(() => this.exportProgress.set(null), 5000);
    this.compareFiles();
  }

}
