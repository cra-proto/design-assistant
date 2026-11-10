import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';

import { AlertsComponent } from './alerts/alerts.component';

import { htmlProcessingResult } from '../../../../services/html-normalization.service';
import { CompareService } from '../../../../views/tasks/compare-versions/compare-versions.service';
import { AlertService } from './alerts/alert.service';

import { coerceInteractiveResultLeadIns, getReportableAlertsFromHtml } from './alerts/alert-reportable.utils';
import { ALERT_SEVERITY_RANK, AlertGuidanceState, computeAlertCategories, computeAlertMaxSeverity, getAlertCategoryI18nKey } from './alerts/alert.config';

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
  private autoExpandedReportKey = '';

  constructor() {
    effect(() => {
      const rows = this.rows();
      const sourceHtml = this.sourceHtml();
      const pagePath = this.compareService.selectedPage();
      const cachedAnalysis = sourceHtml && pagePath ? this.alertService.getRetainedAnalysis(sourceHtml, pagePath) : null;
      if (cachedAnalysis) {
        const reportKey = `${pagePath}\u0000${cachedAnalysis.analyzedAt}`;
        if (reportKey !== this.autoExpandedReportKey) {
          this.autoExpandedReportKey = reportKey;
          this.expandedRows = { ...this.expandedRows, alerts: true };
        }
      } else {
        this.autoExpandedReportKey = '';
      }
      const categories = computeAlertCategories(cachedAnalysis?.issues ?? []);
      this.alertState.set({
        categories,
        maxSeverity: computeAlertMaxSeverity(cachedAnalysis?.issues ?? []),
        loading: false,
        error: false,
        hasAnalysis: cachedAnalysis !== null,
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

  protected categoryI18nKey(category: string): string {
    return getAlertCategoryI18nKey(category);
  }

  markForTranslation() {
    marker('problems.components.alerts.title');
    marker('problems.components.health.unknown');
    marker('problems.components.health.high');
    marker('problems.components.health.medium');
    marker('problems.components.health.low');
    marker('problems.components.health.ok');
    marker('problems.alerts.categoryValue.misuse');
    marker('problems.alerts.categoryValue.tooWordy');
    marker('problems.alerts.categoryValue.genericTitles');
    marker('problems.alerts.categoryValue.unclearImpact');
    marker('problems.alerts.categoryValue.outdated');
    marker('problems.alerts.categoryValue.missingHeading');
    marker('problems.alerts.categoryValue.wrongType');
    marker('problems.alerts.categoryValue.hiddenContent');
    marker('problems.alerts.categoryValue.wrongComponent');
    marker('problems.alerts.categoryValue.tooManyLinks');
    marker('problems.alerts.categoryValue.wrongPlacement');
    marker('problems.alerts.categoryValue.alertOverload');
    marker('problems.alerts.categoryValue.lowRelevance');
    marker('problems.alerts.categoryValue.incorrectHierarchy');
    marker('problems.alerts.categoryValue.nothingActionable');
    marker('problems.alerts.categoryValue.focusOrder');
    marker('problems.alerts.categoryValue.contentClarity');
    marker('problems.alerts.categoryValue.nonTextContent');
    marker('problems.alerts.categoryValue.missingAlertSemantics');
    marker('problems.alerts.recommendation.missingAlertSemantics');
    marker('problems.alerts.categoryValue.accessibilityCode');
    marker('problems.alerts.categoryValue.noIssues');
    marker('problems.alerts.severityValue.high');
    marker('problems.alerts.severityValue.medium');
    marker('problems.alerts.severityValue.low');
    marker('problems.alerts.severityValue.notApplicable');
    marker('problems.alerts.severityValue.unknown');
  }
}
