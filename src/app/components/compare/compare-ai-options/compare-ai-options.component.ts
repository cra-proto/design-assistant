import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AccordionModule } from 'primeng/accordion';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FieldsetModule } from 'primeng/fieldset';
import { RadioButtonModule } from 'primeng/radiobutton';
import { TooltipModule } from 'primeng/tooltip';

import { CompareAiService } from '../compare-ai.service';
import { AiTaskOption, CompareService } from '../compare.service';

import { AI_FREE_MODELS, AI_PAID_MODELS } from '../../../common/ai-models.config';
import { PagePromptKey } from '../../../common/prompts/prompt.model';

/**
 * Reviewed: 2026-08-19 (ng21)
 *
 * AI options for switching between prompts and models
 */
@Component({
  selector: 'aida-compare-ai-options',
  imports: [CommonModule, FormsModule, TranslatePipe, AccordionModule, ButtonModule, DialogModule, FieldsetModule, RadioButtonModule, TooltipModule],
  templateUrl: './compare-ai-options.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareAiOptionsComponent {
  protected readonly compareService = inject(CompareService);
  protected readonly compareAiService = inject(CompareAiService);
  private readonly translate = inject(TranslateService);

  protected readonly admin = localStorage.getItem('myOrg')?.toUpperCase() === 'ADMIN' ? true : false;

  /** AI model radio buttons */
  protected readonly freeModels = AI_FREE_MODELS;
  protected readonly paidModels = AI_PAID_MODELS;

  /** Task radio buttons */
  get tasks(): MenuItem[] {
    return [
      { label: this.translate.instant('compare.aiOptions.comparison.option.default'), value: 'default' as AiTaskOption },
      { label: this.translate.instant('compare.aiOptions.comparison.option.prompts'), value: 'prompts' as AiTaskOption },
      { label: this.translate.instant('compare.aiOptions.comparison.option.models'), value: 'models' as AiTaskOption },
    ];
  }

  showTaskHelp = false;

  /** Prompt radio buttons */
  get prompts(): MenuItem[] {
    return Object.keys(PagePromptKey).map((enumKey) => ({
      label: this.translate.instant(PagePromptKey[enumKey as keyof typeof PagePromptKey]),
      value: enumKey,
    }));
  }

  protected toggleAiDrawer(): void {
    this.compareService.aiDrawerVisible.update((v) => !v);
  }

  markForTranslation() {
    marker('compare.aiOptions.comparison.help');
  }
}
