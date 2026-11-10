const COUNT_TYPES = ['element', 'class', 'attribute'] as const;
const IGNORED_TAGS = 'script,style,noscript';
const TRACKED_ATTRIBUTES = ['role', 'style', 'id'];
const TRACKED_ATTRIBUTE_PREFIXES = ['data-', 'aria-'];

type CountType = (typeof COUNT_TYPES)[number];
type Counts = Record<CountType, Map<string, number>>;

export interface CountRow {
  type: CountType;
  name: string;
  en: number;
  fr: number;
}

function isTrackedAttribute(name: string): boolean {
  return TRACKED_ATTRIBUTES.includes(name) || TRACKED_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function count(doc: Document): Counts {
  const root = (doc.querySelector('main') ?? doc.body).cloneNode(true) as Element;
  root.querySelectorAll(IGNORED_TAGS).forEach((n) => n.remove());

  const counts: Counts = { element: new Map(), class: new Map(), attribute: new Map() };

  root.querySelectorAll('*').forEach((el) => {
    increment(counts.element, el.tagName.toLowerCase());
    el.classList.forEach((c) => increment(counts.class, c));
    el.getAttributeNames()
      .filter(isTrackedAttribute)
      .forEach((a) => increment(counts.attribute, a));
  });

  return counts;
}

export function compareHTML(docEN: Document, docFR: Document): CountRow[] {
  const en = count(docEN);
  const fr = count(docFR);
  const rows: CountRow[] = [];

  for (const type of COUNT_TYPES) {
    const names = new Set([...en[type].keys(), ...fr[type].keys()]);
    for (const name of names) {
      rows.push({ type, name, en: en[type].get(name) ?? 0, fr: fr[type].get(name) ?? 0 });
    }
  }

  // Biggest differences first, then matches alphabetically
  return rows.sort((x, y) => Math.abs(y.en - y.fr) - Math.abs(x.en - x.fr) || x.name.localeCompare(y.name));
}
