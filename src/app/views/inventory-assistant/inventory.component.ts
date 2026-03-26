import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

//PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';
import { TooltipModule } from 'primeng/tooltip';
import { ToolbarModule } from 'primeng/toolbar';
import { IftaLabelModule } from 'primeng/iftalabel';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TagModule } from 'primeng/tag';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService } from 'primeng/api';
import { RadioButtonModule } from 'primeng/radiobutton';
import { MenuModule } from 'primeng/menu';
import { MenuItem } from 'primeng/api';

//Components and models
import { ExportProjectComponent } from '../../components/export-project/export-project.component';
import { AddPagesComponent } from '../../components/add-pages/add-pages.component';
import { FlattenedTreeNode, TableColumn, COLUMN_GROUPS, FIELD_FILTERS } from '../../common/data.model';
import { IaTableComponent } from '../../components/ia-table/ia-table.component';
import { InventoryPrompts } from '../../common/prompts/inventory.prompts';
import { InventoryPromptKey } from '../../common/prompts/prompt.model';

//Services
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from '../../components/ia-diagram/ia-diagram.service';
import { FindPagesComponent } from "../../components/find-pages/find-pages.component";
import { OpenRouterService, OpenRouterResponse } from '../../services/ai/openrouter.service';
import { FetchService } from '../../services/fetch.service';

import { environment } from '../../../environments/environment';

interface ViewOption {
    key: string;
    value: string;
    icon: string;
}

@Component({
    selector: 'aida-inventory',
    imports: [CommonModule, FormsModule, TranslateModule,
        TableModule, ButtonModule, PopoverModule, TooltipModule,
        ToolbarModule, IftaLabelModule, MultiSelectModule, SelectButtonModule, MenuModule,
        TagModule, ToggleButtonModule, ConfirmDialogModule,
        RadioButtonModule,
        ExportProjectComponent, AddPagesComponent, FindPagesComponent, IaTableComponent],
    templateUrl: './inventory.component.html',
    styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
    public projectState = inject(ProjectStateService);
    public translate = inject(TranslateService);
    private confirmationService = inject(ConfirmationService);
    public openRouterService = inject(OpenRouterService);
    private fetchService = inject(FetchService);
    iaDiagram = inject(IaDiagramService);

    production = environment.production;

    // Signals
    columnFilters = signal<Record<string, boolean>>({
        inScope: true,  // Default filter applied
        anyUnusual: false
    });
    resetFilters(): void {
        this.columnFilters.set({
            inScope: true  // Reset to default state
        });
    }

    hasActiveFilters(): boolean {
        const filters = this.columnFilters();
        const activeFilterCount = Object.values(filters).filter(v => v === true).length;
        return activeFilterCount > 1 || !filters['inScope']; // Checks for filters other than inScope
    }

    // All table columns
    allColumns = this.projectState.getTreeTableColumns();
    // Visible table columns
    frozenColumns: TableColumn[] = [];
    scrollableColumns: TableColumn[] = [];

    // Groups
    columnGroups = COLUMN_GROUPS;
    fieldFilters = FIELD_FILTERS;

    // Current selections
    selectedNodes: FlattenedTreeNode[] = [] // Flattened TreeNode data (for delete, status toggles, etc.)
    selectedColumnFields: string[] = []; // Multiselect column data
    selectedGroups: string[] = []; // Multiselect group data
    unselectedGroups: string[] = []; // Multiselect group data
    expandedMetadataCells = new Set<string>(); // Tracks which individual metadata cells are expanded

    // Booleans
    expandAllMetadata = false;
    expandAllUrls = false;
    expandAllTasks = false;

    // Local storage key for loading previous table settings
    private readonly COLUMN_KEY = 'inventoryColumnVisibility';
    private readonly GROUP_KEY = 'inventoryGroupVisibility';

    // Update column visibility on first load
    ngOnInit() {
        this.loadColumnVisibility(); // Loads previous settings
        this.updateVisibleColumns(); // Updates table
    }

    // Multiselect - groups
    get groups() {
        return this.columnGroups.map(groupKey => ({
            label: this.translate.instant(`inventory.columnGroups.${groupKey}`),
            value: groupKey,
        }));
    }

    private markForTranslation() {
        marker('inventory.columnGroups.page');
        marker('inventory.columnGroups.oppPage');
        marker('inventory.columnGroups.github');
        marker('inventory.columnGroups.status');
        marker('inventory.columnGroups.problems');
        marker('inventory.columnGroups.pageData');
        marker('inventory.columnGroups.owner');
        marker('inventory.columnGroups.metadata');
        marker('inventory.view.table');
        marker('inventory.view.tree');
        marker('inventory.tooltip.boolean.inScope.true');
        marker('inventory.tooltip.boolean.inScope.false');
        marker('inventory.tooltip.boolean.isOrphan.true');
        marker('inventory.tooltip.boolean.isOrphan.false');
        marker('inventory.tooltip.boolean.isNew.true');
        marker('inventory.tooltip.boolean.isNew.false');
        marker('inventory.tooltip.boolean.isMoved.true');
        marker('inventory.tooltip.boolean.isMoved.false');
        marker('inventory.tooltip.boolean.isROT.true');
        marker('inventory.tooltip.boolean.isROT.false');
        marker('inventory.tooltip.boolean.linksToPortal.true');
        marker('inventory.tooltip.boolean.linksToPortal.false');
        marker('inventory.tooltip.archive.current');
        marker('inventory.tooltip.archive.to-archive');
        marker('inventory.tooltip.archive.archived');
        marker('inventory.tooltip.archive.unarchive');
        marker('inventory.tooltip.noindex.none');
        marker('inventory.tooltip.noindex.en-only');
        marker('inventory.tooltip.noindex.fr-only');
        marker('inventory.tooltip.noindex.both');
    }

    // Multiselect - column groups
    get groupedColumns() {
        const allGroups = this.columnGroups;
        const groups = allGroups.filter(g => this.selectedGroups.includes(g));

        return groups.map(groupKey => ({
            label: this.translate.instant(`inventory.columnGroups.${groupKey}`),
            value: groupKey,
            items: this.allColumns
                .filter(col => col.group === groupKey && !col.frozen) // exclude frozen from selection (frozen = always visible)
                .map(col => ({
                    label: this.translate.instant(col.translationKey),
                    value: col.field
                }))
        }));
    }

    // Multiselect - selection change handler
    onColumnSelectionChange() {
        this.updateVisibleColumns();
        this.saveColumnVisibility();
        this.syncSelectedGroups();
    }

    // Select Button - column group toggles
    get columnGroupButtons() {
        return this.columnGroups.map(groupKey => ({
            value: groupKey,
            icon: this.getGroupIcon(groupKey),
            tooltip: this.translate.instant(`inventory.columnGroups.${groupKey}`)
        }));
    }

    get columnMaterialButtons() {
        return this.columnGroups.map(groupKey => ({
            value: groupKey,
            icon: this.getMaterialIcon(groupKey),
            tooltip: this.translate.instant(`inventory.columnGroups.${groupKey}`)
        }));
    }

    // Select Button - get icon for each group
    private getGroupIcon(group: string): string {
        const iconMap: Record<string, string> = {
            page: 'pi-file-check',
            oppPage: 'pi-language',
            github: 'pi-github',
            status: 'pi-list-check',
            owner: 'pi-users',
            pageData: 'pi-chart-line',
            metadata: 'pi-tags'
        };
        return iconMap[group] || 'pi-circle';
    }

    private getMaterialIcon(group: string): string {
        const iconMap: Record<string, string> = {
            page: 'link',
            oppPage: 'language',
            github: 'design_services',
            status: 'checklist',
            owner: 'person_search',
            pageData: 'insights',
            metadata: 'grading'
        };
        return iconMap[group] || 'checklist';
    }

    // Select Button - selection change handler
    onGroupSelectionChange() {
        this.selectedColumnFields = this.allColumns
            .filter(col => !col.frozen && this.selectedGroups.includes(col.group))
            .map(col => col.field);

        console.log('selectedColumnFields after filter:', this.selectedColumnFields);
        console.log('All columns:', this.allColumns.map(col => ({ field: col.field, group: col.group })));
        this.updateVisibleColumns();
        this.saveColumnVisibility();
        console.log(this.selectedGroups)
    }


    // Local storage - load column visibility settings (for multiselect dropdown)
    private loadColumnVisibility() {
        const storedColumns = localStorage.getItem(this.COLUMN_KEY);
        const storedGroups = localStorage.getItem(this.GROUP_KEY);
        if (storedColumns && storedGroups) {
            this.selectedGroups = JSON.parse(storedGroups);
            this.selectedColumnFields = JSON.parse(storedColumns);
        } else {
            // Use default values
            this.selectedColumnFields = this.allColumns
                .filter(col => col.visibleByDefault && !col.frozen) //We exclude frozen here since visibility is not toggleable for those
                .map(col => col.field);
        }
        // Sync selected groups from selected fields
        this.syncSelectedGroups();
    }

    // Local storage, multiselect & select button - sync column visibility settings to groups (for select button)
    private syncSelectedGroups() {
        const groupMembers = new Map<string, string[]>();
        this.allColumns
            .filter(col => !col.frozen)
            .forEach(col => {
                if (!groupMembers.has(col.group)) {
                    groupMembers.set(col.group, []);
                }
                groupMembers.get(col.group)!.push(col.field);
            });

        console.log('groupMembers map:', Object.fromEntries(groupMembers));
        console.log('selectedColumnFields:', this.selectedColumnFields);

        //Fully selected groups
        this.selectedGroups = Array.from(groupMembers.entries())
            .filter(([group, fields]) => {
                const hasAnySelected = fields.some(field =>
                    this.selectedColumnFields.includes(field)
                );
                return hasAnySelected;
            })
            .map(([group]) => group);

        console.log('syncSelectedGroups result:', this.selectedGroups);
    }

    // Local storage - save column visibility settings
    private saveColumnVisibility() {
        localStorage.setItem(this.COLUMN_KEY, JSON.stringify(this.selectedColumnFields));
        localStorage.setItem(this.GROUP_KEY, JSON.stringify(this.selectedGroups));
    }

    // Table - get current data
    tableData = computed<FlattenedTreeNode[]>(() => {
        const allNodes = this.projectState.flattenTree();
        const filters = this.columnFilters();
        return allNodes.filter(node => {
            if (filters['anyUnusual']) {
                const hasAnyUnusual = this.fieldFilters.some(field => {
                    if (field === 'archiveStatus') return node[field] !== 'current';
                    if (field === 'noindex') return node[field] !== 'none';
                    return node[field as keyof FlattenedTreeNode] === true;
                });
                if (!hasAnyUnusual) return false;
            }
            return Object.entries(filters).every(([field, filterValue]) => {
                if (field === 'anyUnusual') return true; // Skip, not an actual column
                if (!filterValue) return true; // Filter inactive
                if (field === 'archiveStatus') { return node[field] !== 'current'; } // Special handling for archive field
                if (field === 'noindex') { return node[field] !== 'none'; } // Special handling for noindex field                             
                return node[field as keyof FlattenedTreeNode] === true; // Boolean filters - show only true values
            });
        });
    });

    // Table - returns the value of a cell (used by getBooleanIcon)
    getCellValue(node: FlattenedTreeNode, col: TableColumn): boolean {
        return node[col.field] as boolean;
    }

    // Table - map status booleans to icons
    getBooleanIcon(value: boolean, field: string): string {
        const iconMap: Record<string, { true: string; false: string }> = {
            inScope: { true: 'pi-check text-green-500', false: 'pi-minus text-gray-400' },
            isOrphan: { true: 'pi-times text-red-500', false: 'pi-minus text-gray-400' },
            isNew: { true: 'pi-plus text-blue-500', false: 'pi-minus text-gray-400' },
            isMoved: { true: 'pi-arrow-right text-orange-500', false: 'pi-minus text-gray-400' },
            isROT: { true: 'pi-trash text-red-500', false: 'pi-minus text-gray-400' },
            linksToPortal: { true: 'pi-external-link text-blue-500', false: 'pi-minus text-gray-400' },
        };

        const fieldIcons = iconMap[field];
        if (fieldIcons) {
            return 'pi ' + fieldIcons[String(value) as 'true' | 'false'];
        }
        return 'pi pi-minus text-gray-400';
    }

    getBooleanTooltip(value: boolean, field: string): string {
        return `inventory.tooltip.boolean.${field}.${value}`;
    }

    getArchiveStatusIcon(node: FlattenedTreeNode, col: TableColumn): string {
        const status = node[col.field];
        switch (status) {
            case 'current':
                return 'pi pi-minus text-gray-400';
            case 'to-archive':
                return 'pi pi-exclamation-circle text-blue-500';
            case 'archived':
                return 'pi pi-exclamation-triangle text-orange-500';
            case 'unarchive':
                return 'pi pi-plus-circle text-green-500';
            default:
                return 'pi pi-minus text-gray-400'; // fallback
        }
    }

    getArchiveStatusTooltip(node: FlattenedTreeNode, col: TableColumn): string {
        return `inventory.tooltip.archive.${node[col.field]}`;
    }

    getNoIndexIcon(node: FlattenedTreeNode, col: TableColumn): string {
        const status = node[col.field];
        switch (status) {
            case 'none':
                return 'pi pi-minus text-gray-400';
            case 'en-only':
                return 'pi pi-exclamation-circle text-red-500';
            case 'fr-only':
                return 'pi pi-exclamation-triangle text-red-500';
            case 'both':
                return 'pi pi-android text-orange-500';
            default:
                return 'pi pi-minus text-gray-400'; // fallback
        }
    }

    getNoIndexTooltip(node: FlattenedTreeNode, col: TableColumn): string {
        return `inventory.tooltip.noindex.${node[col.field]}`;
    }

    // Table - update visible columns & check if metadata should autoexpand
    private updateVisibleColumns() {
        this.frozenColumns = this.allColumns.filter(col => col.frozen);
        this.scrollableColumns = this.allColumns.filter(col => this.selectedColumnFields.includes(col.field));
        this.checkAutoExpandMetadata();
        this.checkAutoExpandUrls();
        this.checkAutoExpandTasks();
    }

    // Table - autoexpand metadata when it's the only visible group (NOT WORKING!)
    private checkAutoExpandMetadata() {
        const selectedGroups = new Set(this.scrollableColumns.map(col => col.group));
        this.expandAllMetadata = selectedGroups.size === 1 && selectedGroups.has('metadata');
    }

    // Table - autoexpand urls when it's the only visible type (NOT WORKING!)
    private checkAutoExpandUrls() {
        const selectedTypes = new Set(this.scrollableColumns.map(col => col.type));
        this.expandAllUrls = selectedTypes.size === 1 && selectedTypes.has('url');
    }

    // Table - autoexpand tasks when pageData is the only visible type (NOT WORKING!)
    private checkAutoExpandTasks() {
        const selectedGroups = new Set(this.scrollableColumns.map(col => col.group));
        this.expandAllTasks = selectedGroups.size === 1 && selectedGroups.has('pageData');
    }

    // Table - check if metadata cell is expanded
    isMetadataExpanded(rowIndex: number, field: string): boolean {
        return this.expandAllMetadata || this.expandedMetadataCells.has(`${rowIndex}-${field}`);
    }

    // Table - toggle individual metadata cell expansion
    toggleMetadataCell(rowIndex: number, field: string) {
        const key = `${rowIndex}-${field}`;
        if (this.expandedMetadataCells.has(key)) {
            this.expandedMetadataCells.delete(key);
        } else {
            this.expandedMetadataCells.add(key);
        }
    }

    // Button - toggle expand/collapse for all metadata
    toggleExpandAllMetadata() {
        this.expandAllMetadata = !this.expandAllMetadata;
        if (this.expandAllMetadata) {
            this.expandedMetadataCells.clear(); // Clear individual expansions when expanding all
        }
    }

    // Table - check if any metadata columns are visible
    hasVisibleMetadata(): boolean {
        return this.scrollableColumns.some(col => col.group === 'metadata');
    }

    onDeleteSelected() {
        if (!this.selectedNodes.length) return;
        const additionalDeletions = this.projectState.checkDeletionImpact(this.selectedNodes);
        if (additionalDeletions.length > 0) {
            this.showDeletionConfirmation(this.selectedNodes.length, additionalDeletions);
        } else {
            this.confirmationService.confirm({
                key: 'inventory',
                message: `Delete ${this.selectedNodes.length} page(s)?`,
                header: 'Confirm Deletion',
                icon: 'pi pi-exclamation-circle',
                acceptIcon: 'pi pi-trash',
                acceptLabel: 'Delete',
                rejectLabel: 'Cancel',
                acceptButtonStyleClass: 'p-button-danger',
                rejectButtonStyleClass: 'p-button-secondary',
                accept: () => {
                    this.projectState.deleteNode(this.selectedNodes, true);
                    this.selectedNodes = [];
                }
            });
        }
    }

    private showDeletionConfirmation(deleteCount: number, additionalPages: { url: string, h1: string, inScope: boolean }[]) {
        const inScopeCount = additionalPages.filter(p => p.inScope).length;
        const inScopeList = additionalPages
            .filter(p => p.inScope)
            .map(p => `${p.h1}`)
            .join('<br>');
        const baselineCount = additionalPages.filter(p => !p.inScope).length;
        const baselineList = additionalPages
            .filter(p => !p.inScope)
            .map(p => `${p.h1}`)
            .join('<br>');
        const message = `
        <p class="mt-0">Deleting ${deleteCount} page(s) will also remove ${additionalPages.length} child page(s).</p>
        ${inScopeCount > 0 ? `
        <p>${inScopeCount > 0 ? `${inScopeCount} in-scope page(s) will be affected!` : ''}</p>
        <h2>Delete these in-scope pages?</h2>
        <p>${inScopeList}</p>
        ` : ''}
        ${baselineCount > 0 ? `
        <h2>Delete these baseline pages?</h2>
        <p>${baselineList}</p>
        ` : ''}
    `.trim();

        this.confirmationService.confirm({
            key: 'inventory',
            message,
            header: 'Confirm Deletion',
            icon: 'pi pi-exclamation-triangle',
            acceptIcon: 'pi pi-trash',
            acceptLabel: 'Delete',
            rejectLabel: 'Cancel',
            acceptButtonStyleClass: 'p-button-danger',
            rejectButtonStyleClass: 'p-button-secondary',
            accept: () => {
                this.projectState.deleteNode(this.selectedNodes, true);
                this.selectedNodes = []; // Clear selection after delete
            }
        });
    }

    //Reset to default view
    resetColumnSettings() {
        localStorage.removeItem('inventoryColumnVisibility');
        localStorage.removeItem('inventoryGroupVisibility');

        // Reset to defaults
        this.selectedColumnFields = this.allColumns
            .filter(col => col.visibleByDefault && !col.frozen)
            .map(col => col.field);

        this.syncSelectedGroups();
        this.updateVisibleColumns();

        console.log('Column settings reset to defaults');
    }

    //Metadata view
    viewMetadata() {
        localStorage.removeItem('inventoryColumnVisibility');
        localStorage.removeItem('inventoryGroupVisibility');
        this.selectedColumnFields = this.allColumns
            .filter(col => col.group === 'metadata')
            .map(col => col.field);
        this.syncSelectedGroups();
        this.updateVisibleColumns();
    }


    //View settings
    views: ViewOption[] = [
        { key: 'inventory.view.table', value: 'table', icon: '' },
        { key: 'inventory.view.tree', value: 'tree', icon: '' },
    ];

    // Get column group headings (includes frozen)
    get groupedHeaders() {
        const allGroups = this.columnGroups;
        const groups = allGroups.filter(g => {
            const hasFrozenColumns = this.allColumns.some(col => col.group === g && col.frozen);
            return this.selectedGroups.includes(g) || hasFrozenColumns;
        });

        return groups.map(groupKey => ({
            label: this.translate.instant(`inventory.columnGroups.${groupKey}`),
            value: groupKey,
            // Include ALL columns (frozen + non-frozen) for header span calculation
            items: this.allColumns
                .filter(col => col.group === groupKey)
                .map(col => ({
                    label: this.translate.instant(col.translationKey),
                    value: col.field
                }))
        }));
    }

    // Count visible columns in group (including frozen)
    getVisibleColumnCount(group: any): number {
        return group.items.filter((item: any) => {
            const col = this.allColumns.find(c => c.field === item.value);
            return col?.frozen || this.selectedColumnFields.includes(item.value);
        }).length;
    }

    // For column borders
    isLastInGroup(field: string): boolean {
        // Find which group this column belongs to
        const group = this.groupedHeaders.find(g =>
            g.items.some((item: any) => item.value === field)
        );

        if (!group) return false;

        // Get visible columns in this group
        const visibleInGroup = group.items
            .filter((item: any) => {
                const col = this.allColumns.find(c => c.field === item.value);
                return col?.frozen || this.selectedColumnFields.includes(item.value);
            })
            .map((item: any) => item.value);

        // Check if this is the last visible column
        const isLast = visibleInGroup[visibleInGroup.length - 1] === field;

        // Don't add border after the very last group
        const isLastGroup = this.groupedHeaders[this.groupedHeaders.length - 1].value === group.value;

        return isLast && !isLastGroup;
    }

    // Track which boolean columns are filtered
    isColumnFiltered(field: string): boolean {
        return this.columnFilters()[field] || false;
    }

    toggleColumnFilter(field: string): void {
        this.columnFilters.update(current => ({
            ...current,
            [field]: !current[field]
        }));
    }

    toggleFlaggedFilter(): void {
        this.columnFilters.set({
            inScope: this.columnFilters()['anyUnusual'],
            anyUnusual: !this.columnFilters()['anyUnusual']
        });
    }

    // AI metadata generation
    async generateMetadata(mode: "live" | "prototype" = "live") {
        if (!this.selectedNodes.length) return;

        for (const node of this.selectedNodes) {
            // Set URLs to fetch
            let enUrl: string | null = null;
            let frUrl: string | null = null;
            if (mode === "prototype") {
                enUrl = node.prototypeUrl.includes('/en/') ? node.prototypeUrl : null;
                frUrl = node.prototypeUrl.includes('/fr/') ? node.prototypeUrl : null;
            } else {
                enUrl = node.url.includes('/en/') ? node.url : node.oppUrl;
                frUrl = node.url.includes('/fr/') ? node.url : node.oppUrl;
            }

            if (!enUrl && !frUrl) {
                console.warn(`Skipping ${node.url} — missing EN & FR URLs`);
                continue;
            }

            // Fetch main content
            let enMain: string | null = null;
            let frMain: string | null = null;
            try {
                if (enUrl) {
                    const enDoc = await this.fetchService.fetchContent(enUrl, 'prod', 3, 'none', true);
                    enMain = enDoc.querySelector('main')?.innerHTML ?? enDoc.body.innerHTML;
                }
                if (frUrl) {
                    const frDoc = await this.fetchService.fetchContent(frUrl, 'prod', 3, 'none', true);
                    frMain = frDoc.querySelector('main')?.innerHTML ?? frDoc.body.innerHTML;
                }
            } catch (error) {
                console.warn(`Skipping ${node.url} — fetch failed`, error);
                continue;
            }

            // Build context for the AI
            const context = {
                en: {
                    url: enUrl,
                    existingDescription: node.descriptionEN,
                    existingKeywords: node.keywordsEN,
                    content: enMain,
                },
                fr: {
                    url: frUrl,
                    existingDescription: node.descriptionFR,
                    existingKeywords: node.keywordsFR,
                    content: frMain,
                }
            };

            // Call OpenRouter
            let response: string;
            try {
                response = await this.openRouterService.getTextFromAI(
                    InventoryPrompts[InventoryPromptKey.Metadata],
                    JSON.stringify(context)
                );
            } catch (error) {
                console.warn(`Skipping ${node.url} — AI call failed`, error);
                continue;
            }

            // Parse and merge into tree
            try {
                const parsed = JSON.parse(response);
                this.projectState.setMetadataReview(node.url, {
                    generatedAt: new Date(),
                    model: this.openRouterService.state().respondingModel ?? 'unknown',
                    en: {
                        description: { ai: parsed.en.description, status: 'pending' },
                        keywords: { ai: parsed.en.keywords, status: 'pending' },
                    },
                    fr: {
                        description: { ai: parsed.fr.description, status: 'pending' },
                        keywords: { ai: parsed.fr.keywords, status: 'pending' },
                    },
                });
            } catch (error) {
                console.warn(`Skipping ${node.url} — could not parse AI response`, error);
                continue;
            }

        }
    }

    async refreshData(mode: 'status' | 'problems' | 'data' | 'owner' | 'metadata' | 'all') {
        if (!this.selectedNodes.length) return;

        for (const node of this.selectedNodes) {
            this.projectState.refreshData(node.url, node.oppUrl, 'all');
        }
    }

    //Secondary toolbar dropdowns
    itemsRefresh: MenuItem[] = [];
    updateRefreshMenu() {
        this.itemsRefresh = [
            {
                label: this.translate.instant('inventory.menu.refresh'),
                items: [
                    {
                        label: this.translate.instant('inventory.menu.refresh.all'),
                        icon: 'pi pi-refresh',
                        command: () => {
                            this.refreshData('all')
                        }
                    },
                ]
            },
            {
                label: this.translate.instant('inventory.menu.refresh.group'),
                items: [
                    {
                        label: this.translate.instant('inventory.menu.refresh.status'),
                        icon: 'pi pi-refresh',
                        command: () => {
                            this.refreshData('status')
                        }
                    },
                    {
                        label: this.translate.instant('inventory.menu.refresh.problems'),
                        icon: 'pi pi-refresh',
                        disabled: true,
                        command: () => {
                            this.refreshData('problems')
                        }
                    },
                    {
                        label: this.translate.instant('inventory.menu.refresh.data'),
                        icon: 'pi pi-refresh',
                        command: () => {
                            this.refreshData('data')
                        }
                    },
                    {
                        label: this.translate.instant('inventory.menu.refresh.owner'),
                        icon: 'pi pi-refresh',
                        command: () => {
                            this.refreshData('owner')
                        }
                    },
                    {
                        label: this.translate.instant('inventory.menu.refresh.metadata'),
                        icon: 'pi pi-refresh',
                        command: () => {
                            this.refreshData('metadata')
                        }
                    },
                ]
            }
        ]
    }
    itemsStatus: MenuItem[] = []
    updateStatusMenu() {
        this.itemsStatus = [
            {
                label: this.translate.instant('inventory.menu.status.filter'),
                items: [
                    {
                        label: this.columnFilters()['anyUnusual']
                            ? this.translate.instant('inventory.menu.status.filter.remove')
                            : this.translate.instant('inventory.menu.status.filter.add'),
                        icon: this.columnFilters()['anyUnusual']
                            ? 'pi pi-filter'
                            : 'pi pi-filter-slash',
                        command: () => {
                            this.toggleFlaggedFilter();
                        }
                    },
                    {
                        label: this.translate.instant('inventory.menu.status.filter.reset'),
                        icon: 'pi pi-filter-slash',
                        command: () => {
                            this.resetFilters()
                        },
                        disabled: !this.hasActiveFilters()
                    },
                ]
            },
        ];
    };

    itemsMetadata: MenuItem[] = [];
    updateMetadataMenu() {
        this.itemsMetadata = [
            {
                label: this.translate.instant('inventory.menu.metadata'),
                items: [
                    {
                        label: this.translate.instant('inventory.menu.metadata.generate'),
                        icon: 'pi pi-sparkles',
                        command: () => {
                            this.generateMetadata()
                        }
                    },
                    {
                        label: this.expandAllMetadata
                            ? this.translate.instant('inventory.menu.metadata.collapseAll')
                            : this.translate.instant('inventory.menu.metadata.expandAll'),
                        icon: this.expandAllMetadata ? 'pi pi-minus' : 'pi pi-plus',
                        command: () => {
                            this.toggleExpandAllMetadata()
                        },
                        disabled: !this.hasVisibleMetadata()
                    },
                ]
            },
        ];
    }

    itemsDelete: MenuItem[] = [];
    updateDeleteMenu() {
        this.itemsDelete = [
            {
                label: this.translate.instant('inventory.menu.delete'),
                items: [
                    {
                        label: this.translate.instant('inventory.menu.delete.selected'),
                        icon: 'pi pi-trash',
                        severity: this.selectedNodes.length === 0
                            ? ''
                            : 'danger',
                        disabled: this.selectedNodes.length === 0,
                        command: () => {
                            this.onDeleteSelected()
                        }
                    },
                ]
            },
        ];
    }
}