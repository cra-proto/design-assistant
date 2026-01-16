import { Injectable, inject } from '@angular/core';
import { FetchService } from '../../../services/fetch.service';
import { UrlItem, UrlData, BreadcrumbNode, PageMetadata, JsonMetadata } from '../add-pages.model';
import { TreeNode } from 'primeng/api';

@Injectable({
  providedIn: 'root'
})
export class BreadcrumbValidationService {
  private fetchService = inject(FetchService);

  metadataCache = new Map<string, PageMetadata>();
  jsonCache = new Map<string, JsonMetadata>();

  //Get one breadcrumb
  private getBreadcrumb(doc: Document, baseUrl: string): BreadcrumbNode[] {
    const breadcrumbItems = doc.querySelectorAll('.breadcrumb li a');
    const breadcrumbArray: BreadcrumbNode[] = [];
    breadcrumbItems.forEach((el) => {
      const rawHref = el.getAttribute('href') || '';
      let absoluteUrl = '';
      try {
        absoluteUrl = new URL(rawHref, baseUrl).href; // handles both relative + absolute
      } catch {
        console.warn(`Invalid breadcrumb href: ${rawHref}`);
      }
      breadcrumbArray.push({
        label: el.textContent?.trim() || '',
        url: absoluteUrl,
      });
    });
    return breadcrumbArray;
  }

  //Step 1: Get all breadcrumbs (and any other data we want from the page, H1, metadata, template etc.)
  public async getAllBreadcrumbs(pages: UrlItem[]): Promise<UrlData[]> {
    const results: UrlData[] = [];

    for (const page of pages) {
      const url = page.href;
      if (!url) continue;

      try {
        const doc = await this.fetchService.fetchContent(url, "prod", 3, "random");

        //Get breadcrumb
        const breadcrumb = this.getBreadcrumb(doc, "https://www.canada.ca");

        //Get metadata
        const metadata = this.fetchService.extractPageMetadata(doc, url);
        this.metadataCache.set(url, metadata);

        results.push({
          href: url,
          h1: metadata.h1,
          breadcrumb: breadcrumb,
          descendants: []
        });
      } catch (error) {
        console.error(`Error fetching ${url}:`, error);
      }
    }
    return results;
  }

  //Colors and styles for breadcrumbs
  readonly Icons = {
    pending: 'pi pi-question-circle',
    valid: 'pi pi-arrow-circle-right',
    orphan: 'pi pi-times-circle',
    error: 'pi pi-times',
  };

  readonly Colors = {
    gray: 'text-gray-400 hover:text-gray-600',
    green: 'text-green-500 hover:text-green-600',
    red: 'text-red-500 hover:text-red-600',
    blue: 'text-blue-500 hover:text-blue-600'
  };

  readonly Modifiers = {
    bold: 'font-bold',
    errorBorder: 'border-dotted',
  };

  //Step 2: Filter out redundant breadcrumb trails (so we can do least number of fetches in validation step)
  public filterBreadcrumbs(pages: UrlData[]): BreadcrumbNode[][] {
    const inScopeUrls = new Set(pages.map(p => p.href));
    const trails = pages.map(p => [
      ...(p.breadcrumb[0] // No icon for first item in breadcrumb
        ? [{
          ...p.breadcrumb[0],
          styleClass: inScopeUrls.has(p.breadcrumb[0].url) ? this.Colors.green : this.Colors.gray,
          linkTooltip: 'Breadcrumb root',
          inScope: inScopeUrls.has(p.breadcrumb[0].url),
          iaOrphan: false
        }]
        : []),
      ...p.breadcrumb.slice(1).map(crumb => ({
        ...crumb,
        icon: `${this.Icons.pending} ${this.Colors.gray}`,
        iconTooltip: 'Validation pending',
        styleClass: this.Colors.gray,
        linkTooltip: 'Validation pending',
        inScope: inScopeUrls.has(crumb.url)
      })),
      { //include actual page in breadcrumb
        label: p.h1,
        url: p.href,
        icon: `${this.Icons.pending} ${this.Colors.gray}`,
        iconTooltip: 'Validation pending',
        styleClass: this.Colors.gray,
        linkTooltip: 'Validation pending',
        inScope: true
      } as BreadcrumbNode
    ].filter(Boolean)); //removes undefined (can happen when adding homepage or any page missing a breadcrumb)

    //filter out redundant (i.e. shorter) breadcrumb trails
    const filtered = trails.filter(trail =>
      !trails.some(other =>
        other !== trail &&
        other.length > trail.length &&
        trail.every((crumb, i) => other[i]?.url === crumb.url)
      )
    );

    //sort remaining breadcrumb trails
    filtered.sort((a, b) => {
      const minLength = Math.min(a.length, b.length);
      for (let i = 0; i < minLength; i++) {
        if (a[i].url !== b[i].url) {
          return a[i].url!.localeCompare(b[i].url!);
        }
      }
      //if all compared items are equal, shorter chain comes first
      return a.length - b.length;
    });

    return filtered;
  }

  //Step 3: Check if breadcrumb parent pages link to their children
  public async validateBreadcrumbs(breadcrumbs: BreadcrumbNode[][]): Promise<BreadcrumbNode[][]> {
    for (const breadcrumb of breadcrumbs) {
      for (let i = 1; i < breadcrumb.length; i++) {
        const parent = breadcrumb[i - 1];
        const child = breadcrumb[i];

        if (!parent.url || !child.url) { // fallback if breadcrumbs are missing links (unlikely but could happen on freestyle pages)
          child.icon = `${this.Icons.error} ${this.Colors.red}`;
          child.iconTooltip = 'Link missing from breadcrumb'
          child.iaOrphan = true;
          continue;
        }

        try {

          const doc = await this.fetchService.fetchContent(parent.url, "prod", 3, "random");
          const metadata = this.fetchService.extractPageMetadata(doc, parent.url);
          this.metadataCache.set(parent.url, metadata);

          const links = Array.from(doc.querySelectorAll('a'))
            .map(a => a.getAttribute('href'))
            .filter((href): href is string => !!href)
            .map(href => {
              try {
                return new URL(href, parent.url).href;
              } catch {
                return href;
              }
            });

          if (links.includes(child.url)) {
            child.icon = `${this.Icons.valid} ${this.Colors.green}`;
            child.iconTooltip = 'Valid connection'
            child.iaOrphan = false;
            child.styleClass = child.inScope ? this.Colors.green : this.Colors.gray;
            child.linkTooltip = 'Valid child page';
          } else {
            child.icon = `${this.Icons.orphan} ${this.Colors.red}`;
            child.iconTooltip = 'No link from parent'
            child.iaOrphan = true;
            child.styleClass = child.inScope ? this.Colors.red : this.Colors.gray;
            child.linkTooltip = 'IA Orphan';
          }
        } catch (error) { //this will happen if fetch fails (breadcrumb link may be broken for example since we only validate the urls from the user input)
          console.error(`Error validating breadcrumb link from ${parent.url} to ${child.url}:`, error);
          child.icon = `${this.Icons.error} ${this.Colors.red}`;
          child.iconTooltip = 'Error validating link'
          child.iaOrphan = true;
          child.styleClass = child.inScope ? `${this.Colors.red} ${this.Modifiers.errorBorder}` : `${this.Colors.gray} ${this.Modifiers.errorBorder}`;
          child.linkTooltip = 'Error validating link';
        }
      }
    }

    return breadcrumbs;
  }

  //Step 3.5: Collect additional metadata
  async collectJsonData(breadcrumbs: BreadcrumbNode[][]): Promise<void> {
    const uniqueUrls = this.extractUniqueUrls(breadcrumbs);
    const fields = ['otherTitle', 'gcContributor', 'gcBranch', 'gcLastPublished', 'cq:lastModified'];
    for (const url of uniqueUrls) {
      const contentData = await this.fetchService.fetchJSON(url, fields);

      // Get existing metadata from cache or create new entry
      let jsonData = this.jsonCache.get(url) || {} as JsonMetadata;

      // Merge jcr:content.json data into json cache
      jsonData.oppTitle = contentData['otherTitle'];
      jsonData.owner = contentData['gcContributor'];
      jsonData.email = contentData['gcBranch'];
      jsonData.lastPublished = contentData['gcLastPublished'] ? new Date(contentData['gcLastPublished']) : undefined;
      jsonData.lastModified = contentData['cq:lastModified'] ? new Date(contentData['cq:lastModified']) : undefined;

      this.jsonCache.set(url, jsonData);
    }
    console.log(this.jsonCache)
  }

  private extractUniqueUrls(breadcrumbs: BreadcrumbNode[][]): string[] {
    const urlSet = new Set<string>();
    for (const breadcrumb of breadcrumbs) {
      for (const crumb of breadcrumb) {
        if (crumb.url) urlSet.add(crumb.url);
      }
    }
    return Array.from(urlSet);
  }

  //Step 4: Convert BreadcrumbNode's to TreeNode's
  async setTreeContext(projectTree: TreeNode[], breadcrumbs: BreadcrumbNode[][]): Promise<TreeNode[]> {

    const clonedTree = structuredClone(projectTree);

    // Collect additional page data
    await this.collectJsonData(breadcrumbs);

    const findChildByUrl = (nodes: TreeNode[] | undefined, url?: string | null) => {
      if (!nodes || !url) return undefined;
      return nodes.find(n => n.data?.url === url);
    };

    for (const breadcrumb of breadcrumbs) {
      let currentLevel = clonedTree;
      let parentUrl: string | null = null;
      for (const crumb of breadcrumb) {

        // Get metadata from cache or fetch if missing
        let metadata = this.metadataCache.get(crumb.url ?? '');
        if (!metadata) {
          if (crumb.url) {
            try {
              console.warn("Missing metadata. Starting new fetch.");
              const doc = await this.fetchService.fetchContent(crumb.url, "prod", 3, "random");
              metadata = this.fetchService.extractPageMetadata(doc, crumb.url);
              this.metadataCache.set(crumb.url, metadata);
            } catch (error) {
              // If breadcrumb url is 404 (possible for out-of-scope pages, especially for pseudopages that aren't set up correctly)
              console.error(`Error fetching metadata for ${crumb.url}:`, error);
              metadata = {
                h1: crumb.label,
                title: '',
                description: '',
                keywords: '',
                template: '404',
                oppUrl: ''
              };
            }
          } else {
            // If URL was missing from breadcrumb (unlikely)
            metadata = {
              h1: crumb.label,
              title: '',
              description: '',
              keywords: '',
              template: '404',
              oppUrl: ''
            };
          }
        }

        // Get JSON data from cache
        const jsonData = this.jsonCache.get(crumb.url ?? '');

        // check if node already exists for this crumb at the current level
        let node = findChildByUrl(currentLevel, crumb.url);

        if (!node) {
          // create a new node for this crumb if it doesn't exist
          node = {
            label: crumb.label,
            data: {
              h1: crumb.label,
              url: crumb.url ?? null,
              originalParent: parentUrl,
              status: {
                inScope: crumb.inScope,
                isOrphan: crumb.iaOrphan,
                isCrawled: false,
                isNew: false,
                isMoved: false,
                isROT: false,
                isArchived: metadata.isArchived || false,
                isContainer: false,
              },
              metadata: {
                title: metadata?.title,
                description: metadata?.description,
                keywords: metadata?.keywords,
                template: metadata?.template,
                oppUrl: metadata?.oppUrl,
                oppTitle: jsonData?.oppTitle || '',
                owner: jsonData?.owner || '',
                email: jsonData?.email || '',
                lastPublished: jsonData?.lastPublished || '',
                lastModified: jsonData?.lastModified || '',
                //ADD AIRTABLE TASK AND UPD VISITS & MOBILE%
              }
            },
            expanded: true,
            children: []
          };
          currentLevel.push(node);
        }

        // descend to this node's children for the next crumb
        parentUrl = node.data.url ?? null;
        currentLevel = node.children!;
      }
    }
    return clonedTree;
  }
}