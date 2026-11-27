import { UrlVersion } from '../../common/data.model';

import { environment } from '../../../environments/environment';

/** Returns a relative path for the provided URL
 *
 *  Removes specific number of URL segments for different hosts:
 ** UT server: 4
 ** GitHub: 2
 ** Canada.ca: 1
 */
export function generatePath(url: string): string {
  try {
    const { hostname, pathname } = new URL(url);
    const isLocal = hostname === 'cra-ut.isvcs.net';
    const isGithub = hostname === 'cra-test-arc.canada.ca' || hostname === 'test.canada.ca' || hostname.endsWith('.github.io');
    const slice = isLocal ? 4 : isGithub ? 2 : 1;
    return pathname.split('/').slice(slice).join('/');
  } catch {
    return url;
  }
}

/** Strips anchors, queries, and adds .html to links
 *
 *  Use when comparing two paths to see if they are the same */
export function normalizePath(path: string): string {
  let clean = path.split('?')[0].split('#')[0]; // strip anchors and queries
  clean = clean.replace(/\/+$/, ''); // remove trailing slash
  //Return link with .html
  if (/\.html$/i.test(clean)) {
    return clean;
  }
  // Return link with other extension
  if (/\.[a-z0-9]+$/i.test(clean)) {
    return clean;
  }
  // Add .html if missing
  return `${clean}.html`;
}

/** Generate a URL for a specific version:
 *
 ** live (Canada.ca)
 ** preview (AEM preview)
 ** protoGH (GitHub prototype)
 ** protoUT (UT prototype)
 ** baseGH (GitHub baseline)
 ** baseUT (UT baseline)
 ** upd (Usability Performance Dashboard)
 ** aida (AI Design Assistant)
 *
 * Include owner and repo if generating GitHub URLs
 *
 * Include UI lang if generating a UPD URL
 */
export function generateUrl(path: string, version: UrlVersion = 'live', owner?: string, repo?: string, uiLang?: string): string {
  const repoDomain = owner === 'cra-proto' ? 'https://cra-test-arc.canada.ca' : owner === 'gc-proto' ? 'https://test.canada.ca' : `https://${owner}.github.io`;
  switch (version) {
    case 'live':
      return `https://www.canada.ca/${path}`;
    case 'protoGH':
      return `${repoDomain}/${repo}/${path}`;
    case 'baseGH':
      return `${repoDomain}/${repo}-baseline/${path}`;
    case 'preview':
      return `https://canada-preview.adobecqms.net/${path}`;
    case 'protoUT':
      return `http://cra-ut.isvcs.net/test/aida/${repo}/${path}`;
    case 'baseUT':
      return `http://cra-ut.isvcs.net/test/aida/${repo}-baseline/${path}`;
    case 'upd': {
      const currentLang = uiLang?.startsWith('fr') ? '&lang=FR' : '';
      return `https://cra-arc.alpha.canada.ca/en/pages?url=https://www.canada.ca/${path}${currentLang}`;
    }
    case 'aida': {
      return `${environment.aida}/import-page?url=https://www.canada.ca/${path}`;
    }
    default:
      return `https://www.canada.ca/${path}`;
  }
}

/** Checks if a string is a valid URL */
export function isValidUrl(value: string | undefined | null): value is string {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Get url language (returns en, fr, or null) */
export function getUrlLang(url: string): 'en' | 'fr' | null {
  if (url.includes('/en/') || url.endsWith('en.html') || url.startsWith('en/')) return 'en';
  else if (url.includes('/fr/') || url.endsWith('fr.html') || url.startsWith('fr/')) return 'fr';
  else return null;
}
