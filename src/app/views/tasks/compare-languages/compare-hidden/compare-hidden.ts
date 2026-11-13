/**
 * Hidden content detection (see classify())
 *
 * Hidden from everyone ('all'):
 *   - class: hidden, hide, invisible
 *   - attribute: hidden
 *   - inline style: display:none, visibility:hidden
 * Hidden for visual users, available to screen readers ('visual'):
 *   - class: wb-inv, sr-only
 *   - img alt text
 * Hidden for screen readers only, available to visual users ('screenreaders'):
 *   - attribute: aria-hidden="true"
 * Hidden for browsers only, available under specifc conditions for print, basic HTML, and no JS ('web'):
 *   - class: visible-print, wbdisable-show, nojs-show
 * Hidden for print only ('print'):
 *   - class: hidden-print
 * Hidden for specific breakpoints ('responsive'):
 *   - class: 'hidden-xs', 'hidden-sm', 'hidden-md', 'hidden-lg', 'visible-xs', 'visible-sm', 'visible-md', 'visible-lg'
 *
 * Rules:
 *   - visual + screenreaders on the same element = 'all'
 *   - descendants of an 'all' element are skipped
 *   - elements with no text are ignored
 *   - only <main> (or <body>) is scanned; script/style/noscript removed
 *
 * NOT detected: stylesheet-based hiding, opacity:0, font-size:0, off-screen
 * positioning, clip/clip-path, collapsed <details>, other classes (d-none,
 * wb-inv-focusable, etc.), inert, <template>, input[type=hidden],
 * shadow DOM, iframes
 */

export type HiddenType = 'all' | 'visual' | 'screenreaders' | 'web' | 'print' | 'responsive';
export type HiddenStatus = 'ok' | 'missing' | 'identical' | 'wrongLanguage';

export interface HiddenHit {
  type: HiddenType;
  name: string; // classes or attributes
  text: string;
}

export interface HiddenRow {
  type: HiddenType;
  name: string;
  en?: string;
  fr?: string;
  status: HiddenStatus;
}

// Hidden from everyone (display:none)
export const ALL_CLASSES = new Set(['hidden', 'hide', 'invisible']);
// Hidden for visual users (still exposed to screen readers)
export const VISUAL_CLASSES = new Set(['wb-inv', 'sr-only']);
// Hidden for web users (available to print, basic HTML users, or non-js users)
export const WEB_CLASSES = new Set(['visible-print', 'wbdisable-show', 'nojs-show']);
// Hidden for print users
export const PRINT_CLASSES = new Set(['hidden-print']);
// Hidden for specific breakpoints
export const RESPONSIVE_CLASSES = new Set(['hidden-xs', 'hidden-sm', 'hidden-md', 'hidden-lg', 'visible-xs', 'visible-sm', 'visible-md', 'visible-lg']);

const TYPE_ORDER: HiddenType[] = ['all', 'visual', 'screenreaders', 'web', 'print', 'responsive'];
const SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
// Currency symbols, percent signs, and digits split by a comma or period (1,234 / 1.5) are formatted differently in EN and FR
const LANGUAGE_SENSITIVE = /[$€£¥%]|\d[.,]\d/;

function classify(el: Element): { type: HiddenType; reasons: string[] } | null {
  const all: string[] = [];
  const visual: string[] = [];
  const sr: string[] = [];
  const web: string[] = [];
  const print: string[] = [];
  const responsive: string[] = [];

  el.classList.forEach((c) => {
    if (ALL_CLASSES.has(c)) all.push(`class: ${c}`);
    else if (VISUAL_CLASSES.has(c)) visual.push(`class: ${c}`);
    else if (WEB_CLASSES.has(c)) web.push(`class: ${c}`);
    else if (PRINT_CLASSES.has(c)) print.push(`class: ${c}`);
    else if (RESPONSIVE_CLASSES.has(c)) responsive.push(`class: ${c}`);
  });

  if (el.hasAttribute('hidden')) all.push('attribute: hidden');

  const style = (el as HTMLElement).style;
  if (style?.display === 'none') all.push('style: display:none');
  if (style?.visibility === 'hidden') all.push('style: visibility:hidden');

  if (el.getAttribute('aria-hidden') === 'true') sr.push('attribute: aria-hidden="true"');

  if (!all.length && !visual.length && !sr.length && !web.length && !print.length && !responsive.length) {
    return null;
  }

  // Hidden both visually and from screen readers = hidden for all
  const type: HiddenType = all.length || (visual.length && sr.length) ? 'all' : visual.length ? 'visual' : sr.length ? 'screenreaders' : web.length ? 'web' : print.length ? 'print' : 'responsive';

  return { type, reasons: [...all, ...visual, ...sr, ...web, ...print, ...responsive] };
}

function normalizeText(s: string): string {
  return s
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')
    .replace(SPACES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractHidden(doc: Document): HiddenHit[] {
  const root = (doc.querySelector('main') ?? doc.body).cloneNode(true) as Element;
  root.querySelectorAll('script,style,noscript').forEach((n) => n.remove());

  const hits: HiddenHit[] = [];
  const hiddenForAll = new Set<Element>();

  // Document order guarantees ancestors are processed before descendants
  root.querySelectorAll('*').forEach((el) => {
    // Skip anything nested inside an element that's already hidden for all
    for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
      if (hiddenForAll.has(p)) return;
    }

    // Images: alt text is only exposed to screen readers
    if (el.tagName === 'IMG') {
      const result = classify(el);
      // Skip if the image itself, or an ancestor, is hidden from screen readers
      if ((result && result.type !== 'visual') || el.closest('[aria-hidden="true"]')) return;
      const alt = normalizeText(el.getAttribute('alt') ?? '');
      if (alt) hits.push({ type: 'visual', name: 'attribute: alt', text: alt });
      return;
    }

    const result = classify(el);
    if (!result) return;
    if (result.type === 'all') hiddenForAll.add(el);

    // Elements with no text (icons, empty wrappers) have nothing to compare
    const text = normalizeText(el.textContent ?? '');
    if (!text) return;

    hits.push({ type: result.type, name: result.reasons.join(', '), text });
  });

  return hits;
}

/** Language of a URL's path (/en/ or /fr/), or null for anchors, mailto/tel, and URLs with neither */
function urlLang(href: string): 'en' | 'fr' | null {
  if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return null;
  try {
    const path = new URL(href, 'https://www.canada.ca').pathname;
    if (/\/en(\/|$)/.test(path)) return 'en';
    if (/\/fr(\/|$)/.test(path)) return 'fr';
  } catch {
    // unparseable URL, ignore
  }
  return null;
}

function getLinks(doc: Document): string[] {
  const root = doc.querySelector('main') ?? doc.body;
  return Array.from(root.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') ?? '');
}

/** English links pointing to /fr/ and French links pointing to /en/.
 *  If both pages have the same number of links, the link at the same position on the other page is shown alongside; otherwise it's left blank. */
function wrongLanguageLinks(docEN: Document, docFR: Document): HiddenRow[] {
  const en = getLinks(docEN);
  const fr = getLinks(docFR);
  const aligned = en.length === fr.length;
  const rows: HiddenRow[] = [];
  const row = (e?: string, f?: string): HiddenRow => ({ type: 'all', name: 'attribute: href', en: e, fr: f, status: 'wrongLanguage' });

  en.forEach((href, i) => {
    if (urlLang(href) === 'fr') rows.push(row(href, aligned ? fr[i] : undefined));
  });
  fr.forEach((href, i) => {
    if (urlLang(href) !== 'en') return;
    if (aligned && urlLang(en[i]) === 'fr') return; // already added from the English side
    rows.push(row(aligned ? en[i] : undefined, href));
  });
  return rows;
}

const keyOf = (h: HiddenHit) => `${h.type}|${h.name}`;

/** Text with no letters and no language-specific number formatting reads the same in both languages (2026, 123-4567-3456) */
function isLanguageNeutral(text: string): boolean {
  return !/\p{L}/u.test(text) && !LANGUAGE_SENSITIVE.test(text);
}

function status(en?: string, fr?: string): HiddenStatus {
  if (en === undefined || fr === undefined) return 'missing';
  if (en !== fr) return 'ok';
  return isLanguageNeutral(en) ? 'ok' : 'identical';
}

/** Aligns EN and FR hidden elements by type + name (LCS), since the text itself differs between languages */
export function compareHidden(docEN: Document, docFR: Document): HiddenRow[] {
  const en = extractHidden(docEN);
  const fr = extractHidden(docFR);
  const n = en.length,
    m = fr.length;

  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = keyOf(en[i]) === keyOf(fr[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const rows: HiddenRow[] = [];
  const push = (e?: HiddenHit, f?: HiddenHit) => {
    const src = (e ?? f)!;
    rows.push({ type: src.type, name: src.name, en: e?.text, fr: f?.text, status: status(e?.text, f?.text) });
  };

  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (keyOf(en[i]) === keyOf(fr[j])) push(en[i++], fr[j++]);
    else if (dp[i + 1][j] >= dp[i][j + 1]) push(en[i++]);
    else push(undefined, fr[j++]);
  }
  while (i < n) push(en[i++]);
  while (j < m) push(undefined, fr[j++]);

  // Array.sort is stable, so document order is kept within each type
  return [...rows, ...wrongLanguageLinks(docEN, docFR)].sort((x, y) => TYPE_ORDER.indexOf(x.type) - TYPE_ORDER.indexOf(y.type));
}
