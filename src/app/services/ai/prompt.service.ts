import { Injectable } from '@angular/core';

import { PromptConfig, RubricKey } from '../../common/prompts/prompt.model';
import { OutputFragment, RoleFragment, RubricFragment } from '../../common/prompts/shared.prompts';

@Injectable({ providedIn: 'root' })
export class AiPromptService {
  composePrompt(config: PromptConfig): string {
    const parts = [
      config.role ? `### Role\n${RoleFragment[config.role]}` : null,
      config.task ? `### Task\n${config.task}` : null,
      this.formatRubric(config.rubric),
      config.output ? `### Output requirements\n${OutputFragment[config.output]}` : null,
      config.jsonSchema ? `### JSON schema\n${config.jsonSchema}` : null,
    ].filter((p) => p);
    return parts.join('\n\n');
  }

  private formatRubric(rubricKeys: RubricKey[]): string | null {
    if (!rubricKeys?.length) return null;
    const criteria = rubricKeys.flatMap((key) => RubricFragment[key]);
    return `### Quality criteria\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
  }
}
