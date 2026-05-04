import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { PageMetadata, OppMetadata, BreadcrumbNode } from '../components/add-pages/add-pages.model';
import { PageTemplate } from '../common/data.model';
import { isPortalDomain } from '../common/portal-domains.config';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

@Injectable({ providedIn: 'root' })
export class FetchService {

  //Block unknown hosts
  private prodHost = "www.canada.ca";
  private protoHosts = new Set([
    `${environment.defaultOrg}.github.io`,
    "proto-cra.github.io",
    //"cra-design.github.io", //Currently blocked by browser because it looks like a phishing site
    //"cra-proto.github.io", //Is currently cra-test-arc.canada.ca
    "cra-test-arc.canada.ca",
    "test.canada.ca",
    //"gc-proto.github.io", //CORS error but redirects to test.canada.ca which works
    "canada-preview.adobecqms.net",
    "aleblanc3.github.io"
  ]);
  private getAllowedHosts(mode: "prod" | "proto" | "both"): Set<string> {
    const allowed = new Set<string>();
    if (mode === "prod" || mode === "both") allowed.add(this.prodHost);
    if (mode === "proto" || mode === "both") this.protoHosts.forEach(host => allowed.add(host));
    return allowed;
  }

  //Validates URL and checks if it's in the specified allowed host list
  private validateHost(
    url: string,
    hostMode: "prod" | "proto" | "both" | "none"
  ): string {
    url = url.trim();

    let hostname: string;
    try {
      const parsedUrl = new URL(url);
      if (parsedUrl.protocol !== "https:" || /\s/.test(url)) throw new Error();
      hostname = parsedUrl.hostname.toLowerCase();
    } catch {
      throw new Error(`Invalid URL: ${url}`)
    }

    if (hostMode !== "none") {
      const allowedHosts = this.getAllowedHosts(hostMode);
      if (!allowedHosts.has(hostname)) {
        throw new Error(`Blocked host: ${hostname} blocked for url ${url}`);
      }
    }

    return url;
  }

  //Uses specified fetch method and retries if initial fetch fails (can happen due to intermittent server issues etc.)
  public async fetchWithRetry(
    url: string,
    mode: "GET" | "HEAD" = "HEAD",
    retries = 3,
    delay: number | "random" | "none" = "none",
    suppressErrors = false
  ): Promise<Response> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      await this.simulateDelay(delay);
      try {
        const response =
          mode === "HEAD"
            ? await fetch(url, { method: "HEAD" }) //removed cache: "no-store" from { method: "HEAD", cache: "no-store" } 
            : await fetch(url); // plain GET to avoid CORS error
        if (response.ok) return response;
        else {
          if (!suppressErrors) { console.warn(`Fetch attempt #${attempt}. Status: ${response.status}. Method: ${mode}`); }
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

  public async fetchContent(
    url: string,
    hostMode: "prod" | "proto" | "both" | "none" = "both",
    retries = 3,
    delay: number | "random" | "none" = "none",
    suppressErrors = false
  ): Promise<Document> {
    url = this.validateHost(url, hostMode);
    const response = await this.fetchWithRetry(url, "GET", retries, delay, suppressErrors);
    const html = await response.text();
    return new DOMParser().parseFromString(html, "text/html");
  }

  public async fetchContentAndStatus(
    url: string,
    hostMode: "prod" | "proto" | "both" | "none" = "both",
    retries = 3,
    delay: number | "random" | "none" = "none",
    suppressErrors = false
  ): Promise<{ doc: Document; finalUrl: string }> {
    url = this.validateHost(url, hostMode);
    const response = await this.fetchWithRetry(url, "GET", retries, delay, suppressErrors);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const finalUrl = response.url || url;
    return { doc, finalUrl };
  }

  public async fetchStatus(
    url: string,
    hostMode: "prod" | "proto" | "both" | "none" = "both",
    retries = 3,
    delay: number | "random" | "none" = "none",
    delayBetweenRequests = 100 //ms
  ): Promise<Response> {
    url = this.validateHost(url, hostMode);
    if (delayBetweenRequests > 0) { await this.delay(delayBetweenRequests); }
    return this.fetchWithRetry(url, "HEAD", retries, delay);
  }

  public async fetchJSON(url: string, fields: string[]): Promise<Record<string, string>> {
    const date = new Date().toDateString;
    const jsonUrl = url.replace('.html', `/jcr:content.json?nocache=${date}`);
    const result: Record<string, string> = {};

    try {
      const response = await this.fetchWithRetry(jsonUrl, "GET", 3, "none");
      const json = await response.json();

      for (const field of fields) {
        result[field] = json[field] ?? undefined;
      }
    } catch (error) {
      console.error(`Error fetching content.json for ${url}:`, error);
    }
    return result;
  }

  //only delays on development build
  public async simulateDelay(delay: number | 'random' | 'none' = 'none'): Promise<void> {
    if (environment.production || delay === 'none') return;

    if (delay === "random") {
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 1500)); //random 0.1 to 1.6 second delay
    }
    else if (typeof delay === "number" && delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay)); //user input delay
    }
  }

  //adds delay on both dev and prod (useful for adding short delays before retrying a failed fetch, only use this if the delay is required on prod)
  public async delay(delay: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, delay)); //user input delay
  }

  //fake Response for suppressing CORS errors (should only be used when fetching external content, hostMode = "none:")
  private suppressError(
    url: string,
    status = 500,
    statusText = "Suppressed fetch error"
  ): Response {
    return new Response(null, {
      status,
      statusText,
      headers: { "X-Suppressed-Error": "true", "X-Source-Url": url },
    });
  }

  // Extracts metadata from an HTML document
  public extractPageMetadata(doc: Document, url: string): PageMetadata {
    // Get H1 (or double H1)
    const h1Elements = Array.from(doc.querySelectorAll('h1')).filter(h1 => !h1.classList.contains('wb-inv'));
    const h1Texts = h1Elements.map(e => e.textContent?.trim()).filter(Boolean);

    let doubleH1 = doc.querySelector('hgroup p:has(+ h1)')?.innerHTML || doc.querySelector('p.lead:has(+ h1)')?.innerHTML || '';
    let h1 = '';

    if (h1Texts.length === 1) {
      h1 = h1Texts[0] ?? '';
    } else if (h1Texts.length > 1) {
      doubleH1 = h1Texts[0] ?? '';
      h1 = h1Texts.slice(1).join('<br>');
    }

    // Get metadata
    const title = doc.querySelector('meta[name="dcterms.title"]')?.getAttribute('content') || '';
    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';

    // Get archive status
    const isArchived = doc.querySelector('.gc-archv') !== null;
    console.log('Is archived?' + isArchived)

    // Get portal link status
    const linksToPortal = Array.from(doc.querySelectorAll('a')).some(link => isPortalDomain(link.href));

    // Get template
    const hasSubway = doc.querySelector('.gc-subway') !== null;
    const hasOldSubway = doc.querySelector('.gc-navseq') !== null;
    const hasMostRequested = doc.querySelector('.most-requested-bullets') !== null;
    const hasGcSrvinfo = doc.querySelector('.gc-srvinfo') !== null;
    const hasDoormatComponent = doc.querySelector('.mwsdoormat-links-container') !== null;
    const isContactH1 = h1.startsWith('Contact') || h1.startsWith('Contactez');
    const isCampaignUrl = url.includes('/campaigns/') || url.includes('/campagnes/');
    //News
    const isNewsUrl = /\/(news|nouvelles)\/\d{4}\//.test(url);
    const isTaxtip = url.includes('/newsroom/tax-tips/') || url.includes('/salle-presse/conseils-fiscaux/');
    const isTFSMK = url.includes('/tax-tips/tax-filing-season-media-kit') || url.includes('/conseils-fiscaux/trousse-medias-periode-production-declarations-revenus');
    const isEnforcementNotice = url.includes('/newsroom/criminal-investigations-actions-charges-convictions') || url.includes('/salle-presse/mesures-relatives-enquetes-criminelles-accusations-condamnations');
    const isMultimedia = url.includes('/news/cra-multimedia-library/') || url.includes('/nouvelles/bibliotheque-multimedia-arc/');
    //Video transcript pages
    const hasVideo = doc.querySelector('video') !== null;
    const hasTranscriptH2 = Array.from(doc.querySelectorAll('h2')).some(h2 =>
      /transcript/i.test(h2.textContent?.trim() ?? '')
    );
    const isVideoTranscript = hasVideo && hasTranscriptH2 && isMultimedia;
    //Forms & pubs
    const isFormReadme = url.includes('/forms-publications/forms/') || url.includes('/formulaires-publications/formulaires/');
    const isPub = url.includes('/forms-publications/publications/') || url.includes('/formulaires-publications/publications/'); //must check after isPubReadme
    const isPubReadme = /\/(forms-publications\/publications|formulaires-publications\/publications)\/[a-z0-9-]+\.html$/.test(url);
    const is5000g = url.includes('/general-income-tax-benefit-package/5000-g.html') || url.includes('/trousse-generale-impot-prestations/5000-g.html')
    const isT1Readme = /\/(general-income-tax-benefit-package|trousse-generale-impot-prestations)\/([a-z-]+\/)?5\d{3}-[a-z]{1,5}\.html$/.test(url);
    const isT1Pub = /\/(general-income-tax-benefit-package|trousse-generale-impot-prestations)\/([a-z-]+\/)?5\d{3}-[a-z]{1,5}\/[a-z0-9-]+\.html$/.test(url);
    const isTD1Readme = /\/(td1-forms-pay-received-on-january-1-(\d{4}-)?later|formulaires-td1-paies-recues-1er-janvier-(\d{4}-)?apres)\/[a-z0-9-]+\.html$/.test(url);
    const payrollPatterns = [
      't4127-payroll-deductions-formulas',
      't4127-formules-calcul-retenues-paie',
      'payroll-deductions-t4127-payroll-deductions-formulas',
      't4127-formules-calcul-retenues-paie-annees-precedentes',
      't4032-payroll-deductions-tables',
      't4032-tables-retenues-paie',
      't4032-payroll-deductions-tables-previous-years',
      't4032-tables-retenues-paie-documents-annees-anterieures',
      't4008-payroll-deductions-supplementary-tables',
      't4008-tables-supplementaires-retenues-paie',
      't4008-payroll-deductions-supplementary-tables-previous-years',
      't4008-tables-supplementaires-retenues-paie-annees-anterieures'
    ];
    const isPayrollReadme = new RegExp(`\\/(${payrollPatterns.join('|')})\\/[a-z0-9-]+\\.html$`).test(url);
    //Assume old topic page if more than 80% of list-group-items have links
    const listGroupItemCount = doc.querySelectorAll('.list-group-item').length;
    const listGroupLinkCount = doc.querySelectorAll('.list-group-item a').length;
    const isOldTopic = listGroupItemCount > 0 && (listGroupLinkCount / listGroupItemCount) >= 0.8;
    //Assume navigational page if over 70% of content is link text
    const mainElement = doc.querySelector('main');
    const mainText = mainElement?.innerText.trim() ?? '';
    const mainLinks = mainElement?.querySelectorAll('a') ?? [];
    const linkText = Array.from(mainLinks).map(a => a.innerText.trim()).join('');
    const isNavigational = mainText.length > 0 && (linkText.length / mainText.length) >= 0.7;
    console.log('Percent links: ' + linkText.length / mainText.length);
    //PDF download pages
    const hasPdfDownloadLink = doc.querySelector('a[href$=".pdf"].btn.stretched-link') !== null;
    const hasThumbnailContainer = doc.querySelector('.thumbnail') !== null;
    const hasPdfMetadata = Array.from(doc.querySelectorAll('small')).some(small =>
      /PDF,.*(KB|Ko).*page/i.test(small.textContent?.trim() ?? '')
    );
    const isPdfDownload = hasPdfDownloadLink && (hasThumbnailContainer || hasPdfMetadata);
    //Brochure page
    const isBrochure = doc.querySelector('.panel-heading.bg-primary') !== null;

    let template = PageTemplate.Content; // default
    if (hasSubway) {
      template = PageTemplate.Subway;
    } else if (hasOldSubway) {
      template = PageTemplate.OldSubway;
    } else if (isNewsUrl) {
      template = PageTemplate.Newsroom;
    } else if (isVideoTranscript) {
      template = PageTemplate.VideoTranscript;
    } else if (isCampaignUrl) {
      template = PageTemplate.Campaign;
    } else if (isFormReadme) {
      template = PageTemplate.ReadmeForm;
    } else if (isPubReadme) {
      template = PageTemplate.ReadmeGuide;
    } else if (isPub) {
      template = PageTemplate.Guide;
    } else if (is5000g) {
      template = PageTemplate.GuideT1;
    } else if (isT1Readme) {
      template = PageTemplate.ReadmeT1;
    } else if (isT1Pub) {
      template = PageTemplate.GuideT1;
    } else if (isTD1Readme) {
      template = PageTemplate.ReadmeTD1;
    } else if (isPayrollReadme) {
      template = PageTemplate.ReadmePayroll;
    } else if (isContactH1) {
      template = PageTemplate.Contact;
    } else if (hasMostRequested || hasGcSrvinfo || hasDoormatComponent) {
      template = PageTemplate.Topic;
    } else if (isOldTopic) {
      template = PageTemplate.OldTopic;
    } else if (isNavigational) {
      template = PageTemplate.Navigation;
    } else if (isBrochure) {
      template = PageTemplate.Brochure;
    } else if (isPdfDownload) {
      template = PageTemplate.PdfDownload;
    } else if (isMultimedia) {
      template = PageTemplate.MultimediaGallery;
    } else if (isTaxtip) {
      template = PageTemplate.Taxtip;
    } else if (isTFSMK) {
      template = PageTemplate.TaxFilingSeasonMediaKit;
    } else if (isEnforcementNotice) {
      template = PageTemplate.EnforcementNotice;
    }

    //Opposite language url
    const htmlLang = doc.documentElement.getAttribute('lang');
    const metaLang = doc.querySelector('meta[name="dcterms.language"]')?.getAttribute('content');
    const normalizedMetaLang = metaLang === 'eng' ? 'en' : metaLang === 'fra' ? 'fr' : null;
    const urlLang = url.includes('/en/') ? 'en' : url.includes('/fr/') ? 'fr' : null;
    const currentLang = htmlLang || normalizedMetaLang || urlLang || 'en'; // default to en
    const oppLang = currentLang === 'en' ? 'fr' : 'en';
    const oppUrl = doc.querySelector(`link[rel="alternate"][hreflang="${oppLang}"]`)?.getAttribute('href') || '';

    //Index status
    const robotsContent = doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
    const noindex = robotsContent.includes('noindex');

    //Word count
    const text = doc.querySelector('main')?.textContent || '';
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    const wordCount = words.length;

    return { doubleH1, h1, title, description, keywords, template, oppUrl, isArchived, linksToPortal, noindex, wordCount };
  }

  markForTranslation() {
    marker('template.content');
    marker('template.subway');
    marker('template.oldSubway');
    marker('template.newsroom');
    marker('template.videoTranscript');
    marker('template.campaign');
    marker('template.readmeForm');
    marker('template.readmeGuide');
    marker('template.guide');
    marker('template.guideT1');
    marker('template.readmeT1');
    marker('template.readmeTD1');
    marker('template.readmePayroll');
    marker('template.contact');
    marker('template.topic');
    marker('template.oldTopic');
    marker('template.navigation');
    marker('template.brochure');
    marker('template.pdfDownload');
    marker('template.multimediaGallery');
    marker('template.taxtip');
    marker('template.taxFilingSeasonMediaKit');
    marker('template.enforcementNotice');
    marker('template.freestyle');
  }

  public async getOppMetadata(url: string): Promise<OppMetadata> {
    const doc = await this.fetchContent(url, "prod", 3, "none", true);
    // Get H1 (or double H1)
    const h1Elements = Array.from(doc.querySelectorAll('h1')).filter(h1 => !h1.classList.contains('wb-inv'));
    const h1Texts = h1Elements.map(e => e.textContent?.trim()).filter(Boolean);

    let doubleH1 = doc.querySelector('hgroup p:has(+ h1)')?.innerHTML || doc.querySelector('p.lead:has(+ h1)')?.innerHTML || '';
    let h1 = '';

    if (h1Texts.length === 1) {
      h1 = h1Texts[0] ?? '';
    } else if (h1Texts.length > 1) {
      doubleH1 = h1Texts[0] ?? '';
      h1 = h1Texts.slice(1).join('<br>');
    }
    // Get Metadata
    const title = doc.querySelector('meta[name="dcterms.title"]')?.getAttribute('content') || '';
    const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || '';
    const robotsContent = doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
    const noindex = robotsContent.includes('noindex');
    return { h1, doubleH1, title, description, keywords, noindex };
  }

  //Get breadcrumb
  public getBreadcrumb(doc: Document, baseUrl: string): BreadcrumbNode[] {
    const breadcrumbItems = doc.querySelectorAll('.breadcrumb li a');
    const breadcrumbArray: BreadcrumbNode[] = [];
    breadcrumbItems.forEach((el) => {
      const rawHref = el.getAttribute('href') || '';
      let absoluteUrl = '';
      try {
        absoluteUrl = new URL(rawHref, baseUrl).href.replace("/content/canadasite", ""); // handles both relative + absolute
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

  //Get same-domain links
  public getLinks(doc: Document, baseUrl: string): string[] {
    const baseDomain = new URL(baseUrl).origin
    const links = Array.from(doc.querySelectorAll('main a'))
      .map(a => a.getAttribute('href'))
      .filter((href): href is string => !!href)
      .map(href => {
        try {
          const url = new URL(href, baseUrl);
          url.hash = '';
          url.search = '';
          return url.href.replace("/content/canadasite", "");
        } catch {
          return null;
        }
      })
      .filter((href): href is string => !!href)
      .filter(href => new URL(href).origin === baseDomain);
    return [...new Set(links)];
  }

  //Get preview content
  public fetchPreview(targetUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const previewUrl = `https://canada-preview.adobecqms.net/en/revenue-agency/web-services-test/amber/test.html?fetch=${encodeURIComponent(targetUrl)}`;
      //const previewUrl = `https://aleblanc3.github.io/test/test.html?fetch=${encodeURIComponent(targetUrl)}`;

      const popup = window.open(previewUrl, '_blank', 'width=1,height=1,left=9999,top=9999');
      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site.'));
        return;
      }
      //Listen for response
      const handler = (event: MessageEvent) => {
        // Verify origin
        if (event.origin !== 'https://canada-preview.adobecqms.net') return;
        //if (event.origin !== 'https://aleblanc3.github.io') return;
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


}

