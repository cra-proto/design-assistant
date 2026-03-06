import { Component, inject, computed, ViewChild, effect, afterNextRender } from '@angular/core';
import { CommonModule, LocationStrategy } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG modules
import { TreeModule, TreeNodeContextMenuSelectEvent, TreeNodeDropEvent } from 'primeng/tree';
import { ContextMenuModule, ContextMenu } from 'primeng/contextmenu';
import { TreeNode, MenuItem, TreeDragDropService } from 'primeng/api';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';

import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

// Services
import { ProjectStateService } from '../../services/project-state.service';
import { TreeNodeStyleService } from '../../services/treenode-style.service';
import { UserSettingsService } from '../../services/user-settings.service';

@Component({
    selector: 'aida-ia-table',
    imports: [FormsModule, CommonModule, TranslateModule,
        TreeModule, ContextMenuModule,
        InputTextModule, InputGroupModule, InputGroupAddonModule,
        ButtonModule, TooltipModule
    ],
    providers: [TreeDragDropService],
    templateUrl: './ia-table.component.html',
    styleUrl: './ia-table.component.css'
})
export class IaTableComponent {
    private projectState = inject(ProjectStateService);
    private treeNodeStyleService = inject(TreeNodeStyleService);
    private settingsService = inject(UserSettingsService);
    private locationStrategy = inject(LocationStrategy);
    projectTree = computed(() => this.projectState.getProject().projectData);

    constructor() {
        effect(() => {
            this.settingsService.darkMode(); // track dark mode changes
            this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
        });
    }

    async ngOnInit() {
        //Context menu
        this.options = [
            ...this.baseMenu
        ];
        this.baseHref = this.locationStrategy.getBaseHref();
        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
    }

    //REVIEW THESE FUNCTIONS
    onNodeClick(event: MouseEvent) {
        if (event.button === 0) {
            event.preventDefault();
        }
    }
    //Context menu
    @ViewChild('cm') cm!: ContextMenu;
    options: MenuItem[] = []; //options for editing chart nodes

    baseMenu: MenuItem[] = [
        {
            label: 'Edit label',
            icon: 'pi pi-pen-to-square',
            command: () => {
                this.editNode('label');
            }
        },
        {
            label: 'Edit url',
            icon: 'pi pi-link',
            command: () => {
                this.editNode('link');
            }
        },
        {
            separator: true
        },
        {
            label: 'Add child page',
            icon: 'pi pi-plus',
            command: () => {
                this.addChildNode();
            }
        },
        {
            label: 'Delete page',
            icon: 'pi pi-trash',
            disabled: true,
            command: () => {
                this.deleteNode();
            }
        },
        {
            separator: true
        },
        {
            label: 'Change template',
            icon: 'pi pi-sync',
            items: [
                {
                    label: 'Split into subway pattern',
                    icon: 'pi pi-sitemap',
                    command: () => {
                        this.addParentNode('subway');
                    }
                },
                {
                    label: 'Combine into single page',
                    icon: 'pi pi-file-check',
                    command: () => {
                        this.addParentNode('combine');
                    }
                },
            ]
        },
        {
            label: 'Change status',
            icon: 'pi pi-palette',
            items: [
                {
                    label: 'In-scope',
                    icon: 'pi pi-check text-green-500',
                    command: () => {
                        this.selectedNode.data.status.inScope = true;
                        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
                        this.selectedNode = null!;
                        this.projectState.setModifiedDate();
                    }
                },
                {
                    label: 'IA Orphan',
                    icon: 'pi pi-times text-red-500',
                    command: () => {
                        this.selectedNode.data.status.isOrphan = true;
                        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
                        this.selectedNode = null!;
                        this.projectState.setModifiedDate();
                    }
                },
                {
                    label: 'New page',
                    icon: 'pi pi-file-plus text-green-500',
                    command: () => {
                        this.selectedNode.data.status.isNew = true;
                        this.selectedNode.data.status.isMoved = false;
                        this.selectedNode.data.status.isROT = false;
                        this.selectedNode.data.status.isArchived = 'current';
                        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
                        this.selectedNode = null!;
                        this.projectState.setModifiedDate();
                    }
                },
                {
                    label: 'ROT',
                    icon: 'pi pi-trash text-red-500',
                    command: () => {
                        this.selectedNode.data.status.isROT = true
                        this.selectedNode.data.status.isNew = false;
                        this.selectedNode.data.status.isMoved = false;
                        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
                        this.selectedNode = null!;
                        this.projectState.setModifiedDate();
                    }
                },
                {
                    label: 'Page move',
                    icon: 'pi pi-arrow-right text-orange-500',
                    command: () => {
                        this.selectedNode.data.status.isMoved = true
                        this.selectedNode.data.status.isNew = false;
                        this.selectedNode.data.status.isROT = false;
                        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
                        this.selectedNode = null!;
                        this.projectState.setModifiedDate();
                    }
                },
                {
                    label: 'Portal link',
                    icon: 'pi pi-external-link text-blue-500',
                    command: () => {
                        this.selectedNode.data.status.linksToPortal = true;
                        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
                        this.selectedNode = null!;
                        this.projectState.setModifiedDate();
                    }
                },
                {
                    label: 'Archive',
                    icon: 'pi pi-exclamation-triangle text-orange-500',
                    command: () => {
                        const status = this.selectedNode.data.status.archiveStatus;
                        this.selectedNode.data.status.archiveStatus =
                            status === 'current' ? 'to-archive' :
                                status === 'to-archive' ? 'current' :
                                    status === 'archived' ? 'unarchive' :
                                        status === 'unarchive' ? 'archived' : status;
                        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
                        this.selectedNode = null!;
                        this.projectState.setModifiedDate();
                    }
                },
                {
                    separator: true
                },
                {
                    label: 'Reset status',
                    icon: 'pi pi-replay',
                    command: () => {
                        this.selectedNode.data.status.inScope = false;
                        this.selectedNode.data.status.iaOrphan = false;
                        this.selectedNode.data.status.isNew = false;
                        this.selectedNode.data.status.isMoved = false;
                        this.selectedNode.data.status.isROT = false;
                        this.selectedNode.data.status.linksToPortal = false;
                        this.selectedNode.data.status.archiveStatus = 'current';
                        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
                        this.selectedNode = null!;
                    }
                },
            ]
        },
        {
            separator: true
        },
        {
            label: 'Export to CSV',
            icon: 'pi pi-file-export',
            command: () => {
                this.projectState.exportTreeAsCsv();
            }
        },
        {
            separator: true
        },
        {
            label: 'Open page in page assistant',
            icon: 'pi pi-sparkles',
            disabled: true,
            command: () => {
                console.log('Open link in page assistant ', this.selectedNode)
                this.openInPageAssistant();
            }
        },
        {
            label: 'Open page in new tab',
            icon: 'pi pi-external-link',
            command: () => {
                console.log('Open link in new tab ', this.selectedNode)
                this.openNodeUrl();
            }
        },
    ]
    selectedNode!: TreeNode;
    draggable = true;
    selectable = true;

    //For tracking previous states
    editingNode: TreeNode | null = null;
    undoArray: { node: TreeNode; parent: TreeNode; index: number }[] = [];

    //for loading in page assistant
    baseHref: string | null = null;

    onNodeContextMenu(event: TreeNodeContextMenuSelectEvent) {
        if (this.editingNode) { //auto-save before switching
            this.editingNode.data.editing = null;
        }
        this.selectedNode = event.node;
        const isContainer = this.selectedNode.data.status.isContainer;

        this.options.forEach(item => {
            if (item.label === 'Open page in new page assistant') {
                item.disabled = true //disable until we add page assistant
            }
            if (item.label === 'Open page in new page assistant' || item.label === 'Open page in new tab') {
                item.disabled = !this.selectedNode?.data?.url?.trim(); //disable if no URL
            }
            if (item.label === 'Change template' || item.label === 'Change style') {
                item.disabled = isContainer; //disable if container
            }
        });
    }


    //Edit URL or H1
    editNode(mode: 'label' | 'link' = 'label') {
        if (this.selectedNode) {
            this.selectedNode.data.editing = mode;
            this.editingNode = this.selectedNode;
            this.draggable = false;
            this.selectable = false;
            // auto-focus on input
            setTimeout(() => {
                const input = document.querySelector<HTMLInputElement>('input.ia-label');
                input?.focus();
            });
        }
    }

    //Save changes to URL or H1
    saveNode() {
        if (this.selectedNode) {
            this.selectedNode.data.editing = null;
        }
        if (!this.selectedNode.data.url.endsWith('.html')) {
            this.selectedNode.data.url = this.selectedNode.data.url.replace(/\/$/, '') + '.html'; // add .html if missing
        }
        this.draggable = true;
        this.selectable = false;
        this.projectState.setModifiedDate();
    }

    //Handle keyboard events while editing URL or H1
    onInputKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            this.saveNode();
            event.stopPropagation();
            event.preventDefault();
        }
        if (event.key === ' ') {
            event.stopPropagation(); //allows space to work in tree
        }
    }

    addChildNode() {
        if (!this.selectedNode) return;

        // Ensure children array exists
        if (!this.selectedNode.children) {
            this.selectedNode.children = [];
        }

        const originalParent = this.selectedNode.data.url;
        const pathPrefix = originalParent.replace(".html", "/")

        // Create the new node
        const newNode: TreeNode = {
            label: 'New page',
            data: {
                h1: 'New page',
                url: pathPrefix,
                originalParent: originalParent,
                status: {
                    //Status
                    inScope: true,
                    isOrphan: true,
                    isNew: true,
                    isMoved: false,
                    isROT: false,
                    linksToPortal: false,
                    archiveStatus: 'current',
                }
            },
            children: []
        };

        // Push into parent
        this.selectedNode.children.push(newNode);

        // Expand parent so the new child is visible
        this.selectedNode.expanded = true;

        // Select the new node so the user can start editing
        this.selectedNode = newNode;
        this.editNode('label');

        this.updateMenu(); // refresh context menu, undo, etc.
        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0); // refresh styles

        // Trigger autosave
        this.projectState.setModifiedDate();
    }

    //Will be used to create a container to mark pages for template change
    addParentNode(action: 'subway' | 'combine') {
        if (!this.selectedNode) return;

        // Find the parent node and the array the selected node is in
        const findParent = (nodes: TreeNode[], parentNode?: TreeNode): { parentContainer: TreeNode[]; parentNode: TreeNode | null } | null => {
            for (const node of nodes) {
                if (node === this.selectedNode) {
                    return {
                        parentContainer: nodes, // found at this level
                        parentNode: parentNode ?? null,
                    };
                }
                if (node.children) {
                    const searchChildNodes = findParent(node.children, node);
                    if (searchChildNodes) return searchChildNodes;
                }
            }
            return null;
        };

        const location = findParent(this.projectTree() || []);
        if (!location) return; // if not found

        const { parentContainer, parentNode } = location;

        const label = action === 'subway' ? 'Split into subway pattern' : 'Combine into single page';

        //Create new parent node
        const newParentNode: TreeNode = {
            label: label,
            data: {
                h1: label,
                url: '',
                originalParent: parentNode?.data?.url ?? '',
                status: {
                    //Status
                    inScope: false,
                    isOrphan: false,
                    isNew: false,
                    isMoved: false,
                    isROT: false,
                    linksToPortal: false,
                    archiveStatus: 'current',
                    isContainer: true,
                }
            },
            expanded: true,
            children: [this.selectedNode]
        };

        // Replace the original node with the new parent node (which contains the original node as a child)
        const index = parentContainer.indexOf(this.selectedNode);
        if (index !== -1) {
            parentContainer.splice(index, 1, newParentNode);
        }

        // Make the new parent the selection
        this.selectedNode = newParentNode;

        // UI refresh
        this.updateMenu();
        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);

        // Trigger autosave
        this.projectState.setModifiedDate();
    }

    //TODO: if this was notOrphan, update crawl status of parent node so that this node can be rediscovered on crawl
    deleteNode() {
        if (!this.projectTree() || !this.selectedNode) return;

        const nodeToDelete = this.selectedNode;

        // Root-level (don't delete the root!!!)
        const rootIndex = this.projectTree().findIndex(n => n === nodeToDelete);
        if (rootIndex > -1) {
            console.warn('Cannot delete root node.');
            return;
        }

        // Child node
        const findAndDelete = (nodes: TreeNode[]): boolean => {
            for (const node of nodes) {
                const children: TreeNode[] = node.children ?? [];
                const childIndex = children.findIndex(c => c === nodeToDelete);
                if (childIndex > -1) {
                    this.undoArray.push({ node: nodeToDelete, parent: node, index: childIndex });
                    children.splice(childIndex, 1);
                    node.children = children.length ? children : undefined;
                    return true;
                }
                // recurse into grandchildren
                if (children.length && findAndDelete(children)) {
                    return true;
                }
            }
            return false;
        };

        findAndDelete(this.projectTree());
        this.updateMenu();
    }

    restoreNode() {
        if (this.undoArray.length === 0) return;

        const last = this.undoArray.pop()!;

        if (last.parent?.children) {
            last.parent.children.splice(last.index, 0, last.node);
        } else {
            console.warn('Cannot restore node: parent missing.');
            return;
        }

        this.selectedNode = last.node;
        if (!this.selectedNode.data.status.isContainer) {
            this.selectedNode.data.status.isROT = true;
            this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
        }
        this.updateMenu();
    }

    //Add undo option under delete if there is something to restore
    updateMenu() {
        this.options = [...this.baseMenu];

        const deleteIndex = this.options.findIndex(option => option.label === 'Delete page');

        if (this.undoArray.length > 0 && deleteIndex !== -1) {
            this.options.splice(deleteIndex + 1, 0, {
                label: 'Restore page',
                icon: 'pi pi-history',
                command: () => this.restoreNode()
            });
        }
    }

    //Open link in new tab
    openNodeUrl() {
        window.open(this.selectedNode.data.url, '_blank');
    }

    //Make share link a service so it can be used on both share.component.ts and here
    openInPageAssistant() {
        const baseUrl = (window.location.origin + this.baseHref).replace(/\/+$/, '');
        const urlParam = encodeURIComponent(this.selectedNode.data.url);
        const shareLink = `${baseUrl}/page-assistant/share?url=${urlParam}`;
        console.log('Open in page assistant: ', shareLink);
        window.open(shareLink, '_blank');
    }

    // Page moves
    handleNodeDrop(event: TreeNodeDropEvent): void {
        const dragNode = event.dragNode;
        const dropNode = event.dropNode;

        if (!dragNode || !dropNode) return;

        // Prevent dropping containers into containers (not foolproof)
        if ((dropNode.data.status.isContainer || dropNode.parent?.data?.status.isContainer) && dragNode.data.status.isContainer) return;
        event.accept?.(); // accept the drop       

        // Save initial move status so we can compare and trigger a project save
        const moveStatus = dragNode.data.status.isMoved

        //Get target element
        const targetEl = event.originalEvent?.target as HTMLElement;
        const tag = targetEl.tagName.toLowerCase(); // will be <a> or <div> if dropped on a node or <li> if dropped between nodes
        const droppedOnNode: boolean = tag !== 'li'

        //Check for changes to IA structure
        const dragParentUrl = dragNode.data.originalParent; //parentUrl is the original parent before any changes

        const dropUrl = dropNode.data.url;
        const dropParentUrl = dropNode.parent?.data?.url ?? '';
        const dropGrandparentUrl = dropNode.parent?.data?.originalParent ?? '';

        const droppedOnParent = droppedOnNode && dragParentUrl === dropUrl;
        const reorderedSiblings = !droppedOnNode && dragParentUrl === dropParentUrl;

        //Check if dropping sibling onto a container
        const droppedOnContainerSibling = dropNode.data.status.isContainer && droppedOnNode && dragParentUrl === dropParentUrl;
        const droppedBetweenContainerSibling = dropNode.parent?.data?.status.isContainer && !droppedOnNode && dragParentUrl === dropGrandparentUrl;

        //Set isMoved status when not reordering siblings, moving siblings into a template container, or moving containers or new pages
        if (!(droppedOnParent || reorderedSiblings || droppedOnContainerSibling || droppedBetweenContainerSibling || dragNode.data.status.isContainer || dragNode.data.status.isNew)) {
            dragNode.data.status.isMoved = true;
        }
        else { dragNode.data.status.isMoved = false; }

        //Update project if move status has changed
        if (moveStatus !== dragNode.data.status.isMoved) {
            this.projectState.setModifiedDate();
        }

        //Cleanup hover effect if hovering on parent but dropping between parent and top child      
        document.querySelectorAll('.p-tree-node-dragover').forEach((el) => {
            el.classList.remove('p-tree-node-dragover');
        });
        //Update styles
        this.treeNodeStyleService.updateNodeStyles(this.projectTree(), 0);
    }

}