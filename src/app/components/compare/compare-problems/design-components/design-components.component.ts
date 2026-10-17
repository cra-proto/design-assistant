import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';

import { AlertsComponent } from './alerts/alerts.component';

import { htmlProcessingResult } from '../../../../services/html-normalization.service';
import { CompareService } from '../../../../views/tasks/compare/compare.service';
import { AlertService } from './alerts/alert.service';

import { coerceInteractiveResultLeadIns, getReportableAlertsFromHtml } from './alerts/alert-reportable.utils';
import { ALERT_SEVERITY_RANK, AlertGuidanceState, computeAlertCategories, computeAlertMaxSeverity } from './alerts/alert.config';

interface GuidanceRow {
  id: 'alerts';
  order: number;
  componentKey: string;
  guidanceUrl: string;
}

@Component({
  selector: 'aida-design-components',
  imports: [CommonModule, TranslatePipe, ButtonModule, ChipModule, MessageModule, TableModule, AlertsComponent],
  templateUrl: './design-components.component.html',
  styleUrl: './design-components.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignComponentsComponent {
  protected readonly compareService = inject(CompareService);
  private readonly translate = inject(TranslateService);
  private readonly alertService = inject(AlertService);
  readonly beforeContent = input<htmlProcessingResult>();
  readonly afterContent = input<htmlProcessingResult>();

  protected readonly sourceHtml = computed(() => (this.afterContent() ?? this.beforeContent())?.html ?? '');
  protected readonly rows = computed<GuidanceRow[]>(() => {
    const html = this.sourceHtml();
    if (!html) return [];
    const alertCount = getReportableAlertsFromHtml(html, {
      interactiveResultLeadIns: coerceInteractiveResultLeadIns(this.translate.instant('problems.alerts.interactiveResultLeadIns')),
    }).length;
    return alertCount
      ? [
          {
            id: 'alerts',
            order: 1,
            componentKey: 'problems.components.alerts.title',
            guidanceUrl: 'https://design.cra-arc.alpha.canada.ca/en/design-systems/gcweb/alerts/index.html',
          },
        ]
      : [];
  });

  protected selectedRows: GuidanceRow[] = [];
  protected expandedRows: Record<string, boolean> = {};
  protected alertSelectAll = true;
  protected readonly alertState = signal<AlertGuidanceState>({ categories: [], maxSeverity: null, loading: false, error: false, hasAnalysis: false });
  private previouslyHadAlertIssues = false;

  constructor() {
    effect(() => {
      const rows = this.rows();
      const sourceHtml = this.sourceHtml();
      const cachedIssues = sourceHtml ? this.alertService.getCachedIssues(sourceHtml) : null;
      const categories = computeAlertCategories(cachedIssues ?? []);
      this.alertState.set({
        categories,
        maxSeverity: computeAlertMaxSeverity(cachedIssues ?? []),
        loading: false,
        error: false,
        hasAnalysis: cachedIssues !== null,
      });
      this.previouslyHadAlertIssues = categories.length > 0;
      if (!rows.length) {
        this.selectedRows = [];
        this.expandedRows = {};
        return;
      }
      const alertWasSelected = this.selectedRows.some((row) => row.id === 'alerts');
      this.selectedRows = alertWasSelected || !this.selectedRows.length ? [rows[0]] : [];
    });
  }

  protected onSelectionChange(rows: GuidanceRow[]): void {
    this.selectedRows = rows;
    this.alertSelectAll = rows.some((row) => row.id === 'alerts');
  }

  protected onAlertStateChange(state: AlertGuidanceState): void {
    const sortedCategories = [...state.categories].sort((left, right) => (ALERT_SEVERITY_RANK[right.severity.toLowerCase()] ?? -1) - (ALERT_SEVERITY_RANK[left.severity.toLowerCase()] ?? -1));
    const nextState = { ...state, categories: sortedCategories };
    const hasIssues = sortedCategories.length > 0;
    if (!this.previouslyHadAlertIssues && hasIssues && !this.selectedRows.some((row) => row.id === 'alerts')) {
      this.selectedRows = [...this.rows()];
      this.alertSelectAll = true;
    }
    this.previouslyHadAlertIssues = hasIssues;
    this.alertState.set(nextState);
  }

  protected expandAll(): void {
    this.expandedRows = Object.fromEntries(this.rows().map((row) => [row.id, true]));
  }

  protected collapseAll(): void {
    this.expandedRows = {};
  }

  protected healthLabel(): string {
    return this.translate.instant(`problems.components.health.${this.healthStatus()}`);
  }

  protected healthIcon(): string {
    const status = this.healthStatus();
    if (status === 'high') return 'pi pi-exclamation-triangle';
    if (status === 'medium') return 'pi pi-exclamation-circle';
    if (status === 'low') return 'pi pi-times-circle';
    if (status === 'ok') return 'pi pi-check-circle';
    return 'pi pi-question-circle';
  }

  protected healthStatus(): string {
    const state = this.alertState();
    if (!state.hasAnalysis || state.error) return 'unknown';
    if (!state.categories.length) return 'ok';
    return state.maxSeverity?.toLowerCase() ?? 'unknown';
  }

  protected severityChip(severity: string | null): string {
    const normalized = (severity ?? '').toLowerCase();
    if (normalized === 'high') return 'chip-severe';
    if (normalized === 'medium') return 'chip-med';
    if (normalized === 'low') return 'chip-minor';
    if (normalized === 'ok') return 'chip-ok';
    return 'chip-unk';
  }
}
