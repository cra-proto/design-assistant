export interface AlertRewritePromptRules {
  alertRewrite: {
    styleRulesBase: string[];
    styleRulesWithExamples: string[];
    systemPromptWithExamplesLines: string[];
    systemPromptWithoutExamplesLines: string[];
    retryInstructions: {
      invalidWrapperHtml: string;
      noLinksAllowed: string;
      mustKeepLink: string;
      mustHaveHeading: string;
      avoidExampleCopy: string;
      fullSentenceLinksNeedLeadIn: string;
    };
  };
}

export const AlertRewriteRules: AlertRewritePromptRules = {
  alertRewrite: {
    styleRulesBase: [
      "Keep edits proportionate. Resolve selected issues and use selected examples only as style guidance. Preserve the alert's supported meaning, facts, and purpose.",
      'Preserve the original alert type, such as info, warning, danger, or success, unless a selected issue explicitly identifies the alert type as incorrect.',
      'Do not invent facts, dates, URLs, program names, or destination details.',
      'Prefer short sentences. Use 1 or 2 sentences when the sentences are short, or 1 sentence when the sentence is longer. Treat these as flexible guidance, not hard limits.',
      'Do not use semicolons to combine ideas just to reduce the sentence count.',
      'If the alert includes a standalone lead-in to a link, first include one substantive sentence that explains the alert.',
      'Do not output an alert whose only body text is a link-introduction sentence such as Learn about: or Refer to:.',
      'Add or preserve a short, descriptive heading.',
      'Do not rewrite alert content into accordions, disclosure widgets, expand-collapse components, or other containers that hide content from visual display. Inline assistive text that uses the wb-inv class is allowed: preserve it when it is needed, keep it in its original reading order, and make sure it flows with the surrounding visible text. Do not treat wb-inv text as prohibited hidden content.',
      'Do not add new images or icons. Preserve meaningful non-text content and useful existing text alternatives. When a selected issue identifies a missing or incorrect text alternative for retained non-text content, add or correct it using only information supported by the source content. Keep decorative non-text content hidden from assistive technology with an empty text alternative where appropriate.',
      'State what happened, then what to do.',
      'Use plain, active, neutral language.',
      'Include a next step when possible.',
      'Keep alert content concise for UI.',
      'Ensure each applicable selected issue that can be fixed within the alert results in a meaningful change. Do not claim an issue is fixed when the alert is unchanged, or alter valid content merely to show a change. Issues outside the alert, including placement, do not by themselves require a content change.',
      'Do not add new links. If the original alert has one or more <a> links, rewrittenAlertHtml must include at least one real <a> element with an original href. Do not convert every link to plain text, omit all links, or replace links with placeholder text. You may rewrite anchor text only if it improves clarity and still describes the same destination. If the original alert has multiple links, only remove extra links when the selected issues or plan identify too many links or link removal.',
      'Set rewrittenAlertHtml to full .alert wrapper HTML (for example: <div class="alert alert-info">...</div>).',
    ],
    styleRulesWithExamples: [
      'Use examples as pattern guidance only.',
      "When examples include egHtml, use that field as the example's final HTML pattern.",
      'Do not copy example wording.',
      "Keep wording specific to the input alert's own facts and wording.",
    ],
    systemPromptWithExamplesLines: [
      'You are an expert in Canada.ca alerts, accessibility, content design, and alert HTML rewriting.',
      'Use examples as pattern guidance, not copy/paste text.',
      'Only include exampleIdsUsed values that match the provided example ids.',
      'Keep the alert wrapper and classes valid.',
      'Do not return any sentence copied from the examples.',
      'Return JSON only. No extra text.',
      'Output schema:',
      '{"rewrittenAlertHtml":"string","rewrittenHeading":"string","rewrittenAlert":"string","appliedDirectives":["..."],"exampleIdsUsed":["ex-001"]}',
    ],
    systemPromptWithoutExamplesLines: [
      'You are an expert in Canada.ca alerts, accessibility, content design, and alert HTML rewriting.',
      'No examples are provided for this request.',
      'Return exampleIdsUsed as an empty array: [].',
      'Keep the alert wrapper and classes valid.',
      'Return JSON only. No extra text.',
      'Output schema:',
      '{"rewrittenAlertHtml":"string","rewrittenHeading":"string","rewrittenAlert":"string","appliedDirectives":["..."],"exampleIdsUsed":[]}',
    ],
    retryInstructions: {
      invalidWrapperHtml: 'Return valid rewrittenAlertHtml as a full .alert wrapper element.',
      noLinksAllowed: 'The original alert has no links. Do not add hyperlinks. Return rewrittenAlertHtml without any <a> tags.',
      mustKeepLink:
        'The original alert has one or more required <a> links. Your previous rewrittenAlertHtml removed every link. Return rewrittenAlertHtml with at least one real <a> element using an original href. If the issue is too many links, remove only extra links and keep the most useful original link.',
      mustHaveHeading:
        'Alerts must include a semantic heading element in rewrittenAlertHtml. Add a short, descriptive heading using <h2 class="h3"> or <h3> to <h6> as needed, and place it before the body text.',
      avoidExampleCopy: 'Your previous output matched example wording. Rewrite using alert-specific wording and facts only.',
      fullSentenceLinksNeedLeadIn:
        'If a link stands alone as its own sentence or paragraph, or if a sentence mainly directs the user to a link, place that link direction in its own paragraph. Prefer putting a standalone link sentence or paragraph last in the alert content, but do not treat placement as a hard requirement. Use a natural lead-in before the anchor when the standalone link text does not already contain a clear action verb. "Refer to:" and "For details:" are both valid for supporting detail, reference, status, or explanatory links. Prefer "Refer to:" for required task, service, form, or procedural reference links. Prefer "For details:" when the link provides supporting information or more context. Prefer "Learn more:" for optional background, status, or update links. Do not add a lead-in before standalone action links such as "View CRA processing times", "Check CRA processing times", "Get an access code", "Sign up for direct deposit", "Create an account", "Cancel a payment", "Send documents", "Confirm your information", "Review the proposed rates", "Register a business", "Sign in or register for a CRA account", "Learn about the Canada Groceries and Essentials Benefit", "Find out how to get an access code", or "How to get an access code". Use "Learn about" without a colon when the linked text naturally completes the phrase, especially for explainer or topic pages. If the phrase needs an article, place it before the anchor, for example "Learn about the <a>Canada Groceries and Essentials Benefit</a>". Do not put a period or other punctuation after the closing anchor in a standalone link sentence or paragraph.',
    },
  },
};
