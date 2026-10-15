// Update all page dropdowns with thier valid versions (speeds up page switching)
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MessageModule } from 'primeng/message';

import { CompareAiOptionsComponent } from '../compare-ai-options/compare-ai-options.component';

import { OpenRouterService } from '../../../services/ai/openrouter.service';
import { FetchService } from '../../../services/fetch.service';
import { CompareService } from '../../../views/tasks/compare/compare.service';
import { CompareAiService } from '../compare-ai.service';

@Component({
  selector: 'aida-compare-tools',
  imports: [CommonModule, TranslatePipe, ButtonModule, DrawerModule, MessageModule, CompareAiOptionsComponent],
  templateUrl: './compare-tools.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareToolsComponent {
  protected readonly messageService = inject(MessageService);
  protected readonly compareService = inject(CompareService);
  protected readonly compareAiService = inject(CompareAiService);
  private readonly fetchService = inject(FetchService);
  protected readonly openrouterService = inject(OpenRouterService);

  protected readonly readabilityBefore = signal(0);
  protected readonly readabilityAfter = signal(0);
  protected readonly readabilityChange = signal(0);

  public readonly jobPending = input<boolean>(false);

  constructor() {
    effect(() => {
      const originalHTML = this.compareService.originalHtml()?.html ?? '';
      const modifiedHTML = this.compareService.modifiedHtml()?.html ?? '';
      //Calculate readability scores
      const originalRead = this.fetchService.getReadability(this.fetchService.stringToDoc(originalHTML));
      const modifiedRead = this.fetchService.getReadability(this.fetchService.stringToDoc(modifiedHTML));
      const before = Math.max(0, Math.min(originalRead.fleschKincaid, originalRead.gunningFog));
      const after = Math.max(0, Math.min(modifiedRead.fleschKincaid, modifiedRead.gunningFog));
      //Set scores
      this.readabilityBefore.set(before);
      this.readabilityAfter.set(after);
      this.readabilityChange.set(after - before);
    });
  }

  protected toggleAiDrawer(): void {
    this.compareService.aiDrawerVisible.update((v) => !v);
  }
}
