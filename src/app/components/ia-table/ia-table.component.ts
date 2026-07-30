import { Component, inject, computed, ViewChild, effect, OnInit } from '@angular/core';
import { CommonModule, LocationStrategy } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// PrimeNG modules
import { TreeModule, TreeNodeContextMenuSelectEvent, TreeNodeDropEvent } from 'primeng/tree';
import { ContextMenuModule, ContextMenu } from 'primeng/contextmenu';
import { TreeNode, MenuItem, TreeDragDropService } from 'primeng/api';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';

import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DialogModule } from 'primeng/dialog';

// Services
import { ProjectStateService } from '../../services/project-state.service';
import { TreeNodeStyleService } from '../../services/treenode-style.service';
import { UserSettingsService } from '../../services/user-settings.service';
import { EditNodeComponent } from '../edit-node/edit-node.component';
import { AddUrlsService } from '../add-urls/add-urls.service';
import { FetchService } from '../../services/fetch.service';

@Component({
    selector: 'aida-ia-table',
    imports: [FormsModule, CommonModule, TranslateModule,
        TreeModule, ContextMenuModule, DialogModule,
        InputTextModule, InputGroupModule, InputGroupAddonModule,
        ButtonModule, TooltipModule,
        EditNodeComponent
    ],
    providers: [TreeDragDropService],
    templateUrl: './ia-table.component.html',
    styleUrl: './ia-table.component.css'
})
export class IaTableComponent implements OnInit {
    private projectState = inject(ProjectStateService);
    private treeNodeStyleService = inject(TreeNodeStyleService);
    private settingsService = inject(UserSettingsService);
    private locationStrategy = inject(LocationStrategy);
    private translate = inject(TranslateService);
    private addUrlsService = inject(AddUrlsService);
    private fetchService = inject(FetchService);

    projectTree = computed(() => this.projectState.getProject().projectData);
    selectedNode: TreeNode = {};

    //For edit node popup
    editNode = false;

    //Drag & drop states
    draggable = true;
    selectable = false;

    get currentLang() { return this.translate.currentLang.startsWith('fr') ? 'fr' : 'en' }

    constructor() {
        effect(() => {
            this.settingsService.darkMode(); // track dark mode changes
            this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
        });
    }

    async ngOnInit() {
        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
    }

    //Context menu
    @ViewChild('cm') cm!: ContextMenu;
    options: MenuItem[] = []; //options for editing nodes

    //RIGHT & LEFT CLICK ACTIONS
    onNodeClick(event: MouseEvent) {
        if (event.button === 0) {
            event.preventDefault();
        }
    }

    onNodeContextMenu(event: TreeNodeContextMenuSelectEvent) {
        this.selectedNode = event.node;
        const isContainer = this.selectedNode.data.isContainer;
        const primaryLang = this.selectedNode.data.lang;
        const path = this.selectedNode.data.path[primaryLang];
        if (!path) return;

        // Edit node
        this.options = []

        if (!isContainer) {
            this.options.push(
                {
                    label: this.translate.instant(`common.editNode`),
                    icon: "pi pi-pen-to-square",
                    command: () => { this.editNode = true }
                });
        }

        // Reorder siblings
        const siblings = this.projectState.getSiblings(this.selectedNode);
        const index = siblings.indexOf(this.selectedNode);
        const canMoveLeft = index > 0;
        const canMoveRight = index < siblings.length - 1;
        if (canMoveRight || canMoveLeft) {
            this.options.push({ separator: true });
        }
        if (canMoveLeft) {
            this.options.push(
                {
                    label: this.translate.instant(`common.moveUp`),
                    icon: "pi pi-arrow-up",
                    command: () => this.projectState.reorderNode(this.selectedNode, "left")
                }
            );
        }
        if (canMoveRight) {
            this.options.push({
                label: this.translate.instant(`common.moveDown`),
                icon: "pi pi-arrow-down",
                command: () => this.projectState.reorderNode(this.selectedNode, "right")
            });
        }
        if (canMoveRight || canMoveLeft) {
            this.options.push({ separator: true });
        }

        // Find child pages
        if (!this.selectedNode.data.isCrawled && !isContainer) {
            this.options.push({
                label: this.translate.instant(`iaDiagram.menu.findChildren`),
                icon: "pi pi-search",
                disabled: this.selectedNode.data.isCrawled,
                command: () => { this.addUrlsService.addChildren(this.selectedNode, primaryLang); }
            })
        }
        // Add child page or delete node       
        this.options.push(
            {
                label: this.translate.instant(`iaDiagram.menu.createChild`),
                icon: "pi pi-file-plus text-green-500",
                command: () => { this.selectedNode = this.projectState.createNode(this.selectedNode); this.editNode = true; }
            },
            {
                label: this.translate.instant(`iaDiagram.menu.deleteNode`),
                icon: "pi pi-trash text-red-500",
                command: () => { this.projectState.deleteNode(this.selectedNode) }
            },
        );

        // Open in new tab
        const github = this.projectState.getProject().github;
        const liveUrl = this.fetchService.generateUrl(path, "live");
        const previewUrl = this.fetchService.generateUrl(path, "preview");
        const prototypeUrl = this.fetchService.generateUrl(path, "protoGH", github.owner, github.repo);
        const baselineUrl = this.fetchService.generateUrl(path, "baseGH", github.owner, github.repo);
        const updUrl = `https://cra-arc.alpha.canada.ca/en/pages?url=${liveUrl}${this.currentLang}`;
        if (!isContainer) {
            this.options.push(
                { separator: true },
                {
                    label: this.translate.instant('common.openNewTab'),
                    icon: 'pi pi-external-link',
                    items: [
                        {
                            label: this.translate.instant('inventory.menu.newTab.liveUrl'),
                            icon: 'pi pi-external-link',
                            command: () => { window.open(liveUrl, '_blank'); }
                        },
                        {
                            label: this.translate.instant('inventory.menu.newTab.previewUrl'),
                            icon: 'pi pi-external-link',
                            command: () => { window.open(previewUrl, '_blank'); }
                        },
                        {
                            label: this.translate.instant('inventory.menu.newTab.prototypeUrl'),
                            icon: 'pi pi-external-link',
                            command: () => { window.open(prototypeUrl, '_blank'); }
                        },
                        {
                            label: this.translate.instant('inventory.menu.newTab.baselineUrl'),
                            icon: 'pi pi-external-link',
                            command: () => { window.open(baselineUrl, '_blank'); }
                        },
                        {
                            label: this.translate.instant('inventory.menu.newTab.UPD'),
                            icon: 'pi pi-external-link',
                            command: () => { window.open(updUrl, '_blank'); }
                        },
                    ]
                });
        }
    }

    // Page moves
    handleNodeDrop(event: TreeNodeDropEvent): void {
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