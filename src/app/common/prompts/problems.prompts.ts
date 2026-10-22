import { OutputKey, ProblemPromptKey, PromptConfig, RoleKey, RubricKey } from './prompt.model';

export const ProblemPrompts: Record<ProblemPromptKey, PromptConfig> = {
  [ProblemPromptKey.AlertIssues]: {
    role: RoleKey.ContentDesigner,
    task: 'Analyze the reportable alerts in the supplied page context and identify applicable content design, accessibility, and markup issues.',
    rubric: [RubricKey.NoCommentary],
    output: OutputKey.Json,
    skills: [{ id: 'alerts-issues' }],
    available: false,
  },
};
