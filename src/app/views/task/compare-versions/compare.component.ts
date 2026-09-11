import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TabsModule } from 'primeng/tabs';

import { CompareRenderedComponent } from '../../../components/compare/compare-rendered/compare-rendered.component';
import { CompareSelectComponent } from '../../../components/compare/compare-select/compare-select.component';
import { CompareSourceComponent } from '../../../components/compare/compare-source/compare-source.component';
import { CompareToolsComponent } from '../../../components/compare/compare-tools/compare-tools.component';

import { FetchService } from '../../../services/fetch.service';
import { HtmlNormalizationService, htmlProcessingResult } from '../../../services/html-normalization.service';
import { ProjectCacheService } from '../../../services/project-cache.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { UserSettingsService } from '../../../services/user-settings.service';
import { CompareService } from './compare.service';

@Component({
  selector: 'aida-compare-versions',
  imports: [FormsModule, TranslatePipe, TabsModule, CompareRenderedComponent, CompareSelectComponent, CompareSourceComponent, CompareToolsComponent],
  templateUrl: './compare.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareComponent {
  private translate = inject(TranslateService);
  private projectState = inject(ProjectStateService);
  private readonly projectCache = inject(ProjectCacheService);
  public compareService = inject(CompareService);
  private fetchService = inject(FetchService);
  private htmlNormalizationService = inject(HtmlNormalizationService);
  private settingsService = inject(UserSettingsService);

  markForTranslation() {
    marker('compare.view.linebyline');
    marker('compare.view.sidebyside');
  }

  // Handle accept/reject changes
  onContentChanged(event: { beforeContent: htmlProcessingResult; afterContent: htmlProcessingResult }): void {
    // Push old content to undo stack mapped to this path
    const path = this.compareService.selectedPage();
    const previousBefore = this.compareService.originalHtml();
    const previousAfter = this.compareService.modifiedHtml();
    if (previousBefore && previousAfter) {
      this.projectCache.updatePageEdit(path, previousBefore, previousAfter, event.beforeContent, event.afterContent);
    }
    // Update signals with new content
    this.compareService.originalHtml.set(event.beforeContent);
    this.compareService.modifiedHtml.set(event.afterContent);
  }

  onHasChanges(event: boolean): void {
    this.compareService.hasChanges.set(event);
  }

  onUndo(): void {
    const restored = this.projectCache.undoPageEdit(this.compareService.selectedPage());
    if (!restored) return;
    this.compareService.originalHtml.set(restored.originalHtml);
    this.compareService.modifiedHtml.set(restored.modifiedHtml);
  }

  protected get canUndo(): boolean {
    return this.projectCache.getPageUndoStack(this.compareService.selectedPage())?.canUndo() ?? false;
  }

  /** TODO: feed this into rendered & source components to lock after edits during pending AI jobs */
  protected get aiJobPending(): boolean {
    return this.projectCache.getAiJobStatus(this.compareService.selectedPage()) === 'pending';
  }
}
