export type CanadaCaStyleRuleSeverity = 'must' | 'should';

export interface CanadaCaStyleRule {
  id: string;
  severity: CanadaCaStyleRuleSeverity;
  text: string;
}

export interface CanadaCaStyleExample {
  ruleId: string;
  avoid: string;
  prefer: string;
}

export interface CanadaCaStylePromptOptions {
  includeExamples?: boolean;
}

export const CanadaCaStyleRules: readonly CanadaCaStyleRule[] = [
  {
    id: 'C1_avoid_please',
    severity: 'must',
    text: 'Do not use "please" as a courtesy filler in instructions or task-oriented copy. Start with the action verb when possible. If simply removing "please" leaves awkward wording, rewrite the sentence while preserving meaning.',
  },{
    id: 'C2_direct_instructions',
    severity: 'should',
    text: 'Use direct imperative wording for task instructions. Lead with the action users need to take and avoid unnecessary introductory phrases.',
  }, {
    id: 'C3_plain_language',
    severity: 'should',
    text: 'Use plain, concise language. Prefer familiar words and short sentences when meaning and required detail are preserved.',
  }, {
    id: 'C4_preserve_required_meaning',
    severity: 'must',
    text: 'Preserve legal, eligibility, deadline, service, and policy meaning. Do not simplify content in a way that changes who qualifies, what action is required, when something happens, or what a service provides.',
  }, {
    id: 'C5_do_not_invent_operational_details',
    severity: 'must',
    text: 'Do not invent service standards, contact channels, or other operational details that are not supported by the source content.',
  }, {
    id: 'C6_no_unverified_qa_claims',
    severity: 'must',
    text: 'Do not claim that content passed a full quality assurance review unless the request explicitly states that a full review was performed.',
  },
];

export const CanadaCaStyleExamples: readonly CanadaCaStyleExample[] = [
  { ruleId: 'C1_avoid_please', avoid: 'Please note that processing times may vary.', prefer: 'Processing times may vary.' },
  { ruleId: 'C1_avoid_please', avoid: 'Please ensure your information is accurate.', prefer: 'Make sure your information is accurate.' },
  {
    ruleId: 'C3_plain_language',
    avoid: 'Prior to submitting your application, verify that all required fields have been completed.',
    prefer: 'Before you submit your application, make sure you have completed all required fields.',
  },
  {
    ruleId: 'C3_plain_language',
    avoid: 'Individuals experiencing difficulty accessing their account may contact us for assistance.',
    prefer: 'If you cannot access your account, contact us for help.',
  },
];

export function getCanadaCaStylePromptRules(options: CanadaCaStylePromptOptions = {}): string[] {
  const rules = CanadaCaStyleRules.map((rule) => `[Canada.ca style ${rule.id} ${rule.severity}] ${rule.text}`);
  if (options.includeExamples === false) return rules;

  const examples = CanadaCaStyleExamples.map((example) => `[Canada.ca style example ${example.ruleId}] Avoid: "${example.avoid}" Prefer: "${example.prefer}"`);
  return [...rules, ...examples];
}
