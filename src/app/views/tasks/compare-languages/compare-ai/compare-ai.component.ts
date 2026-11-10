import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';

import { OpenRouterService } from '../../../../services/ai/openrouter.service';
import { CompareService } from '../../compare-versions/compare-versions.service';
import { LanguageDifference, ReviewLanguagesService } from '../compare-languages.service';

import { AI_PAID_MODELS } from '../../../../common/ai-models.config';
import { InventoryPrompts } from '../../../../common/prompts/inventory.prompts';
import { InventoryPromptKey } from '../../../../common/prompts/prompt.model';

@Component({
  selector: 'aida-compare-ai-lang',
  imports: [TranslatePipe, ButtonModule, MessageModule, TableModule],
  templateUrl: './compare-ai.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareAiLangComponent {
  protected readonly reviewLanguagesService = inject(ReviewLanguagesService);
  protected readonly compareService = inject(CompareService);
  protected readonly openRouterService = inject(OpenRouterService);

  public readonly aiEnglish = input<string>('');
  public readonly aiFrench = input<string>('');
  /** Input to track if selected page is 404 */
  public readonly is404 = input<boolean>(false);

  //AI difference summary
  protected async getSummary() {
    const path = this.compareService.selectedPage();
    this.reviewLanguagesService.setAiJobStatus(path, 'pending');
    try {
      const content = `### English HTML\n${this.aiEnglish()}\n### French HTML\n${this.aiFrench()}`;
      console.log('AI request start', path);
      const response = await this.openRouterService.getTextFromAI(InventoryPrompts[InventoryPromptKey.Languages], content, AI_PAID_MODELS[0].value);
      console.log('AI response received', response);
      this.reviewLanguagesService.setAiResponse(path, this.parseDifferences(response));
      this.reviewLanguagesService.setAiJobStatus(path, 'done');
    } catch (error) {
      console.error('AI summary failed', error);
      this.reviewLanguagesService.setAiJobStatus(path, 'error');
    }
  }

  private parseDifferences(response: string): LanguageDifference[] {
    try {
      const cleaned = response.replace(/```json|```/g, '').trim();
      const parsed: unknown = JSON.parse(cleaned);

      if (!this.isRecord(parsed) || !Array.isArray(parsed['differences'])) return [];

      return parsed['differences'].filter(this.isRecord).flatMap((d) =>
        typeof d['issue'] === 'string'
          ? [
              {
                english: typeof d['english'] === 'string' ? d['english'] : '',
                french: typeof d['french'] === 'string' ? d['french'] : '',
                issue: d['issue'],
              },
            ]
          : [],
      );
    } catch (error) {
      console.error('Could not parse AI response', error);
      return [];
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
