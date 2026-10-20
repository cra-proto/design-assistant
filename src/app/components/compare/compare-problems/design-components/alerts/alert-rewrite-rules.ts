export interface AlertRewriteRulesJson {
  version: string;
  alertRewrite: {
    styleRulesBase: string[];
    styleRulesWithExamples: string[];
    systemPromptWithExamplesLines: string[];
    systemPromptWithoutExamplesLines: string[];
    retryInstructions: {
      invalidWrapperHtml: string;
      placeholderLinks: string;
      noLinksAllowed: string;
      mustKeepLink: string;
      mustHaveHeading: string;
      avoidExampleCopy: string;
      fullSentenceLinksNeedLeadIn: string;
    };
  };
}

interface AlertRewriteSharedGuidanceJson {
  styleRules: string[];
  exampleRules: string[];
}

const ALERT_REWRITE_RULES_PATH = new URL('skills/alerts/alerts-rewriting/references/runtime-rewrite-rules.json', document.baseURI).toString();

const ALERT_REWRITE_SHARED_GUIDANCE_PATH = new URL('skills/alerts/alerts-rewriting/references/shared-rewrite-guidance.json', document.baseURI).toString();

const ALERT_REWRITE_RULES_FALLBACK: AlertRewriteRulesJson = {
  version: 'fallback-inline',
  alertRewrite: {
    styleRulesBase: [],
    styleRulesWithExamples: [],
    systemPromptWithExamplesLines: [],
    systemPromptWithoutExamplesLines: [],
    retryInstructions: {
      invalidWrapperHtml: '',
      placeholderLinks: '',
      noLinksAllowed: '',
      mustKeepLink: '',
      mustHaveHeading: '',
      avoidExampleCopy: '',
      fullSentenceLinksNeedLeadIn: '',
    },
  },
};

let alertRewriteRulesCache: AlertRewriteRulesJson | null = null;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function toValidatedRules(raw: unknown): AlertRewriteRulesJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const version = typeof root['version'] === 'string' ? root['version'].trim() : '';
  const alertRewrite = root['alertRewrite'] && typeof root['alertRewrite'] === 'object' ? (root['alertRewrite'] as Record<string, unknown>) : null;
  if (!version || !alertRewrite) return null;

  const styleRulesBase = alertRewrite['styleRulesBase'];
  const styleRulesWithExamples = alertRewrite['styleRulesWithExamples'];
  const systemWithExamples = alertRewrite['systemPromptWithExamplesLines'];
  const systemWithoutExamples = alertRewrite['systemPromptWithoutExamplesLines'];
  const retryInstructionsRaw = alertRewrite['retryInstructions'] && typeof alertRewrite['retryInstructions'] === 'object' ? (alertRewrite['retryInstructions'] as Record<string, unknown>) : null;

  if (!isStringArray(styleRulesBase) || !isStringArray(styleRulesWithExamples) || !isStringArray(systemWithExamples) || !isStringArray(systemWithoutExamples) || !retryInstructionsRaw) {
    return null;
  }
  const invalidWrapperHtml = retryInstructionsRaw['invalidWrapperHtml'];
  const placeholderLinks = retryInstructionsRaw['placeholderLinks'];
  const noLinksAllowed = retryInstructionsRaw['noLinksAllowed'];
  const mustKeepLink = retryInstructionsRaw['mustKeepLink'];
  const mustHaveHeading = retryInstructionsRaw['mustHaveHeading'];
  const avoidExampleCopy = retryInstructionsRaw['avoidExampleCopy'];
  const fullSentenceLinksNeedLeadIn = retryInstructionsRaw['fullSentenceLinksNeedLeadIn'];
  if (
    typeof invalidWrapperHtml !== 'string' ||
    typeof placeholderLinks !== 'string' ||
    typeof noLinksAllowed !== 'string' ||
    typeof mustKeepLink !== 'string' ||
    typeof mustHaveHeading !== 'string' ||
    typeof avoidExampleCopy !== 'string' ||
    typeof fullSentenceLinksNeedLeadIn !== 'string' ||
    !invalidWrapperHtml.trim() ||
    !placeholderLinks.trim() ||
    !noLinksAllowed.trim() ||
    !mustKeepLink.trim() ||
    !mustHaveHeading.trim() ||
    !avoidExampleCopy.trim() ||
    !fullSentenceLinksNeedLeadIn.trim()
  ) {
    return null;
  }

  return {
    version,
    alertRewrite: {
      styleRulesBase,
      styleRulesWithExamples,
      systemPromptWithExamplesLines: systemWithExamples,
      systemPromptWithoutExamplesLines: systemWithoutExamples,
      retryInstructions: {
        invalidWrapperHtml,
        placeholderLinks,
        noLinksAllowed,
        mustKeepLink,
        mustHaveHeading,
        avoidExampleCopy,
        fullSentenceLinksNeedLeadIn,
      },
    },
  };
}

function toValidatedSharedGuidance(raw: unknown): AlertRewriteSharedGuidanceJson | null {
  if (!raw || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const styleRules = root['styleRules'];
  const exampleRules = root['exampleRules'];

  if (!isStringArray(styleRules) || !isStringArray(exampleRules)) {
    return null;
  }

  return {
    styleRules,
    exampleRules,
  };
}

function mergeSharedGuidance(rules: AlertRewriteRulesJson, sharedGuidance: AlertRewriteSharedGuidanceJson): AlertRewriteRulesJson {
  return {
    ...rules,
    alertRewrite: {
      ...rules.alertRewrite,
      styleRulesBase: [...sharedGuidance.styleRules, ...rules.alertRewrite.styleRulesBase],
      styleRulesWithExamples: [...sharedGuidance.exampleRules, ...rules.alertRewrite.styleRulesWithExamples],
    },
  };
}

export async function getAlertRewriteRules(): Promise<AlertRewriteRulesJson> {
  if (alertRewriteRulesCache) return alertRewriteRulesCache;

  try {
    const [runtimeResponse, sharedGuidanceResponse] = await Promise.all([fetch(ALERT_REWRITE_RULES_PATH), fetch(ALERT_REWRITE_SHARED_GUIDANCE_PATH)]);
    if (!runtimeResponse.ok) {
      throw new Error(`Failed to load alert rewrite rules (${runtimeResponse.status}).`);
    }
    if (!sharedGuidanceResponse.ok) {
      throw new Error(`Failed to load shared alert rewrite guidance (${sharedGuidanceResponse.status}).`);
    }
    const payload = (await runtimeResponse.json()) as unknown;
    const sharedGuidancePayload = (await sharedGuidanceResponse.json()) as unknown;
    const validated = toValidatedRules(payload);
    const sharedGuidance = toValidatedSharedGuidance(sharedGuidancePayload);
    if (!validated) {
      throw new Error('Invalid alert rewrite rules JSON schema.');
    }
    if (!sharedGuidance) {
      throw new Error('Invalid shared alert rewrite guidance JSON schema.');
    }
    alertRewriteRulesCache = mergeSharedGuidance(validated, sharedGuidance);
  } catch (err) {
    console.warn('Unable to load alert rewrite rules JSON; using inline fallback.', err);
    alertRewriteRulesCache = ALERT_REWRITE_RULES_FALLBACK;
  }

  return alertRewriteRulesCache;
}
