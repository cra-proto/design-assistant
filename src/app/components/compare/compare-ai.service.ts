import { inject, Injectable } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { MessageService } from 'primeng/api';

import { OpenRouterService } from '../../services/ai/openrouter.service';
import { ProjectCacheService } from '../../services/project-cache.service';
import { ProjectStateService } from '../../services/project-state.service';
import { CompareService } from '../../views/task/compare-versions/compare.service';

import { PagePrompts } from '../../common/prompts/page.prompts';
import { PagePromptKey } from '../../common/prompts/prompt.model';

export type TargetTense = 'past' | 'present' | 'future';

@Injectable({
  providedIn: 'root',
})
export class CompareAiService {
  private readonly messageService = inject(MessageService);
  private readonly translate = inject(TranslateService);
  private readonly projectState = inject(ProjectStateService);
  private readonly projectCache = inject(ProjectCacheService);
  private readonly compareService = inject(CompareService);
  private readonly openRouterService = inject(OpenRouterService);

  public async sendToAI() {
    //Snapshot of current before & after version
    const initialBefore = this.compareService.originalHtml();
    const initialAfter = this.compareService.modifiedHtml();
    if (!initialBefore || !initialAfter) return;

    //Set AI job cache
    const pagePath = this.compareService.selectedPage();
    this.projectCache.setAiJobStatus(pagePath, 'pending');

    //Build prompt
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
    try {
      const response = await this.openRouterService.getTextFromAI(prompt, JSON.stringify(initialAfter.html)); // note: this can take up to 5 min

      // Cached versions (or snapshot if no cached version available)
      const cached = this.projectCache.getPageEdit(pagePath);
      const latestBefore = cached?.originalHtml ?? initialBefore;
      const latestAfter = cached?.modifiedHtml ?? initialAfter;

      // Set cache with latest before version and AI response merged into after version
      const newAfter = { ...latestAfter, html: response, edited: true };
      this.projectCache.updatePageEdit(pagePath, latestBefore, latestAfter, latestBefore, newAfter);

      // Update the diff if the user is still on the same page
      if (this.compareService.selectedPage() === pagePath) {
        const updated = this.projectCache.getPageEdit(pagePath);
        if (updated) {
          this.compareService.originalHtml.set(updated.originalHtml);
          this.compareService.modifiedHtml.set(updated.modifiedHtml);
        }
      }
      this.projectCache.setAiJobStatus(pagePath, 'done');
      this.messageService.add({
        severity: 'success',
        summary: this.translate.instant('aiJob.done.summary'),
        detail: this.translate.instant('aiJob.done.detail', { page: this.getPageLabel(pagePath) }),
        life: 5000,
      });
    } catch (error) {
      console.warn(`AI call failed`, error);
      this.projectCache.setAiJobStatus(pagePath, 'error');
      this.messageService.add({
        severity: 'error',
        summary: this.translate.instant('aiJob.error.summary'),
        detail: this.translate.instant('aiJob.error.detail', { page: this.getPageLabel(pagePath) }),
        sticky: true,
      });
      return;
    }
  }

  private getPageLabel(path: string): string {
    const lang = this.projectState.detectPrimaryLanguage();
    const tree = this.projectState.getProjectTree();
    const node = this.projectState.findNodeByPath(tree, path, lang);
    return node?.data?.prototype?.[lang]?.h1 || path;
  }
}
