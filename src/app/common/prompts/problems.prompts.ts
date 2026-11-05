import { OutputKey, ProblemPromptKey, PromptConfig, RoleKey, RubricKey } from './prompt.model';
import { AlertIssuesInstructions } from './reference.prompt';

export const ProblemPrompts: Record<ProblemPromptKey, PromptConfig> = {
  [ProblemPromptKey.AlertsProblems]: {
    role: RoleKey.ContentDesigner,
    task: `Analyze the reportable alerts in the supplied page context and identify applicable content design, accessibility, and markup issues.
Return issue reports only. Do not rewrite alert HTML.

### Analysis instructions
${AlertIssuesInstructions}`,
    rubric: [],
    output: OutputKey.Json,
    jsonSchema: `{
  "type": "object",
  "required": ["issues"],
  "properties": {
    "issues": {
      "type": "array",
      "items": {
        "type": "object",
        "required": [
          "alert_index",
          "issue_category",
          "description",
          "recommendation",
          "severity"
        ],
        "properties": {
          "alert_index": { "type": "integer", "minimum": 1 },
          "issue_category": { "type": "string" },
          "description": { "type": "string" },
          "recommendation": { "type": "string" },
          "severity": { "type": "string", "enum": ["High", "Medium", "Low"] }
        }
      }
    }
  }
}`,
    available: false,
  },
  [ProblemPromptKey.AlertsRewrite]: {
    role: RoleKey.ContentDesigner,
    task: 'Analyze the reportable alerts in the supplied page context and identify applicable content design, accessibility, and markup issues.',
    rubric: [RubricKey.NoCommentary],
    output: OutputKey.Json,
    available: false,
  },
  [ProblemPromptKey.TranslateIssueDetails]: {
    role: RoleKey.Translator,
    task: `Translate only the description and recommendation values in the supplied JSON from English into Canadian French.
Return only valid JSON with this exact shape: {"items":[{"translation_id":"1","description":"...","recommendation":"..."}]}.
Preserve every translation_id exactly. Do not add, remove, combine, split, or reorder items.
Preserve HTML tags and attributes, URLs, code, placeholders, CSS classes, ARIA attributes, and quoted source text exactly.`,
    rubric: [],
    output: OutputKey.Json,
    jsonSchema: `{
  "type": "object",
  "required": ["items"],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["translation_id", "description", "recommendation"],
        "properties": {
          "translation_id": { "type": "string" },
          "description": { "type": "string" },
          "recommendation": { "type": "string" }
        }
      }
    }
  }
}`,
  },
};
