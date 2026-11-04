export type CraTerminologyLanguage = 'en' | 'fr';
export type CraTerminologyIntroductionPolicy = 'allowed' | 'source-only';

export interface CraTerminologyEntryConfig {
  id: string;
  language: CraTerminologyLanguage;
  termKey: string;
  introduction: CraTerminologyIntroductionPolicy;
  disallowedShortFormKeys: string[];
}

export interface ResolvedCraTerminologyEntry extends CraTerminologyEntryConfig {
  term: string;
  disallowedShortForms: string[];
}

export interface CraTerminologyViolation {
  type: 'introduced' | 'shortened';
  entry: ResolvedCraTerminologyEntry;
}

export const CraTerminologyInstructions = {
  preserveAtomic: 'If retained, keep these source expressions complete and unchanged; they may be removed with the ideas they name, but do not shorten or replace them: {{terms}}.',
  retryAtomic: 'If the related idea remains, use the complete source expression instead of a shortened form: {{terms}}.',
  retrySourceOnly: 'Do not introduce these source-only expressions because they do not appear in the source: {{terms}}.',
} as const;

export const CraTerminologyEntries: readonly CraTerminologyEntryConfig[] = [
  {
    id: 'royal-assent-en',
    language: 'en',
    termKey: 'aiPrompt.craTerminology.terms.royalAssent',
    introduction: 'source-only',
    disallowedShortFormKeys: ['aiPrompt.craTerminology.shortForms.royalAssent'],
  },
  {
    id: 'sanction-royale-fr',
    language: 'fr',
    termKey: 'aiPrompt.craTerminology.terms.royalAssent',
    introduction: 'source-only',
    disallowedShortFormKeys: ['aiPrompt.craTerminology.shortForms.royalAssent'],
  },
  {
    id: 'retenues-sur-la-paie-fr',
    language: 'fr',
    termKey: 'aiPrompt.craTerminology.terms.payrollDeductions',
    introduction: 'allowed',
    disallowedShortFormKeys: ['aiPrompt.craTerminology.shortForms.payrollDeductions'],
  },
];

export function resolveCraTerminologyEntries(language: CraTerminologyLanguage, translate: (key: string) => string): ResolvedCraTerminologyEntry[] {
  return CraTerminologyEntries.filter((entry) => entry.language === language)
    .map((entry) => ({
      ...entry,
      term: translate(entry.termKey).trim(),
      disallowedShortForms: entry.disallowedShortFormKeys.map((key) => translate(key).trim()).filter((value) => !!value),
    }))
    .filter((entry) => !!entry.term);
}

export function getMatchedCraTerminology(source: string, entries: ResolvedCraTerminologyEntry[]): ResolvedCraTerminologyEntry[] {
  return entries.filter((entry) => containsCraTerm(source, entry.term));
}

export function findCraTerminologyViolations(source: string, output: string, entries: ResolvedCraTerminologyEntry[]): CraTerminologyViolation[] {
  const violations: CraTerminologyViolation[] = [];

  for (const entry of entries) {
    const sourceHasTerm = containsCraTerm(source, entry.term);
    const outputHasTerm = containsCraTerm(output, entry.term);

    if (entry.introduction === 'source-only' && !sourceHasTerm && outputHasTerm) {
      violations.push({ type: 'introduced', entry });
      continue;
    }

    if (sourceHasTerm && !outputHasTerm && entry.disallowedShortForms.some((shortForm) => containsCraTerm(output, shortForm))) {
      violations.push({ type: 'shortened', entry });
    }
  }

  return violations;
}

function containsCraTerm(value: string, term: string): boolean {
  if (!value || !term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(value);
}
