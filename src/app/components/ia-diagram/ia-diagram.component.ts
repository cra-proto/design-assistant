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

import { AddPagesLinkComponent } from '../add-pages/add-pages-link/add-pages-link.component';
import { EditNodeComponent } from '../edit-node/edit-node.component';
import { ProjectSettingsComponent } from '../project-settings/project-settings.component';

import { FetchService } from '../../services/fetch.service';
import { ProjectCacheService } from '../../services/project-cache.service';
import { ProjectStateService } from '../../services/project-state.service';
import { TreeNodeStyleService } from '../../services/treenode-style.service';
import { AddUrlsService } from '../add-pages/by-url/add-urls.service';
import { IaDiagramService } from './ia-diagram.service';

import { TreeNodeData } from '../../common/data.model';

@Component({
  selector: 'aida-ia-diagram',
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    DialogModule,
    MenuModule,
    OrganizationChartModule,
    TooltipModule,
    AddPagesLinkComponent,
    EditNodeComponent,
    ProjectSettingsComponent,
  ],
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
    if (!tree) return [];
    //Adjustments for full tree or custom root
    if (this.iaDiagram.selectedTree() !== 'full') {
      const custom = this.projectState.findNodeByPath(tree, this.iaDiagram.selectedTree(), this.primaryLang);
      if (custom) {
        tree = [custom];
      }
    }
    //Adjustments for baseline or final version
    if (this.projectCache.selectedViewIA() === 'baseline') {
      tree = this.projectState.getBaselineTree(tree, this.iaDiagram.selectedTree() === 'full' ? 'full' : 'custom');
    } else if (this.projectCache.selectedViewIA() === 'final') {
      tree = this.projectState.getFinalTree(tree);
    }
    //Adjustments for collapsed nodes
    if (this.iaDiagram.collapsedNodes().size > 0 || this.iaDiagram.hiddenNodes().size > 0 || this.iaDiagram.navNodes().size > 0) {
      tree = this.projectState.getDisplayTree(tree, this.iaDiagram.collapsedNodes(), this.iaDiagram.hiddenNodes(), this.iaDiagram.navNodes());
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

  //Menu options
  protected readonly menu = viewChild.required<Menu>('menu');
  protected items: MenuItem[] = [];

  protected editNode = false;
  protected showNotes = false;
  protected selectedNode: TreeNode | undefined = undefined;

  closeDialog() {
    this.editNode = false;
    this.showNotes = false;
    this.selectedNode = undefined;
  }

  protected onMenuClick(event: MouseEvent, node: TreeNode) {
    if (!node.data.path[this.primaryLang]) return;
    const projectNode = this.projectState.findNodeByPath(this.projectData().projectData, node.data.path[this.primaryLang], this.primaryLang);
    if (!projectNode) return;

    event.preventDefault();

    // Action: Edit node
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
    if ((projectNode.data?.notes?.issue?.length ?? 0) + (projectNode.data?.notes?.solution?.length ?? 0) > 0) {
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
    // Action: Move left
    if (this.projectCache.selectedViewIA() === 'changes' && canMoveLeft) {
      this.items[0].items!.push({
        label: this.translate.instant(`common.moveLeft`),
        icon: 'pi pi-arrow-left',
        command: () => this.projectState.reorderNode(node, 'left'),
      });
    }
    // Action: Move right
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

    if (this.projectCache.selectedViewIA() === 'changes' && !node.data.isNavChild) {
      // Action: Find child pages
      if (!node.data.isCrawled) {
        this.items[0].items!.push({
          label: this.translate.instant(`iaDiagram.menu.findChildren`),
          icon: 'pi pi-search',
          command: () => {
            this.addUrlsService.addChildren(node, this.primaryLang);
          },
        });
      }
      // Action: Add child page or delete page
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
        command: () => this.iaDiagram.selectedTree.set(node.data.path[this.primaryLang]),
      });
    }
    if (this.iaDiagram.selectedTree() !== 'full') {
      this.items[1].items!.push({
        label: this.translate.instant(`iaDiagram.menu.viewFullTree`),
        icon: 'pi pi-window-maximize',
        command: () => this.iaDiagram.selectedTree.set('full'),
      });
    }
    if ((this.projectTree()[0].data.path[this.primaryLang] !== node.data.path[this.primaryLang] && !node.data.isNavChild) || this.iaDiagram.selectedTree() !== 'full') {
      this.items[1].items!.push({ separator: true });
    }

    // View: Show nav children
    if (!node.data.isNavChild) {
      const path = node.data.path[this.primaryLang];
      const navChildrenVisible = this.iaDiagram.navNodes().has(path);

      this.items[1].items!.push({
        label: navChildrenVisible ? this.translate.instant(`iaDiagram.menu.hideNavChildren`) : this.translate.instant(`iaDiagram.menu.showNavChildren`),
        icon: navChildrenVisible ? 'pi pi-eye-slash' : 'pi pi-eye',
        command: async () => {
          //Toggle off
          if (this.iaDiagram.navNodes().has(path)) {
            this.iaDiagram.navNodes.update((map) => {
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
          this.iaDiagram.navNodes.update((map) => new Map(map).set(path, filteredPaths));
        },
      });

      // View: Show hidden nodes (1 level only, only visible if specific children are hidden)
      if (node.children?.length && node.data.hiddenChildrenUrls?.length) {
        this.items[1].items!.push({
          label: this.translate.instant(`iaDiagram.menu.showHiddenNodes`),
          icon: 'pi pi-eye',
          command: () =>
            this.iaDiagram.hiddenNodes.update((set) => {
              const next = new Set(set);
              node.data.hiddenChildrenUrls.forEach((url: string) => next.delete(url));
              return next;
            }),
        });
      }

      // View: Show next level of hidden children
      if (!node.children?.length && (node.data.collapsedChildren?.length || node.data.hiddenChildrenUrls?.length)) {
        this.items[1].items!.push({
          label: this.translate.instant(`iaDiagram.menu.showNextChildren`),
          icon: 'pi pi-eye',
          command: () => {
            this.iaDiagram.collapsedNodes.update((set) => {
              const next = new Set(set);
              next.delete(node.data.path[this.primaryLang]); // in case children were collapsed
              return next;
            });
            this.iaDiagram.hiddenNodes.update((set) => {
              const next = new Set(set);
              (node.data.hiddenChildrenUrls ?? []).forEach((path: string) => next.delete(path));
              return next;
            });
          },
        });
      }

      // View: Show all levels of hidden children
      if (projectNode && this.hasDeepHiddenContent(projectNode)) {
        this.items[1].items!.push({
          label: this.translate.instant('iaDiagram.menu.showAllChildren'),
          icon: 'pi pi-eye',
          command: () => {
            const descendants = this.projectState.getSubtreePaths(projectNode, this.primaryLang);
            this.iaDiagram.collapsedNodes.update((set) => {
              const next = new Set(set);
              descendants.forEach((path) => next.delete(path));
              return next;
            });
            this.iaDiagram.hiddenNodes.update((set) => {
              const next = new Set(set);
              descendants.forEach((path) => next.delete(path));
              return next;
            });
          },
        });
      }

      if (node.parent || node.children?.length) {
        this.items[1].items!.push({ separator: true });
      }

      // View: Hide node
      if (node.parent) {
        this.items[1].items!.push({
          label: this.translate.instant(`iaDiagram.menu.hideNode`),
          icon: 'pi pi-eye-slash',
          command: () => this.iaDiagram.hiddenNodes.update((set) => new Set([...set, node.data.path[this.primaryLang]])),
        });
      }

      // View: Hide all children from specified level
      if (node.children?.length) {
        const maxDepth = this.projectState.getSubtreeMaxDepth(node);
        for (let level = 1; level <= maxDepth; level++) {
          this.items[1].items!.push({
            label: this.translate.instant('iaDiagram.menu.hideLevelChildren', { level: level + this.projectState.getOrdinalSuffix(level) }),
            icon: 'pi pi-eye-slash',
            command: () => {
              const cutNodes: TreeNode<TreeNodeData>[] = [];
              for (let targetLevel = maxDepth; targetLevel >= level; targetLevel--) {
                cutNodes.push(...this.projectState.getNodesAtRelativeDepth(node, targetLevel - 1).filter((n) => (n.children?.length ?? 0) > 0));
              }
              this.iaDiagram.collapsedNodes.update((set) => {
                const next = new Set(set);
                cutNodes.forEach((node) => {
                  if (node.data) next.add(node.data.path[this.primaryLang]);
                });
                return next;
              });
            },
          });
        }
      }
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

  /** Returns true if any child nodes have collapsed or hidden nodes and those child nodes also have child nodes */
  private hasDeepHiddenContent(node: TreeNode<TreeNodeData>): boolean {
    const checkBelow = (currentNode: TreeNode<TreeNodeData>): boolean => {
      const path = currentNode.data?.path[this.primaryLang];
      if (path) {
        const hasRealCollapse = this.iaDiagram.collapsedNodes().has(path) && (currentNode.children?.length ?? 0) > 0;
        if (hasRealCollapse || this.iaDiagram.hiddenNodes().has(path)) {
          return true;
        }
      }
      return (currentNode.children ?? []).some((child) => checkBelow(child));
    };
    return (node.children ?? []).some((child) => checkBelow(child));
  }

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
    const items: { context: string[]; text: string }[] = [];
    const tree = this.projectTree();
    if (tree.length === 0) return items;

    const mainColours = this.treeNodeStyleService.bgColors;
    const allColours = this.treeNodeStyleService.contextStyles;

    const depth = this.projectState.getInScopeMaxDepth(tree[0]);
    if (depth) {
      const inScopeColours = Array.from({ length: depth + 1 }, (_, i) => mainColours[i]);
      items.push({ context: inScopeColours, text: this.translate.instant('editNode.inScope') });
    }

    const hasOutOfScope = this.projectState.findNodeWhere(tree, (node) => node.data?.status?.inScope === false) !== null;
    if (hasOutOfScope) {
      items.push({ context: [allColours['template']], text: this.translate.instant('iaDiagram.outOfScope') });
    }

    const hasNew = this.projectState.findNodeWhere(tree, (node) => node.data?.status?.isNew === true) !== null;
    const hasMoves = this.projectState.findNodeWhere(tree, (node) => node.data?.status?.isMoved === true) !== null;
    const hasROT = this.projectState.findNodeWhere(tree, (node) => node.data?.status?.isROT === true) !== null;

    //Dynamic rescue link colour swatches
    const inScopePaths = new Set(this.projectState.getAllPages(this.primaryLang, 'live', 'inScope').map((p) => p.path));
    const allRescuePaths = Array.from(this.iaDiagram.navNodes().values()).flat();
    const hasInScopeRescues = allRescuePaths.some((p) => inScopePaths.has(p));
    const hasOutOfScopeRescues = allRescuePaths.some((p) => !inScopePaths.has(p));
    const rescueColours = [...(hasInScopeRescues ? [allColours['navChild']] : []), ...(hasOutOfScopeRescues ? [allColours['navChildTemp']] : [])];

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
      if (hasInScopeRescues || hasOutOfScopeRescues) {
        items.push({ context: rescueColours, text: this.translate.instant('iaDiagram.hasRescues') });
      }
    }

    return items;
  }

  get hasIaOrphan() {
    const tree = this.projectTree();
    if (tree.length === 0) return false;
    const lang = this.projectCache.selectedLang() ?? 'en';
    return this.projectState.findNodeWhere(tree, (node) => node.data?.live?.[lang].isOrphan === true) !== null;
  }
}
