import { inject, Injectable } from '@angular/core';

import { OpenRouterService } from '../../services/ai/openrouter.service';
import { AiPromptService } from '../../services/ai/prompt.service';
import { CompareService } from './compare.service';

import { PagePrompts } from '../../common/prompts/page.prompts';
import { PagePromptKey } from '../../common/prompts/prompt.model';

export type TargetTense = 'past' | 'present' | 'future';
@Injectable({
  providedIn: 'root',
})
export class CompareAiService {
  private readonly compareService = inject(CompareService);
  private readonly promptService = inject(AiPromptService);
  private readonly openRouterService = inject(OpenRouterService);

  public async sendToAI() {
    //Build context
    const modifiedHtml = this.compareService.modifiedHtml;
    const current = modifiedHtml();
    const html = current?.html;
    if (!current || !html) return;

    const promptKey = this.compareService.selectedPrompt();
    const selectedTense = this.compareService.selectedTense();

    const basePrompt = PagePrompts[PagePromptKey[promptKey]];
    const prompt =
      promptKey === 'Tense'
        ? {
            ...basePrompt,
            task: basePrompt.task.replace('{{TARGET_TENSE}}', selectedTense),
          }
        : basePrompt;

    // Call OpenRouter
    let response: string;
    try {
      response = await this.openRouterService.getTextFromAI(prompt, JSON.stringify(html));
    } catch (error) {
      console.warn(`AI call failed`, error);
      return;
    }
    //Merge with project data
    this.compareService.modifiedHtml.set({ ...current, html: response });
  }
}
