import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

//PrimeNG Modules
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';

//Components and models
import { ExportProjectComponent } from '../../components/export-project/export-project.component';
import { AddPagesComponent } from '../../components/add-pages/add-pages.component';
import { FlattenedTreeNode, TableColumn } from '../../common/data.model';

//Services
import { ProjectStateService } from '../../services/project-state.service';
import { IaDiagramService } from '../../components/ia-diagram/ia-diagram.service';
import { FindPagesComponent } from "../../components/find-pages/find-pages.component";


@Component({
    selector: 'aida-inventory',
    imports: [CommonModule, FormsModule, TranslateModule,
        TableModule, ButtonModule, PopoverModule,
        ExportProjectComponent, AddPagesComponent, FindPagesComponent],
    templateUrl: './inventory.component.html',
    styles: ``
})
export class InventoryComponent {
    private projectState = inject(ProjectStateService);
    iaDiagram = inject(IaDiagramService);

    allColumns = this.projectState.getTreeTableColumns();
    frozenColumns = this.allColumns.filter(col => col.frozen);
    scrollableColumns = this.allColumns.filter(col => !col.frozen)

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