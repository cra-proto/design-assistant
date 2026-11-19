import { OutputKey, PromptConfig, RoleKey, RubricKey, ToolsPromptKey } from './prompt.model';

export const ToolsPrompts: Record<ToolsPromptKey, PromptConfig> = {
  [ToolsPromptKey.Metadata]: {
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
    available: true,
  },
  [ToolsPromptKey.Description]: {
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
  [ToolsPromptKey.Keywords]: {
    role: RoleKey.SeoExpert,
    task: 'Generate 10 meaningful, topic-specific meta keywords that are DIRECTLY EXTRACTED from or strongly implied by the content. Return only a comma separated list of keywords.',
    rubric: [RubricKey.CharacterLimit, RubricKey.NoCommentary],
    output: OutputKey.Text,
  },
  [ToolsPromptKey.Languages]: {
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
    available: true,
  },
};
