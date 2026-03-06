import { Injectable } from '@angular/core';
import { PromptConfig, RoleKey, OutputKey, RubricKey } from '../../common/prompts/prompt.model';
import { RoleFragment, OutputFragment, RubricFragment } from '../../common/prompts/shared.prompts';

@Injectable({ providedIn: 'root' })
export class AiPromptService {

    composePrompt(config: PromptConfig): string {
        const parts = [
            RoleFragment[config.role],
            config.task,
            this.formatRubric(config.rubric),
            OutputFragment[config.output],
        ].filter(p => p);

        if (config.output === OutputKey.Json && config.jsonSchema) {
            parts.push(`\nRequired JSON schema:\n${config.jsonSchema}`);
        }

        return parts.join('\n\n');
    }

    private formatRubric(rubricKeys: RubricKey[]): string {
        if (!rubricKeys?.length) return '';
        const criteria = rubricKeys.map(key => RubricFragment[key]);
        return `Quality criteria:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
    }
}