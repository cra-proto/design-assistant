import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MenuItem, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Menu, MenuModule } from 'primeng/menu';
import { OrganizationChartModule } from 'primeng/organizationchart';
import { TooltipModule } from 'primeng/tooltip';

import { EditNodeComponent } from '../edit-node/edit-node.component';
import { ProjectSettingsComponent } from '../project-settings/project-settings.component';

import { FetchService } from '../../services/fetch.service';
import { ProjectCacheService } from '../../services/project-cache.service';
import { ProjectStateService } from '../../services/project-state.service';
import { TreeNodeStyleService } from '../../services/treenode-style.service';
import { AddUrlsService } from '../add-urls/add-urls.service';
import { IaDiagramService } from './ia-diagram.service';

@Component({
  selector: 'aida-ia-diagram',
  imports: [CommonModule, FormsModule, TranslatePipe, ButtonModule, DialogModule, MenuModule, OrganizationChartModule, TooltipModule, EditNodeComponent, ProjectSettingsComponent],
  templateUrl: './ia-diagram.component.html',
  styleUrl: './ia-diagram.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaDiagramComponent {
  private readonly projectState = inject(ProjectStateService);
  protected readonly projectCache = inject(ProjectCacheService);
  private readonly translate = inject(TranslateService);
  protected readonly iaDiagram = inject(IaDiagramService);
  private readonly treeNodeStyleService = inject(TreeNodeStyleService);
  protected readonly addUrlsService = inject(AddUrlsService);
  private readonly fetchService = inject(FetchService);

  protected readonly primaryLang = this.projectState.detectPrimaryLanguage();

  //Signals
  private readonly projectData = this.projectState.getProject;

  constructor() {
    effect(() => {
      const applyStatusColors = this.projectCache.selectedViewIA() === 'changes';
      this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0, applyStatusColors);
    });
  }

  protected readonly projectTree = computed(() => {
    let tree = this.projectState.getProject().projectData;
    //Adjustments for full tree or custom root
    if (this.selectedTree() !== 'full') {
      const custom = this.projectState.findNodeByPath(tree, this.selectedTree(), this.primaryLang);
      if (custom) {
        tree = [custom];
      }
    }
    //Adjustments for baseline or final version
    if (this.projectCache.selectedViewIA() === 'baseline') {
      tree = this.projectState.getBaselineTree(tree, this.selectedTree() === 'full' ? 'full' : 'custom');
    } else if (this.projectCache.selectedViewIA() === 'final') {
      tree = this.projectState.getFinalTree(tree);
    }
    //Adjustments for collapsed nodes
    if (this.collapsedNodes().size > 0 || this.hiddenNodes().size > 0 || this.navNodes().size > 0) {
      tree = this.projectState.getDisplayTree(tree, this.collapsedNodes(), this.hiddenNodes(), this.navNodes());
    }
    this.treeNodeStyleService.updateNodeStyles(tree);
    return tree;
  });

  // Display H1
  protected getH1Display(node: TreeNode): string {
    const lang = this.projectCache.selectedLang();
    const liveH1 = node.data?.live?.[lang]?.h1 ?? '';
    const protoH1 = node.data?.prototype?.[lang]?.h1 ?? '';
    const changed = liveH1 !== protoH1;
    if (this.projectCache.selectedViewIA() === 'baseline') return liveH1;
    else if (this.projectCache.selectedViewIA() === 'final') return protoH1;
    else if (changed) return `<s class="text-color-secondary text-sm">${liveH1}</s><br>${protoH1}`;
    else return protoH1;
  }

  //Tree options
  private readonly selectedTree = signal<'full' | string>('full');

  //Menu options
  protected readonly menu = viewChild.required<Menu>('menu');
  protected items: MenuItem[] = [];

  protected editNode = false;
  protected showNotes = false;
  protected selectedNode: TreeNode = {};

  closeDialog() {
    this.editNode = false;
    this.showNotes = false;
  }
  protected onMenuClick(event: MouseEvent, node: TreeNode) {
    if (!node.data.path[this.primaryLang]) return;
    const projectNode = this.projectState.findNodeByPath(this.projectData().projectData, node.data.path[this.primaryLang], this.primaryLang);
    if (!projectNode) return;

    event.preventDefault();
    this.items = [
      {
        label: this.translate.instant(`common.actions`),
        items: [
          {
            label: this.translate.instant(`common.editNode`),
            icon: 'pi pi-pen-to-square',
            command: () => {
              this.selectedNode = projectNode;
              this.showNotes = false;
              this.editNode = true;
            },
          },
        ],
      },
      {
        label: this.translate.instant(`common.viewOptions`),
        items: [],
      },
    ];

    // Action: View notes
    if ((projectNode.data?.notes?.issue.length ?? 0) + (projectNode.data?.notes?.solution.length ?? 0) > 0) {
      this.items[0].items!.push({
        label: this.translate.instant(`common.viewNotes`),
        icon: 'pi pi-list',
        command: () => {
          this.selectedNode = projectNode;
          this.showNotes = true;
          this.editNode = true;
        },
      });
    }

    // Action: Reorder siblings
    const siblings = this.projectState.getSiblings(node);
    const index = siblings.indexOf(node);
    const canMoveLeft = index > 0 && !node.data.isNavChild;
    const canMoveRight = index < siblings.length - 1 && !node.data.isNavChild;
    if (this.projectCache.selectedViewIA() === 'changes' && (canMoveRight || canMoveLeft)) {
      this.items[0].items!.push({ separator: true });
    }
    if (this.projectCache.selectedViewIA() === 'changes' && canMoveLeft) {
      this.items[0].items!.push({
        label: this.translate.instant(`common.moveLeft`),
        icon: 'pi pi-arrow-left',
        command: () => this.projectState.reorderNode(node, 'left'),
      });
    }
    if (this.projectCache.selectedViewIA() === 'changes' && canMoveRight) {
      this.items[0].items!.push({
        label: this.translate.instant(`common.moveRight`),
        icon: 'pi pi-arrow-right',
        command: () => this.projectState.reorderNode(node, 'right'),
      });
    }
    if (this.projectCache.selectedViewIA() === 'changes' && (canMoveRight || canMoveLeft)) {
      this.items[0].items!.push({ separator: true });
    }
    // Action: Find child pages
    if (this.projectCache.selectedViewIA() === 'changes' && !node.data.isCrawled && !node.data.isNavChild) {
      this.items[0].items!.push({
        label: this.translate.instant(`iaDiagram.menu.findChildren`),
        icon: 'pi pi-search',
        command: () => {
          this.addUrlsService.addChildren(node, this.primaryLang);
        },
      });
    }
    // Action: Add child page or delete node
    if (this.projectCache.selectedViewIA() === 'changes' && !node.data.isNavChild) {
      this.items[0].items!.push(
        {
          label: this.translate.instant(`iaDiagram.menu.createChild`),
          icon: 'pi pi-file-plus text-green-500',
          command: () => {
            this.selectedNode = this.projectState.createNode(node);
            this.showNotes = false;
            this.editNode = true;
          },
        },
        {
          label: this.translate.instant(`iaDiagram.menu.deleteNode`),
          icon: 'pi pi-trash text-red-500',
          command: () => {
            this.projectState.deleteNode(node);
          },
        },
      );
    }

    // View: Full or custom tree
    if (this.projectTree()[0].data.path[this.primaryLang] !== node.data.path[this.primaryLang] && !node.data.isNavChild) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.viewAsRoot`),
        icon: 'pi pi-window-minimize',
        command: () => this.selectedTree.set(node.data.path[this.primaryLang]),
      });
    }
    if (this.selectedTree() !== 'full') {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.viewFullTree`),
        icon: 'pi pi-window-maximize',
        command: () => this.selectedTree.set('full'),
      });
    }
    // View: Show/hide children
    if (node.children?.length) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.hideChildren`),
        icon: 'pi pi-eye-slash',
        command: () => this.collapsedNodes.update((set) => new Set([...set, node.data.path[this.primaryLang]])),
      });
    }
    if (!node.children?.length && (node.data.collapsedChildren?.length || node.data.hiddenChildrenUrls?.length)) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.showChildren`),
        icon: 'pi pi-eye',
        command: () => {
          this.collapsedNodes.update((set) => {
            const next = new Set(set);
            next.delete(node.data.path[this.primaryLang]); // in case children were collapsed
            return next;
          });
          this.hiddenNodes.update((set) => {
            const next = new Set(set);
            (node.data.hiddenChildrenUrls ?? []).forEach((url: string) => next.delete(url));
            return next;
          });
        },
      });
    }
    // View: Show/hide node
    if (node.parent) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.hideNode`),
        icon: 'pi pi-eye-slash',
        command: () => this.hiddenNodes.update((set) => new Set([...set, node.data.path[this.primaryLang]])),
      });
    }
    if (node.children?.length && node.data.hiddenChildrenUrls?.length) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.showHiddenNodes`),
        icon: 'pi pi-eye',
        command: () =>
          this.hiddenNodes.update((set) => {
            const next = new Set(set);
            node.data.hiddenChildrenUrls.forEach((url: string) => next.delete(url));
            return next;
          }),
      });
    }
    //Show nav children
    if (!node.data.isNavChild) {
      const path = node.data.path[this.primaryLang];
      const navChildrenVisible = this.navNodes().has(path);

      this.items[1].items!.push({
        label: navChildrenVisible ? this.translate.instant(`iaDiagram.menu.hideNavChildren`) : this.translate.instant(`iaDiagram.menu.showNavChildren`),
        icon: navChildrenVisible ? 'pi pi-eye-slash' : 'pi pi-eye',
        command: async () => {
          //Toggle off
          if (this.navNodes().has(path)) {
            this.navNodes.update((map) => {
              const next = new Map(map);
              next.delete(path);
              return next;
            });
            return;
          }
          //Toggle on
          const type = this.projectState.getProject().repoType;
          const version = type === 'github' && this.projectCache.hasGitHub() ? 'protoGH' : type === 'local' && this.projectCache.hasLocal() ? 'protoUT' : 'live';
          const url = this.fetchService.generateUrl(path, version, this.projectData().github.owner, this.projectData().github.repo);
          const viaProxy = version.endsWith('UT');
          let linkedPaths = await this.fetchService.getPaths(url, viaProxy);
          if (version !== 'live' && linkedPaths.length === 0) {
            const urlLive = this.fetchService.generateUrl(path, 'live');
            linkedPaths = await this.fetchService.getPaths(urlLive, false);
          }
          const projectPaths = new Set(this.projectState.getAllPages(this.primaryLang).map((p) => p.path));
          const directChildPaths = new Set((node.children ?? []).map((child) => child.data.path[this.primaryLang]));
          const filteredPaths = linkedPaths.filter((p) => projectPaths.has(p) && !directChildPaths.has(p) && p !== path);
          console.log(filteredPaths);
          this.navNodes.update((map) => new Map(map).set(path, filteredPaths));
        },
      });
    }
    // View: Fallback if no menu options available
    if (this.items[1].items!.length === 0) {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.noActions`),
        disabled: true,
      });
    }

    this.menu().toggle(event);
  }

  // Show/hide pages or children
  private readonly collapsedNodes = signal<Set<string>>(new Set());
  private readonly hiddenNodes = signal<Set<string>>(new Set());
  private readonly navNodes = signal<Map<string, string[]>>(new Map());

  // Drag & drop
  private readonly dragNode = signal<TreeNode | null>(null);
  private readonly dropTarget = signal<TreeNode | null>(null);

  protected onDragStart(node: TreeNode) {
    if (this.projectCache.selectedViewIA() !== 'changes') return;
    this.dragNode.set(node);
  }

  protected onDragOver(event: DragEvent, node: TreeNode) {
    event.preventDefault(); // required to allow drop
    if (this.projectCache.selectedViewIA() !== 'changes') return;
    if (node.data.path[this.primaryLang] !== this.dragNode()?.data?.path[this.primaryLang]) {
      this.dropTarget.set(node);
    }
  }

  protected onDragLeave(node: TreeNode) {
    if (this.projectCache.selectedViewIA() !== 'changes') return;
    if (this.dropTarget()?.data?.path[this.primaryLang] === node.data.path[this.primaryLang]) {
      this.dropTarget.set(null);
    }
  }

  protected onDrop() {
    if (this.projectCache.selectedViewIA() !== 'changes') return;
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

  protected get legendItems() {
    const mainColours = this.treeNodeStyleService.bgColors;
    const allColours = this.treeNodeStyleService.contextStyles;

    const items: { context: string[]; text: string }[] = [
      { context: [mainColours[0], mainColours[1], mainColours[3]], text: this.translate.instant('editNode.inScope') },
      { context: [allColours['template']], text: this.translate.instant('iaDiagram.outOfScope') },
    ];

    const hasNew = this.projectState.findNodeWhere(this.projectTree(), (node) => node.data?.status?.isNew === true) !== null;
    const hasMoves = this.projectState.findNodeWhere(this.projectTree(), (node) => node.data?.status?.isMoved === true) !== null;
    const hasROT = this.projectState.findNodeWhere(this.projectTree(), (node) => node.data?.status?.isROT === true) !== null;
    const hasRescues = Array.from(this.navNodes().values()).some((links) => links.length > 0);

    if (this.projectCache.selectedViewIA() === 'changes') {
      if (hasNew) {
        items.push({ context: [allColours['new']], text: this.translate.instant('editNode.isNew') });
      }
      if (hasMoves) {
        items.push({ context: [allColours['move']], text: this.translate.instant('editNode.isMoved') });
      }
      if (hasROT) {
        items.push({ context: [allColours['rot']], text: this.translate.instant('editNode.isROT') });
      }
      if (hasRescues) {
        items.push({ context: [allColours['navChild'], allColours['navChildTemp']], text: this.translate.instant('iaDiagram.hasRescues') });
      }
    }

    return items;
  }
}
