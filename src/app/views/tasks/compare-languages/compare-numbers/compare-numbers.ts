type Lang = 'en' | 'fr';

export interface NumberHit {
  raw: string; // extracted value, for example: "1 234,56"
  value: string; // normalized value, for example: "1234.56"
  before: string; // context before the number
  after: string; // context after the number
}

export interface NumberRow {
  en?: NumberHit;
  fr?: NumberHit;
  match: boolean; // true if en & fr have same value
}

const BLOCK = 'h1,h2,h3,h4,h5,h6,p,li,td,th,dt,dd,caption,figcaption,summary,div,blockquote,address,pre';
const CONTEXT = 40;

const HYPHEN = String.raw`\-\u2010\u2011\u2012\u2013\u2212`;
const SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

const WORDS: Record<Lang, Record<string, number>> = {
  en: { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 },
  fr: { deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 },
};

/** Finds phone numbers with optional leading "1-" */
const PHONE = String.raw`(?<![\d${HYPHEN}])(?:\d[${HYPHEN}])?\d{3}[${HYPHEN}]\d{3}[${HYPHEN}]\d{4}(?![\d${HYPHEN}])`;
const PHONE_EXACT = new RegExp(String.raw`^(?:\d[${HYPHEN}])?\d{3}[${HYPHEN}]\d{3}[${HYPHEN}]\d{4}$`);

/** Finds clock times for comparison, EN uses 12h times (for example, 3 pm or 3:00 pm), FR uses 24h times (for example, 15 h) */
const TIME: Record<Lang, string> = {
  en: String.raw`(?<![\d.,:])(?:1[0-2]|[1-9])(?::00)? ?[ap]m(?![\p{L}\d])`,
  fr: String.raw`(?<![\d.,:])(?:1[3-9]|2[0-3]) ?h(?![\p{L}\d])`,
};

/** Finds plain numbers with thousands separators. For example, EN: 1,234.56 FR: 1 234,56 */
const DIGITS: Record<Lang, string> = {
  en: String.raw`(?<![\d.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)|\d+(?:\.\d+)?`,
  fr: String.raw`(?<![\d.,])\d{1,3}(?: \d{3})+(?:,\d+)?(?!\d)|\d+(?:,\d+)?`,
};

function timeValue(raw: string, lang: Lang): string | null {
  if (lang === 'en') {
    const m = raw.match(/^(\d{1,2})(?::00)? ?([ap])m$/i);
    if (!m) return null;
    const hour = parseInt(m[1], 10);
    // Note: 1-11 pm becomes time:13 to time:23 to match French formatting
    return m[2].toLowerCase() === 'p' && hour < 12 ? `time:${hour + 12}` : String(hour);
  }
  const m = raw.match(/^(\d{2}) ?h$/i);
  return m ? `time:${m[1]}` : null;
}

function numberRegex(lang: Lang): RegExp {
  const words = Object.keys(WORDS[lang]).join('|');
  const beforeHyphen = String.raw`(?<![\p{L}\d]|\p{L}[${HYPHEN}])`;
  const afterHyphen = lang === 'fr' ? String.raw`(?![\p{L}\d]|[${HYPHEN}]\p{L})` : String.raw`(?![\p{L}\d])`;
  return new RegExp(`${PHONE}|${TIME[lang]}|${DIGITS[lang]}|${beforeHyphen}(?:${words})${afterHyphen}`, 'giu');
}

/** Converts a number as written into a value that can be compared across languages */
function normalize(raw: string, lang: Lang): string {
  if (PHONE_EXACT.test(raw)) return `phone:${raw.replace(/\D/g, '')}`;
  const time = timeValue(raw, lang);
  if (time) return time;
  const word = WORDS[lang][raw.toLowerCase()];
  if (word !== undefined) return String(word);
  const cleaned = lang === 'en' ? raw.replace(/,/g, '') : raw.replace(/ /g, '').replace(',', '.');
  return String(parseFloat(cleaned));
}

/** Removes zero-width characters, normalizes spaces, and replaces line breaks with spaces  */
function cleanWhitespace(text: string): string {
  return text
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '') // zero-width characters
    .replace(SPACES, ' ') // spaces
    .replace(/[ \t\r\n]+/g, ' ') // line breaks
    .trim();
}

/** Text of a block, excluding nested blocks so numbers aren't counted twice */
function getText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll(`${BLOCK},script,style`).forEach((n) => n.remove());
  clone.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  return cleanWhitespace(clone.textContent ?? '');
}

export function extractNumbers(doc: Document, lang: Lang): NumberHit[] {
  const root = doc.querySelector('main') ?? doc.body;
  const regex = numberRegex(lang);
  const hits: NumberHit[] = [];

  root.querySelectorAll(BLOCK).forEach((el) => {
    const text = getText(el);

    for (const match of text.matchAll(regex)) {
      const start = match.index!;
      const end = start + match[0].length;
      hits.push({
        raw: match[0],
        value: normalize(match[0], lang),
        before: text.slice(Math.max(0, start - CONTEXT), start),
        after: text.slice(end, end + CONTEXT),
      });
    }
  });
  return hits;
}

/** Aligns two number lists using longest common subsequence, then pairs up adjacent leftovers as mismatches */
export function alignNumbers(en: NumberHit[], fr: NumberHit[]): NumberRow[] {
  const n = en.length,
    m = fr.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = en[i].value === fr[j].value ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const raw: { en?: NumberHit; fr?: NumberHit }[] = [];
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (en[i].value === fr[j].value) raw.push({ en: en[i++], fr: fr[j++] });
    else if (dp[i + 1][j] >= dp[i][j + 1]) raw.push({ en: en[i++] });
    else raw.push({ fr: fr[j++] });
  }
  while (i < n) raw.push({ en: en[i++] });
  while (j < m) raw.push({ fr: fr[j++] });

  // An EN-only row next to an FR-only row (either order) is a changed number, so show it as one row
  const rows: NumberRow[] = [];
  for (let k = 0; k < raw.length; k++) {
    const cur = raw[k],
      next = raw[k + 1];
    if (next && ((cur.en && !cur.fr && next.fr && !next.en) || (cur.fr && !cur.en && next.en && !next.fr))) {
      rows.push({ en: cur.en ?? next.en, fr: cur.fr ?? next.fr, match: false });
      k++;
    } else {
      rows.push({ ...cur, match: !!(cur.en && cur.fr) });
    }
  }
  return rows;
}
