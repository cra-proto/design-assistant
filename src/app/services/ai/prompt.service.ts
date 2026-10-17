import { inject, Injectable } from '@angular/core';

import { SkillService } from './skill.service';

import { OutputKey, PromptConfig, RubricKey } from '../../common/prompts/prompt.model';
import { OutputFragment, RoleFragment, RubricFragment } from '../../common/prompts/shared.prompts';
import { ResolvedSkillResource } from '../../common/skills/skill.model';

export interface ComposedPrompt {
  prompt: string;
  loadedSkills: string[];
  loadedResources: string[];
  estimatedTokens: number;
  warnings: string[];
}

@Injectable({ providedIn: 'root' })
export class AiPromptService {
  private readonly skillService = inject(SkillService);

  async composePrompt(config: PromptConfig): Promise<string> {
    return (await this.composePromptDetails(config)).prompt;
  }

  async composePromptDetails(config: PromptConfig): Promise<ComposedPrompt> {
    const resolvedSkills = await this.skillService.resolveBindings(config.skills ?? [], config.output);
    const instructionResources = resolvedSkills.resources.filter((resource) => resource.kind !== 'asset');
    const assetResources = resolvedSkills.resources.filter((resource) => resource.kind === 'asset');

    if (config.jsonSchema && assetResources.length) {
      throw new Error('Prompt configuration cannot define jsonSchema when an attached skill supplies an output asset.');
    }

    const parts = [
      config.role ? `### Role\n${RoleFragment[config.role]}` : null,
      config.task ? `### Task\n${config.task}` : null,
      this.formatRubric(config.rubric),
      ...instructionResources.map((resource) => this.formatSkillResource(resource)),
      config.output ? `### Output requirements\n${OutputFragment[config.output]}` : null,
    ].filter((p) => p);

    if (config.output === OutputKey.Json && config.jsonSchema) {
      parts.push(`### JSON schema\n${config.jsonSchema}`);
    }
    parts.push(...assetResources.map((resource) => this.formatSkillResource(resource)));

    const prompt = parts.join('\n\n');
    return {
      prompt,
      loadedSkills: resolvedSkills.skills.map((skill) => skill.id),
      loadedResources: resolvedSkills.resources.map((resource) => resource.path),
      estimatedTokens: Math.ceil(prompt.length / 4),
      warnings: resolvedSkills.warnings,
    };
  }

  private formatRubric(rubricKeys: RubricKey[]): string {
    if (!rubricKeys?.length) return '';
    const criteria = rubricKeys.map((key) => RubricFragment[key]);
    return `### Quality criteria\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
  }

  private formatSkillResource(resource: ResolvedSkillResource): string {
    const relationship = resource.included ? 'Included' : 'Activated';
    if (resource.kind === 'instructions') {
      return `### ${relationship} skill: ${resource.skillName}\n${resource.content}`;
    }
    const label = resource.kind === 'asset' ? 'Skill asset' : resource.kind === 'optionalReference' ? 'Optional skill reference' : 'Skill reference';
    const fileName = resource.path.split('/').pop() || resource.path;
    return `### ${label}: ${fileName}\n${resource.content}`;
  }
}
