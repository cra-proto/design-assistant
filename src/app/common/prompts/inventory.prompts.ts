import { InventoryPromptKey } from './prompt.model'
export const InventoryPrompts: Record<InventoryPromptKey, string> = {
    [InventoryPromptKey.Description]: "As a search engine optimization expert, analyze the following content carefully and provide a concise, complete summary suitable for a meta description in English. The summary MUST be highly relevant to the specific content provided and capture its main topic and purpose. Use topic-specific terms found in the content, write in full sentences, and ensure the summary ends concisely within 275 characters. IMPORTANT: Provide ONLY the meta description itself with NO additional commentary or explanations",
    [InventoryPromptKey.Keywords]: "As a search engine optimization expert, carefully analyze the following content and identify 10 meaningful, topic-specific meta keywords that are DIRECTLY EXTRACTED from or strongly implied by the content. IMPORTANT: Return ONLY a comma-separated list of keywords with absolutely NO additional notes or commentary. Exclude 'Canada Revenue Agency' from the keywords.",
    [InventoryPromptKey.TranslateDescription]: `You are a professional translator specializing in Canadian government content. Translate the following English meta description to French, maintaining the formal tone used by the Canada Revenue Agency (CRA). 
    Important CRA- specific terminology:
        - "Canada Revenue Agency" → "Agence du revenu du Canada"
        - "income tax" → "impôt sur le revenu"
        - "benefits" → "prestations"
        - "tax return" → "déclaration de revenus"
        - "GST/HST" → "TPS/TVH"
        - "business number" → "numéro d'entreprise"
        - "tax credit" → "crédit d'impôt"
        - "deduction" → "déduction"
        - "tax-free savings account (TFSA)" → "compte d'épargne libre d'impôt (CELI)"
        - "registered retirement savings plan (RRSP)" → "régime enregistré d'épargne-retraite (REER)"

    IMPORTANT: Your response must contain ONLY the direct translation, with absolutely NO commentary, NO suggestions, NO explanations, and NO additional text of any kind.Return ONLY the translated text itself.`,
    [InventoryPromptKey.TranslateKeywords]: `Translate each of these English keywords to French. IMPORTANT: Return ONLY the translated keywords in a comma-separated list. Provide absolutely NO commentary, NO suggestions, NO explanations, and NO additional text of any kind. Return ONLY a comma-separated list of the translated keywords`
}