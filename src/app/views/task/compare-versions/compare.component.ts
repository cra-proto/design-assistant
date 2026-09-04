import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TabsModule } from 'primeng/tabs';

import { CompareRenderedComponent } from '../../../components/compare/compare-rendered/compare-rendered.component';
import { CompareSelectComponent } from '../../../components/compare/compare-select/compare-select.component';
import { CompareSourceComponent } from '../../../components/compare/compare-source/compare-source.component';
import { CompareToolsComponent } from '../../../components/compare/compare-tools/compare-tools.component';

import { CompareService } from '../../../components/compare/compare.service';
import { FetchService } from '../../../services/fetch.service';
import { HtmlNormalizationService, htmlProcessingResult } from '../../../services/html-normalization.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { UserSettingsService } from '../../../services/user-settings.service';

@Component({
  selector: 'aida-compare-versions',
  imports: [FormsModule, TranslatePipe, TabsModule, CompareRenderedComponent, CompareSelectComponent, CompareSourceComponent, CompareToolsComponent],
  templateUrl: './compare.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareComponent {
  private translate = inject(TranslateService);
  private projectState = inject(ProjectStateService);
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
    // Push old content to undo stack
    const originalHtml = this.compareService.originalHtml() ?? this.compareService.modifiedHtml();
    const modifiedHtml = this.compareService.modifiedHtml() ?? this.compareService.originalHtml();
    if (originalHtml && modifiedHtml)
      this.compareService.undoStack.push({
        beforeContent: originalHtml,
        afterContent: modifiedHtml,
      });

    // Update signals with new content
    this.compareService.originalHtml.set(event.beforeContent);
    this.compareService.modifiedHtml.set(event.afterContent);

    // TODO: Update cache so user doesn't lose progress when navigating to other pages in project
    // this.compareService.setDiffCache(pageId, event.beforeContent, event.afterContent);
  }

  onHasChanges(event: boolean): void {
    this.compareService.hasChanges.set(event);
    console.log(event);
  }

  onUndo(): void {
    const snapshot = this.compareService.undoStack.pop();
    if (!snapshot) return;
    this.compareService.originalHtml.set(snapshot.beforeContent);
    this.compareService.modifiedHtml.set(snapshot.afterContent);
  }
}
