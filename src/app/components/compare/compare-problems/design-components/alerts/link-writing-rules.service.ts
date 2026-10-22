import { Injectable } from '@angular/core';

export interface LinkWritingRulesOptions {
  hasTooManyLinksIssue: boolean;
}

export type LinkWritingRuleCondition = 'always' | 'too_many_links' | 'not_too_many_links';

export interface LinkWritingRule {
  id: string;
  condition: LinkWritingRuleCondition;
  text: string;
}

export interface LinkWritingRulesJson {
  version: string;
  rules: readonly LinkWritingRule[];
}

const LINK_WRITING_RULES_PATH = new URL('skills/link-writing/references/link-writing-rules.json', document.baseURI).toString();

const LINK_WRITING_RULES_FALLBACK: LinkWritingRulesJson = {
  version: 'fallback-empty',
  rules: [],
};

@Injectable({ providedIn: 'root' })
export class LinkWritingRulesService {
  private rulesCache: LinkWritingRulesJson | null = null;
  private readonly filteredRulesCache = new Map<string, LinkWritingRule[]>();
  private readonly ruleTextCache = new Map<string, string[]>();

  async getLinkWritingRulesJson(options: LinkWritingRulesOptions): Promise<LinkWritingRule[]> {
    const cacheKey = options.hasTooManyLinksIssue ? 'too_many_links' : 'default';
    const cached = this.filteredRulesCache.get(cacheKey);
    if (cached) return cached;

    const source = await this.loadRulesSource();
    const rules = this.filterRules(source, options);
    this.filteredRulesCache.set(cacheKey, rules);
    return rules;
  }

  async getLinkWritingRules(options: LinkWritingRulesOptions): Promise<string[]> {
    const cacheKey = options.hasTooManyLinksIssue ? 'too_many_links' : 'default';
    const cached = this.ruleTextCache.get(cacheKey);
    if (cached) return cached;

    const rules = await this.getLinkWritingRulesJson(options);
    const ruleText = rules.map((rule) => rule.text);
    this.ruleTextCache.set(cacheKey, ruleText);
    return ruleText;
  }

  private async loadRulesSource(): Promise<LinkWritingRulesJson> {
    if (this.rulesCache) return this.rulesCache;
    try {
      const response = await fetch(LINK_WRITING_RULES_PATH);
      if (!response.ok) {
        throw new Error(`Failed to load link writing rules (${response.status}).`);
      }
      const payload = (await response.json()) as unknown;
      const validated = this.toValidatedRulesJson(payload);
      if (!validated) {
        throw new Error('Invalid link writing rules JSON schema.');
      }
      this.rulesCache = validated;
    } catch (err) {
      console.warn('Unable to load link writing rules JSON; using empty fallback.', err);
      this.rulesCache = LINK_WRITING_RULES_FALLBACK;
    }
    return this.rulesCache;
  }

  private filterRules(source: LinkWritingRulesJson, options: LinkWritingRulesOptions): LinkWritingRule[] {
    return source.rules.filter((rule) => {
      if (rule.condition === 'always') return true;
      if (rule.condition === 'too_many_links') return options.hasTooManyLinksIssue;
      return !options.hasTooManyLinksIssue;
    });
  }

  private toValidatedRulesJson(raw: unknown): LinkWritingRulesJson | null {
    if (!raw || typeof raw !== 'object') return null;
    const root = raw as Record<string, unknown>;
    const version = typeof root['version'] === 'string' ? root['version'].trim() : '';
    const rulesRaw = Array.isArray(root['rules']) ? root['rules'] : [];
    const rules: LinkWritingRule[] = [];

    for (const item of rulesRaw) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const id = typeof entry['id'] === 'string' ? entry['id'].trim() : '';
      const conditionRaw = typeof entry['condition'] === 'string' ? entry['condition'].trim() : '';
      const text = typeof entry['text'] === 'string' ? entry['text'].trim() : '';
      if (!id || !text || !this.isRuleCondition(conditionRaw)) continue;
      rules.push({ id, condition: conditionRaw, text });
    }

    if (!version || !rules.length) return null;
    return { version, rules };
  }

  private isRuleCondition(value: string): value is LinkWritingRuleCondition {
    return value === 'always' || value === 'too_many_links' || value === 'not_too_many_links';
  }
}
