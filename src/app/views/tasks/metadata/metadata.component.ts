import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';
import { FieldsetModule } from 'primeng/fieldset';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { Table, TableModule } from 'primeng/table';

import { CompareSelectComponent } from '../../../components/compare/compare-select/compare-select.component';
import { EditMetadataComponent } from '../../../components/edit-node/edit-metadata/edit-metadata.component';
import { ProjectSettingsComponent } from '../../../components/project-settings/project-settings.component';

import { FetchService } from '../../../services/fetch.service';
import { ProjectCacheService } from '../../../services/project-cache.service';
import { FlattenedMetadata, LabelItem, ProjectMetadataService, TableItem } from '../../../services/project-metadata.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { StyleCardService } from '../../../services/style-card.service';
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
 ** add multi-page action menu and link checkboxes to refreshing data, generating metadata, adjusted status, and deletions,
 ** add single-page action menu to select a page section for refreshing data and generating metadata,
 ** add single-page action menu to table for editing node data, AI suggestions, and opening in new tab
 ** add legend for color-coding
 ** add a "confirm no changes" option and a count of how many metadatas [need to be reviewed / total] & [updated on Canada.ca / total planned updates]
 ** add a tag for the approval status
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
    TableModule,
    CompareSelectComponent,
    EditMetadataComponent,
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
  private readonly projectState = inject(ProjectStateService);
  private readonly projectMetadata = inject(ProjectMetadataService);
  protected readonly projectCache = inject(ProjectCacheService);
  private readonly compareService = inject(CompareService);
  private readonly fetchService = inject(FetchService);
  private readonly settingsService = inject(UserSettingsService);

  protected readonly selectedNode = signal<TreeNode<TreeNodeData> | null>(null);
  protected readonly selectedNodes: FlattenedMetadata[] = [];
  protected readonly uiLang = computed<'en' | 'fr'>(() => (this.translate.currentLang()?.startsWith('fr') ? 'fr' : 'en'));
  protected readonly searchTerm = signal<string>('');
  protected readonly dt = viewChild.required<Table>('dt');

  constructor() {
    effect(() => {
      const path = this.compareService.selectedPage();
      this.selectedNode.set(this.projectState.findNodeByPath(this.projectState.getProject().projectData, path, 'en'));
    });
  }

  ngOnInit() {
    this.projectCache.selectedLang.set('both');
  }

  protected onMetaChanged() {
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
      .map((c) => c.key)
      .filter((k) => k.endsWith('Live') || k.endsWith('Proto'));

    return rows.filter((row) => {
      const r = row as unknown as Record<string, TableItem>;
      return keys.some((key) => r[key].content !== 'noChange');
    });
  });

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

    return columns.map(([key, cell], i) => ({
      key,
      group: cell.group,
      version: cell.version,
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

  protected approvalClasses(approved: boolean): string {
    const isDark = this.settingsService.darkMode();
    const classes =
      isDark && approved
        ? 'hover:bg-green-600 hover:border-green-400 text-green-400'
        : isDark
          ? 'hover:bg-red-600 hover:border-red-400 text-red-400'
          : approved
            ? 'hover:bg-green-50 hover:border-green-500 text-green-500'
            : 'hover:bg-red-50 hover:border-red-500 text-red-500';
    return classes;
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
