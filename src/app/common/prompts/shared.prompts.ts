import { RoleKey, OutputKey, RubricKey } from './prompt.model'

export const RoleFragment: Record<RoleKey, string> = {
    [RoleKey.SeoExpert]: "You are a bilingual search engine optimization expert (Canadian French and English).",
    [RoleKey.ContentDesigner]: "You are an expert web content designer with 10 years of experience in the Canadian public service.",
    [RoleKey.AccessibilityExpert]: "You are a web accessibility expert.",
    [RoleKey.Translator]: "You are an expert government translator for Canadian English and French.",
    [RoleKey.None]: ""
}

export const OutputFragment: Record<OutputKey, string> = {
    [OutputKey.Text]: "Provide ONLY the requested output as plain text with absolutely NO additional commentary, explanations, markdown formatting, or preamble.",
    [OutputKey.Html]: "Return ONLY valid HTML with no markdown code blocks (no ```html). Preserve the original code structure where possible, only modifying the specific elements needed to meet the task requirements.",
    [OutputKey.Json]: "You must return ONLY valid JSON. No markdown (no ```json), no explanations, no preamble. The response must be directly parseable by JSON.parse()."
}

export const RubricFragment: Record<RubricKey, string> = {
    [RubricKey.Description]: "Description: The description must capture the main topic and use terminology found in the content.",
    [RubricKey.DescriptionEN]: "English description: Must be between 130 and 160 characters (including spaces).",
    [RubricKey.DescriptionFR]: "French description: Must be concise but is permitted to be longer than the English version, up to a maximum of 275 characters (including spaces).",
    [RubricKey.Keywords]: "Keywords: Provide 10 highly relevant words or short phrases directly extracted from or strongly implied by the content. Do NOT include \"Canada Revenue Agency\" or \"Agence du revenu du Canada\" in the keyword list.",
    [RubricKey.CraTermTranslations]: `Important CRA-specific translations:
    - "Canada Revenue Agency" → "Agence du revenu du Canada"
    - "income tax" → "impôt sur le revenu"
    - "benefits" → "prestations"
    - "tax return" → "déclaration de revenus"
    - "GST/HST" → "TPS/TVH"
    - "business number" → "numéro d'entreprise"
    - "tax credit" → "crédit d'impôt"
    - "deduction" → "déduction"
    - "tax-free savings account (TFSA)" → "compte d'épargne libre d'impôt (CELI)"
    - "registered retirement savings plan (RRSP)" → "régime enregistré d'épargne-retraite (REER)"`,
    [RubricKey.NoCommentary]: "Response contains no preamble or explanatory text beyond what was requested.",
    [RubricKey.PreserveHtmlStructure]: "Original HTML structure, attributes, and formatting are maintained where possible.",
    [RubricKey.CharacterLimit]: "Response must be under the specified character limit."
}

