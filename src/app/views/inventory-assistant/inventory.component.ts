import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

//PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';
import { ToolbarModule } from 'primeng/toolbar';
import { IftaLabelModule } from 'primeng/iftalabel';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectButtonModule } from 'primeng/selectbutton';

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
        TableModule, ButtonModule, PopoverModule,
        ToolbarModule, IftaLabelModule, MultiSelectModule, SelectButtonModule,
        ExportProjectComponent, AddPagesComponent, FindPagesComponent],
    templateUrl: './inventory.component.html',
    styles: `
    .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}`
})
export class InventoryComponent implements OnInit {
    public projectState = inject(ProjectStateService);
    private translate = inject(TranslateService)
    iaDiagram = inject(IaDiagramService);

    // All table columns
    allColumns = this.projectState.getTreeTableColumns();
    // Visible table columns
    frozenColumns: TableColumn[] = [];
    scrollableColumns: TableColumn[] = [];

    // Current selections
    selectedNodes = [] // TreeNode data
    selectedColumnFields: string[] = []; //
    expandedMetadataCells = new Set<string>(); // stores "rowIndex-field" keys

    // Booleans
    expandAllMetadata = false;

    // Local storage key for loading previous table settings
    private readonly STORAGE_KEY = 'inventoryColumnVisibility';

    ngOnInit() {
        this.loadColumnVisibility(); // Loads previous settings
        this.updateVisibleColumns(); // Updates table
    }

    // Multiselect column groups
    get groupedColumns() {
        const groups = ['page', 'oppPage', 'status', 'owner', 'data', 'metadata'];

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
    }

    // Local storage - load table settings
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
    }

    // Local storage - save table settings
    private saveColumnVisibility() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.selectedColumnFields));
    }








    /*
        onColumnGroupToggle(group: ColumnGroup) {
            // When toggling a group, set all its columns to match
            group.columns.forEach(col => {
                col.visibleByDefault = group.visible;
            });
            this.updateVisibleColumns();
            this.saveColumnVisibility();
        }
    */


    private updateVisibleColumns() {
        this.frozenColumns = this.allColumns.filter(col => col.frozen);
        this.scrollableColumns = this.allColumns.filter(col => this.selectedColumnFields.includes(col.field));
        // Auto-expand metadata when it's the only visible group
        this.checkAutoExpandMetadata();
    }

    private checkAutoExpandMetadata() {
        const selectedGroups = new Set(
            this.scrollableColumns
                .map(col => col.group)
        );

        // Auto-expand if only metadata group is visible
        this.expandAllMetadata = selectedGroups.size === 1 &&
            selectedGroups.has('metadata');
    }

    toggleMetadataCell(rowIndex: number, field: string) {
        const key = `${rowIndex}-${field}`;
        if (this.expandedMetadataCells.has(key)) {
            this.expandedMetadataCells.delete(key);
        } else {
            this.expandedMetadataCells.add(key);
        }
    }

    isMetadataExpanded(rowIndex: number, field: string): boolean {
        return this.expandAllMetadata || this.expandedMetadataCells.has(`${rowIndex}-${field}`);
    }

    toggleExpandAllMetadata() {
        this.expandAllMetadata = !this.expandAllMetadata;
        if (this.expandAllMetadata) {
            this.expandedMetadataCells.clear();
        }
    }

    isMetadataColumn(field: string): boolean {
        return ['title', 'description', 'keywords'].includes(field);
    }

    hasVisibleMetadata(): boolean {
        return this.scrollableColumns.some(col => this.isMetadataColumn(col.field));
    }


    tableData = computed<FlattenedTreeNode[]>(() => {
        return this.projectState.flattenTree();
    });

    onExportCsv() {
        this.projectState.exportTreeAsCsv();
    }

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
    getCellValue(node: FlattenedTreeNode, col: TableColumn): any {
        return node[col.field];
    }
}