import { OutputKey, PagePromptConfigs, PagePromptKey, RoleKey, RubricKey } from './prompt.model';

import { AlertRewritePipeline } from './alert-rewrite.prompt';

export const PagePrompts: PagePromptConfigs = {
  [PagePromptKey.AlertRewrite]: {
    role: RoleKey.AlertRewrite,
    // Placeholder for the future PromptConfig migration. The working alert rewrite
    // prompt is currently assembled from pipeline fragments and runtime context in
    // AlertRewriteService.buildAlertRewriteMessages(). Do not add this task text to
    // the system prompt as-is; replace it with the working payload-generation
    // structure when the alert rewrite prompt is consolidated into PromptConfig.
    task: 'Rewrite the supplied alerts, using identified issues where available, preserving valid content and returning safe alert replacements.',
    rubric: [RubricKey.NoCommentary],
    output: OutputKey.Json,
    available: true,
    pipeline: {
      styleRulesBase: [
        'Keep edits proportionate. Resolve selected issues and use selected examples only as style guidance.',
        'Preserve the original alert type, such as info, warning, danger, or success, unless a selected issue explicitly identifies the alert type as incorrect.',
        'For alert body text, aim for 1 or 2 sentences. Treat this as flexible guidance, not a hard limit.',
        'Do not use semicolons to combine ideas just to reduce the sentence count.',
        'If the alert includes a standalone link lead-in, include at least one substantive sentence that explains the alert. Do not return body text consisting only of a link-introduction sentence such as "Learn about:" or "Refer to:".',
        'Add or preserve a short, descriptive heading.',
        'Match the semantic alert heading level to its structural parent section. Directly after an H1, use <h2>. Inside an H2 section, use <h3>; continue one semantic level deeper for nested sections. Ignore headings inside adjacent alerts, utility headings such as Note or Notes, and headings contained in a preceding closed panel when the alert is outside that panel. A heading in a sibling component does not make the alert its subsection. Preserve existing classes when the semantic heading level remains unchanged. When correcting the semantic heading level, you may remove the existing styling class, but do not add or remove styling classes for their own sake.',
        'Do not rewrite alert content into accordions, disclosure widgets, expand-collapse components, or other containers that hide content from visual display. Inline assistive text that uses the wb-inv class is allowed: preserve it when it is needed, keep it in its original reading order, and make sure it flows with the surrounding visible text. Do not treat wb-inv text as prohibited hidden content.',
        'Do not add new images or icons. Preserve meaningful non-text content and useful existing text alternatives. When a selected issue identifies a missing or incorrect text alternative for retained non-text content, add or correct it using only information supported by the source content. Keep decorative non-text content hidden from assistive technology with an empty text alternative where appropriate.',
        'State what happened. Include a clear next step when the source supports one.',
        'Ensure each applicable selected issue that can be fixed within the alert results in a meaningful change. Do not claim an issue is fixed when the alert is unchanged, or alter valid content merely to show a change. Issues outside the alert, including placement, do not by themselves require a content change.',
        'Do not add new links.',
        'Set rewrittenAlertHtml to full .alert wrapper HTML (for example: <div class="alert alert-info">...</div>).',
      ],
      // Keep example guidance intentionally reinforced in both the base rules and
      // the system prompt. Keep the two source-wording instructions below separate:
      // egHtml should anchor structure, while the input alert should anchor wording.
      // A-B-A testing showed that consolidating them caused generic example actions
      // to leak into rewrites and made other internal guidance more likely to surface.
      systemPromptWithExamplesLines: [
        'Use examples as pattern guidance only.',
        "When examples include egHtml, use that field as the example's final HTML pattern.",
        "Keep wording specific to the input alert's own facts and wording.",
        'Do not introduce wording from an example unless it is supported by the input alert. Valid wording already present in the input alert may be preserved.',
        'Only include exampleIdsUsed values that match the provided example ids.',
      ],
      systemPromptWithoutExamplesLines: ['No examples are provided for this request.', 'Return exampleIdsUsed as an empty array: [].'],
      outputSchemas: {
        withExamples: '{"rewrittenAlertHtml":"string","rewrittenHeading":"string","exampleIdsUsed":["ex-XXX"]}',
        withoutExamples: '{"rewrittenAlertHtml":"string","rewrittenHeading":"string","exampleIdsUsed":[]}',
      },
      conditionalInstructions: {
        preserveFinalStandaloneLink:
          'The original alert already ends with an acceptable standalone final link sentence or paragraph. Preserve that wording and placement unless a selected issue clearly requires a change. Do not rewrite a valid existing lead-in such as "For details:" to "Refer to:" when it already reads naturally.',
        enforceLinkManifest:
          'Use linkManifest as the source of truth for original links. If linkManifest.mustPreserveAll is true, rewrittenAlertHtml must include a real <a> element for every linkManifest.items[].href value. If linkManifest.mustPreserveAtLeastOne is true, rewrittenAlertHtml must include at least one real <a> element whose href exactly matches one of linkManifest.items[].href values. If linkManifest.allowRemoval is true, you may remove extra links, but you must still keep at least one original link.',
      },
      retryInstructions: {
        invalidWrapperHtml: 'Return valid rewrittenAlertHtml as a full .alert wrapper element.',
        noLinksAllowed: 'The original alert has no links. Do not add hyperlinks. Return rewrittenAlertHtml without any <a> tags.',
        mustKeepLink:
          'An earlier rewrite attempt removed every original link. In this rewrite, retain the appropriate original link or links using the link-selection rule. Use only original href values and do not introduce new links.',
        mustKeepAllLinks:
          'An earlier rewrite attempt removed one or more required original links. No too-many-links issue permits their removal, so retain every linkManifest.items[].href value in a real <a> element. Link text and placement may be improved, but each original href must remain unchanged.',
        mustHaveHeading:
          'Alerts must include a semantic heading element in rewrittenAlertHtml. Add a short, descriptive heading using <h2> to <h6> as required by the page hierarchy, and place it before the body text.',
        avoidExampleCopy: 'Your previous output matched example wording. Rewrite using alert-specific wording and facts only.',
        // Reinforce permanent link-formatting rules when a source link needs a retry.
        fullSentenceLinksNeedLeadIn: [
          'If a link stands alone as its own sentence or paragraph, or if a sentence mainly directs the user to a link, place that link direction in its own paragraph.',
          'Prefer putting a standalone link sentence or paragraph last in the alert content, but do not treat placement as a hard requirement.',
          'Use a natural lead-in before the anchor when the standalone link text does not already contain a clear action verb.',
          '"Refer to:" and "For details:" are both valid for supporting detail, reference, status, or explanatory links.',
          'Prefer "Refer to:" for required task, service, form, or procedural reference links.',
          'Prefer "For details:" when the link provides supporting information or more context.',
          'Prefer "Learn more:" for optional background, status, or update links.',
          'The previous response combined redundant lead-ins. Choose exactly one meaning-based link treatment and put the link direction in a separate paragraph. For a wordy "For more information" construction containing "visit", "refer to", or "go to", remove the wordy construction and select the treatment based on the link purpose; no option is the default.',
          'For French content, choose a concise lead-in that fits the purpose; valid options include "En savoir plus :" and "Consultez :".',
          'Treat them as meaning-based options, not fixed translations.',
          'Do not use "Apprenez-en plus" or "Apprenez-en davantage" as lead-ins.',
          'Avoid wordy constructions such as "Pour plus dâ€™informations, consultez la page".',
          'Do not add a lead-in before standalone action links such as "View CRA processing times", "Check CRA processing times", "Get an access code", "Sign up for direct deposit", "Create an account", "Cancel a payment", "Send documents", "Confirm your information", "Review the proposed rates", "Register a business", "Sign in or register for a CRA account", "Find out how to get an access code", or "How to get an access code".',
          'Use "Learn about" without a colon when the linked text naturally completes the phrase, especially for explainer or topic pages.',
          'Keep "Learn about" and any required article outside the anchor; keep only the destination name inside the anchor, for example "Learn about the <a>Canada Groceries and Essentials Benefit</a>".',
          'Do not put a period or other punctuation after the closing anchor in a standalone link sentence or paragraph.',
        ],
      },
    },
  },
  [PagePromptKey.Headings]: {
    role: RoleKey.ContentDesigner,
    task: `Structure content into clear, hierarchical headings at h1, h2, h3 and more rarely h4 and h5 levels to improve scannability of the tasks on the page.
Reorganize content between sections and rewrite where necessary to fit the new semantic structure. Avoid rewriting where possible to keep text like the original.
Guidelines: 
Make sure the H1 accurately reflects the content of the whole page.
Make sure other headings (for example, H2, H3, etc.) accurately describe the content of their section.
If search terms are provided, try to reflect common terms in the H1 for best SEO practices.
When writing a heading or subheading, make sure that it:
· Gives a clear idea of what follows.
· Is short and contains no unnecessary words.
· Contains the most relevant terms at the beginning.
Also ensure that you are meeting the following style requirements:
· Do not include punctuation in headings.
· Headings should not be questions – avoid the use of FAQ patterns.
When thinking of the hierarchy of the headings, apply the following concepts of good information architecture:
· Keep the page structure consistent, logical and straightforward.
· Categorize the content into tasks the user of the page can complete or things they need to learn about.
· Prioritize the content so the most important tasks are easiest to find.
· Consider the logical order in which the user of the page will need information as they are learning how to complete the task, giving them information gradually.
· If there are multiple tasks on the page, consider which tasks the user needs to complete or understand before they begin another task, and order the headings accordingly.
· Do not duplicate sections.
Tone: use an informative tone while addressing the user directly. Phrase headings where possible as tasks the user of the page can complete or learn about in that section.
Return only updated HTML code with no other commentary.`,
    rubric: [RubricKey.NoCommentary, RubricKey.PreserveHtmlStructure],
    output: OutputKey.Html,
  },
  [PagePromptKey.Doormats]: {
    role: RoleKey.ContentDesigner,
    task: `Writing clear and easy-to-differentiate navigation options for pages with links to different services or tasks.
Write navigation links as "doormats", a convention that includes a link and description.
You may be asked to create a single doormat, or to create a set of doormats based on supplied content, or to refine a set of supplied doormat links to meet best practices around style and length restrictions.
Doormat style length and punctuation requirements:
· Link Title: Ideally under 35 characters, maximum 75 characters, no punctuation at the end.
· Short description: Ideally under 100 characters, maximum 120 characters, no punctuation, no period.
Best Practices:
· Link Title: Must be descriptive, unique, and distinguishable from other link titles on the page. Avoid vague terms, duplication, and unnecessary words.
· Short description: The description should describe the linked page concisely, including what to expect when clicking on the link title. It should, however, avoid repeating text from the title. It can be:
  o A list of short phrases indicating tasks that can be completed on the linked page.
  o A list of keywords, separated by commas that would generally correspond to the link titles of doormats of the navigation page it links to, or h2s of a content page.
If one of the 2 above styles is used for a doormat description, it should generally match the other doormats on that navigation page.
In some exceptional cases a doormat can be written as a sentence if it is hard to describe in a set of phrases, but this would only apply to a specific doormat, not all doormats on the page. A sentence doormat should not have a period or other punctuation at the end.
Avoid promotional language, introductory phrases, or redundant content.
Maintain consistent capitalization, formatting, and style (e.g., Topics, Products/Services, Actions, Audience Groups).
Prompt reminders:
· Ask the user for the topic and purpose of the page if more context is needed.
· If useful to the refinement of the navigation links, request additional details such as target audience, key keywords, or specific tone/style (e.g., formal, casual, technical).
Remove Placeholders: Only include doormat(s) that have been fully customized based on user input. Do not include generic or placeholder text.
Provide a Preview: Display the suggested doormat(s) in a clear, easy-to-read list for the user to review and adjust as needed.
Doormat examples:
1. Title: Tax-free savings accounts Description: Tax-free savings accounts, registered savings plans, pooled pension plans, plan administrators.
2. Title: Apply for a clearance certificate Description: Required for final tax returns, legal representatives, estate executors, outstanding balances.
3. Title: Renewable energy grants Description: Government grants, solar panel incentives, wind energy funding, green energy initiatives.
Return only updated HTML code with no other commentary.`,
    rubric: [RubricKey.NoCommentary, RubricKey.PreserveHtmlStructure],
    output: OutputKey.Html,
  },
  [PagePromptKey.PlainLanguage]: {
    role: RoleKey.ContentDesigner,
    task: `Your primary function is to help web publishers rewrite technical content to be easy to understand for the general public.
Your task is to convert text into content which is aimed at improving:
· Comprehension
· Flow
· Logical transitions
Apply the Canada.ca Content Style Guide rules to the content and tailor it for a web page layout.
Avoid the passive voice. Use active voice to inform the user in a direct manner.
Use action verbs, preferably at the beginning of your sentences.
Prioritize the use of positive constructions over negative ones whenever possible.
Write in short sentences that do not run-on.
Use simple, direct phrasing.
Aim to structure the content to have a logical flow like a story would with a beginning, middle, and end, providing a task resolution.
Lists must have a lead-in sentence.
Bullet points should be short and convey one idea.
When rewriting content do not remove important details or instructions.
Reorganize ideas and arrange them in stepped processes, logical hierarchies or for clarity of cause and effect.
Make sure to use the inverted pyramid concept when organizing information.
Examples of using action verbs, preferably at the beginning of your sentences:
· "Report your business income on line x of the form"
· "Refer to the guide for more instructions on claiming a deduction"
Return only updated HTML code with no other commentary.`,
    rubric: [RubricKey.NoCommentary, RubricKey.PreserveHtmlStructure],
    output: OutputKey.Html,
  },
  [PagePromptKey.Tense]: {
    role: RoleKey.HTMLeditor,
    task: `Your only task is to rewrite the tense of all human-readable sentences in the HTML content below to {{TARGET_TENSE}} tense.

# PRESERVE EXACTLY (character-for-character, unchanged):
- All HTML tags, attributes, attribute values, classes, ids, and inline styles
- All whitespace, line breaks, and indentation
- URLs, href/src values, code samples, <script>/<style> contents, HTML entities, numbers, dates, proper nouns
- Direct quotations attributed to a speaker (leave their original tense intact)

# CONTENT RULES:
- Change verb tense only. Do not reword, rephrase, correct grammar, fix typos, summarize, or expand any sentence beyond what the tense change itself requires.
- Do not add, remove, or reorder any content, tags, or attributes.
- If text has no verb or unclear tense (headings, labels, button text, standalone nouns), leave it unchanged.
- Apply tense consistently across the entire document — every text node, including alt text, table cells, and nested elements, not just the first paragraph.`,
    rubric: [RubricKey.NoCommentary, RubricKey.PreserveHtmlStructure],
    output: OutputKey.Html,
    available: true,
  },
};
