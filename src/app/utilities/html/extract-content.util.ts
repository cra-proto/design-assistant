import { marker } from '@colsen1991/ngx-translate-extract-marker';

import { generateSHA } from './hash.util';
import { generatePath, normalizePath } from './link.util';
import { getHTMLReadability } from './readability.util';

import { isPortalDomain, isSignInLink } from '../../common/portal-domains.config';

import { PageTemplate } from '../../common/data.model';

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

/** Extracts data from an HTML document */
export async function extractPageData(doc: Document, url: string): Promise<PageMetadata> {
  const removeExtraWhiteSpace = (s: string | null | undefined) => (s ?? '').replace(/[ \t\r\n\f]+/g, ' ').replace(/^ | $/g, '');

  //Opposite language url
  const htmlLang = doc.documentElement.getAttribute('lang');
  const metaLang = doc.querySelector('meta[name="dcterms.language"]')?.getAttribute('content');
  const normalizedMetaLang = metaLang === 'eng' ? 'en' : metaLang === 'fra' ? 'fr' : null;
  const urlLang = url.includes('/en/') ? 'en' : url.includes('/fr/') ? 'fr' : null;
  const currentLang = htmlLang || normalizedMetaLang || urlLang || 'en'; // default to en
  const oppLang = currentLang === 'en' ? 'fr' : 'en';
  const oppUrl = doc.querySelector(`link[rel="alternate"][hreflang="${oppLang}"]`)?.getAttribute('href') || '';

  // Get H1 (or double H1)
  const h1Elements = Array.from(doc.querySelectorAll('h1')).filter((h1) => !h1.classList.contains('wb-inv'));
  const h1Texts = h1Elements.map((e) => removeExtraWhiteSpace(e.textContent)).filter(Boolean);

  let doubleH1 = removeExtraWhiteSpace(doc.querySelector('hgroup p:has(+ h1)')?.innerHTML || doc.querySelector('p.lead:has(+ h1)')?.innerHTML || '');
  let h1 = '';

  if (h1Texts.length === 1) {
    h1 = h1Texts[0] ?? '';
  } else if (h1Texts.length > 1) {
    doubleH1 = h1Texts[0] ?? '';
    h1 = h1Texts.slice(1).join('<br>');
  }

  // Content hash
  const mainContent = doc.querySelector('main')?.innerHTML ?? '';
  const contentHash = await generateSHA(mainContent);
  const lastChecked = new Date().toISOString();

  // Get metadata
  const title = doc.querySelector('meta[name="dcterms.title"]')?.getAttribute('content') || '';
  const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const keywords = doc.querySelector('meta[name="keywords"]')?.getAttribute('content') || doc.querySelector('data[id="pageKeywords"]')?.getAttribute('value') || '';

  //Index status
  const robotsContent = doc.querySelector('meta[name="robots"]')?.getAttribute('content') || '';
  const noindex = robotsContent.includes('noindex');

  // Get archive status
  const isArchived = doc.querySelector('.gc-archv') !== null;

  // Get portal link status
  const linksToPortal = Array.from(doc.querySelectorAll('a')).some((link) => isPortalDomain(link.href));

  //Has ChatBot
  const hasChatbot = !!doc.querySelector('chatbot');

  //Has fieldflow
  const hasFieldflow = !!doc.querySelector('.wb-fieldflow');

  //Parent URL
  const parentUrl = getBreadcrumb(doc, url)?.at(-1)?.url;
  const parentPath = parentUrl ? generatePath(parentUrl) : undefined;

  //Word count
  const text = doc.querySelector('main')?.textContent || '';
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const wordCount = words.length;

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
  const isEnforcementNotice =
    url.includes('/newsroom/criminal-investigations-actions-charges-convictions') || url.includes('/salle-presse/mesures-relatives-enquetes-criminelles-accusations-condamnations');
  const isMultimedia = url.includes('/news/cra-multimedia-library/') || url.includes('/nouvelles/bibliotheque-multimedia-arc/');
  //Video transcript pages
  const hasVideo = doc.querySelector('video') !== null;
  const hasTranscriptH2 = Array.from(doc.querySelectorAll('h2')).some((h2) => /transcript/i.test(h2.textContent?.trim() ?? ''));
  const isVideoTranscript = hasVideo && hasTranscriptH2 && isMultimedia;
  //Forms & pubs
  const isFormReadme = url.includes('/forms-publications/forms/') || url.includes('/formulaires-publications/formulaires/');
  const isPub = url.includes('/forms-publications/publications/') || url.includes('/formulaires-publications/publications/'); //must check after isPubReadme
  const isPubReadme = /\/(forms-publications\/publications|formulaires-publications\/publications)\/[a-z0-9-]+\.html$/.test(url);
  const is5000g = url.includes('/general-income-tax-benefit-package/5000-g.html') || url.includes('/trousse-generale-impot-prestations/5000-g.html');
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
    't4008-tables-supplementaires-retenues-paie-annees-anterieures',
  ];
  const isPayrollReadme = new RegExp(`\\/(${payrollPatterns.join('|')})\\/[a-z0-9-]+\\.html$`).test(url);
  //Assume old topic page if more than 80% of list-group-items have links
  const listGroupItemCount = doc.querySelectorAll('.list-group-item').length;
  const listGroupLinkCount = doc.querySelectorAll('.list-group-item a').length;
  const isOldTopic = listGroupItemCount > 0 && listGroupLinkCount / listGroupItemCount >= 0.8;
  //Assume navigational page if over 70% of content is link text
  const mainElement = doc.querySelector('main');
  const mainText = mainElement?.innerText.trim() ?? '';
  const mainLinks = mainElement?.querySelectorAll('a') ?? [];
  const linkCount = mainLinks.length;
  const linkText = Array.from(mainLinks)
    .map((a) => a.innerText.trim())
    .join('');
  const isNavigational = mainText.length > 0 && linkText.length / mainText.length >= 0.7;
  // Get sign-in link status
  const linksToSignIn = Array.from(mainLinks).some((link) => isSignInLink(link.href));
  //PDF download pages
  const hasPdfDownloadLink = doc.querySelector('a[href$=".pdf"].btn.stretched-link') !== null;
  const hasThumbnailContainer = doc.querySelector('.thumbnail') !== null;
  const hasPdfMetadata = Array.from(doc.querySelectorAll('small')).some((small) => /PDF,.*(KB|Ko).*page/i.test(small.textContent?.trim() ?? ''));
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

  const links = getLinks(doc, url);

  const { fleschKincaid, gunningFog } = getHTMLReadability(doc);

  // Phone numbers
  const phoneRegex = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g;
  const phoneNumbers = [...new Set(mainText.match(phoneRegex) ?? [])].map((n) => n.trim());

  return {
    oppUrl,
    h1,
    doubleH1,
    contentHash,
    lastChecked,
    title,
    description,
    keywords,
    noindex,
    isArchived,
    linksToPortal,
    linksToSignIn,
    hasChatbot,
    hasFieldflow,
    parentPath,
    wordCount,
    linkCount,
    template,
    links,
    fleschKincaid,
    gunningFog,
    phoneNumbers,
  };
}

/** Get same-domain links from an HTML doc */
export function getLinks(doc: Document, baseUrl: string): string[] {
  const baseDomain = new URL(baseUrl).origin;
  const links = Array.from(doc.querySelectorAll('main a'))
    .map((a) => a.getAttribute('href'))
    .filter((href): href is string => !!href)
    .map((href) => {
      try {
        const url = new URL(href, baseUrl);
        url.hash = '';
        url.search = '';
        return normalizePath(url.href.replace('/content/canadasite', ''));
      } catch {
        return null;
      }
    })
    .filter((href): href is string => !!href)
    .filter((href) => new URL(href).origin === baseDomain);
  return [...new Set(links)];
}

/** Get breadcrumb nodes from and HTML doc */
export function getBreadcrumb(doc: Document, baseUrl: string): BreadcrumbNode[] {
  const breadcrumbItems = doc.querySelectorAll('.breadcrumb li a');
  const breadcrumbArray: BreadcrumbNode[] = [];
  breadcrumbItems.forEach((el) => {
    const rawHref = el.getAttribute('href') || '';
    let absoluteUrl = '';
    try {
      absoluteUrl = new URL(rawHref, baseUrl).href.replace('/content/canadasite', ''); // handles both relative + absolute
      absoluteUrl = normalizePath(absoluteUrl);
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

/** WIP: Get all links, link text, and anchors or queries from and HTML document */
export function getLinkData(doc: Document, baseUrl: string): string[] {
  const baseDomain = new URL(baseUrl).origin;
  const links = Array.from(doc.querySelectorAll('main a'))
    .map((a) => a.getAttribute('href'))
    .filter((href): href is string => !!href)
    .map((href) => {
      try {
        const url = new URL(href, baseUrl);
        url.hash = '';
        url.search = '';
        return normalizePath(url.href.replace('/content/canadasite', ''));
      } catch {
        return null;
      }
    })
    .filter((href): href is string => !!href)
    .filter((href) => new URL(href).origin === baseDomain);
  return [...new Set(links)];
}

export function stringToDoc(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}
