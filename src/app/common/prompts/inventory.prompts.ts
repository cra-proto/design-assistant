import { InventoryPromptKey, OutputKey, PromptConfig, RoleKey, RubricKey } from './prompt.model';

export const InventoryPrompts: Record<InventoryPromptKey, PromptConfig> = {
  [InventoryPromptKey.Metadata]: {
    role: RoleKey.SeoExpert,
    task: 'Generate a new SEO meta description and a list of target keywords for a webpage in both English and French. The French and English versions should be closely aligned in meaning but localized appropriately, not just translated word-for-word.',
    rubric: [RubricKey.Description, RubricKey.DescriptionEN, RubricKey.DescriptionFR, RubricKey.Keywords, RubricKey.CraTermTranslations],
    output: OutputKey.Json,
    jsonSchema: `{
"en": {
"description": "string (120-160 chars)",
"keywords": ["string", "string", "string", "string", "string", "string", "string", "string", "string", "string"]
},
"fr": {
"description": "string (120-200 chars)",
"keywords": ["string", "string", "string", "string", "string", "string", "string", "string", "string", "string"]
}
}`,
  },
  [InventoryPromptKey.Description]: {
    role: RoleKey.SeoExpert,
    task: 'Generate a concise meta description in English for the following web page content. The description must capture the main topic and use terminology found in the content.',
    rubric: [RubricKey.CharacterLimit, RubricKey.NoCommentary],
    output: OutputKey.Json,
    jsonSchema: `{
  "title": "string (max 60 chars)",
  "description": "string (max 275 chars)",
  "keywords": ["string", "string", ...]
}`,
  },
  [InventoryPromptKey.Keywords]: {
    role: RoleKey.SeoExpert,
    task: 'Generate 10 meaningful, topic-specific meta keywords that are DIRECTLY EXTRACTED from or strongly implied by the content. Return only a comma separated list of keywords.',
    rubric: [RubricKey.CharacterLimit, RubricKey.NoCommentary],
    output: OutputKey.Text,
  },
  [InventoryPromptKey.Languages]: {
    role: RoleKey.Translator,
    task: `Compare the English and French content and return an array of any semantic differences. If no differences are found, return { "differences": [] }. 
    For every difference you report, quote the exact English text and the exact French text it refers to, and say what the problem is. 
    Acronyms and abbreviations are expected to differ between English and French and don't need to be reported if correct for the language (for example GST/HST and TPS/TVH, or CCR and RCC).`,
    rubric: [RubricKey.CraTermTranslations, RubricKey.NoCommentary],
    output: OutputKey.Json,
    jsonSchema: `{
  "differences": [
    {
      "english": "exact English text, or an empty string if the English page has nothing for this",
      "french": "exact French text, or an empty string if the French page has nothing for this",
      "issue": "short description of the problem"
    }
  ]
}`,
  },
};

/*
export const InventoryPrompts: Record<InventoryPromptKey, string> = {
    [InventoryPromptKey.Description]: "As a search engine optimization expert, analyze the following content carefully and provide a concise, complete summary suitable for a meta description in English. The summary MUST be highly relevant to the specific content provided and capture its main topic and purpose. Use topic-specific terms found in the content, write in full sentences, and ensure the summary ends concisely within 275 characters. IMPORTANT: Provide ONLY the meta description itself with NO additional commentary or explanations",
    [InventoryPromptKey.Keywords]: "As a search engine optimization expert, carefully analyze the following content and identify 10 meaningful, topic-specific meta keywords that are DIRECTLY EXTRACTED from or strongly implied by the content. IMPORTANT: Return ONLY a comma-separated list of keywords with absolutely NO additional notes or commentary. Exclude 'Canada Revenue Agency' from the keywords.",
    [InventoryPromptKey.TranslateDescription]: `You are a professional translator specializing in Canadian government content. Translate the following English meta description to French, maintaining the formal tone used by the Canada Revenue Agency (CRA). 
    Important CRA-specific terminology:
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
}*/
