import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

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

//Components and models
import { ExportProjectComponent } from '../../components/export-project/export-project.component';
import { AddPagesComponent } from '../../components/add-pages/add-pages.component';
import { FlattenedTreeNode, TableColumn, ColumnGroup } from '../../common/data.model';

//Services
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from '../../components/ia-diagram/ia-diagram.service';
import { FindPagesComponent } from "../../components/find-pages/find-pages.component";


@Component({
    selector: 'aida-inventory',
    imports: [CommonModule, FormsModule, TranslateModule,
        TableModule, ButtonModule, PopoverModule, TooltipModule,
        ToolbarModule, IftaLabelModule, MultiSelectModule, SelectButtonModule,
        TagModule,
        ExportProjectComponent, AddPagesComponent, FindPagesComponent],
    templateUrl: './inventory.component.html',
    styles: `
    ::ng-deep .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    }
    ::ng-deep .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    }
    `})
export class InventoryComponent implements OnInit {
    public projectState = inject(ProjectStateService);
    private translate = inject(TranslateService)
    iaDiagram = inject(IaDiagramService);

    // Remove this later
    test() { console.log("Button click") }

    // All table columns
    allColumns = this.projectState.getTreeTableColumns();
    // Visible table columns
    frozenColumns: TableColumn[] = [];
    scrollableColumns: TableColumn[] = [];

    // Current selections
    selectedNodes = [] // Flattened TreeNode data (for delete, status toggles, etc.)
    selectedColumnFields: string[] = []; // Multiselect data
    selectedGroups: string[] = []; // Select button data
    expandedMetadataCells = new Set<string>(); // Tracks which individual metadata cells are expanded

    // Booleans
    expandAllMetadata = false;
    expandAllUrls = false;

    // Local storage key for loading previous table settings
    private readonly STORAGE_KEY = 'inventoryColumnVisibility';

    // Update column visibility on first load
    ngOnInit() {
        this.loadColumnVisibility(); // Loads previous settings
        this.updateVisibleColumns(); // Updates table
    }

    // Multiselect - column groups
    get groupedColumns() {
        const groups = ['page', 'oppPage', 'github', 'status', 'owner', 'pageData', 'metadata'];

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
        const groups = ['page', 'oppPage', 'github', 'status', 'owner', 'pageData', 'metadata'];

        return groups.map(groupKey => ({
            value: groupKey,
            icon: this.getGroupIcon(groupKey),
            tooltip: this.translate.instant(`inventory.columnGroups.${groupKey}`)
        }));
    }

    get columnMaterialButtons() {
        const groups = ['page', 'oppPage', 'github', 'status', 'owner', 'pageData', 'metadata'];

        return groups.map(groupKey => ({
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
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            this.selectedColumnFields = JSON.parse(stored);
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

        this.selectedGroups = Array.from(groupMembers.entries())
            .filter(([group, fields]) =>
                fields.every(field => this.selectedColumnFields.includes(field))
            )
            .map(([group]) => group);

        console.log('syncSelectedGroups result:', this.selectedGroups);
    }

    // Local storage - save column visibility settings
    private saveColumnVisibility() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.selectedColumnFields));
    }

    // Table - get current data
    tableData = computed<FlattenedTreeNode[]>(() => {
        return this.projectState.flattenTree();
    });

    // Table - returns the value of a cell (used by getBooleanIcon)
    getCellValue(node: FlattenedTreeNode, col: TableColumn): any {
        return node[col.field];
    }

    // Table - map status booleans to icons
    getBooleanIcon(value: boolean, field: string): string {
        const iconMap: Record<string, { true: string; false: string }> = {
            inScope: { true: 'pi-check text-green-500', false: 'pi-minus text-gray-400' },
            isOrphan: { true: 'pi-times text-red-500', false: 'pi-minus text-gray-400' },
            isNew: { true: 'pi-plus text-blue-500', false: 'pi-minus text-gray-400' },
            isMoved: { true: 'pi-arrow-right text-orange-500', false: 'pi-minus text-gray-400' },
            isROT: { true: 'pi-trash text-red-500', false: 'pi-minus text-gray-400' },
        };

        const fieldIcons = iconMap[field];
        if (fieldIcons) {
            return 'pi ' + fieldIcons[String(value) as 'true' | 'false'];
        }
        return 'pi pi-minus text-gray-400';
    }

    // Table - update visible columns & check if metadata should autoexpand
    private updateVisibleColumns() {
        this.frozenColumns = this.allColumns.filter(col => col.frozen);
        this.scrollableColumns = this.allColumns.filter(col => this.selectedColumnFields.includes(col.field));
        this.checkAutoExpandMetadata();
        this.checkAutoExpandUrls();
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










    /*
    
        isMetadataColumn(field: string): boolean {
            return ['title', 'description', 'keywords'].includes(field);
        }
    
    
    
    
        
        onColumnGroupToggle(group: ColumnGroup) {
            // When toggling a group, set all its columns to match
            group.columns.forEach(col => {
                col.visibleByDefault = group.visible;
            });
            this.updateVisibleColumns();
            this.saveColumnVisibility();
        }
    */





    onExportCsv() {
        this.projectState.exportTreeAsCsv();
    }

}