import { Injectable } from '@angular/core';

import { getLinks, stringToDoc } from '../utilities/html/extract-content.util';
import { generatePath } from '../utilities/html/link.util';

import { PageTemplate } from '../common/data.model';

import { environment } from '../../environments/environment';

export interface JsonMetadata {
  owner?: string; // jrc:content.json gcContributor
  email?: string; // jrc:content.json gcBranch
  lastPublished?: string; // jrc:content.json gcLastPublished
  lastModified?: string; // jrc:content.json cq:lastModified
  isFreestyle?: boolean; // jrc:content.json cq:template
}

export interface PageMetadata {
  oppUrl: string;
  h1?: string;
  doubleH1?: string;
  //Content
  contentHash?: string; // Hash of normalized page HTML at last crawl
  lastChecked?: string; // ISO string of fetch date
  //Metadata
  title?: string; // metadata title
  description?: string; // metadata description
  keywords?: string; // metadata keywords
  //Status
  noindex?: boolean; // True if page is not indexed for search
  isArchived: boolean; // True if page has archive banner
  linksToPortal: boolean; // True if page links to a portal
  linksToSignIn: boolean; // True if page links to the CRA sign-in page
  hasChatbot: boolean; // True if page has chatbot
  hasFieldflow: boolean; // True if page has fieldflow
  //Data
  parentPath?: string; // For page move detection
  wordCount?: number; // Count of words on page
  linkCount?: number; // Count of links on page
  template?: PageTemplate; // Determined based on page content & url pattern
  links?: string[];
  fleschKincaid: number;
  gunningFog: number;
  phoneNumbers: string[];
}

export interface BreadcrumbNode {
  label: string; // link text
  url: string; // link
  inScope?: boolean; // true = user-added page, false = page added from breadcrumb for context
  iaOrphan?: boolean; // true = IA orphan, false = link found on parent
  icon?: string; // represents status of link from parent to child
  iconTooltip?: string; // explanation for icon
  linkTooltip?: string; // explanation for color/boldness of label
  styleClass?: string; // for the label (used to set color and/or bold)
}

@Injectable({ providedIn: 'root' })
export class FetchService {
  //Block unknown hosts
  private prodHost = 'www.canada.ca';
  private protoHosts = new Set([
    `${environment.defaultOrg}.github.io`,
    'proto-cra.github.io',
    //"cra-design.github.io", //Currently blocked by browser because it looks like a phishing site
    //"cra-proto.github.io", //Is currently cra-test-arc.canada.ca
    'cra-test-arc.canada.ca',
    'test.canada.ca',
    //"gc-proto.github.io", //CORS error but redirects to test.canada.ca which works
    'aleblanc3.github.io',
    'canada-preview.adobecqms.net',
    'cra-ut.isvcs.net',
  ]);
  private getAllowedHosts(mode: 'prod' | 'proto' | 'both'): Set<string> {
    const allowed = new Set<string>();
    if (mode === 'prod' || mode === 'both') allowed.add(this.prodHost);
    if (mode === 'proto' || mode === 'both') this.protoHosts.forEach((host) => allowed.add(host));
    return allowed;
  }

  //Validates URL and checks if it's in the specified allowed host list
  private validateHost(url: string, hostMode: 'prod' | 'proto' | 'both' | 'none'): string {
    url = url.trim();

    let hostname: string;
    try {
      const parsedUrl = new URL(url);
      if (/\s/.test(url)) throw new Error();
      hostname = parsedUrl.hostname.toLowerCase();
      const isUT = hostname === 'cra-ut.isvcs.net';
      if (parsedUrl.protocol !== 'https:' && !isUT) throw new Error();
      //Add nocache parameter to GitHub urls
      if (hostname !== this.prodHost) {
        const separator = url.includes('?') ? '&' : '?';
        url = url + `${separator}nocache=${Date.now()}`;
      }
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    if (hostMode !== 'none') {
      const allowedHosts = this.getAllowedHosts(hostMode);
      if (!allowedHosts.has(hostname)) {
        throw new Error(`Blocked host: ${hostname} blocked for url ${url}`);
      }
    }

    return url;
  }

  //Uses specified fetch method and retries if initial fetch fails (can happen due to intermittent server issues, Akamai etc.)
  public async fetchWithRetry(url: string, mode: 'GET' | 'HEAD' = 'HEAD', retries = 3, delay: number | 'random' | 'none' = 'none', suppressErrors = false): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      await this.simulateDelay(delay);
      if (attempt > 1 && attempt === retries) {
        mode = 'GET'; //fallback to GET on last HEAD request
      }
      try {
        const response =
          mode === 'HEAD'
            ? await fetch(url, { method: 'HEAD' }) //removed cache: "no-store" from { method: "HEAD", cache: "no-store" }
            : await fetch(url); // plain GET to avoid CORS error
        if (response.ok) return response;
        else {
          if (!suppressErrors) {
            console.warn(`Fetch attempt #${attempt}. Status: ${response.status}. Method: ${mode}`);
          }
          if (attempt < retries) {
            const backoffDelay = Math.pow(2, attempt - 1) * 300; // 300ms, 600ms, 1200ms delay before retry
            await this.delay(backoffDelay);
            continue;
          }
          if (suppressErrors) return this.suppressError(url);
          throw new Error(`Fetch failed ${attempt} times. Method: ${mode}. Status: ${response.status} for ${url}`);
        }
      } catch (error) {
        if (attempt < retries) {
          const backoffDelay = Math.pow(2, attempt - 1) * 300; // 300ms, 600ms, 1200ms
          await this.delay(backoffDelay);
          continue;
        }
        if (suppressErrors === true) return this.suppressError(url);
        else if (attempt === retries) throw new Error((error as Error).message);
      }
    }
    if (suppressErrors === true) return this.suppressError(url);
    else throw new Error(`Unexpected error for ${url}`); //fallback, could be CORS or URLs blocked for safety reasons (suspected phishing etc.)
  }

  public async fetchContent(url: string, hostMode: 'prod' | 'proto' | 'both' | 'none' = 'both', retries = 3, delay: number | 'random' | 'none' = 'none', suppressErrors = false): Promise<Document> {
    url = this.validateHost(url, hostMode);
    const response = await this.fetchWithRetry(url, 'GET', retries, delay, suppressErrors);
    const html = await response.text();
    const doc = this.cleanupFetch(html);
    return doc;
  }

  public async fetchContentAndStatus(
    url: string,
    hostMode: 'prod' | 'proto' | 'both' | 'none' = 'both',
    retries = 3,
    delay: number | 'random' | 'none' = 'none',
    suppressErrors = false,
  ): Promise<{ doc: Document; finalUrl: string }> {
    url = this.validateHost(url, hostMode);
    const response = await this.fetchWithRetry(url, 'GET', retries, delay, suppressErrors);
    const html = await response.text();
    const doc = this.cleanupFetch(html);
    const finalUrl = response.url || url;
    return { doc, finalUrl };
  }

  public async fetchStatus(
    url: string,
    hostMode: 'prod' | 'proto' | 'both' | 'none' = 'both',
    retries = 3,
    delay: number | 'random' | 'none' = 'none',
    delayBetweenRequests = 100, //ms
  ): Promise<Response> {
    url = this.validateHost(url, hostMode);
    if (delayBetweenRequests > 0) {
      await this.delay(delayBetweenRequests);
    }
    return this.fetchWithRetry(url, 'HEAD', retries, delay, true);
  }

  public async fetchJSON(url: string, fields: string[]): Promise<Record<string, string>> {
    const date = new Date().toDateString();
    const jsonUrl = url.replace('.html', `/jcr:content.json?nocache=${date}`);
    const result: Record<string, string> = {};

    try {
      const response = await this.fetchWithRetry(jsonUrl, 'GET', 3, 'none', true);
      const json = await response.json();

      for (const field of fields) {
        result[field] = json[field] ?? undefined;
      }
    } catch (error) {
      console.error(`Error fetching content.json for ${url}:`, error);
    }
    return result;
  }

  public async fetchPageJSON(url: string): Promise<JsonMetadata> {
    const fields = ['gcContributor', 'gcBranch', 'gcLastPublished', 'gcModifiedIsOverridden', 'gcModifiedOverride', 'cq:lastModified', 'cq:template'];
    const data = await this.fetchJSON(url, fields);

    return {
      owner: data['gcContributor'] ?? undefined,
      email: data['gcBranch'] ?? undefined,
      lastPublished: data['gcLastPublished'] ? data['gcLastPublished'] : undefined,
      lastModified: data['gcModifiedIsOverridden'] === 'true' && data['gcModifiedOverride'] ? data['gcModifiedOverride'] : data['cq:lastModified'] ? data['cq:lastModified'] : undefined,
      isFreestyle: data['cq:template']?.includes('freestyle') ?? false,
    };
  }

  //only delays on development build
  public async simulateDelay(delay: number | 'random' | 'none' = 'none'): Promise<void> {
    if (environment.production || delay === 'none') return;

    if (delay === 'random') {
      await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 1500)); //random 0.1 to 1.6 second delay
    } else if (typeof delay === 'number' && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay)); //user input delay
    }
  }

  //adds delay on both dev and prod (useful for adding short delays before retrying a failed fetch, only use this if the delay is required on prod)
  public async delay(delay: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, delay)); //user input delay
  }

  //fake Response for suppressing CORS errors (should only be used when fetching external content, hostMode = "none:")
  private suppressError(url: string, status = 500, statusText = 'Suppressed fetch error'): Response {
    return new Response(null, {
      status,
      statusText,
      headers: { 'X-Suppressed-Error': 'true', 'X-Source-Url': url },
    });
  }

  /** Fetches a unique array of same-domain paths */
  public async getPaths(url: string, viaProxy = false): Promise<string[]> {
    try {
      const doc = !viaProxy ? await this.fetchContent(url, 'both', 2) : stringToDoc(await this.fetchViaProxy(url));
      const links = getLinks(doc, url);
      return [...new Set(links.map((link) => generatePath(link)))];
    } catch (error) {
      console.warn(`Failed to fetch links for "${url}"`, error);
      return [];
    }
  }

  /**
   * Fetches page content from a different origin (UT, AEM preview etc.) by relaying
   * the request through a same-origin proxy page. Only use if {@link fetchContent} is unsuccessful.
   *
   * This function must be triggered by the user or the popup may be blocked resulting in
   * inconsistent behaviour for different users.
   *
   * @param targetUrl The full URL to fetch. Must be on an allowed origin or this will throw. (see {@link generateQuery} for allowed origins)
   * @returns a string with the HTML content. For just a status check, use {@link fetchStatusViaProxy} instead.
   */
  public fetchViaProxy(targetUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let fetchQuery: string;
      let fetchOrigin: string;
      try {
        ({ fetchQuery, fetchOrigin } = this.generateQuery(targetUrl, false));
      } catch (error) {
        reject(error);
        return;
      }

      const popup = window.open(fetchQuery, '_blank', 'width=1,height=1,left=9999,top=9999');
      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }
      //Listen for response
      const handler = (event: MessageEvent) => {
        // Verify origin
        if (event.origin !== fetchOrigin) return;
        // Cleanup
        window.removeEventListener('message', handler);
        clearTimeout(timeout);
        popup.close();
        // Handle response
        if (event.data.success) {
          resolve(event.data.html);
        } else {
          reject(new Error(event.data.error || 'Failed to fetch preview content'));
        }
      };
      window.addEventListener('message', handler);
      // Timeout after 10 seconds
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        popup.close();
        reject(new Error('Timeout waiting for preview content'));
      }, 10000);
    });
  }

  /**
   * Fetches page status from a different origin (UT, AEM preview etc.) by relaying
   * the request through a same-origin proxy page. Only use if {@link fetchStatus} is unsuccessful.
   *
   * This function must be triggered by the user or the popup may be blocked resulting in
   * inconsistent behaviour for different users.
   *
   * @param targetUrl The full URL to fetch. Must be on an allowed origin or this will throw. (see {@link generateQuery} for allowed origins)
   * @returns true if the page exists. For a content fetch, use {@link fetchViaProxy} instead.
   */
  fetchStatusViaProxy(targetUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      let fetchQuery: string;
      let fetchOrigin: string;
      try {
        ({ fetchQuery, fetchOrigin } = this.generateQuery(targetUrl, true));
      } catch {
        resolve(false);
        return;
      }

      const popup = window.open(fetchQuery, '_blank', 'width=1,height=1,left=9999,top=9999');

      if (!popup) {
        resolve(false);
        return;
      }

      const handler = (event: MessageEvent) => {
        if (event.origin !== fetchOrigin) return;

        window.removeEventListener('message', handler);
        clearTimeout(timeout);
        popup.close();

        resolve(event.data.success || false);
      };

      window.addEventListener('message', handler);

      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        popup.close();
        resolve(false);
      }, 5000);
    });
  }

  /**
   * Generates the url query string needed for {@link fetchViaProxy} and {@link fetchStatusViaProxy}
   *
   * If you want to enable a new origin, add the origin and the same-origin proxy page with proxy.js to the paths records.
   *
   * @param targetUrl The full URL for the query.
   * @param statusCheck False by default. Set it to true to add an optional parameter to limit the fetch to page status and no content.
   * @returns fetchQuery (The proxy page with your target url as the query) and fetchOrigin (the origin we are fetching from)
   * @throws Throws if targetUrl is not an allowed origin (see paths variable)
   */
  private generateQuery(targetUrl: string, statusCheck = false): { fetchQuery: string; fetchOrigin: string } {
    const targetOrigin = new URL(targetUrl).origin;
    const paths: Record<string, string> = {
      'https://canada-preview.adobecqms.net': 'https://canada-preview.adobecqms.net/en/revenue-agency/web-services-test/amber/test.html?fetch=',
      'http://cra-ut.isvcs.net': 'http://cra-ut.isvcs.net/test/aida/_Tools/fetch.html?fetch=',
    };
    const fetchUrl = paths[targetOrigin];
    if (!fetchUrl) {
      throw new Error(`Unhandled target URL: ${targetUrl}`);
    }
    return {
      fetchQuery: `${fetchUrl}${encodeURIComponent(targetUrl)}&check=${statusCheck}`,
      fetchOrigin: targetOrigin,
    };
  }

  /**
   * Removes malformed data-rte elements from fetched content before it causes parsing errors
   */
  cleanupFetch(html: string): Document {
    const clean = html.replace(/<data-rte-class="[^"]*">/g, '').replace(/<\/data-rte-class="[^"]*">/g, '');
    const doc = new DOMParser().parseFromString(clean, 'text/html');
    doc.querySelectorAll('[data-rte-class]').forEach((el) => {
      while (el.firstChild) {
        el.parentNode?.insertBefore(el.firstChild, el);
      }
      el.remove();
    });
    return doc;
  }
}
