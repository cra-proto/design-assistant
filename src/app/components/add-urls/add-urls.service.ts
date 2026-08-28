import { computed, inject, Injectable, signal } from '@angular/core';

import { TreeNode } from 'primeng/api';

import { AirtableService } from '../../services/data-sources/airtable.service';
import { UpdService } from '../../services/data-sources/upd.service';
import { VanityService } from '../../services/data-sources/vanity.service';
import { FetchService } from '../../services/fetch.service';
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectStorageService } from '../../services/storage/project-storage.service';
import { TreeNodeStyleService } from '../../services/treenode-style.service';

import { LangData, PageActions, PageTemplate } from '../../common/data.model';

//Interfaces
export interface ValidationItem {
  href: string;
  status: 'ok' | 'bad' | 'redirect' | 'blocked' | 'checking' | 'new';
  originalHref?: string;
}

export interface AddItem {
  href: string;
  status: 'pending' | 'added' | 'error';
}

export interface UrlState {
  rawUrls: string;
  urlsToValidate: ValidationItem[];
  urlsToReview: ValidationItem[];
  urlsToAdd: AddItem[];
  isValidating: boolean;
  isAdding: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class AddUrlsService {
  private readonly fetchService = inject(FetchService);
  private readonly projectState = inject(ProjectStateService);
  private readonly updService = inject(UpdService);
  private readonly airtableService = inject(AirtableService);
  private readonly vanityService = inject(VanityService);
  private readonly projectStorageService = inject(ProjectStorageService);
  private readonly treeNodeStyleService = inject(TreeNodeStyleService);

  /********************************************************************************************************************
   *  STEPS                                                                                                           *
   *  0. Parse raw url input                                                                                          *
   *  1. Validate URLs (store invalid for later review)                                                               *
   *  2. Add URLs, for each, fetch breadcrumb & cache content to add after parent pages                               *
   *     - If breadcrumb url is not in project yet, fetch content and add it in TreeNode structure (baseline & live)  *
   *     - If breadcrumb url is already in project, skip it                                                           *
   *     - add cached page to TreeNode structure (baseline & live)                                                    *
   ********************************************************************************************************************/

  /** Current state of the add URL workflow */
  public readonly urlState = signal<UrlState>({
    rawUrls: '',
    urlsToValidate: [],
    urlsToReview: [],
    urlsToAdd: [],
    isValidating: false,
    isAdding: false,
  });

  /** Updates a partial signal from the {@link urlState} */
  public setUrlState(partial: Partial<UrlState>) {
    this.urlState.update((curr) => ({ ...curr, ...partial }));
  }

  /** Updates urlsToReview from the {@link urlState} */
  public updateReviewStatus(hrefs: string[], status: ValidationItem['status']) {
    const hrefSet = new Set(hrefs);
    const urlsToReview = this.urlState().urlsToReview.map((url) => (hrefSet.has(url.href) ? { ...url, status } : url));
    this.setUrlState({ urlsToReview });
  }

  private projectLang = this.projectState.detectPrimaryLanguage();

  /**** STEP 0 ********************************************************************************************************/

  /** Parse raw URL input into UrlItem array */
  public parseUrls(rawUrls: string, existingUrls: Set<string>, currentLang: 'en' | 'fr'): { parsedUrls: ValidationItem[]; duplicates: string[]; invalidUrls: string[]; oppositeLangUrls: string[] } {
    const seen = new Set<string>(existingUrls); //to track duplicates
    const duplicates: string[] = []; //to store duplicates
    const invalidUrls: string[] = []; //to store invalid urls
    const oppositeLangUrls: string[] = []; //to store opposite language urls

    // Step 1: Normalize URLs and detect their languages
    const normalizedUrls = rawUrls
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean)
      .map((line) => ({
        original: line,
        normalized: this.normalizeUrl(line),
        lang: this.detectUrlLanguage(this.normalizeUrl(line)),
      }));

    // Step 2: Determine project language
    this.projectLang = this.detectProjectLanguage(existingUrls, normalizedUrls, currentLang);

    // Step 3: Filter and validate
    const parsedUrls = normalizedUrls
      .filter(({ normalized, lang, original }) => {
        // Check if it's a valid URL with language
        if (!lang || !normalized.includes('canada.ca')) {
          invalidUrls.push(original);
          return false;
        }
        // Check if language matches project language
        if (lang !== this.projectLang) {
          oppositeLangUrls.push(normalized);
          return false;
        }
        // Check for duplicates
        if (seen.has(normalized)) {
          duplicates.push(normalized);
          return false;
        }
        seen.add(normalized);
        return true;
      })
      .map(({ normalized }) => ({ href: normalized, status: 'checking' as const }));
    return { parsedUrls, duplicates, invalidUrls, oppositeLangUrls };
  }

  // Step 0: Normalize incomplete URLs
  private normalizeUrl(input: string): string {
    let url = input;

    // Fix domain
    if (url.match('/content/canadasite')) {
      url = url.replace('/content/canadasite', '');
    }
    if (!url.startsWith('http')) {
      if (url.startsWith('/en') || url.startsWith('/fr')) {
        url = 'https://www.canada.ca' + url;
      } else if (url.startsWith('en') || url.startsWith('fr')) {
        url = 'https://www.canada.ca/' + url;
      } else if (url.startsWith('www')) {
        url = 'https://' + url;
      } else if (url.startsWith('canada.ca')) {
        url = 'https://www.' + url;
      }
    } else if (url.startsWith('https://canada-preview.adobecqms.net/')) {
      url = url.replace('https://canada-preview.adobecqms.net/', 'https://www.canada.ca/');
    }

    // Fix extension
    if (!url.endsWith('.html') && !url.endsWith('/')) {
      if (url.endsWith('/en') || url.endsWith('/fr')) {
        url = url + '.html';
      }
      if ((url.includes('/en/') || url.includes('/fr/')) && !url.match(/\.[a-z]{2,4}$/i)) {
        url = url + '.html';
      }
    }

    return url;
  }

  // Step 0: Detect url language
  private detectUrlLanguage(url: string): 'en' | 'fr' | null {
    if (url.includes('/en/') || url.endsWith('/en.html')) {
      return 'en';
    }
    if (url.includes('/fr/') || url.endsWith('/fr.html')) {
      return 'fr';
    }
    return null;
  }

  // Step 0: Detect project language
  private detectProjectLanguage(existingUrls: Set<string>, normalizedUrls: { normalized: string; lang: 'en' | 'fr' | null }[], currentLang: 'en' | 'fr'): 'en' | 'fr' {
    // Priority 1: If project has existing URLs, use their language
    if (existingUrls.size > 0) {
      const firstUrl = Array.from(existingUrls)[0];
      const existingLang = this.detectUrlLanguage(firstUrl);
      if (existingLang) return existingLang;
    }

    // Priority 2: If pasted URLs are all one language, use that
    const pastedLanguages = normalizedUrls.map((u) => u.lang).filter((lang): lang is 'en' | 'fr' => lang !== null);

    if (pastedLanguages.length > 0) {
      const uniqueLangs = new Set(pastedLanguages);

      if (uniqueLangs.size === 1) {
        return pastedLanguages[0];
      }
    }

    // Priority 3: If no project language and pasted urls are mixed, fallback to app language
    return currentLang;
  }

  /**** STEP 1 ********************************************************************************************************/

  // Step 1: Validate multiple URLs sequentially (concurrency can cause issues with Akamai rate limiting)
  public async validateUrls(): Promise<void> {
    this.setUrlState({ isValidating: true });
    const urls = this.urlState().urlsToValidate;
    for (const url of urls) {
      await this.validateUrl(url);
    }
    // Filter out duplicates & invalid urls for urlsToAdd
    const validated = this.urlState().urlsToValidate;
    const tree = this.projectState.getProjectTree();

    const seen = new Set<string>();
    const pathsToFlip = new Set<string>();

    const urlsToAdd: AddItem[] = validated
      .filter((url) => url.status === 'ok' || url.status === 'redirect')
      .filter((url) => {
        const path = this.fetchService.generatePath(url.href);
        const node = this.projectState.findNodeByPath(tree, path, this.projectLang);
        if (node) {
          if (!node.data?.status?.inScope) {
            pathsToFlip.add(path);
          }
          return false;
        }
        if (seen.has(url.href)) return false;
        seen.add(url.href);
        return true;
      })
      .map((url) => ({ href: url.href, status: 'pending' }));

    if (pathsToFlip.size) {
      this.projectState.setScope([...pathsToFlip], this.projectLang);
    }

    const urlsToReview: ValidationItem[] = validated.filter((url) => url.status === 'bad' || url.status === 'redirect' || url.status === 'blocked');

    this.setUrlState({ isValidating: false, urlsToValidate: [], urlsToReview, urlsToAdd });
    this.addUrls();
  }

  // Validate a single URL
  private async validateUrl(page: ValidationItem): Promise<void> {
    try {
      const response = await this.fetchService.fetchStatus(page.href, 'prod', 3, 'none', 500);

      let updated: ValidationItem;
      if (!response.ok || response.url.includes('404.html')) {
        updated = { ...page, status: 'bad' };
      } else if (response.url !== page.href) {
        updated = { ...page, status: 'redirect', originalHref: page.href, href: response.url };
      } else {
        updated = { ...page, status: 'ok' };
      }
      this.urlState.update((curr) => ({
        ...curr,
        urlsToValidate: curr.urlsToValidate.map((url) => (url.href === page.href ? updated : url)),
      }));
    } catch (error) {
      console.error(error);
      const status = (error as Error).message.startsWith('Blocked host') ? 'blocked' : 'bad';
      this.urlState.update((curr) => ({
        ...curr,
        urlsToValidate: curr.urlsToValidate.map((url) => (url.href === page.href ? { ...url, status } : url)),
      }));
    }
  }

  // Step 1: validating URL progress bar
  public readonly validatingProgress = computed(() => {
    const { urlsToValidate } = this.urlState();
    const total = urlsToValidate.length;
    const processed = urlsToValidate.filter((u) => u.status !== 'checking').length;
    return {
      percent: total ? Math.round((processed / total) * 100) : 0,
      total,
      processed,
    };
  });

  /**** STEP 2 ********************************************************************************************************/

  private readonly linkCache = new Map<string, string[]>();

  // Step 2: Add multiple URLs sequentially (concurrency can cause issues with Akamai rate limiting)
  private async addUrls(parent: string | null = null) {
    this.setUrlState({ isAdding: true });
    const urls = this.urlState().urlsToAdd;
    //console.log(urls);
    // Load UPD & Airtable data
    await this.updService.fetchData();
    await this.airtableService.fetchTasks();
    await this.vanityService.fetchData();
    this.setPreviousProjectData(this.projectState.cloneTree(this.projectState.getProjectTree()));

    for (const url of urls) {
      try {
        await this.addUrl(url.href, true, parent);
        // Mark as added
        this.urlState.update((curr) => ({
          ...curr,
          urlsToAdd: curr.urlsToAdd.map((u) => (u.href === url.href ? { ...u, status: 'added' } : u)),
        }));
      } catch {
        // Mark as error
        this.urlState.update((curr) => ({
          ...curr,
          urlsToAdd: curr.urlsToAdd.map((u) => (u.href === url.href ? { ...u, status: 'error' } : u)),
        }));
      }
    }

    this.projectState.setProjectTree(this.projectState.getProjectTree());
    this.projectStorageService.rebuildParents(this.projectState.getProjectTree(), undefined);
    this.treeNodeStyleService.updateNodeStyles(this.projectState.getProjectTree(), 0);
    this.setUrlState({ isAdding: false, urlsToAdd: [], rawUrls: '' });
  }

  // Step 2: Add a single URL
  private async addUrl(url: string, inScope: boolean, parent: string | null = null) {
    // Step 1: lookup url in tree and if found, flip status to inScope if mode is inScope, then return if found for either mode
    const inTree = this.projectState.urlExists(url);
    if (inTree) {
      if (inScope) {
        const path = this.fetchService.generatePath(url);
        const lang = this.fetchService.getLang(url) ?? 'en';
        this.projectState.setScope([path], lang);
      }
      return;
    }

    // Step 2: Fetch page data
    const doc = await this.fetchService.fetchContent(url, 'prod', 3, 'none');
    const breadcrumb = this.fetchService.getBreadcrumb(doc, 'https://www.canada.ca');
    // Step 2a: Early return for find child mode
    if (parent && breadcrumb) {
      if (parent !== breadcrumb.at(-1)?.url) return;
    }
    // Step 2b: Build out breadcrumb context for inScope pages
    if (inScope) {
      for (const crumb of breadcrumb) {
        await this.addUrl(crumb.url, false);
      }
    }

    // Step 3: Collect English & French data
    const pageData = await this.fetchService.extractPageMetadata(doc, url);

    const oppDoc = pageData.oppUrl ? await this.fetchService.fetchContent(pageData.oppUrl, 'prod', 3, 'none') : undefined;
    const oppPageData = oppDoc ? await this.fetchService.extractPageMetadata(oppDoc, pageData.oppUrl!) : undefined;

    const urlLang = this.fetchService.getLang(url);
    if (!urlLang) return;

    const pageDataEN = urlLang === 'en' ? pageData : oppPageData;
    const pageDataFR = urlLang === 'fr' ? pageData : oppPageData;

    const enUrl = urlLang === 'en' ? url : pageData.oppUrl;
    const frUrl = urlLang === 'fr' ? url : pageData.oppUrl;

    const jsonDataEN = enUrl ? await this.fetchService.fetchPageJSON(enUrl) : undefined;
    const jsonDataFR = frUrl ? await this.fetchService.fetchPageJSON(frUrl) : undefined;

    if (enUrl) this.linkCache.set(enUrl, pageDataEN?.links ?? []);
    if (frUrl) this.linkCache.set(frUrl, pageDataFR?.links ?? []);

    const enParentUrl = this.fetchService.generateUrl(pageDataEN?.parentPath ?? '', 'live');
    const frParentUrl = this.fetchService.generateUrl(pageDataFR?.parentPath ?? '', 'live');

    //Add parent to link cache if missing
    if (enParentUrl && !this.linkCache.has(enParentUrl)) {
      const parentDoc = await this.fetchService.fetchContent(enParentUrl, 'prod', 3, 'none');
      if (parentDoc) this.linkCache.set(enParentUrl, this.fetchService.getLinks(parentDoc, enParentUrl));
    }

    if (frParentUrl && !this.linkCache.has(frParentUrl)) {
      const parentDoc = await this.fetchService.fetchContent(frParentUrl, 'prod', 3, 'none');
      if (parentDoc) this.linkCache.set(frParentUrl, this.fetchService.getLinks(parentDoc, frParentUrl));
    }

    const enOrphan = pageDataEN?.parentPath ? !this.linkCache.get(enParentUrl)?.includes(enUrl ?? '') : false;
    const frOrphan = pageDataFR?.parentPath ? !this.linkCache.get(frParentUrl ?? '')?.includes(frUrl ?? '') : false;

    // Step 4: Create node
    const enData: LangData = {
      h1: pageDataEN?.h1 ?? 'Missing H1',
      doubleH1: pageDataEN?.doubleH1,
      //Content
      contentHash: pageDataEN?.contentHash,
      lastChecked: pageDataEN?.lastChecked,
      githubSha: undefined,
      //Metadata
      title: pageDataEN?.title ?? '',
      description: pageDataEN?.description ?? '',
      keywords: pageDataEN?.keywords ?? '',
      //Status
      is404: !pageDataEN, //TODO: set to true for baseline/prototype until export
      isOrphan: enOrphan,
      noindex: pageDataEN?.noindex ?? false,
      isArchived: pageDataEN?.isArchived ?? false,
      linksToPortal: pageDataEN?.linksToPortal ?? false,
      hasChatbot: pageDataEN?.hasChatbot ?? false,
      // jrc:content.json
      owner: jsonDataEN?.owner,
      email: jsonDataEN?.email,
      lastPublished: jsonDataEN?.lastPublished,
      lastModified: jsonDataEN?.lastModified,
      //Data
      parentPath: pageDataEN?.parentPath,
      wordCount: pageDataEN?.wordCount ?? -1,
      linkCount: pageDataEN?.linkCount ?? -1,
      template: jsonDataEN?.isFreestyle ? PageTemplate.Freestyle : (pageDataEN?.template ?? PageTemplate.Content),
      fleschKincaid: pageDataEN?.fleschKincaid ?? -1,
      gunningFog: pageDataEN?.gunningFog ?? -1,
      phoneNumbers: pageDataEN?.phoneNumbers ?? [],
      // Data from problem assistant
      problem: undefined,
    };

    const frData: LangData = {
      h1: pageDataFR?.h1 ?? 'Missing H1',
      doubleH1: pageDataFR?.doubleH1,
      //Content
      contentHash: pageDataFR?.contentHash,
      lastChecked: pageDataFR?.lastChecked,
      githubSha: undefined,
      //Metadata
      title: pageDataFR?.title ?? '',
      description: pageDataFR?.description ?? '',
      keywords: pageDataFR?.keywords ?? '',
      //Status
      is404: !pageDataFR,
      isOrphan: frOrphan,
      noindex: pageDataFR?.noindex ?? false,
      isArchived: pageDataFR?.isArchived ?? false,
      linksToPortal: pageDataFR?.linksToPortal ?? false,
      hasChatbot: pageDataFR?.hasChatbot ?? false,
      // jrc:content.json
      owner: jsonDataFR?.owner,
      email: jsonDataFR?.email,
      lastPublished: jsonDataFR?.lastPublished,
      lastModified: jsonDataFR?.lastModified,
      //Data
      parentPath: pageDataFR?.parentPath,
      wordCount: pageDataFR?.wordCount ?? -1,
      linkCount: pageDataFR?.linkCount ?? -1,
      template: jsonDataFR?.isFreestyle ? PageTemplate.Freestyle : (pageDataFR?.template ?? PageTemplate.Content),
      fleschKincaid: pageDataFR?.fleschKincaid ?? -1,
      gunningFog: pageDataFR?.gunningFog ?? -1,
      phoneNumbers: pageDataFR?.phoneNumbers ?? [],
      // Data from problem assistant
      problem: undefined,
    };

    const githubEnData: LangData = { ...enData, phoneNumbers: [...enData.phoneNumbers], is404: true };
    const githubFrData: LangData = { ...frData, phoneNumbers: [...frData.phoneNumbers], is404: true };

    const status: PageActions = {
      inScope: inScope,
      isNew: false,
      isMoved: false,
      isROT: false,
    };

    const node: TreeNode = {
      label: pageData.h1 ?? url,
      data: {
        lang: urlLang,
        path: {
          en: this.fetchService.generatePath(enUrl),
          fr: this.fetchService.generatePath(frUrl),
        },
        visits: {
          en: this.updService.findVisitsByUrl(enUrl.replace('https://', '')),
          fr: this.updService.findVisitsByUrl(frUrl.replace('https://', '')),
        },
        task: {
          en: this.airtableService.findTaskNamesByUrl(enUrl, 'en'),
          fr: this.airtableService.findTaskNamesByUrl(frUrl, 'fr'),
        },
        vanity: {
          en: this.vanityService.findVanitiesByDestination(enUrl),
          fr: this.vanityService.findVanitiesByDestination(frUrl),
        },
        status: status,
        baseline: {
          en: { ...githubEnData },
          fr: { ...githubFrData },
        },
        live: {
          en: enData,
          fr: frData,
        },
        prototype: {
          en: { ...githubEnData },
          fr: { ...githubFrData },
        },
        metadataReview: undefined,
        notes: undefined,
        isContainer: false,
        isCrawled: false,
      },
      expanded: true,
      children: [],
    };

    // Step 5: Merge node into TreeNode
    const tree = this.projectState.getProjectTree();
    const parentPath = pageData?.parentPath;

    if (parentPath) {
      const parentNode = this.projectState.findNodeByPath(tree, parentPath, urlLang);
      if (parentNode) {
        parentNode.children = parentNode.children ?? [];
        parentNode.children.push(node);
      }
    } else {
      tree.push(node); // Root level
    }
  }

  // Step 2: adding URL progress bar
  public readonly addingProgress = computed(() => {
    const { urlsToAdd } = this.urlState();
    const total = urlsToAdd.length;
    const processed = urlsToAdd.filter((u) => u.status !== 'pending').length;
    return {
      percent: total ? Math.round((processed / total) * 100) : 0,
      total,
      processed,
    };
  });

  /**** OTHER UTILITIES ************************************************************************************************/

  // Previous project data for undo
  private readonly previousProjectData = signal<TreeNode[] | null>(null);
  public readonly getPreviousProjectData = computed(() => this.previousProjectData());
  public setPreviousProjectData(data: TreeNode[] | null) {
    this.previousProjectData.set(data);
  }

  // Highlight logic
  private readonly highlight = signal<boolean>(false);
  public setHighlight(value: boolean) {
    this.highlight.set(value);
  }
  public getHighlight() {
    return this.highlight();
  }

  // Append URLs to input (for the various find pages components)
  public appendUrlsToInput(newUrls: string[]): void {
    const lang = this.projectState.detectPrimaryLanguage();
    const currentRawUrls = this.urlState().rawUrls;
    const additionalRawUrls = newUrls.join('\n');

    const updatedRawUrls = currentRawUrls ? `${currentRawUrls}\n${additionalRawUrls}` : additionalRawUrls;

    const { parsedUrls } = this.parseUrls(updatedRawUrls, new Set(this.projectState.getAllPages(lang, 'live', 'inScope').map((u) => u.url)), lang);

    this.setUrlState({
      rawUrls: updatedRawUrls,
      urlsToValidate: parsedUrls,
    });
  }

  // Add child pages
  public async addChildren(node: TreeNode, lang: 'en' | 'fr'): Promise<void> {
    const parentLink = this.fetchService.generateUrl(node.data?.path[lang], 'live');
    if (!parentLink) return;

    // Step 1: Get all Canada.ca links from parent page
    const allLinks = new Set<string>();
    try {
      const doc = await this.fetchService.fetchContent(parentLink, 'prod', 3, 'none');
      const links = this.fetchService.getLinks(doc, parentLink);
      links.filter((l) => l.includes('canada.ca')).forEach((l) => allLinks.add(l));
    } catch (error) {
      console.warn(`Failed to fetch page ${parentLink}: ${error}`);
    }

    // Step 2: Strip out any links that are already in the project
    const projectPaths = new Set(this.projectState.getAllPages(lang, 'live', 'all').map((p) => p.path));
    const linksToAdd = [...allLinks].filter((link) => {
      const normalized = this.projectState.getPath(link);
      return !projectPaths.has(normalized);
    });
    if (linksToAdd.length === 0) return;

    // Step 3: add pages if they are a child of the parent page
    this.setUrlState({
      isAdding: true,
      urlsToAdd: linksToAdd.map((url) => ({ href: url, status: 'pending' })),
    });

    await this.addUrls(parentLink);
    node.data.isCrawled = true;
  }
}
