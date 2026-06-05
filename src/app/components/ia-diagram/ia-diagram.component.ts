import { Component, inject, computed, signal, ViewChild } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

// PrimeNG modules
import { OrganizationChartModule, OrganizationChartNodeExpandEvent, OrganizationChartNodeCollapseEvent } from 'primeng/organizationchart';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MenuModule, Menu } from 'primeng/menu';
import { TreeNode, MenuItem } from 'primeng/api';

// Services
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from './ia-diagram.service';
import { TreeNodeStyleService } from '../../services/treenode-style.service';

@Component({
  selector: 'aida-ia-diagram',
  imports: [TranslateModule, FormsModule,
    OrganizationChartModule, ButtonModule, TooltipModule, SelectButtonModule,
    MenuModule
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
    let tree = this.projectState.getProject().projectData;
    //Adjustments for full tree or custom root
    if (this.selectedTree() !== "full") {
      const custom = this.projectState.findNodeByUrl(tree, this.selectedTree());
      if (custom) { tree = [custom] };
    }
    //Adjustments for baseline or final version
    if (this.selectedView() === 'baseline') {
      tree = this.projectState.getBaselineTree(tree, this.selectedTree() === 'full' ? 'full' : 'custom');
    } else if (this.selectedView() === 'final') {
      tree = this.projectState.getFinalTree(tree);
    }
    //Adjustments for collapsed nodes
    if (this.collapsedNodes().size > 0 || this.hiddenNodes().size > 0) {
      tree = this.projectState.getDisplayTree(tree, this.collapsedNodes(), this.hiddenNodes());
    }
    return tree;
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

  //Tree options
  selectedTree = signal<'full' | string>('full');

  //Menu options
  @ViewChild('menu') menu!: Menu;
  items: MenuItem[] = [];

  onMenuClick(event: MouseEvent, node: TreeNode) {
    if (!node.data.url) return;
    console.log(node);
    event.preventDefault();
    this.items = [];

    //Full or custom tree
    if (this.projectTree()[0].data.url !== node.data.url) {
      this.items.push({
        label: this.translate.instant(`iaDiagram.menu.viewAsRoot`),
        icon: "pi pi-window-minimize",
        command: () => this.selectedTree.set(node.data.url)
      });
    }
    if (this.selectedTree() !== "full") {
      this.items.push({
        label: this.translate.instant(`iaDiagram.menu.viewFullTree`),
        icon: "pi pi-window-maximize",
        command: () => this.selectedTree.set("full")
      });
    }
    //Show/hide children
    if (node.children?.length) {
      this.items.push({
        label: this.translate.instant(`iaDiagram.menu.hideChildren`),
        icon: "pi pi-eye-slash",
        command: () => this.collapsedNodes.update(set => new Set([...set, node.data.url]))
      });
    }
    if (!node.children?.length && (node.data.collapsedChildren?.length || node.data.hiddenChildrenUrls?.length)) {
      this.items.push({
        label: this.translate.instant(`iaDiagram.menu.showChildren`),
        icon: "pi pi-eye",
        command: () => {
          this.collapsedNodes.update(set => {
            const next = new Set(set);
            next.delete(node.data.url); // in case children were collapsed
            return next;
          });
          this.hiddenNodes.update(set => {
            const next = new Set(set);
            (node.data.hiddenChildrenUrls ?? []).forEach((url: string) => next.delete(url));
            return next;
          });
        }
      });
    }
    //Show/hide node
    if (node.parent) {
      this.items.push({
        label: this.translate.instant(`iaDiagram.menu.hideNode`),
        icon: "pi pi-eye-slash",
        command: () => this.hiddenNodes.update(set => new Set([...set, node.data.url]))
      });
    }
    if (node.children?.length && node.data.hiddenChildrenUrls?.length) {
      this.items.push({
        label: this.translate.instant(`iaDiagram.menu.showHiddenNodes`),
        icon: "pi pi-eye",
        command: () => this.hiddenNodes.update(set => {
          const next = new Set(set);
          node.data.hiddenChildrenUrls.forEach((url: string) => next.delete(url));
          return next;
        })
      });
    }
    //Fallback if no menu options available
    if (this.items.length === 0) {
      this.items.push({
        label: this.translate.instant(`iaDiagram.menu.noActions`),
        disabled: true
      });
    }
    this.menu.toggle(event);
  }

  // Show/hide pages or children
  collapsedNodes = signal<Set<string>>(new Set());
  hiddenNodes = signal<Set<string>>(new Set());

}