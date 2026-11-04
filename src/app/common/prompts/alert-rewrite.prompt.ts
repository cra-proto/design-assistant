import { OutputKey } from './prompt.model';
import { OutputFragment } from './shared.prompts';

export interface AlertRewritePromptRules {
  alertRewrite: {
    role: string;
    styleRulesBase: string[];
    systemPromptWithExamplesLines: string[];
    systemPromptWithoutExamplesLines: string[];
    outputRequirement: string;
    outputSchemas: {
      withExamples: string;
      withoutExamples: string;
    };
    conditionalInstructions: {
      preserveFinalStandaloneLink: string;
      enforceLinkManifest: string;
    };
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
    role: 'You are an expert in Canada.ca alerts, accessibility, content design, and alert HTML rewriting.',
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
      'Do not add new links.',
      'Set rewrittenAlertHtml to full .alert wrapper HTML (for example: <div class="alert alert-info">...</div>).',
    ],
    systemPromptWithExamplesLines: [
      'Use examples as pattern guidance only.',
      "When examples include egHtml, use that field as the example's final HTML pattern.",
      "Keep wording specific to the input alert's own facts and wording.",
      'Do not introduce wording from an example unless it is supported by the input alert. Valid wording already present in the input alert may be preserved.',
      'Only include exampleIdsUsed values that match the provided example ids.',
    ],
    systemPromptWithoutExamplesLines: ['No examples are provided for this request.', 'Return exampleIdsUsed as an empty array: [].'],
    outputRequirement: OutputFragment[OutputKey.Json],
    outputSchemas: {
      withExamples: '{"rewrittenAlertHtml":"string","rewrittenHeading":"string","rewrittenAlert":"string","exampleIdsUsed":["ex-XXX"]}',
      withoutExamples: '{"rewrittenAlertHtml":"string","rewrittenHeading":"string","rewrittenAlert":"string","exampleIdsUsed":[]}',
    },
    conditionalInstructions: {
      preserveFinalStandaloneLink:
        'The original alert already ends with an acceptable standalone final link sentence or paragraph. Preserve that wording and placement unless a selected issue clearly requires a change. Do not rewrite a valid existing lead-in such as "For details:" to "Refer to:" when it already reads naturally.',
      enforceLinkManifest:
        'Use linkManifest as the source of truth for original links. If linkManifest.mustPreserveAtLeastOne is true, rewrittenAlertHtml must include at least one real <a> element whose href exactly matches one of linkManifest.items[].href values. If linkManifest.allowRemoval is true, you may remove extra links, but you must still keep at least one original link.',
    },
    retryInstructions: {
      invalidWrapperHtml: 'Return valid rewrittenAlertHtml as a full .alert wrapper element.',
      noLinksAllowed: 'The original alert has no links. Do not add hyperlinks. Return rewrittenAlertHtml without any <a> tags.',
      mustKeepLink:
        'An earlier rewrite attempt removed every original link. In this rewrite, retain the appropriate original link or links using the link-selection rule. Use only original href values and do not introduce new links.',
      mustHaveHeading:
        'Alerts must include a semantic heading element in rewrittenAlertHtml. Add a short, descriptive heading using <h2 class="h3"> or <h3> to <h6> as needed, and place it before the body text.',
      avoidExampleCopy: 'Your previous output matched example wording. Rewrite using alert-specific wording and facts only.',
      fullSentenceLinksNeedLeadIn:
        'If a link stands alone as its own sentence or paragraph, or if a sentence mainly directs the user to a link, place that link direction in its own paragraph. Prefer putting a standalone link sentence or paragraph last in the alert content, but do not treat placement as a hard requirement. Use a natural lead-in before the anchor when the standalone link text does not already contain a clear action verb. "Refer to:" and "For details:" are both valid for supporting detail, reference, status, or explanatory links. Prefer "Refer to:" for required task, service, form, or procedural reference links. Prefer "For details:" when the link provides supporting information or more context. Prefer "Learn more:" for optional background, status, or update links. For French content, choose a concise lead-in that fits the purpose; valid options include "En savoir plus :" and "Consultez :". Treat them as meaning-based options, not fixed translations. Do not use "Apprenez-en plus" or "Apprenez-en davantage" as lead-ins. Avoid wordy constructions such as "Pour plus d’informations, consultez la page". Do not add a lead-in before standalone action links such as "View CRA processing times", "Check CRA processing times", "Get an access code", "Sign up for direct deposit", "Create an account", "Cancel a payment", "Send documents", "Confirm your information", "Review the proposed rates", "Register a business", "Sign in or register for a CRA account", "Learn about the Canada Groceries and Essentials Benefit", "Find out how to get an access code", or "How to get an access code". Use "Learn about" without a colon when the linked text naturally completes the phrase, especially for explainer or topic pages. If the phrase needs an article, place it before the anchor, for example "Learn about the <a>Canada Groceries and Essentials Benefit</a>". Do not put a period or other punctuation after the closing anchor in a standalone link sentence or paragraph.',
    },
  },
};
