import { ChangeDetectionStrategy, Component, effect, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslateService } from '@ngx-translate/core';

import { MenuItem, TreeDragDropService, TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { Menu, MenuModule } from 'primeng/menu';
import { TreeModule, TreeNodeDropEvent } from 'primeng/tree';

import { EditNodeComponent } from '../edit-node/edit-node.component';

import { FetchService } from '../../services/fetch.service';
import { ProjectCacheService } from '../../services/project-cache.service';
import { ProjectStateService } from '../../services/project-state.service';
import { TreeNodeStyleService } from '../../services/treenode-style.service';
import { UserSettingsService } from '../../services/user-settings.service';
import { AddUrlsService } from '../add-pages/by-url/add-urls.service';

@Component({
  selector: 'aida-ia-table',
  imports: [FormsModule, ButtonModule, DialogModule, MenuModule, TreeModule, EditNodeComponent],
  providers: [TreeDragDropService],
  templateUrl: './ia-table.component.html',
  styleUrl: './ia-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IaTableComponent {
  private readonly projectState = inject(ProjectStateService);
  private readonly treeNodeStyleService = inject(TreeNodeStyleService);
  protected readonly projectCache = inject(ProjectCacheService);
  private readonly settingsService = inject(UserSettingsService);
  private readonly translate = inject(TranslateService);
  private readonly addUrlsService = inject(AddUrlsService);
  private readonly fetchService = inject(FetchService);

  public readonly projectTree = input<TreeNode[]>(this.projectState.getProject().projectData);

  protected readonly treeKey = signal(0);
  protected selectedNode?: TreeNode | null;
  protected readonly menu = viewChild.required<Menu>('menu');

  //For edit node popup
  protected editNode = false;
  protected showNotes = false;

  //Drag & drop states
  protected draggable = true;
  protected selectable = false;

  protected get currentLanguage() {
    return this.translate.currentLang()?.startsWith('fr') ? 'fr' : 'en';
  }

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

  constructor() {
    effect(() => {
      this.settingsService.darkMode();
      this.projectState.getProject();
      this.treeKey.update((k) => k + 1);
    });
  }

  /** Needed to get the actual node reference from a cloned getDisplayTree */
  protected resolveRealNode(cloneNode: TreeNode | null): TreeNode | null {
    if (!cloneNode) return null;
    return this.projectState.findNodeByPath(this.projectState.getProjectTree(), cloneNode.data.path[this.currentLanguage], this.currentLanguage);
  }

  //Context menu
  protected options: MenuItem[] = []; //options for editing nodes

  //RIGHT & LEFT CLICK ACTIONS
  protected onNodeClick(event: MouseEvent) {
    if (event.button === 0) {
      event.preventDefault();
    }
  }

  protected onNodeMenuClick(event: MouseEvent, clonedNode: TreeNode) {
    event.preventDefault();
    this.menu().hide();
    const target = event.currentTarget;
    this.selectedNode = this.resolveRealNode(clonedNode);
    if (!this.selectedNode) return;
    const node = this.selectedNode;
    const isContainer = this.selectedNode.data.isContainer;
    const path = this.selectedNode.data.path[this.projectCache.selectedLang()];
    if (!path) return;

    // Options
    this.options = [
      {
        label: this.translate.instant(`common.actions`),
        items: [],
      },
      {
        label: this.translate.instant(`common.openNewTab`),
        items: [],
      },
    ];

    // Action: edit node
    if (!isContainer) {
      this.options[0].items!.push({
        label: this.translate.instant(`common.editNode`),
        icon: 'pi pi-pen-to-square',
        command: () => {
          this.showNotes = false;
          this.editNode = true;
        },
      });
    }
    // Action: View notes
    if ((node.data?.notes?.issue?.length ?? 0) + (node.data?.notes?.solution?.length ?? 0) > 0) {
      this.options[0].items!.push({
        label: this.translate.instant(`common.viewNotes`),
        icon: 'pi pi-list',
        command: () => {
          this.showNotes = true;
          this.editNode = true;
        },
      });
    }

    // Reorder siblings
    const siblings = this.projectState.getSiblings(this.selectedNode);
    const index = siblings.indexOf(this.selectedNode);
    const canMoveLeft = index > 0;
    const canMoveRight = index < siblings.length - 1;
    if (canMoveRight || canMoveLeft) {
      this.options[0].items!.push({ separator: true });
    }
    if (canMoveLeft) {
      this.options[0].items!.push({
        label: this.translate.instant(`common.moveUp`),
        icon: 'pi pi-arrow-up',
        command: () => this.projectState.reorderNode(node, 'left'),
      });
    }
    if (canMoveRight) {
      this.options[0].items!.push({
        label: this.translate.instant(`common.moveDown`),
        icon: 'pi pi-arrow-down',
        command: () => this.projectState.reorderNode(node, 'right'),
      });
    }
    if (canMoveRight || canMoveLeft) {
      this.options[0].items!.push({ separator: true });
    }

    // Actions: Find child pages
    if (!this.selectedNode.data.isCrawled && !isContainer) {
      this.options[0].items!.push({
        label: this.translate.instant(`iaDiagram.menu.findChildren`),
        icon: 'pi pi-search',
        disabled: this.selectedNode.data.isCrawled,
        command: () => {
          this.addUrlsService.addChildren(node, this.projectState.detectPrimaryLanguage());
        },
      });
    }
    // Action: Add child page or delete node
    this.options[0].items!.push(
      {
        label: this.translate.instant(`iaDiagram.menu.createChild`),
        icon: 'pi pi-file-plus text-green-500',
        command: () => {
          this.selectedNode = this.projectState.createNode(node);
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

    // Open in new tab
    const github = this.projectState.getProject().github;
    const liveUrl = this.fetchService.generateUrl(path, 'live');
    const previewUrl = this.fetchService.generateUrl(path, 'preview');
    const prototypeUrl = this.fetchService.generateUrl(path, 'protoGH', github.owner, github.repo);
    const baselineUrl = this.fetchService.generateUrl(path, 'baseGH', github.owner, github.repo);
    const updUrl = this.fetchService.generateUrl(path, 'upd');
    if (!isContainer) {
      this.options[1].items!.push(
        {
          label: this.translate.instant('inventory.menu.newTab.liveUrl'),
          icon: 'pi pi-external-link',
          command: () => {
            window.open(liveUrl, '_blank');
          },
        },
        {
          label: this.translate.instant('inventory.menu.newTab.previewUrl'),
          icon: 'pi pi-external-link',
          command: () => {
            window.open(previewUrl, '_blank');
          },
        },
        {
          label: this.translate.instant('inventory.menu.newTab.prototypeUrl'),
          icon: 'pi pi-external-link',
          command: () => {
            window.open(prototypeUrl, '_blank');
          },
        },
        {
          label: this.translate.instant('inventory.menu.newTab.baselineUrl'),
          icon: 'pi pi-external-link',
          command: () => {
            window.open(baselineUrl, '_blank');
          },
        },
        {
          label: this.translate.instant('inventory.menu.newTab.UPD'),
          icon: 'pi pi-external-link',
          command: () => {
            window.open(updUrl, '_blank');
          },
        },
      );
    }
    setTimeout(() => this.menu().show({ currentTarget: target }));
  }

  // Page moves
  protected handleNodeDrop(event: TreeNodeDropEvent): void {
    const dragNode = event.dragNode;
    const dropNode = event.dropNode;

    if (!dragNode || !dropNode) return;

    // Prevent dropping containers into containers (not foolproof)
    if ((dropNode.data.isContainer || dropNode.parent?.data?.isContainer) && dragNode.data.isContainer) return;
    event.accept?.(); // accept the drop

    //Get target element
    const targetEl = event.originalEvent?.target as HTMLElement;
    const droppedOnNode = targetEl.tagName.toLowerCase() !== 'li'; // tag will be <a> or <div> if dropped on a node or <li> if dropped between nodes
    const effectiveNewParent = droppedOnNode ? dropNode : dropNode.parent;

    if (!dragNode.data.isContainer && !dragNode.data.status.isNew) {
      this.projectState.applyMoveResult(dragNode, effectiveNewParent);
    }

    //Cleanup hover effect if hovering on parent but dropping between parent and top child
    document.querySelectorAll('.p-tree-node-dragover').forEach((el) => {
      el.classList.remove('p-tree-node-dragover');
    });
    //Update styles
    this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
  }
}
