import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, inject, OnInit, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';
import { FieldsetModule } from 'primeng/fieldset';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressBarModule } from 'primeng/progressbar';
import { Table, TableModule } from 'primeng/table';

import { CompareSelectComponent } from '../../../components/compare/compare-select/compare-select.component';
import { AiMetadataComponent } from '../../../components/edit-node/ai-metadata/ai-metadata.component';
import { EditMetadataComponent } from '../../../components/edit-node/edit-metadata/edit-metadata.component';
import { MenuBulkPageActionsComponent } from '../../../components/menu-bulk-page-actions/menu-bulk-page-actions.component';
import { ProjectSettingsComponent } from '../../../components/project-settings/project-settings.component';

import { FetchService } from '../../../services/fetch.service';
import { ProjectCacheService } from '../../../services/project-cache.service';
import { FlattenedMetadata, LabelItem, ProjectMetadataService, TableItem } from '../../../services/project-metadata.service';
import { LoadingTypes, ProjectStateService } from '../../../services/project-state.service';
import { StyleCardService } from '../../../services/style-card.service';
import { StyleTreeNodeService } from '../../../services/style-treenode.service';
import { UserSettingsService } from '../../../services/user-settings.service';
import { CompareService } from '../compare/compare.service';

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
 ** add single-page action menu to: refresh prototype/live, generate metadata, update status, edit node data, open in AI suggestions, open in new tab
 ** put single-page action menu next to table checkbox AND in single page editor (have 2 button styles)
 ** reorganize controls into more logical groups
 ** add export changed fields for translation
 ** add import translations???
 *
 */
@Component({
  selector: 'aida-metadata',
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    FieldsetModule,
    IconFieldModule,
    InputIconModule,
    InputTextModule,
    ProgressBarModule,
    TableModule,
    AiMetadataComponent,
    CompareSelectComponent,
    EditMetadataComponent,
    MenuBulkPageActionsComponent,
    ProjectSettingsComponent,
    TooltipDirective,
  ],
  templateUrl: 'metadata.component.html',
  styleUrl: 'metadata.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetadataComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  protected readonly styleCardService = inject(StyleCardService);
  private readonly styleTreeNodeService = inject(StyleTreeNodeService);
  protected readonly projectState = inject(ProjectStateService);
  protected readonly projectMetadata = inject(ProjectMetadataService);
  protected readonly projectCache = inject(ProjectCacheService);
  private readonly compareService = inject(CompareService);
  private readonly fetchService = inject(FetchService);
  private readonly settingsService = inject(UserSettingsService);

  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly stuckX = signal(false);
  protected readonly stuckY = signal(false);

  /* TreeNode selected in page dropdown */
  protected readonly selectedNode = signal<TreeNode<TreeNodeData> | null>(null);
  /* Row associated with selected TreeNode */
  protected readonly selectedRow = signal<FlattenedMetadata | null>(null);

  /* Rows selected in table */
  protected readonly selectedRows = signal<FlattenedMetadata[]>([]);
  /* TreeNodes associated to selected table rows (for bulk action dropdown) */
  protected readonly selectedNodes = computed(() => {
    return this.projectState.findNodesByPaths(
      this.projectState.getProject().projectData,
      this.selectedRows().map((r) => r.label[this.uiLang()].path),
      this.uiLang(),
    );
  });

  /* Current UI language */
  protected readonly uiLang = computed<'en' | 'fr'>(() => (this.translate.currentLang()?.startsWith('fr') ? 'fr' : 'en'));
  /* Search term for filtering table rows */
  protected readonly searchTerm = signal<string>('');
  /* Reference to data table */
  protected readonly dt = viewChild.required<Table>('dt');

  constructor() {
    effect(() => {
      const path = this.compareService.selectedPage();
      this.selectedNode.set(this.projectState.findNodeByPath(this.projectState.getProject().projectData, path, 'en'));
      const row = this.rows().find((row) => row.label[this.uiLang()].path === path);
      if (row) {
        this.selectedRow.set(row);
      }
    });
    effect(() => {
      const byPath = new Map(this.rows().map((row) => [row.label.en.path, row]));
      untracked(() => {
        this.selectedRows.set(
          this.selectedRows()
            .map((row) => byPath.get(row.label.en.path))
            .filter((row): row is FlattenedMetadata => !!row),
        );
      });
    });
    const update = () => {
      const el = this.host.nativeElement as HTMLElement;
      const th = el.querySelector<HTMLElement>('th.sticky-table-column');
      if (!th) return;
      const rect = th.getBoundingClientRect();
      const style = getComputedStyle(th);
      this.stuckX.set(rect.left <= (parseFloat(style.left) || 0) + 0.5);
      this.stuckY.set(rect.top <= (parseFloat(style.top) || 0) + 0.5);
    };

    // capture: scroll events from ancestor containers don't bubble to window
    document.addEventListener('scroll', update, { capture: true, passive: true });
    window.addEventListener('resize', update, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('scroll', update, { capture: true });
      window.removeEventListener('resize', update);
    });
  }

  ngOnInit() {
    this.projectCache.selectedLang.set('both');
  }

  protected onMetaChanged() {
    this.projectState.setModifiedDate();
  }

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

  /** All table rows */
  protected readonly rows = computed(() => {
    return this.projectMetadata.flattenMetadata(this.projectState.getProject().projectData);
  });

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

  /** Approved rows */
  protected readonly approvedRows = computed(() => this.rows().filter((row) => row.approved === true).length);
  /** Pending updates rows */
  protected readonly liveChangesRows = computed(() => this.rows().filter((row) => this.approvalStatus(row) === 'changeLive').length);
  /** Total updated rows */
  protected readonly changedRows = computed(() => this.rows().filter((row) => this.approvalStatus(row).startsWith('change')).length);

  /** Column keys, groups, version, & an indicator for first column in group */
  protected readonly columns = computed(() => {
    const first = this.rows()[0] as unknown as Record<string, TableItem> | undefined;
    if (!first) return [];

    const selectedMeta = this.projectCache.selectedMeta();
    const selectedLang = this.projectCache.selectedLang();

    const metas = selectedMeta.length ? selectedMeta : ['title', 'description', 'keywords'];
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

  /** Group names & calculated span for table */
  protected readonly groups = computed(() => {
    const result: { name: string; span: number }[] = [];
    for (const column of this.columns()) {
      const last = result.at(-1);
      if (last?.name === column.group) last.span++;
      else result.push({ name: column.group, span: 1 });
    }
    return result;
  });

  /** Set max rows per page to the total pages in project */
  protected get rowsPerPageOptions(): number[] {
    const total = this.rows().length;
    return [25, 50, 100].filter((n) => n < total).concat(total);
  }

  protected updateNodeApproval(node: TreeNode<TreeNodeData>) {
    if (!node.data) return;
    this.projectMetadata.approvalStatus(node.data);
  }
  protected updateApproval(value: boolean, path: string) {
    const nodeData = this.projectState.findNodeByPath(this.projectState.getProject().projectData, path, this.uiLang())?.data;
    if (!nodeData) return;
    if (value) {
      nodeData.approved = { ...nodeData.approved, metadata: this.projectMetadata.hashMetadata(nodeData) };
      this.projectState.setModifiedDate();
    } else if (nodeData.approved) {
      nodeData.approved.metadata = undefined;
      this.projectState.setModifiedDate();
    }
  }

  protected readonly noPreviewPath = signal<string | null>(null);
  protected onToggleEnter(path: string) {
    if (this.noPreviewPath() !== path) this.noPreviewPath.set(null);
  }

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
  protected tooltip(content: string, label: Record<'en' | 'fr', LabelItem>, key: string): string | undefined {
    if (key.startsWith('title')) {
      return !this.isMatchforH1(content, label, key) ? 'metadata.tooltip.notH1Match' : undefined;
    } else {
      return this.isTooLong(content) ? 'metadata.tooltip.tooLong' : undefined;
    }
  }

  protected isRed(content: string, label: Record<'en' | 'fr', LabelItem>, key: string): boolean {
    if (key.startsWith('title')) {
      return !this.isMatchforH1(content, label, key);
    } else {
      return this.isTooLong(content);
    }
  }

  protected countClasses(content: string, key: string): string {
    const max = key.startsWith('title') ? 60 : 160;
    const tooLong = content.length > max;
    const classes = tooLong ? 'bg-red text-red' : 'bg-green text-green';
    return classes;
  }

  /** Checks if title matches H1 - Double H1 */
  protected isMatchforH1(title: string, label: Record<'en' | 'fr', LabelItem>, key: string): boolean {
    const h1 = key.startsWith('titleEn') ? label.en.h1 : label.fr.h1;
    const doubleH1 = key.startsWith('titleEn') ? label.en.doubleH1 : label.fr.doubleH1;
    const expectedTitle = doubleH1 ? [' - ', ' – ', ' — ', ': ', ' : '].map((sep) => h1.trim() + sep + doubleH1.trim()) : [h1.trim()];
    return expectedTitle.includes(title.trim());
  }

  /** Checks if metadata is within accepted character length */
  protected isTooLong(content: string): boolean {
    if (content !== 'noChange') {
      return content.length > 160;
    } else return false;
  }

  protected normalizeSearchValue(value: string): string {
    return this.fetchService.generatePath(value);
  }

  // Filter on currently visible columns plus h1, double h1, and path
  protected readonly filterFields = computed(() => [`label.${this.uiLang()}.h1`, `label.${this.uiLang()}.doubleH1`, `label.${this.uiLang()}.path`, ...this.columns().map((c) => `${c.key}.content`)]);

  /** Legend for table colour-coding: new page, page move, & unpublish */
  protected get legendItems() {
    const items: { context: string[]; text: string }[] = [];
    const tree = this.projectState.getProject().projectData;
    if (tree.length === 0) return items;

    const allColours = this.styleTreeNodeService.contextStyles;

    const hasNew = this.projectState.findNodeWhere(tree, (node) => node.data?.status?.isNew === true) !== null;
    const hasMoves = this.projectState.findNodeWhere(tree, (node) => node.data?.status?.isMoved === true) !== null;
    const hasROT = this.projectState.findNodeWhere(tree, (node) => node.data?.status?.isROT === true) !== null;

    if (this.projectCache.selectedViewIA() === 'changes') {
      if (hasNew) {
        items.push({ context: [allColours['new'].replace('border-dashed', '')], text: this.translate.instant('editNode.isNew') });
      }
      if (hasMoves) {
        items.push({ context: [allColours['move'].replace('border-dashed', '')], text: this.translate.instant('editNode.isMoved') });
      }
      if (hasROT) {
        items.push({ context: [allColours['rot'].replace('border-dashed', '')], text: this.translate.instant('editNode.isROT') });
      }
    }
    return items;
  }

  markForTranslation() {
    marker('metadata.status.changePendingReview');
    marker('metadata.status.changeApproved');
    marker('metadata.status.changeLive');
    marker('metadata.status.noChangesPendingReview');
    marker('metadata.status.noChangesApproved');
    marker('metadata.tooltip.tooLong');
    marker('metadata.tooltip.notH1Match');
  }
}
