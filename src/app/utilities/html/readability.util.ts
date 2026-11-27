import rs from 'text-readability';

export function getHTMLReadability(doc: Document): { fleschKincaid: number; gunningFog: number } {
  // Remove fieldflow & other hard to score elements
  doc.querySelectorAll('.wb-fieldflow, .wb-fieldflow-sub, .pagedetails, script, nav, style').forEach((el) => el.remove());

  // Add periods to end of list items if missing
  doc.querySelectorAll('li').forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    if (text && !text.match(/[.!?]$/)) {
      el.textContent = text + '.';
    }
  });

  // Add periods to end of headings if missing
  doc.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    if (text && !text.match(/[.!?]$/)) {
      el.textContent = text + '.';
    }
  });

  // Strip all HTML
  const text = doc.querySelector('main')?.textContent?.trim() ?? doc.body?.innerText ?? doc.body?.textContent ?? '';
  const cleanText = text.replace(/\s+/g, ' ').trim();

  // Get grade (unlike FK, GF doesn't penalize acronyms and capitalized program names so may better represent grade level of the things we can control)
  const { fleschKincaid, gunningFog } = getTextReadability(cleanText);

  return { fleschKincaid, gunningFog };
}

export function getTextReadability(text: string): { fleschKincaid: number; gunningFog: number } {
  const cleanText = text.trim();
  return {
    fleschKincaid: rs.fleschKincaidGrade(cleanText),
    gunningFog: rs.gunningFog(cleanText),
  };
}
