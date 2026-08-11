import { Component, OnInit, inject, effect, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

//PrimeNG Modules
import { TableModule, Table } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { IftaLabelModule } from 'primeng/iftalabel';
import { MultiSelectModule } from 'primeng/multiselect';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { RadioButtonModule } from 'primeng/radiobutton';
import { MenuModule } from 'primeng/menu';
import { ConfirmationService, MenuItem, SortEvent, TreeNode, SelectItemGroup, SelectItem } from 'primeng/api';
import { ContextMenuModule, ContextMenu } from 'primeng/contextmenu';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { DialogModule } from 'primeng/dialog';

//Components and models
import { ExportProjectComponent } from '../../../components/export-project/export-project.component';
import { AddUrlsComponent } from '../../../components/add-urls/add-urls.component';
import { FlattenedTreeNode, TreeNodeTypes, TreeNodeData, TableColumn, COLUMN_GROUPS, FIELD_FILTERS, PageTemplate, MetadataField, MetadataReviewStatus, MetadataReview, ColumnGroups } from '../../../common/data.model';
import { IaTableComponent } from '../../../components/ia-table/ia-table.component';
import { InventoryPrompts } from '../../../common/prompts/inventory.prompts';
import { InventoryPromptKey } from '../../../common/prompts/prompt.model';
import { EditNodeComponent } from '../../../components/edit-node/edit-node.component';

//Services
import { ProjectStateService } from '../../../services/project-state.service';
import { IaDiagramService } from '../../../components/ia-diagram/ia-diagram.service';
import { FindPagesComponent } from "../../../components/find-pages/find-pages.component";
import { OpenRouterService } from '../../../services/ai/openrouter.service';
import { FetchService } from '../../../services/fetch.service';
import { isKnownNumber } from '../../../common/phone-numbers.config';

@Component({
    selector: 'aida-inventory',
    imports: [CommonModule, FormsModule, TranslatePipe,
        TableModule, TooltipModule, TagModule,
        ButtonModule, RadioButtonModule, IftaLabelModule, MultiSelectModule, SelectModule, TextareaModule,
        MenuModule, ContextMenuModule, ConfirmDialogModule, DialogModule,
        ExportProjectComponent, IaTableComponent, EditNodeComponent, AddUrlsComponent, FindPagesComponent],
    templateUrl: './inventory.component.html',
    styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
    public projectState = inject(ProjectStateService);
    public translate = inject(TranslateService);
    private confirmationService = inject(ConfirmationService);
    public openRouterService = inject(OpenRouterService);
    private fetchService = inject(FetchService);
    public iaDiagram = inject(IaDiagramService);

    // Variables
    lang = this.projectState.detectPrimaryLanguage();
    github = this.projectState.getProject().github;

    // Effects
    constructor() {
        effect(() => {
            this.allColumns(); // track the signal
            this.updateVisibleColumns();
        });
    }

    @ViewChild('dt') dt!: Table;
    @ViewChild('menuContext') menuContext!: ContextMenu;

    // Variables
    allColumns = computed(() => this.projectState.treeTableColumns()); // All table columns
    frozenColumns = signal<TableColumn[]>([]); // Visible table columns
    scrollableColumns = signal<TableColumn[]>([]); // Visible table columns

    public selectedNodes: FlattenedTreeNode[] = [] // Flattened TreeNode data (for bulk actions - refresh, generate metadata, delete etc.)

    public selectedColumnFields: string[] = []; // Multiselect column data
    public selectedGroups: string[] = []; // Multiselect group data

    private currentEditNode: FlattenedTreeNode | undefined; // Flattened TreeNode data (for individual actions - edit node, context menus etc.)
    private currentEditCol: TableColumn | undefined; // Table column (for determining which field is being edited or accessing other column properties)
    isEditing = false // Tracks if currently making inline edits

    private touchTimer: ReturnType<typeof setTimeout> | null = null; // Touch is alternative to right click for mobile cibtext menus

    editNode = false; // Tracks if currently making dialog edits
    selectedNode: TreeNode = {}; // TreeNode data for edit node dialog (not flattened!)

    sortField = signal<string | null>(null);
    sortOrder = signal<number>(1); // 1 = ascending, -1 = descending
    lastSortField: string | null = null;
    lastSortOrder: number | null = null;

    private readonly COLUMN_KEY = 'inventoryColumnVisibility'; // Local storage key for loading previous table settings
    private readonly GROUP_KEY = 'inventoryGroupVisibility'; // Local storage key for loading previous table settings

    expandAll: Record<string, boolean> = { metadata: false, notes: false, task: false, phoneNumbers: false, enVanity: false, frVanity: false }; // Tracks "expand all" state per group
    expandedCells: Record<string, Set<string>> = { metadata: new Set(), notes: new Set(), task: new Set(), phoneNumbers: new Set(), enVanity: new Set(), frVanity: new Set() }; // Tracks individual cell expansion per group  

    fieldFilters = FIELD_FILTERS; // Fields that are filterable
    columnFilters = signal<Record<string, boolean>>({ inScope: true, anyUnusual: false }); // Tracks preset filter statuses

    itemsContext: MenuItem[] = []; // context menu items (dynamically built)
    itemsDropdown: MenuItem[] = []; // dropdown menu items (dynamically built)

    /***********************************************************/

    // Update column visibility on first load
    ngOnInit() {
        this.loadColumnVisibility(); // Loads previous settings
        this.updateVisibleColumns(); // Updates table
    }

    private loadColumnVisibility() {
        const storedColumns = localStorage.getItem(this.COLUMN_KEY);
        const storedGroups = localStorage.getItem(this.GROUP_KEY);
        if (storedColumns && storedGroups) {
            this.selectedGroups = JSON.parse(storedGroups);
            this.selectedColumnFields = JSON.parse(storedColumns);
        } else {
            // Use default values
            this.selectedColumnFields = this.allColumns()
                .filter(col => col.visibleByDefault && !col.frozen) //We exclude frozen here since visibility is not toggleable for those
                .map(col => col.field);
        }
        // Sync selected groups from selected fields
        this.syncSelectedGroups();
    }

    /**********************************************************/

    /**********************************************************
    *                                                         *
    *    START OF TABLE DATA                                  *
    *    table, headers, boolean icons                        *
    *                                                         *
    **********************************************************/

    // Table - get current data
    tableData = computed<FlattenedTreeNode[]>(() => {
        const allNodes = this.projectState.flattenTree();
        const filters = this.columnFilters();

        //Apply filters
        const filtered = allNodes.filter(node => {
            if (filters['anyUnusual']) {
                const hasAnyUnusual = this.fieldFilters.some(field => {
                    return node[field as keyof FlattenedTreeNode] === true;
                });
                if (!hasAnyUnusual) return false;
            }
            return Object.entries(filters).every(([field, filterValue]) => {
                if (field === 'anyUnusual') return true; // Skip, not an actual column
                if (!filterValue) return true; // Filter inactive                       
                return node[field as keyof FlattenedTreeNode] === true; // Boolean filters - show only true values
            });
        });

        //Apply sorting
        const field = this.sortField();
        const order = this.sortOrder();
        if (!field) return filtered;

        return [...filtered].sort((a, b) => {
            const valueA = a[field as keyof FlattenedTreeNode];
            const valueB = b[field as keyof FlattenedTreeNode];

            // Get the column type
            const column = this.projectState.treeTableColumns().find(col => col.field === field);
            const colType = column?.type;

            // Handle null/undefined
            const isEmptyA = valueA == null || valueA === '' || (Array.isArray(valueA) && valueA.length === 0);
            const isEmptyB = valueB == null || valueB === '' || (Array.isArray(valueB) && valueB.length === 0);
            if (isEmptyA && isEmptyB) return 0;
            if (colType === 'date' || colType === 'number') {
                // null at the start (by oldest date or smallest number)
                if (isEmptyA) return -order;
                if (isEmptyB) return order;
            } else {
                // null at the end (by z)
                if (isEmptyA) return order;
                if (isEmptyB) return -order;
            }

            let comparison = 0;

            // Type-specific comparison
            if (colType === 'date') {
                // Compare as dates
                const dateA = new Date(valueA as string).getTime();
                const dateB = new Date(valueB as string).getTime();
                comparison = dateA - dateB;
            } else if (colType === 'number') {
                // Compare as numbers
                comparison = (valueA as number) - (valueB as number);
            } else if (colType === 'array') {
                // Compare arrays by joined string
                const strA = (valueA as string[]).join(', ').toLowerCase();
                const strB = (valueB as string[]).join(', ').toLowerCase();
                comparison = strA.localeCompare(strB);
            } else {
                // Default: text comparison (case-insensitive)
                comparison = valueA.toString().toLowerCase().localeCompare(
                    valueB.toString().toLowerCase()
                );
            }

            return order * comparison;
        });
    });

    // Get column group headings (includes frozen)
    get groupedHeaders() {
        const allGroups = this.columnGroups;
        const groups = allGroups.filter(g => {
            const hasFrozenColumns = this.allColumns().some(col => col.group === g && col.frozen);
            return this.selectedGroups.includes(g) || hasFrozenColumns;
        });

        return groups.map(groupKey => ({
            label: this.translate.instant(`inventory.columnGroups.${groupKey}`),
            value: groupKey,
            // Include ALL columns (frozen + non-frozen) for header span calculation
            items: this.allColumns()
                .filter(col => col.group === groupKey)
                .map(col => ({
                    label: col.label,
                    value: col.field
                }))
        }));
    }

    // For colspan - count visible columns in group (including frozen)
    getVisibleColumnCount(group: SelectItemGroup): number {
        return group.items.filter((item: SelectItem) => {
            const col = this.allColumns().find(c => c.field === item.value);
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            return col?.frozen || this.selectedColumnFields.includes(item.value);
        }).length;
    }

    // For column borders
    isLastInGroup(field: string): boolean {
        // Find which group this column belongs to
        const group = this.groupedHeaders.find(g =>
            g.items.some((item: SelectItem) => item.value === field)
        );

        if (!group) return false;

        // Get visible columns in this group
        const visibleInGroup = group.items
            .filter((item: SelectItem) => {
                const col = this.allColumns().find(c => c.field === item.value);
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                return col?.frozen || this.selectedColumnFields.includes(item.value);
            })
            .map((item: SelectItem) => item.value);

        // Check if this is the last visible column
        const isLast = visibleInGroup[visibleInGroup.length - 1] === field;

        // Don't add border after the very last group
        const isLastGroup = this.groupedHeaders[this.groupedHeaders.length - 1].value === group.value;

        return isLast && !isLastGroup;
    }

    // Table - returns the value of a cell (used by getBooleanIcon)
    getBooleanValue(node: FlattenedTreeNode, col: TableColumn): boolean {
        return node[col.field] as boolean;
    }

    // Table - map status booleans to icons
    getBooleanIcon(value: boolean, field: string): string {
        if (!value) return 'pi pi-minus text-gray-400';

        const trueIcons: Record<string, string> = {
            inScope: 'pi pi-check text-green-500',
            isNew: 'pi pi-plus text-blue-500',
            isMoved: 'pi pi-arrow-right text-orange-500',
            isROT: 'pi pi-trash text-red-500',
            isArchived: 'pi pi-book text-orange-500',
            noindex: 'pi pi-android text-orange-500',
            isOrphan: 'pi pi-exclamation-circle text-red-500',
            linksToPortal: 'pi pi-external-link text-blue-500',
            hasChatbot: 'pi pi-comments text-blue-500',
        };

        return trueIcons[field] ?? 'pi pi-check text-green-500';
    }

    getBooleanTooltip(value: boolean, field: string): string {
        return `inventory.tooltip.boolean.${field}.${value}`;
    }

    isKnownNumber = isKnownNumber

    /**********************************************************
    *                                                         *
    *    END OF TABLE DATA                                    *
    *    table, headers, boolean icons                        *
    *                                                         *
    **********************************************************/

    /**********************************************************
    *                                                         *
    *    START OF VIEW SETTINGS                               *
    *    columns, sort, filter, ex/hide                       *
    *                                                         *
    **********************************************************/

    // 1. Visible column dropdowns   

    // All column groups
    get columnGroups() {
        const groups = [...COLUMN_GROUPS];
        if (this.translate.currentLang()?.startsWith('fr')) {
            [groups[0], groups[1]] = [groups[1], groups[0]];
        }
        return groups;
    }

    // Multiselect - visible groups
    get groups() {
        return this.columnGroups.map(groupKey => ({
            label: this.translate.instant(`inventory.columnGroups.${groupKey}`),
            value: groupKey,
        }));
    }

    // Multiselect - visible columns
    get groupedColumns() {
        const allGroups = this.columnGroups;
        const groups = allGroups.filter(g => this.selectedGroups.includes(g));

        return groups.map(groupKey => ({
            label: this.translate.instant(`inventory.columnGroups.${groupKey}`),
            value: groupKey,
            items: this.allColumns()
                .filter(col => col.group === groupKey && !col.frozen) // exclude frozen from selection (frozen = always visible)
                .map(col => ({
                    label: col.label,
                    value: col.field
                }))
        }));
    }

    // Multiselect - column selection change handler
    onColumnSelectionChange() {
        this.updateVisibleColumns();
        this.saveColumnVisibility();
        this.syncSelectedGroups();
    }

    // Multiselect - group selection change handler
    onGroupSelectionChange() {
        this.selectedColumnFields = this.allColumns()
            .filter(col => !col.frozen && this.selectedGroups.includes(col.group))
            .map(col => col.field);
        this.updateVisibleColumns();
        this.saveColumnVisibility();
    }

    // Local storage, multiselect & select button - sync column visibility settings to groups (for select button)
    private syncSelectedGroups() {
        const groupMembers = new Map<string, string[]>();
        this.allColumns()
            .filter(col => !col.frozen)
            .forEach(col => {
                if (!groupMembers.has(col.group)) {
                    groupMembers.set(col.group, []);
                }
                groupMembers.get(col.group)!.push(col.field);
            });

        //Fully selected groups
        this.selectedGroups = Array.from(groupMembers.entries())
            .filter(([, fields]) => {
                const hasAnySelected = fields.some(field =>
                    this.selectedColumnFields.includes(field)
                );
                return hasAnySelected;
            })
            .map(([group]) => group);
    }

    // Local storage - save column visibility settings
    private saveColumnVisibility() {
        localStorage.setItem(this.COLUMN_KEY, JSON.stringify(this.selectedColumnFields));
        localStorage.setItem(this.GROUP_KEY, JSON.stringify(this.selectedGroups));
    }

    // Update visible columns & check if any data should autoexpand
    private updateVisibleColumns() {
        this.frozenColumns.set(this.allColumns().filter(col => col.frozen));
        this.scrollableColumns.set(this.allColumns().filter(col => !col.frozen && this.selectedColumnFields.includes(col.field)));
        this.checkAutoExpand();
    }

    // 2. Visible column buttons

    applyView(filter: (col: TableColumn) => boolean) {
        localStorage.removeItem('inventoryColumnVisibility');
        localStorage.removeItem('inventoryGroupVisibility');
        //Apply predefined column filter
        this.selectedColumnFields = this.allColumns()
            .filter(filter)
            .map(col => col.field);
        this.syncSelectedGroups();
        this.updateVisibleColumns();
    }

    viewDefault() {
        this.applyView(col => col.visibleByDefault && !col.frozen);
    }

    viewMetadata() {
        this.applyView(col => col.group === 'metadata');
    }

    // 3. Sort

    // Sort table
    customSort(event: SortEvent): void {
        if (event.field === this.lastSortField && event.order === 1 && this.lastSortOrder === -1) {
            this.sortField.set(null);
            this.sortOrder.set(1);
            this.lastSortField = null;
            this.lastSortOrder = null;
            this.dt.reset();
        } else {
            this.sortField.set(event.field ?? null);
            this.sortOrder.set(event.order ?? 1);
            this.lastSortField = event.field ?? null;
            this.lastSortOrder = event.order ?? null;
        }
    }

    // 4. Filter
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

    toggleInScopeFilter(): void {
        this.columnFilters.set({
            inScope: !this.columnFilters()['inScope'],
            anyUnusual: false
        });
    }

    // 5. Ex/Hides

    // Auto-expand when group is the only visible one
    private checkAutoExpand() {
        const selectedGroups = new Set(this.scrollableColumns().map(col => col.group));
        const selectedFields = new Set(this.scrollableColumns().map(col => col.field));
        for (const key of Object.keys(this.expandAll)) {
            this.expandAll[key] = selectedGroups.size === 1 && (selectedGroups.has(key as ColumnGroups) || selectedFields.has(key as keyof FlattenedTreeNode));
        }
    }

    // Check if a cell is expanded
    isCellExpanded(key: string, rowIndex: number, field: string): boolean {
        return this.expandAll[key] || this.expandedCells[key]?.has(`${rowIndex}-${field}`);
    }

    // Toggle individual cell
    toggleCell(key: string, rowIndex: number, field: string) {
        const cellKey = `${rowIndex}-${field}`;
        const set = this.expandedCells[key];
        if (set.has(cellKey)) { set.delete(cellKey); } else { set.add(cellKey); }
    }

    // Toggle expand all for a group
    toggleExpandAll(key: string) {
        this.expandAll[key] = !this.expandAll[key];
        if (this.expandAll[key]) this.expandedCells[key]?.clear();
    }

    // Check if a group or field has visible columns
    hasVisible(key: string, byField = false): boolean {
        return this.scrollableColumns().some(col => byField ? col.field === key : col.group === key);
    }

    /**********************************************************
    *                                                         *
    *    END OF VIEW SETTINGS                                 *
    *    columns, sort, filter, ex/hide                       *
    *                                                         *
    **********************************************************/

    /**********************************************************
    *                                                         *
    *    START OF FUNCTIONS                                   *
    *    refresh, generate metadata, edit                     *
    *                                                         *
    **********************************************************/

    // 1. Refresh (prototype or live data)
    async refreshData(version: 'live' | 'prototype') {
        if (!this.selectedNodes.length) return;
        const urlVersion = version === 'live' ? 'live' : this.projectState.getProject().repoType === 'github' ? 'protoGH' : 'protoUT'
        this.projectState.refreshing.update(r => ({ ...r, [version]: true }));
        for (const node of this.selectedNodes) {
            const treeNode = this.projectState.findNodeByPath(this.projectState.getProjectTree(), node.enPath, "en");
            if (treeNode) await this.projectState.refreshNode(treeNode, urlVersion)
        }
        this.projectState.refreshing.update(r => ({ ...r, [version]: false }));
    }

    // 2. AI metadata generation
    async generateMetadata(mode: "live" | "prototype" = "live") {
        if (!this.selectedNodes.length) return;
        const urlVersion = mode === 'live' ? 'live' : this.projectState.getProject().repoType === 'github' ? 'protoGH' : 'protoUT'
        for (const node of this.selectedNodes) {
            // Set URLs to fetch
            const enUrl = this.fetchService.generateUrl(node.enPath, urlVersion, this.github.owner, this.github.repo)
            const frUrl = this.fetchService.generateUrl(node.frPath, urlVersion, this.github.owner, this.github.repo)

            if (!enUrl && !frUrl) {
                console.warn(`Skipping ${enUrl} — missing EN & FR URLs`);
                continue;
            }

            // Fetch main content
            let enMain: string | null = null;
            let frMain: string | null = null;
            try {
                if (enUrl) {
                    const enDoc = urlVersion !== 'protoUT'
                        ? await this.fetchService.fetchContent(enUrl, 'prod', 3, 'none', true)
                        : this.fetchService.stringToDoc(await this.fetchService.fetchViaProxy(enUrl));
                    enMain = enDoc.querySelector('main')?.innerHTML ?? enDoc.body.innerHTML;
                }
                if (frUrl) {
                    const frDoc = urlVersion !== 'protoUT'
                        ? await this.fetchService.fetchContent(frUrl, 'prod', 3, 'none', true)
                        : this.fetchService.stringToDoc(await this.fetchService.fetchViaProxy(frUrl));
                    frMain = frDoc.querySelector('main')?.innerHTML ?? frDoc.body.innerHTML;
                }
            } catch (error) {
                console.warn(`Skipping ${enUrl} — fetch failed`, error);
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
                console.warn(`Skipping ${enUrl} — AI call failed`, error);
                continue;
            }

            // Parse and merge into tree
            const path = this.lang === 'fr' ? node.frPath : node.enPath;
            try {
                const parsed = JSON.parse(response);
                this.projectState.setMetadataReview(path, {
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
                }, InventoryPrompts[InventoryPromptKey.Metadata]);
            } catch (error) {
                console.warn(`Skipping ${path} — could not parse AI response`, error);
                continue;
            }
        }
    }

    // 2b. Compare metadata fields after editing to determine status
    compareMetadata(node: FlattenedTreeNode, col: TableColumn) {
        const compareCol = col.field.slice(2).replace(/^./, c => c.toLowerCase());
        const compareValue = (node as unknown as Record<string, unknown>)[compareCol] as string;
        if ((node[col.field] as MetadataField).edited === compareValue) { this.saveMetadata(node, col, "noChange") }
        else if ((node[col.field] as MetadataField).edited !== (node[col.field] as MetadataField).ai) { this.saveMetadata(node, col, "edited") }
        else if ((node[col.field] as MetadataField).edited === (node[col.field] as MetadataField).ai) { this.saveMetadata(node, col, "pending") }
    }

    onPasteMetadata(node: FlattenedTreeNode, col: TableColumn) {
        setTimeout(() => this.compareMetadata(node, col), 0);
    }

    onBlurMetadata() {
        this.isEditing = false;
    }

    // 2c. Save AI metadata status (NOTE: KEEP THIS AS SEPARATE FUNCTION SINCE IT CALLS TRACK USAGE)
    saveMetadata(node: FlattenedTreeNode, col: TableColumn, status: MetadataReviewStatus) {
        //Update FlattenedTreeNode
        (node[col.field] as MetadataField).status = status;

        //Update TreeNode
        if (!node['aiGeneratedAt'] || !node['aiModel'] || !node['aiDescriptionEN'] || !node['aiKeywordsEN'] || !node['aiDescriptionFR'] || !node['aiKeywordsFR']) return;
        const path = this.lang === 'fr' ? node['frPath'] : node['enPath']
        const review: MetadataReview = {
            generatedAt: node['aiGeneratedAt'],
            model: node['aiModel'],
            en: {
                description: node['aiDescriptionEN'],
                keywords: node['aiKeywordsEN'],
            },
            fr: {
                description: node['aiDescriptionFR'],
                keywords: node['aiKeywordsFR'],
            }
        };
        this.projectState.setMetadataReview(path, review);
    }

    // 3. Save new cell value
    saveCell(newValue: boolean | string) {
        if (!this.currentEditNode || !this.currentEditCol?.dataSection) return;
        const path = this.lang === 'fr' ? this.currentEditNode['frPath'] : this.currentEditNode['enPath']
        const node = this.projectState.findNodeByPath(this.projectState.getProjectTree(), path, this.lang);
        if (!node) return;

        const dataSection = this.currentEditCol.dataSection;
        const type = this.currentEditCol.type;

        if ((type === 'boolean' || type === 'template') && dataSection.includes("lang")) {
            const enSection = dataSection.map(k => k === 'lang' ? 'en' : k);
            const frSection = dataSection.map(k => k === 'lang' ? 'fr' : k);
            const currentValueEN = this.getNestedValue(node.data, enSection);
            const currentValueFR = this.getNestedValue(node.data, frSection);
            if (currentValueEN !== newValue || currentValueFR !== newValue) {
                this.setNestedValue(node.data, enSection, newValue);
                this.setNestedValue(node.data, frSection, newValue);
                this.projectState.setModifiedDate();
            }
        }
        else {
            const section = dataSection.map(k => k === 'lang' ? this.lang : k);
            const currentValue = this.getNestedValue(node.data, section);
            if (currentValue !== newValue) {
                this.setNestedValue(node.data, section, newValue);
                this.projectState.setModifiedDate();
            }
        }
    }

    getNestedValue(obj: TreeNodeData, path: string[]): TreeNodeTypes {
        return path.reduce((current: unknown, key: string) =>
            current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined
            , obj as unknown) as TreeNodeTypes;
    }

    setNestedValue(obj: TreeNodeData, path: string[], value: TreeNodeTypes): void {
        const last = path[path.length - 1];
        const target = path.slice(0, -1).reduce((current: Record<string, unknown>, key: string) => {
            if (!current[key] || typeof current[key] !== 'object') current[key] = {};
            return current[key] as Record<string, unknown>;
        }, obj as unknown as Record<string, unknown>);
        if (target) target[last] = value;
    }

    /**********************************************************
    *                                                         *
    *    END OF FUNCTIONS                                   *
    *    refresh, delete, edit, save                          *
    *                                                         *
    **********************************************************/

    /**********************************************************
     *                                                        *
     *    START OF MENU & POPUP OPTIONS                       *
     *    p-menu, p-contextMenu, p-dialog, p-confirmDialog    *
     *                                                        *
     **********************************************************/

    // 1. Dropdown menus (p-menu)
    updateDropdown(mode: "actions" | "view" | "newTab", path?: string) {
        switch (mode) {
            case 'actions': {
                const numPages = this.selectedNodes.length;
                const numChildPages = this.projectState.checkDeletionImpact(this.selectedNodes).length;
                this.itemsDropdown = [
                    {
                        label: this.translate.instant('common.refresh'),
                        styleClass: 'text-primary-500',
                        items: [
                            {
                                label: this.projectState.refreshing().prototype
                                    ? this.translate.instant('inventory.menu.refreshing.prototype', { pageCount: numPages })
                                    : this.translate.instant('inventory.menu.refresh.prototype', { pageCount: numPages }),
                                icon: this.projectState.refreshing().prototype ? 'pi pi-spin pi-spinner' : 'pi pi-refresh',
                                disabled: numPages === 0,
                                command: () => {
                                    this.refreshData('prototype')
                                }
                            },
                            {
                                label: this.projectState.refreshing().live
                                    ? this.translate.instant('inventory.menu.refreshing.live', { pageCount: numPages })
                                    : this.translate.instant('inventory.menu.refresh.live', { pageCount: numPages }),
                                icon: this.projectState.refreshing().live ? 'pi pi-spin pi-spinner' : 'pi pi-refresh',
                                disabled: numPages === 0,
                                command: () => {
                                    this.refreshData('live')
                                }
                            },
                        ]
                    },
                    {
                        label: this.translate.instant('inventory.menu.metadata'),
                        styleClass: 'text-primary-500',
                        items: [
                            {
                                label: this.openRouterService.state().loading
                                    ? this.translate.instant('inventory.menu.metadata.generating', { pageCount: numPages })
                                    : this.translate.instant('inventory.menu.metadata.generate', { pageCount: numPages }),
                                icon: this.openRouterService.state().loading ? 'pi pi-spin pi-spinner' : 'pi pi-sparkles',
                                disabled: numPages === 0 || this.openRouterService.state().loading,
                                command: async () => {
                                    await this.generateMetadata()
                                }
                            },
                        ]
                    },
                    {
                        label: this.translate.instant('inventory.menu.delete'),
                        styleClass: 'text-red-500',
                        items: [
                            {
                                label: this.translate.instant('inventory.menu.delete.selected', { pageCount: numPages, childCount: numChildPages }),
                                icon: 'pi pi-trash text-red-500',
                                disabled: numPages === 0,
                                command: () => {
                                    this.onDeleteSelected()
                                }
                            },
                        ]
                    },
                ];
                return;
            }
            case 'view': {
                this.itemsDropdown = [
                    {
                        label: this.translate.instant('common.filters'),
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
                                label: this.columnFilters()['inScope']
                                    ? this.translate.instant('inventory.menu.inscope.filter.remove')
                                    : this.translate.instant('inventory.menu.inscope.filter.add'),
                                icon: this.columnFilters()['inScope']
                                    ? 'pi pi-filter'
                                    : 'pi pi-filter-slash',
                                command: () => {
                                    this.toggleInScopeFilter();
                                }
                            },
                        ]
                    },
                    {
                        label: this.translate.instant('common.expandCollapse'),
                        items: [
                            {
                                label: this.expandAll['metadata']
                                    ? this.translate.instant('inventory.menu.metadata.collapseAll')
                                    : this.translate.instant('inventory.menu.metadata.expandAll'),
                                icon: this.expandAll['metadata'] ? 'pi pi-minus' : 'pi pi-plus',
                                command: () => {
                                    this.toggleExpandAll('metadata')
                                },
                                disabled: !this.hasVisible('metadata')
                            },
                            {
                                label: this.expandAll['task']
                                    ? this.translate.instant('inventory.menu.tasks.collapseAll')
                                    : this.translate.instant('inventory.menu.tasks.expandAll'),
                                icon: this.expandAll['task'] ? 'pi pi-minus' : 'pi pi-plus',
                                command: () => {
                                    this.toggleExpandAll('task')
                                },
                                disabled: !this.hasVisible('task', true)
                            },
                            {
                                label: this.expandAll['notes']
                                    ? this.translate.instant('inventory.menu.notes.collapseAll')
                                    : this.translate.instant('inventory.menu.notes.expandAll'),
                                icon: this.expandAll['notes'] ? 'pi pi-minus' : 'pi pi-plus',
                                command: () => {
                                    this.toggleExpandAll('notes')
                                },
                                disabled: !this.hasVisible('notes')
                            },
                            {
                                label: this.expandAll['phoneNumbers']
                                    ? this.translate.instant('inventory.menu.phoneNumbers.collapseAll')
                                    : this.translate.instant('inventory.menu.phoneNumbers.expandAll'),
                                icon: this.expandAll['phoneNumbers'] ? 'pi pi-minus' : 'pi pi-plus',
                                command: () => {
                                    this.toggleExpandAll('phoneNumbers')
                                },
                                disabled: !this.hasVisible('phoneNumbers', true)
                            },
                            {
                                label: this.expandAll['enVanity'] || this.expandAll['frVanity']
                                    ? this.translate.instant('inventory.menu.vanities.collapseAll')
                                    : this.translate.instant('inventory.menu.vanities.expandAll'),
                                icon: this.expandAll['enVanity'] || this.expandAll['frVanity'] ? 'pi pi-minus' : 'pi pi-plus',
                                command: () => {
                                    this.toggleExpandAll('enVanity');
                                    this.toggleExpandAll('frVanity');
                                },
                                disabled: !this.hasVisible('enVanity', true) && !this.hasVisible('frVanity', true)
                            },
                        ]
                    },
                ];
                return;
            }
            case 'newTab': {
                if (path) {
                    const repoType = this.projectState.getProject().repoType;
                    const protoVersion = repoType === 'github' ? 'protoGH' : 'protoUT';
                    const baseVersion = repoType === 'github' ? 'baseGH' : 'baseUT';
                    const liveUrl = this.fetchService.generateUrl(path, "live");
                    const previewUrl = this.fetchService.generateUrl(path, "preview");
                    const prototypeUrl = this.fetchService.generateUrl(path, protoVersion, this.github.owner, this.github.repo);
                    const baselineUrl = this.fetchService.generateUrl(path, baseVersion, this.github.owner, this.github.repo);
                    this.itemsDropdown = [
                        {
                            label: this.translate.instant('common.openNewTab'),
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
                            ]
                        },
                    ];
                }
                return;
            }
        }

    }

    // 2. Context menus (for flipping booleans & updating AI text)

    // Update context menu 
    updateContext(event: MouseEvent | TouchEvent, type: "boolean" | "aiText", field: string, value: boolean | MetadataField) {
        this.itemsContext = [];
        switch (type) {
            case 'boolean': {
                if (value !== true) {
                    this.itemsContext.push({
                        label: this.translate.instant(`inventory.contextMenu.${field}.true`),
                        icon: this.getBooleanIcon(true, field),
                        command: () => this.saveCell(true)
                    });
                }
                if (value !== false) {
                    this.itemsContext.push({
                        label: this.translate.instant(`inventory.contextMenu.${field}.false`),
                        icon: this.getBooleanIcon(false, field),
                        command: () => this.saveCell(false)
                    });
                }
                break;
            }
            case 'aiText': {
                const status = (value as MetadataField)?.status;
                const ai = (value as MetadataField)?.ai;
                const edited = (value as MetadataField)?.edited;
                const node = this.currentEditNode!;
                const col = this.currentEditCol!;

                if (!value) {
                    this.itemsContext = [
                        {
                            label: this.translate.instant(`inventory.contextMenu.metadata.generate`),
                            icon: 'pi pi-sparkles text-primary',
                            command: async () => {
                                this.selectedNodes = [node];
                                await this.generateMetadata()
                            },
                        }
                    ];
                    break;
                }
                this.itemsContext = [
                    {
                        label: this.translate.instant(`common.edit`),
                        icon: 'pi pi-pencil text-primary',
                        command: () => {
                            this.isEditing = true;
                            this.isEditingCell(node, col, true);
                            if (!edited) { (node[col.field] as MetadataField).edited = ai }
                        },
                    }
                ];
                if (status !== 'noChange') {
                    this.itemsContext.push({
                        label: this.translate.instant(`common.accept`),
                        icon: 'pi pi-check text-green-500',
                        command: () => status === 'edited' ? this.saveMetadata(node, col, 'approvedEdits') : this.saveMetadata(node, col, 'approvedAI'),
                    })
                    this.itemsContext.push({
                        label: this.translate.instant(`common.reject`),
                        icon: 'pi pi-trash text-red-500',
                        command: () => this.saveMetadata(node, col, 'rejected'),
                    })
                }

                if (status !== 'pending') {
                    this.itemsContext.push({
                        label: this.translate.instant(`common.undo`),
                        icon: 'pi pi-undo',
                        command: () => this.saveMetadata(node, col, 'pending'),
                    });
                }
                break;
            }
        }
        this.menuContext.show(event);
    }

    // Highlights cells with context menu or inline editing (on right click or long press)
    hasContextMenu(group: string, type: string): boolean {
        return ['status'].includes(group) || ['template', 'aiText', 'textArea'].includes(type);
    }

    onTouchStart(event: TouchEvent, node: FlattenedTreeNode, col: TableColumn) {
        this.touchTimer = setTimeout(() => {
            this.onRightClick(event, node, col);
        }, 500); // 500ms long press
    }

    onTouchEnd() {
        if (this.touchTimer) {
            clearTimeout(this.touchTimer);
            this.touchTimer = null;
        }
    }

    // End editing when clicking outside of cell
    onLeftClick(node: FlattenedTreeNode, col: TableColumn) {
        if (node !== this.currentEditNode) { this.currentEditNode = undefined; }
        if (col !== this.currentEditCol) { this.currentEditCol = undefined; }
    }

    // Start editing inline or open context menu
    onRightClick(event: MouseEvent | TouchEvent, node: FlattenedTreeNode, col: TableColumn) {
        event.preventDefault();
        if (!this.hasContextMenu(col.group, col.type)) return;
        this.isEditing = false;
        this.currentEditNode = node;
        this.currentEditCol = col;

        if (!this.currentEditNode || !this.currentEditCol) return;

        switch (col.type) {
            case 'boolean': {
                const field = col.field;
                const currentValue = this.getBooleanValue(node, col);
                this.updateContext(event, "boolean", field, currentValue)
                break;
            }
            case 'template':
                this.isEditingCell(node, col);
                break;
            case 'textArea':
                this.isEditingCell(node, col);
                break;
            case 'aiText': {
                const field = col.field;
                const currentValue = node[col.field] as MetadataField;
                this.updateContext(event, "aiText", field, currentValue)
                break;
            }
            default:
                return;
        }
    }

    isEditingCell(node: FlattenedTreeNode, col: TableColumn, requireConfirm = false) {
        return this.currentEditNode === node && this.currentEditCol === col && (requireConfirm ? this.isEditing : true);
    }

    // 3. Template dropdown options
    get templateOptions() {
        return Object.values(PageTemplate)
            .map(key => ({
                value: key,
                label: this.translate.instant(key)
            }))
            .sort((a, b) => a.label.localeCompare(b.label, this.translate.currentLang()));
    }

    // 4. Dialog popup (edit node)
    get currentLang() { return this.translate.currentLang()?.startsWith('fr') ? 'fr' : 'en' }

    edit(node: FlattenedTreeNode) {
        const path = this.lang === 'fr' ? node.frPath : node.enPath;
        this.selectedNode = this.projectState.findNodeByPath(this.projectState.getProjectTree(), path, this.lang) ?? {};
        this.editNode = true;
    }

    // 5. Confirmation dialogs (deletions)
    onDeleteSelected() {
        if (!this.selectedNodes.length) return;
        const additionalDeletions = this.projectState.checkDeletionImpact(this.selectedNodes);
        if (additionalDeletions.length > 0) {
            this.showDeletionConfirmation(this.selectedNodes.length, additionalDeletions);
        } else {
            this.confirmationService.confirm({
                key: 'inventory',
                message: this.translate.instant('inventory.delete.confirmMessage', { count: this.selectedNodes.length }),
                header: this.translate.instant('inventory.delete._title'),
                icon: 'pi pi-exclamation-circle',
                acceptIcon: 'pi pi-trash',
                acceptLabel: this.translate.instant('common.delete'),
                rejectLabel: this.translate.instant('common.cancel'),
                acceptButtonStyleClass: 'p-button-danger',
                rejectButtonStyleClass: 'p-button-secondary',
                accept: () => {
                    this.projectState.deleteNodes(this.selectedNodes, true);
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
        const childWarning = this.translate.instant('inventory.delete.childPagesWarning', {
            deleteCount,
            childCount: additionalPages.length
        });

        let message = `<p class="mt-0">${childWarning}</p>`;

        if (inScopeCount > 0) {
            const inScopeWarning = this.translate.instant('inventory.delete.inScopeWarning', { count: inScopeCount });
            const inScopeHeading = this.translate.instant('inventory.delete.inScopeHeading');
            message += `
            <p>${inScopeWarning}</p>
            <h2>${inScopeHeading}</h2>
            <p>${inScopeList}</p>
        `;
        }

        if (baselineCount > 0) {
            const baselineHeading = this.translate.instant('inventory.delete.baselineHeading');
            message += `
            <h2>${baselineHeading}</h2>
            <p>${baselineList}</p>
        `;
        }

        message = message.trim();

        this.confirmationService.confirm({
            key: 'inventory',
            message,
            header: this.translate.instant('inventory.delete._title'),
            icon: 'pi pi-exclamation-triangle',
            acceptIcon: 'pi pi-trash',
            acceptLabel: this.translate.instant('common.delete'),
            rejectLabel: this.translate.instant('common.cancel'),
            acceptButtonStyleClass: 'p-button-danger',
            rejectButtonStyleClass: 'p-button-secondary',
            accept: () => {
                this.projectState.deleteNodes(this.selectedNodes, true);
                this.selectedNodes = []; // Clear selection after delete
            }
        });
    }

    // 5. Open in UPD
    openInUPD(node: FlattenedTreeNode): void {
        const updLink = this.fetchService.generateUrl(this.lang === 'fr' ? node.frPath : node.enPath, "upd")
        window.open(updLink, '_blank');
    }

    /*********************************************************
    *                                                        *
    *    END OF MENU & POPUP OPTIONS                         *
    *    p-menu, p-contextMenu, p-dialog, p-confirmDialog    *
    *                                                        *
    *********************************************************/

    private markForTranslation() {
        //Grouped headings
        marker('inventory.columnGroups.english');
        marker('inventory.columnGroups.french');
        marker('inventory.columnGroups.status');
        marker('inventory.columnGroups.actions');
        marker('inventory.columnGroups.notes');
        marker('inventory.columnGroups.problems');
        marker('inventory.columnGroups.pageData');
        marker('inventory.columnGroups.owner');
        marker('inventory.columnGroups.metadata');
        //Tooltips
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
        marker('inventory.tooltip.boolean.isArchived.true');
        marker('inventory.tooltip.boolean.isArchived.false');
        marker('inventory.tooltip.boolean.noindex.true');
        marker('inventory.tooltip.boolean.noindex.false');
        //Booleans
        marker('inventory.contextMenu.inScope.true');
        marker('inventory.contextMenu.inScope.false');
        marker('inventory.contextMenu.isNew.true');
        marker('inventory.contextMenu.isNew.false');
        marker('inventory.contextMenu.isMoved.true');
        marker('inventory.contextMenu.isMoved.false');
        marker('inventory.contextMenu.isROT.true');
        marker('inventory.contextMenu.isROT.false');
        marker('inventory.contextMenu.linksToPortal.true');
        marker('inventory.contextMenu.linksToPortal.false');
        marker('inventory.contextMenu.isOrphan.true');
        marker('inventory.contextMenu.isOrphan.false');
        marker('inventory.contextMenu.isArchived.true');
        marker('inventory.contextMenu.isArchived.false');
        marker('inventory.contextMenu.noindex.true');
        marker('inventory.contextMenu.noindex.false');

    }

}