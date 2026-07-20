import { Component, inject, computed, signal, ViewChild } from '@angular/core';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';

// PrimeNG modules
import { OrganizationChartModule } from 'primeng/organizationchart';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MenuModule, Menu } from 'primeng/menu';
import { TreeNode, MenuItem } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';

// Services
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from './ia-diagram.service';
import { TreeNodeStyleService } from '../../services/treenode-style.service';
import { EditNodeComponent } from '../edit-node/edit-node.component';
import { AddUrlsService } from '../add-urls/add-urls.service';

@Component({
  selector: 'aida-ia-diagram',
  imports: [TranslateModule, FormsModule,
    OrganizationChartModule, ButtonModule, TooltipModule, SelectButtonModule,
    MenuModule, DialogModule, EditNodeComponent],
  templateUrl: './ia-diagram.component.html',
  styleUrl: './ia-diagram.component.css'
})
export class IaDiagramComponent {
  private projectState = inject(ProjectStateService);
  private translate = inject(TranslateService);
  public iaDiagram = inject(IaDiagramService);
  private treeNodeStyleService = inject(TreeNodeStyleService);
  public addUrlsService = inject(AddUrlsService);

  primaryLang = this.projectState.detectPrimaryLanguage();

  projectTree = computed(() => {
    let tree = this.projectState.getProject().projectData;
    //Adjustments for full tree or custom root
    if (this.selectedTree() !== "full") {
      const custom = this.projectState.findNodeByPath(tree, this.selectedTree(), this.primaryLang);
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
    this.treeNodeStyleService.updateNodeStyles(tree);
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

  //Language options
  selectedLanguage = signal<'en' | 'fr'>(this.primaryLang);

  get languageOptions() {
    return [
      { label: this.translate.instant('common.language.english'), value: 'en' },
      { label: this.translate.instant('common.language.french'), value: 'fr' },
    ];
  }

  // Display H1
  getH1Display(node: TreeNode): string {
    const lang = this.selectedLanguage();
    const liveH1 = node.data?.live?.[lang]?.h1 ?? '';
    const protoH1 = node.data?.prototype?.[lang]?.h1 ?? '';
    const changed = liveH1 !== protoH1
    if (this.selectedView() === 'baseline') return liveH1;
    else if (this.selectedView() === 'final') return protoH1;
    else if (changed) return `<s class="text-color-secondary text-sm">${liveH1}</s><br>${protoH1}`;
    else return protoH1;
  }

  //Tree options
  selectedTree = signal<'full' | string>('full');

  //Menu options
  @ViewChild('menu') menu!: Menu;
  items: MenuItem[] = [];


  editNode = false;
  selectedNode: TreeNode = {};

  onMenuClick(event: MouseEvent, node: TreeNode) {
    if (!node.data.path[this.primaryLang]) return;

    event.preventDefault();
    this.items = [
      {
        label: this.translate.instant(`common.actions`),
        items: [
          {
            label: this.translate.instant(`common.editNode`),
            icon: "pi pi-pen-to-square",
            command: () => { this.selectedNode = node; this.editNode = true }
          },
        ],
      },
      {
        label: this.translate.instant(`common.viewOptions`),
        items: []
      }];

    // Action: Reorder siblings
    const siblings = this.projectState.getSiblings(node);
    const index = siblings.indexOf(node);
    const canMoveLeft = index > 0;
    const canMoveRight = index < siblings.length - 1;
    if (this.selectedView() === 'changes' && (canMoveRight || canMoveLeft)) {
      this.items[0].items!.push({ separator: true });
    }
    if (this.selectedView() === 'changes' && canMoveLeft) {
      this.items[0].items!.push(
        {
          label: this.translate.instant(`common.moveLeft`),
          icon: "pi pi-arrow-left",
          command: () => this.projectState.reorderNode(node, "left")
        }
      );
    }
    if (this.selectedView() === 'changes' && canMoveRight) {
      this.items[0].items!.push({
        label: this.translate.instant(`common.moveRight`),
        icon: "pi pi-arrow-right",
        command: () => this.projectState.reorderNode(node, "right")
      });
    }
    if (this.selectedView() === 'changes' && (canMoveRight || canMoveLeft)) {
      this.items[0].items!.push({ separator: true });
    }
    // Action: Find child pages
    if (this.selectedView() === 'changes' && !node.data.isCrawled) {
      this.items[0].items!.push({
        label: this.translate.instant(`iaDiagram.menu.findChildren`),
        icon: "pi pi-search",
        disabled: node.data.isCrawled,
        command: () => { this.addUrlsService.addChildren(node, this.primaryLang); }
      })
    }
    // Action: Add child page or delete node
    if (this.selectedView() === 'changes') {
      this.items[0].items!.push(
        {
          label: this.translate.instant(`iaDiagram.menu.createChild`),
          icon: "pi pi-file-plus text-green-500",
          command: () => { this.projectState.createNode(node) }
        },
        {
          label: this.translate.instant(`iaDiagram.menu.deleteNode`),
          icon: "pi pi-trash text-red-500",
          command: () => { this.projectState.deleteNode(node) }
        },
      );
    }

    // View: Full or custom tree
    if (this.projectTree()[0].data.path[this.primaryLang] !== node.data.path[this.primaryLang]) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.viewAsRoot`),
        icon: "pi pi-window-minimize",
        command: () => this.selectedTree.set(node.data.path[this.primaryLang])
      });
    }
    if (this.selectedTree() !== "full") {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.viewFullTree`),
        icon: "pi pi-window-maximize",
        command: () => this.selectedTree.set("full")
      });
    }
    // View: Show/hide children
    if (node.children?.length) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.hideChildren`),
        icon: "pi pi-eye-slash",
        command: () => this.collapsedNodes.update(set => new Set([...set, node.data.path[this.primaryLang]]))
      });
    }
    if (!node.children?.length && (node.data.collapsedChildren?.length || node.data.hiddenChildrenUrls?.length)) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.showChildren`),
        icon: "pi pi-eye",
        command: () => {
          this.collapsedNodes.update(set => {
            const next = new Set(set);
            next.delete(node.data.path[this.primaryLang]); // in case children were collapsed
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
    // View: Show/hide node
    if (node.parent) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.hideNode`),
        icon: "pi pi-eye-slash",
        command: () => this.hiddenNodes.update(set => new Set([...set, node.data.path[this.primaryLang]]))
      });
    }
    if (node.children?.length && node.data.hiddenChildrenUrls?.length) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.showHiddenNodes`),
        icon: "pi pi-eye",
        command: () => this.hiddenNodes.update(set => {
          const next = new Set(set);
          node.data.hiddenChildrenUrls.forEach((url: string) => next.delete(url));
          return next;
        })
      });
    }
    // View: Fallback if no menu options available
    if (this.items[1].items!.length === 0) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.noActions`),
        disabled: true
      });
    }

    this.menu.toggle(event);
  }

  // Show/hide pages or children
  collapsedNodes = signal<Set<string>>(new Set());
  hiddenNodes = signal<Set<string>>(new Set());

  // Drag & drop
  dragNode = signal<TreeNode | null>(null);
  dropTarget = signal<TreeNode | null>(null);

  onDragStart(node: TreeNode) {
    if (this.selectedView() !== 'changes') return;
    this.dragNode.set(node);
  }

  onDragOver(event: DragEvent, node: TreeNode) {
    event.preventDefault(); // required to allow drop
    if (this.selectedView() !== 'changes') return;
    if (node.data.path[this.primaryLang] !== this.dragNode()?.data?.path[this.primaryLang]) {
      this.dropTarget.set(node);
    }
  }

  onDragLeave(node: TreeNode) {
    if (this.selectedView() !== 'changes') return;
    if (this.dropTarget()?.data?.path[this.primaryLang] === node.data.path[this.primaryLang]) {
      this.dropTarget.set(null);
    }
  }

  onDrop() {
    if (this.selectedView() !== 'changes') return;
    const drag = this.dragNode();
    const drop = this.dropTarget();
    if (!drag || !drop || drag.data.path[this.primaryLang] === drop.data.path[this.primaryLang] || drag.parent?.data?.path[this.primaryLang] === drop.data.path[this.primaryLang]) {
      this.dragNode.set(null);
      this.dropTarget.set(null);
      return;
    }
    this.projectState.moveNode(drag, drop);
    this.dragNode.set(null);
    this.dropTarget.set(null);
  }
}