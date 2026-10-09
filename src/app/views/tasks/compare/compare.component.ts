import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';
import { TabsModule } from 'primeng/tabs';

import { CompareRenderedComponent } from '../../../components/compare/compare-rendered/compare-rendered.component';
import { CompareSelectComponent } from '../../../components/compare/compare-select/compare-select.component';
import { CompareSourceComponent } from '../../../components/compare/compare-source/compare-source.component';
import { CompareToolsComponent } from '../../../components/compare/compare-tools/compare-tools.component';
import { EditNodeComponent } from '../../../components/edit-node/edit-node.component';

import { htmlProcessingResult } from '../../../services/html-normalization.service';
import { ProjectCacheService } from '../../../services/project-cache.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { CompareService } from './compare.service';

@Component({
  selector: 'aida-compare-versions',
  imports: [FormsModule, TranslatePipe, TabsModule, CompareRenderedComponent, CompareSelectComponent, CompareSourceComponent, CompareToolsComponent, EditNodeComponent],
  templateUrl: './compare.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareComponent {
  private projectState = inject(ProjectStateService);
  private readonly projectCache = inject(ProjectCacheService);
  public compareService = inject(CompareService);

  public readonly mode = input.required<'compare' | 'ai'>();
  protected readonly showAiTools = computed(() => this.mode() === 'ai');
  protected readonly showAfterVersion = computed(() => this.mode() === 'compare');

  protected readonly projectName = this.projectState.getProject().projectName;

  protected readonly selectedNode = signal<TreeNode | undefined>(undefined);
  protected editNode = false; // Tracks if currently making dialog edits

  constructor() {
    effect(() => {
      this.editNode = false;
      const tree = this.projectState.getProjectTree();
      const page = this.compareService.selectedPage();
      const node = this.projectState.findNodeByPath(tree, page, this.projectState.detectPrimaryLanguage());
      if (node) {
        this.selectedNode.set(node);
        this.editNode = true;
      }
    });
  }
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

  protected get aiJobPending(): boolean {
    return this.projectCache.getAiJobStatus(this.compareService.selectedPage()) === 'pending';
  }
}
