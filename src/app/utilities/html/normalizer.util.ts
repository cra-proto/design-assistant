export const SPACES = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

export function normalizeText(text: string): string {
  return text
    .replace(/[\u00AD\u200B-\u200D\uFEFF]/g, '')
    .replace(SPACES, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function linkText(a: Element): string {
  return normalizeText(a.textContent ?? '') || normalizeText(a.querySelector('img[alt]')?.getAttribute('alt') ?? '');
}
