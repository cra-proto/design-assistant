import { CommonModule } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, inject, Injector, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DrawerModule } from 'primeng/drawer';
import { FieldsetModule } from 'primeng/fieldset';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { TableModule } from 'primeng/table';

import { CompareSelectComponent } from '../../../components/compare/compare-select/compare-select.component';
import { AiMetadataComponent } from '../../../components/edit-node/ai-metadata/ai-metadata.component';
import { EditMetadataComponent } from '../../../components/edit-node/edit-metadata/edit-metadata.component';
import { MenuPageActionsComponent } from '../../../components/menu-page-actions/menu-page-actions.component';
import { ProjectSettingsComponent } from '../../../components/project-settings/project-settings.component';

import { FetchService } from '../../../services/fetch.service';
import { ProjectCacheService } from '../../../services/project-cache.service';
import { LoadingTypes, ProjectStateService } from '../../../services/project-state.service';
import { StyleCardService } from '../../../services/style-card.service';
import { buildFilterFields, ColumnVisibility, createRowSelection, groupSpans, LabelItem, persisted, rowsPerPageOptions, TableService, trackStuck } from '../../../services/style-table.service';
import { FlattenedMetadata, TableItem, TableMetadataService } from '../../../services/table-metadata.service';
import { UserSettingsService } from '../../../services/user-settings.service';
import { CompareService } from '../compare-versions/compare-versions.service';

import { TreeNodeData } from '../../../common/data.model';
import { TooltipDirective } from '../../../common/tooltip.directive';

/**
 * Reviewed: 2026-08-14 (ng21)
 *
 * Easier UI for editing metdata
 * Displays all versions of metadata (baseline, live, prototype)
 * Used to track if changes are planned in prototype and updates automatically when those changes go live
 *
 * TODO:
 ** add export changed fields for translation
 *
 */
@Component({
  selector: 'aida-metadata',
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    ButtonModule,
    CheckboxModule,
    DrawerModule,
    FieldsetModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    ProgressBarModule,
    TableModule,
    AiMetadataComponent,
    CompareSelectComponent,
    EditMetadataComponent,
    MenuPageActionsComponent,
    ProjectSettingsComponent,
    TooltipDirective,
  ],
  templateUrl: 'table-metadata.component.html',
  styleUrl: '../../../../sticky.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableMetadataComponent implements OnInit {
  private readonly injector = inject(Injector);
  protected readonly projectState = inject(ProjectStateService);
  protected readonly projectCache = inject(ProjectCacheService);
  protected readonly tableMetadata = inject(TableMetadataService);
  protected readonly tableService = inject(TableService);
  protected readonly styleCardService = inject(StyleCardService);
  protected readonly fetchService = inject(FetchService);
  private readonly compareService = inject(CompareService);
  protected readonly settingsService = inject(UserSettingsService);

  /* Search term for filtering table rows */
  protected readonly searchTerm = signal<string>('');
  /** Tracks if sticky content is currently stuck to X or Y axis*/
  protected readonly stuck = trackStuck();
  /** Unique instance of visibility class */
  protected readonly visible = new ColumnVisibility('metaHidden', [
    persisted('metaFilter', this.projectCache.selectedFilter, ['all', 'changes'] as const),
    persisted('metaLang', this.projectCache.selectedLang, ['en', 'fr', 'both'] as const),
    persisted('metaMeta', this.projectCache.selectedMeta, ['title', 'description', 'keywords'] as const),
  ]);
  /** Count of how many filters are applied */
  protected readonly filterCount = computed(() => {
    const filterFilter = this.projectCache.selectedFilter() !== 'all' ? 1 : 0;
    const langFilter = this.projectCache.selectedLang() !== 'both' ? 1 : 0;
    const metaFilter = this.projectCache.selectedMeta() ? 1 : 0;
    const colFilter = this.visibleColumns().length !== this.columns().length ? 1 : 0;
    const searchFilter = this.searchTerm() ? 1 : 0;
    return (filterFilter + langFilter + metaFilter + colFilter + searchFilter).toString();
  });
  /** Controls visibility of row and column filter drawer */
  protected showDrawer = false;

  ngOnInit() {
    this.projectCache.selectedLang.set('both');
    /** Restores users default column settings on load */
    this.visible.restore();
  }

  /** All table rows */
  protected readonly rows = computed(() => {
    return this.tableMetadata.flattenMetadata(this.projectState.getProject().projectData);
  });

  /** Selected table rows */
  protected readonly selection = createRowSelection(this.rows);

  /** Visible table rows */
  protected readonly visibleRows = computed(() => {
    const rows = this.rows();
    if (this.projectCache.selectedFilter() === 'all') return rows;

    const keys = this.columns()
      .map((col) => col.key)
      .filter((key) => key.endsWith('Live') || key.endsWith('Proto'));

    return rows.filter((row) => {
      const r = row as unknown as Record<string, TableItem>;
      return keys.some((key) => r[key].content !== 'noChange');
    });
  });

  /** All table columns (keys, groups, version, & an indicator for first column in group) */
  protected readonly columns = computed(() => {
    const first = this.rows()[0] as unknown as Record<string, TableItem> | undefined;
    if (!first) return [];

    const selectedMeta = this.projectCache.selectedMeta();
    const selectedLang = this.projectCache.selectedLang();

    const metas = selectedMeta?.length ? [selectedMeta] : ['title', 'description', 'keywords'];
    const langs = selectedLang === 'both' ? ['En', 'Fr'] : [selectedLang === 'en' ? 'En' : 'Fr'];

    const prefixes = metas.flatMap((meta) => langs.map((lang) => `${meta}${lang}`));

    const columns = Object.entries(first).filter(([key]) => prefixes.some((p) => key.startsWith(p)));

    const versionType = (key: string): LoadingTypes | null =>
      key.endsWith('Base') ? 'baseline' : key.endsWith('Proto') ? 'prototype' : key.endsWith('Live') ? 'live' : key.endsWith('Ai') ? 'aiMetadata' : null;

    return columns.map(([key, cell], i) => ({
      key,
      group: cell.group,
      version: cell.version,
      type: versionType(key),
      isGroupStart: i === 0 || columns[i - 1][1].group !== cell.group,
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
      map.get(col.group)!.push({ key: col.key, column: col.version });
    }
    return [...map].map(([group, cols]) => ({ group, cols }));
  });

  markForTranslation() {
    marker('metadata.status.changePendingReview');
    marker('metadata.status.changeApproved');
    marker('metadata.status.changeLive');
    marker('metadata.status.noChangesPendingReview');
    marker('metadata.status.noChangesApproved');
  }

  /***** END OF TABLE FUNCTIONS *****/

  /***** START OF PROGRESS BAR FUNCTIONS *****/

  /** Approved rows count */
  protected readonly approvedRows = computed(() => this.rows().filter((row) => row.approved === true).length);
  /** Pending updates rows count */
  protected readonly liveChangesRows = computed(() => this.rows().filter((row) => this.approvalStatus(row) === 'changeLive').length);
  /** Total updated rows count */
  protected readonly changedRows = computed(() => this.rows().filter((row) => this.approvalStatus(row).startsWith('change')).length);

  /***** END OF PROGRESS BAR FUNCTIONS *****/

  /***** START OF EDITOR FUNCTIONS *****/

  /* TreeNode selected in page dropdown */
  protected readonly selectedNode = signal<TreeNode<TreeNodeData> | null>(null);
  /* Row associated with selected TreeNode */
  protected readonly selectedRow = signal<FlattenedMetadata | null>(null);

  constructor() {
    effect(() => {
      const path = this.compareService.selectedPage();
      this.selectedNode.set(this.projectState.findNodeByPath(this.projectState.getProject().projectData, path, 'en'));
      const row = this.rows().find((row) => row.label[this.projectCache.uiLang()].path === path);
      if (row) {
        this.selectedRow.set(row);
      }
    });
  }

  /** Set project modified date when metadata is edited (AI or prototype) */
  protected onMetaChanged() {
    this.projectState.setModifiedDate();
  }

  /** Update corresponding prototype data when AI metadata is accepted */
  protected onMetaAccepted(lang: 'en' | 'fr', emitted: { field: 'description' | 'keywords'; value: string }) {
    const nodeData = this.selectedNode()?.data;
    const proto = nodeData?.prototype;
    if (!proto) return;

    nodeData.prototype = {
      ...proto,
      [lang]: { ...proto[lang], [emitted.field]: emitted.value },
    };

    this.projectState.setModifiedDate();
  }

  /** Sets page signal and scrolls to metadata editor */
  editMeta(path: string) {
    this.compareService.selectedPage.set(path);
    afterNextRender(
      () => {
        const el = document.getElementById('edit-metadata');
        if (!el) return;
        window.scrollTo({ left: 0, top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
      },
      { injector: this.injector },
    );
  }

  /** Syncs H1 and double H1 to title */
  generateTitleFromH1(label: LabelItem) {
    const h1 = label.h1;
    const doubleH1 = label.doubleH1 ? ` - ${label.doubleH1}` : '';
    const title = h1 + doubleH1;
    const nodeData = this.projectState.findNodeByPath(this.projectState.getProject().projectData, label.path, this.projectCache.uiLang())?.data;
    if (!nodeData) return;
    nodeData.prototype[this.projectCache.uiLang()].title = title;
    this.projectState.setModifiedDate();
  }

  /***** END OF EDITOR FUNCTIONS *****/

  /***** START OF APPROVAL FUNCTIONS *****/

  /** Toggle metadata approval for a path when user clicks approval div */
  protected updateApproval(value: boolean, path: string) {
    const nodeData = this.projectState.findNodeByPath(this.projectState.getProject().projectData, path, this.projectCache.uiLang())?.data;
    if (!nodeData) return;
    if (value) {
      nodeData.approved = { ...nodeData.approved, metadata: this.tableMetadata.hashMetadata(nodeData) };
      this.projectState.setModifiedDate();
    } else if (nodeData.approved) {
      nodeData.approved.metadata = undefined;
      this.projectState.setModifiedDate();
    }
  }

  /** Tracks which path was last clicked so we don't show hover effect until after pointer leaves */
  protected readonly noPreviewPath = signal<string | null>(null);

  /** Cell style functions */
  protected approvalStatus(row: FlattenedMetadata): 'changePendingReview' | 'changeApproved' | 'changeLive' | 'noChangesPendingReview' | 'noChangesApproved' {
    const cells = row as unknown as Record<string, TableItem>;
    const changed = (suffix: 'Proto' | 'Live') => ['title', 'description', 'keywords'].some((meta) => ['En', 'Fr'].some((lang) => cells[`${meta}${lang}${suffix}`]?.content !== 'noChange'));
    const approved = row.approved;
    if (changed('Proto') && !approved) return 'changePendingReview';
    if (changed('Proto') && approved) return 'changeApproved';
    if (changed('Live')) return 'changeLive';
    if (!approved) return 'noChangesPendingReview';
    return 'noChangesApproved';
  }

  /***** END OF APPROVAL FUNCTIONS *****/

  /***** START OF TABLE STYLE FUNCTIONS *****/

  protected tooltip(content: string, label: Record<'en' | 'fr', LabelItem>, key: string): string | undefined {
    if (key.startsWith('title')) {
      return !this.isMatchForH1(content, label, key) ? marker('metadata.tooltip.notH1Match') : this.isTooLong(content, key) ? marker('metadata.tooltip.tooLongTitle') : undefined;
    } else {
      return this.isTooLong(content, key) ? marker('metadata.tooltip.tooLong') : undefined;
    }
  }

  /** Checks if title matches H1 - Double H1 */
  protected isMatchForH1(content: string, label: Record<'en' | 'fr', LabelItem>, key: string): boolean {
    if (!key.startsWith('title')) return true;
    const h1 = key.startsWith('titleEn') ? label.en.h1 : label.fr.h1;
    const doubleH1 = key.startsWith('titleEn') ? label.en.doubleH1 : label.fr.doubleH1;
    const expectedTitle = doubleH1 ? [' - ', ' – ', ' — ', ': ', ' : '].map((sep) => h1.trim() + sep + doubleH1.trim()) : [h1.trim()];
    return expectedTitle.includes(content.trim());
  }

  /** Checks if metadata is within accepted character length */
  private isTooLong(content: string, key: string): boolean {
    const max = key.startsWith('title') ? 60 : 160;
    if (content !== 'noChange') {
      return content.length > max;
    } else return false;
  }

  /** Checks if metadata is within accepted character length and returns green/red colour classes */
  protected colorClasses(content: string, label: Record<'en' | 'fr', LabelItem>, key: string): string {
    const tooLong = this.isTooLong(content, key);
    const notMatch = !this.isMatchForH1(content, label, key);
    return tooLong || notMatch ? 'bg-red text-red' : 'bg-green text-green';
  }

  /** Logic to determine if sync title button should be visible in a cell */
  protected showSync(row: FlattenedMetadata, key: string): boolean {
    if (!key.endsWith('Proto')) return false;
    if (key.startsWith('titleEn')) {
      const content = row.titleEnProto.content === 'noChange' ? row.titleEnBase.content : row.titleEnProto.content;
      return !this.isMatchForH1(content, row.label, key);
    } else if (key.startsWith('titleFr')) {
      const content = row.titleFrProto.content === 'noChange' ? row.titleFrBase.content : row.titleFrProto.content;
      return !this.isMatchForH1(content, row.label, key);
    } else return false;
  }
}
