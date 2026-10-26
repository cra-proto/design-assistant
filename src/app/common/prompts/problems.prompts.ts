import { OutputKey, ProblemPromptKey, PromptConfig, ReferenceKey, RoleKey, RubricKey } from './prompt.model';

export const ProblemPrompts: Record<ProblemPromptKey, PromptConfig> = {
  [ProblemPromptKey.AlertsProblems]: {
    role: RoleKey.ContentDesigner,
    task: 'Analyze the reportable alerts in the supplied page context and identify applicable content design, accessibility, and markup issues.',
    rubric: [RubricKey.NoCommentary],
    output: OutputKey.Json,
    skill: `alerts-issues
# Canada.ca Alerts Issues

Use this skill only for issue analysis. Do not rewrite alert HTML.

## Workflow
1. Analyze every alert in the input array.
2. Identify every applicable alert issue and content accessibility issue.
3. Return JSON only.

## Resources
- Read \`references/issue-analysis-instructions.json\` for issue taxonomy, analysis procedure, structured context rules, and output rules.
- Match \`assets/issues-output-schema.json\` exactly.
- If structured fields such as \`pageSignals\`, \`alertPlacementContext\`, or \`alertSignals\` are present, use them as primary evidence for context-sensitive issues.

## Output Boundary
- Return issue reports only.
- Do not return rewritten HTML, replacement payloads, or prose commentary.`,
    skillReferences: [ReferenceKey.IssueAnalysisInstructions],
    skillJsonSchema: `issues-output-schema.json
  {
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
          "severity": { "type": "string", "enum": ["High", "Medium", "Low"] },
          "include": { "type": "boolean" }
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
};
