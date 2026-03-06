import { RoleKey, OutputKey, RubricKey } from './prompt.model'

export const RoleFragment: Record<RoleKey, string> = {
    [RoleKey.SeoExpert]: "You are a search engine optimization expert.",
    [RoleKey.ContentDesigner]: "You are an expert web content designer with 10 years of experience in the Canadian public service.",
    [RoleKey.AccessibilityExpert]: "You are a web accessibility expert.",
    [RoleKey.Translator]: "You are an expert government translator for Canadian English and French.",
    [RoleKey.None]: ""
}

export const OutputFragment: Record<OutputKey, string> = {
    [OutputKey.Text]: "Provide ONLY the requested output as plain text with absolutely NO additional commentary, explanations, markdown formatting, or preamble.",
    [OutputKey.Html]: "Return ONLY valid HTML with no markdown code blocks (```html). Preserve the original code structure where possible, only modifying the specific elements needed to meet the task requirements.",
    [OutputKey.Json]: "You must return ONLY valid JSON. No markdown (```json), no explanations, no preamble. The response must be directly parseable by JSON.parse()."
}

export const RubricFragment: Record<RubricKey, string> = {
    [RubricKey.NoCommentary]: "Response contains no preamble or explanatory text beyond what was requested.",
    [RubricKey.PreserveHtmlStructure]: "Original HTML structure, attributes, and formatting are maintained where possible.",
    [RubricKey.CharacterLimit]: "Response must be under the specified character limit."
}