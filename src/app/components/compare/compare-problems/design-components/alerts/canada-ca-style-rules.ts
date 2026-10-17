export type CanadaCaStyleRuleSeverity = 'must' | 'should';

export interface CanadaCaStyleRule {
  id: string;
  severity: CanadaCaStyleRuleSeverity;
  condition: string;
  text: string;
}

export interface CanadaCaStyleExample {
  ruleId: string;
  avoid: string;
  prefer: string;
}

export interface CanadaCaStyleRulesJson {
  version: string;
  status?: string;
  rules: readonly CanadaCaStyleRule[];
  examples: readonly CanadaCaStyleExample[];
}

export interface CanadaCaStyleRulesOptions {
  includeExamples?: boolean;
}

const CANADA_CA_STYLE_RULES_PATH = new URL('skills/canada-ca-style/references/writing-rules.json', document.baseURI).toString();

const CANADA_CA_STYLE_RULES_FALLBACK: CanadaCaStyleRulesJson = {
  version: 'fallback-empty',
  rules: [],
  examples: [],
};

let canadaCaStyleRulesCache: CanadaCaStyleRulesJson | null = null;
const canadaCaStyleRuleTextCache = new Map<string, string[]>();

function isSeverity(value: string): value is CanadaCaStyleRuleSeverity {
  return value === 'must' || value === 'should';
}

function toValidatedRulesJson(raw: unknown): CanadaCaStyleRulesJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const version = typeof root['version'] === 'string' ? root['version'].trim() : '';
  const status = typeof root['status'] === 'string' ? root['status'].trim() : '';
  const rulesRaw = Array.isArray(root['rules']) ? root['rules'] : [];
  const examplesRaw = Array.isArray(root['examples']) ? root['examples'] : [];
  const rules: CanadaCaStyleRule[] = [];
  const examples: CanadaCaStyleExample[] = [];

  for (const item of rulesRaw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry['id'] === 'string' ? entry['id'].trim() : '';
    const severityRaw = typeof entry['severity'] === 'string' ? entry['severity'].trim() : '';
    const condition = typeof entry['condition'] === 'string' ? entry['condition'].trim() : '';
    const text = typeof entry['text'] === 'string' ? entry['text'].trim() : '';
    if (!id || !condition || !text || !isSeverity(severityRaw)) continue;
    rules.push({ id, severity: severityRaw, condition, text });
  }

  for (const item of examplesRaw) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const ruleId = typeof entry['ruleId'] === 'string' ? entry['ruleId'].trim() : '';
    const avoid = typeof entry['avoid'] === 'string' ? entry['avoid'].trim() : '';
    const prefer = typeof entry['prefer'] === 'string' ? entry['prefer'].trim() : '';
    if (!ruleId || !avoid || !prefer) continue;
    examples.push({ ruleId, avoid, prefer });
  }

  if (!version || !rules.length) return null;
  return { version, ...(status ? { status } : {}), rules, examples };
}

async function loadRulesSource(): Promise<CanadaCaStyleRulesJson> {
  if (canadaCaStyleRulesCache) return canadaCaStyleRulesCache;
  try {
    const response = await fetch(CANADA_CA_STYLE_RULES_PATH);
    if (!response.ok) {
      throw new Error(`Failed to load Canada.ca style rules (${response.status}).`);
    }
    const payload = (await response.json()) as unknown;
    const validated = toValidatedRulesJson(payload);
    if (!validated) {
      throw new Error('Invalid Canada.ca style rules JSON schema.');
    }
    canadaCaStyleRulesCache = validated;
  } catch (err) {
    console.warn('Unable to load Canada.ca style rules JSON; using empty fallback.', err);
    canadaCaStyleRulesCache = CANADA_CA_STYLE_RULES_FALLBACK;
  }
  return canadaCaStyleRulesCache;
}

export async function getCanadaCaStyleRulesJson(): Promise<CanadaCaStyleRulesJson> {
  return loadRulesSource();
}

export async function getCanadaCaStyleRules(options: CanadaCaStyleRulesOptions = {}): Promise<string[]> {
  const cacheKey = options.includeExamples === false ? 'rules-only' : 'with-examples';
  const cached = canadaCaStyleRuleTextCache.get(cacheKey);
  if (cached) return cached;

  const source = await loadRulesSource();
  const rules = source.rules.map((rule) => `[Canada.ca style ${rule.id} ${rule.severity}] ${rule.text}`);
  if (options.includeExamples === false) {
    canadaCaStyleRuleTextCache.set(cacheKey, rules);
    return rules;
  }

  const examples = source.examples.map((example) => `[Canada.ca style example ${example.ruleId}] Avoid: "${example.avoid}" Prefer: "${example.prefer}"`);
  const ruleText = [...rules, ...examples];
  canadaCaStyleRuleTextCache.set(cacheKey, ruleText);
  return ruleText;
}
