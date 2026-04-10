import { Component, inject, computed, signal } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

// PrimeNG modules
import { OrganizationChartModule } from 'primeng/organizationchart';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TreeNode } from 'primeng/api';

// Services
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from './ia-diagram.service';
import { TreeNodeStyleService } from '../../services/treenode-style.service';

@Component({
  selector: 'aida-ia-diagram',
  imports: [TranslateModule, FormsModule,
    OrganizationChartModule, ButtonModule, TooltipModule, SelectButtonModule
  ],
  templateUrl: './ia-diagram.component.html',
  styleUrl: './ia-diagram.component.css'
})
export class IaDiagramComponent {
  private projectState = inject(ProjectStateService)
  private translate = inject(TranslateService)
  public iaDiagram = inject(IaDiagramService);
  private treeNodeStyleService = inject(TreeNodeStyleService)

  projectTree = computed(() => {
    const tree = this.projectState.getProject().projectData;
    if (this.selectedView() === 'baseline') {
      return this.projectState.getBaselineTree(tree);
    } else return tree;
  });

  //View options
  selectedView = signal<'baseline' | 'changes' | 'final'>('changes');

  get viewOptions() {
    return [
      { label: this.translate.instant('iaDiagram.view.baseline'), value: 'baseline' },
      { label: this.translate.instant('iaDiagram.view.changes'), value: 'changes' },
      { label: this.translate.instant('iaDiagram.view.final'), value: 'final' }
    ];
  }

  changeView() {
    const applyStatusColors = this.selectedView() === 'changes';
    this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0, applyStatusColors);
  }
}