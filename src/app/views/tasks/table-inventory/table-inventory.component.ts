import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { SortEvent } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DrawerModule } from 'primeng/drawer';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';

import { AddPagesComponent } from '../../../components/add-pages/add-pages.component';
import { MenuPageActionsComponent } from '../../../components/menu-page-actions/menu-page-actions.component';
import { ProjectSettingsComponent } from '../../../components/project-settings/project-settings.component';
import { ViewPagesComponent } from '../../../components/view-pages/view-pages.component';

import { FetchService } from '../../../services/fetch.service';
import { ProjectCacheService } from '../../../services/project-cache.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { StyleCardService } from '../../../services/style-card.service';
import { buildFilterFields, ColumnVisibility, createRowSelection, groupSpans, persisted, rowsPerPageOptions, TableService, trackStuck } from '../../../services/style-table.service';
import { FlattenedInventory, TableInventoryService, TableItem } from '../../../services/table-inventory.service';

import { TooltipDirective } from '../../../common/tooltip.directive';

/**
 * Reviewed: 2026-08-14 (ng21)
 *
 * Content inventory table for reviewing all data collected for each page in the project
 *
 * Preferentially displays prototype data but will fall back to live
 *
 * TODO:
 ** add unusual row status filter for booleans (any visible true)
 ** make sure all tooltips have translations
 ** add context menu for proposed status, notes, and template?
 ** add sorting & filtering?
 */
@Component({
  selector: 'aida-table-inventory',
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CheckboxModule,
    DrawerModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    TableModule,
    AddPagesComponent,
    MenuPageActionsComponent,
    ProjectSettingsComponent,
    TooltipDirective,
    ViewPagesComponent,
  ],
  templateUrl: 'table-inventory.component.html',
  styleUrl: '../../../../sticky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableInventoryComponent implements OnInit {
  protected readonly projectState = inject(ProjectStateService);
  protected readonly projectCache = inject(ProjectCacheService);
  protected readonly tableInventory = inject(TableInventoryService);
  protected readonly tableService = inject(TableService);
  protected readonly styleCardService = inject(StyleCardService);
  protected readonly fetchService = inject(FetchService);

  /* Search term for filtering table rows */
  protected readonly searchTerm = signal<string>('');
  /** Tracks if sticky content is currently stuck to X or Y axis*/
  protected readonly stuck = trackStuck();
  /** Unique instance of visibility class */
  protected readonly visible = new ColumnVisibility('invHidden', [
    persisted('invLang', this.projectCache.selectedLang, ['en', 'fr', 'both'] as const),
    persisted('invScope', this.projectCache.selectedScope, ['inScope', 'all'] as const),
  ]);
  /** Count of how many filters are applied */
  protected readonly filterCount = computed(() => {
    const scopeFilter = this.projectCache.selectedScope() !== 'all' ? 1 : 0;
    const langFilter = this.projectCache.selectedLang() !== 'both' ? 1 : 0;
    const colFilter = this.visibleColumns().length !== this.columns().length ? 1 : 0;
    const searchFilter = this.searchTerm() ? 1 : 0;
    return (scopeFilter + langFilter + colFilter + searchFilter).toString();
  });
  /** Controls visibility of row and column filter drawer */
  protected showDrawer = false;

  ngOnInit() {
    /** Restores users default column settings on load */
    this.visible.restore();
  }

  /** All table rows */
  protected readonly rows = computed(() => {
    return this.tableInventory.flattenInventory(this.projectState.getProject().projectData);
  });

  /** Selected table rows */
  protected readonly selection = createRowSelection(this.rows);

  /** Visible table rows */
  protected readonly visibleRows = computed(() => {
    let rows = this.rows();

    if (this.projectCache.selectedScope() === 'inScope') {
      rows = rows.filter((row) => !(row.inScope.type === 'boolean' && row.inScope.content !== true));
    }

    //Apply sorting
    const col = this.sortColumn();
    if (!col) return rows;

    const order = this.sortOrder();
    return [...rows].sort((a, b) => order * this.compareRows(a, b, col));
  });

  /** All table columns (keys, groups, version, & an indicator for first column in group) */
  protected readonly columns = computed(() => {
    const first = this.rows()[0] as unknown as Record<string, TableItem> | undefined;
    if (!first) return [];

    const selectedLang = this.projectCache.selectedLang();

    const excluded = selectedLang === 'en' ? ['Fr'] : selectedLang === 'fr' ? ['En'] : [];

    const cols = Object.entries(first).filter(([key, cell]) => cell?.group !== undefined && cell?.column !== undefined && !excluded.some((lang) => key.endsWith(lang)));

    return cols.map(([key, cell], i) => ({
      key,
      group: cell.group,
      column: cell.column,
      isGroupStart: i === 0 || cols[i - 1][1].group !== cell.group,
    }));
  });

  /** Visible table columns */
  protected readonly visibleColumns = computed(() => {
    const cols = this.columns().filter((c) => this.visible.isVisible(c.key));
    return cols.map((col, index) => ({ ...col, isGroupStart: index === 0 || cols[index - 1].group !== col.group }));
  });

  /** Visible table groups (Group names & calculated span for table) */
  protected readonly groups = computed(() => groupSpans(this.visibleColumns()));

  /** Set max rows per page to the total pages in project */
  protected get rowsPerPageOptions(): number[] {
    return rowsPerPageOptions(this.rows().length);
  }

  /** Filters on currently visible columns plus h1, double h1, and path */
  protected readonly filterFields = computed(() => buildFilterFields(this.projectCache.uiLang(), this.visibleColumns()));

  /** Map columns to groups for drawer checkboxes */
  protected readonly columnGroups = computed(() => {
    const map = new Map<string, { key: string; column: string }[]>();
    for (const col of this.columns()) {
      if (!map.has(col.group)) map.set(col.group, []);
      map.get(col.group)!.push({ key: col.key, column: col.column });
    }
    return [...map].map(([group, cols]) => ({ group, cols }));
  });

  private markForTranslation() {
    marker('inventory.table.header.all');
    marker('inventory.table.header.inScope');
  }

  /** Sort */
  protected readonly dt = viewChild.required<Table>('dt');
  private readonly sortColumn = signal<string | null>(null);
  private readonly sortOrder = signal<number>(1); // 1 = ascending, -1 = descending
  private lastSortField: string | null = null;
  private lastSortOrder: number | null = null;

  protected customSort(event: SortEvent): void {
    if (event.field === this.lastSortField && event.order === 1 && this.lastSortOrder === -1) {
      this.sortColumn.set(null);
      this.sortOrder.set(1);
      this.lastSortField = null;
      this.lastSortOrder = null;
      this.dt().reset();
    } else {
      this.sortColumn.set(event.field ?? null);
      this.sortOrder.set(event.order ?? 1);
      this.lastSortField = event.field ?? null;
      this.lastSortOrder = event.order ?? null;
    }
  }

  private compareRows(a: FlattenedInventory, b: FlattenedInventory, col: string): number {
    const cellA = this.sortCell(a, col);
    const cellB = this.sortCell(b, col);
    const type = cellA.type ?? cellB.type;

    const emptyA = this.isEmpty(cellA.content);
    const emptyB = this.isEmpty(cellB.content);
    if (emptyA && emptyB) return 0;

    const emptyFirst = type === 'date' || type === 'number'; // empties are sorted as smallest for dates and numbers
    if (emptyA) return emptyFirst ? -1 : 1;
    if (emptyB) return emptyFirst ? 1 : -1;

    const x = cellA.content;
    const y = cellB.content;

    switch (type) {
      case 'date':
        return new Date(x as string).getTime() - new Date(y as string).getTime();
      case 'number':
        return (x as number) - (y as number);
      case 'boolean':
        return Number(x) - Number(y); // false before true
      case 'array':
        return this.joinArray(x).localeCompare(this.joinArray(y), this.projectCache.uiLang());
      default:
        return String(x).toLowerCase().localeCompare(String(y).toLowerCase(), this.projectCache.uiLang(), { numeric: true });
    }
  }

  /** Returns type & content for a given cell */
  private sortCell(row: FlattenedInventory, col: string): { type?: string; content: unknown } {
    const value = col.split('.').reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], row);
    return typeof value === 'object' && value !== null && !Array.isArray(value) && 'content' in value ? (value as { type?: string; content: unknown }) : { content: value };
  }

  /** Detects if cell is empty */
  private isEmpty(value: unknown): boolean {
    return value == null || value === '' || (Array.isArray(value) && value.length === 0);
  }

  /** Converts an array to a string so value can be sorted alphabetically */
  private joinArray(value: unknown): string {
    return (value as unknown[]).map(String).join(', ').toLowerCase();
  }
}
