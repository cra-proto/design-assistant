export type CanadaCaStyleRuleSeverity = 'must' | 'should';

export interface CanadaCaStyleRule {
  id: string;
  severity: CanadaCaStyleRuleSeverity;
  text: string;
}

export const CanadaCaStyleRules: readonly CanadaCaStyleRule[] = [
  {
    id: 'C1_avoid_please',
    severity: 'must',
    text: 'Do not use "please" as a courtesy filler in instructions or task-oriented copy. Start with the action verb when possible. If simply removing "please" leaves awkward wording, rewrite the sentence while preserving meaning.',
  },
  {
    id: 'C2_direct_instructions',
    severity: 'should',
    text: 'Use direct imperative wording for task instructions. Lead with the action users need to take and avoid unnecessary introductory phrases.',
  },
  {
    id: 'C3_plain_language',
    severity: 'should',
    text: 'Use plain, concise language. Prefer familiar words and short sentences when meaning and required detail are preserved.',
  },
  {
    id: 'C4_preserve_required_meaning',
    severity: 'must',
    text: 'Preserve legal, eligibility, deadline, service, and policy meaning. Do not simplify content in a way that changes who qualifies, what action is required, when something happens, or what a service provides.',
  },
  {
    id: 'C5_do_not_invent_operational_details',
    severity: 'must',
    text: 'Do not invent service standards, contact channels, or other operational details that are not supported by the source content.',
  },
  {
    id: 'C6_no_unverified_qa_claims',
    severity: 'must',
    text: 'Do not claim that content passed a full quality assurance review unless the request explicitly states that a full review was performed.',
  },
];

export function getCanadaCaStylePromptRules(): string[] {
  return CanadaCaStyleRules.map((rule) => `[Canada.ca style ${rule.id} ${rule.severity}] ${rule.text}`);
}
