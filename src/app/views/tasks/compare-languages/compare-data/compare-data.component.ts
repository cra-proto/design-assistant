import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';

import { DataMismatch } from '../compare-languages.component';

import { ProjectStateService } from '../../../../services/project-state.service';
import { CompareService } from '../../compare-versions/compare-versions.service';

import { SourceVersion, TreeNodeData } from '../../../../common/data.model';

@Component({
  selector: 'aida-compare-data',
  imports: [NgTemplateOutlet, TranslatePipe, ButtonModule, MessageModule, TableModule],
  templateUrl: './compare-data.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareDataComponent {
  protected readonly projectState = inject(ProjectStateService);
  protected readonly compareService = inject(CompareService);

  public readonly selectedNode = input<TreeNode<TreeNodeData> | undefined>(undefined);
  public readonly selectedBase = input<DataMismatch[] | undefined>(undefined);
  public readonly selectedProto = input<DataMismatch[] | undefined>(undefined);
  public readonly selectedLive = input<DataMismatch[] | undefined>(undefined);
  /** Input to track if selected page is 404 */
  public readonly is404 = input<boolean>(false);

  protected readonly noRefresh = computed(() => {
    const version = this.compareService.selectedSource();
    const live = this.is404() && version === 'live';
    const proto = this.is404() && version.startsWith('proto');
    return { live, proto };
  });

  protected async refresh(version: 'prototype' | 'live') {
    const node = this.selectedNode();
    if (!node) return;
    const repoType = this.projectState.getProject().repoType === 'github' ? 'GH' : 'UT';
    const urlVersion: SourceVersion = version === 'live' ? 'live' : version === 'prototype' ? `proto${repoType}` : `base${repoType}`;
    this.projectState.refreshing.update((r) => ({ ...r, [version]: true }));
    await this.projectState.refreshNode(node, urlVersion);
    this.projectState.refreshing.update((r) => ({ ...r, [version]: false }));
  }
}
