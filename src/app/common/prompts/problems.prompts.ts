import { ProblemPromptKey, PromptConfig, RoleKey, OutputKey, RubricKey } from './prompt.model'
export const ProblemPrompts: Record<ProblemPromptKey, PromptConfig> = {
    [ProblemPromptKey.Alerts]: {
        role: RoleKey.ContentDesigner,
        task: "This is where the alert prompt will go",
        rubric: [RubricKey.NoCommentary],
        output: OutputKey.Json,
    }
}