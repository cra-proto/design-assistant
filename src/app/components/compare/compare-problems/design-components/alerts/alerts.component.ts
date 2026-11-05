import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';

import { AlertService } from './alert.service';

import { coerceInteractiveResultLeadIns, getReportableAlertsFromHtml } from './alert-reportable.utils';
import { ALERT_SEVERITY_RANK, AlertGuidanceState, AlertIssue, computeAlertCategories, computeAlertMaxSeverity, getAlertCategoryI18nKey, getAlertSeverityI18nKey, isNoAlertIssue } from './alert.config';

@Component({
  selector: 'aida-alerts',
  imports: [CommonModule, FormsModule, TranslatePipe, ButtonModule, CheckboxModule, MessageModule, ProgressSpinnerModule, TableModule],
  templateUrl: './alerts.component.html',
  styleUrl: './alerts.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsComponent {
  private readonly alertService = inject(AlertService);
  private readonly translate = inject(TranslateService);

  readonly sourceHtml = input('');
  readonly pagePath = input.required<string>();
  readonly preferredModel = input<string>();
  readonly selectAll = input(true);
  readonly analyzeOnInit = input(false);
  readonly stateChange = output<AlertGuidanceState>();

  protected readonly issues = signal<AlertIssue[]>([]);
  protected readonly analysisLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  private readonly analyzedHtmlHash = signal('');
  private readonly analysisCurrent = signal(false);
  private readonly canonicalReportableIssueCount = signal(0);
  private readonly frenchReportComplete = signal(false);
  private readonly lastFrenchIssues = signal<AlertIssue[]>([]);
  private lastFrenchPagePath = '';
  private autoAnalysisKey = '';
  private selectAllInitialized = false;

  protected readonly isFrench = computed(() => (this.translate.currentLang() ?? 'en').toLowerCase().startsWith('fr'));
  protected readonly translationStatus = computed(() => this.alertService.getFrenchTranslationStatus(this.pagePath()));
  protected readonly waitingForFrench = computed(() => this.isFrench() && this.translationStatus() === 'pending');
  protected readonly translationUnavailable = computed(
    () =>
      this.isFrench() &&
      this.canonicalReportableIssueCount() > 0 &&
      !this.frenchReportComplete() &&
      !this.analysisLoading() &&
      (this.translationStatus() === 'idle' || this.translationStatus() === 'failed'),
  );
  protected readonly loading = computed(() => this.analysisLoading() || this.waitingForFrench());
  protected readonly hasHiddenFrenchIssues = computed(() => this.isFrench() && this.canonicalReportableIssueCount() > 0 && this.issues().length === 0);

  protected readonly alertCount = computed(() => {
    const html = this.sourceHtml();
    if (!html) return 0;
    return getReportableAlertsFromHtml(html, {
      interactiveResultLeadIns: coerceInteractiveResultLeadIns(this.translate.instant('problems.alerts.interactiveResultLeadIns')),
    }).length;
  });

  protected readonly hasAnalysis = computed(() => !!this.analyzedHtmlHash());
  protected readonly reanalysisRecommended = computed(() => !this.hasAnalysis() || !this.analysisCurrent());

  constructor() {
    effect(() => {
      const html = this.sourceHtml();
      const pagePath = this.pagePath();
      const currentLanguage = this.translate.currentLang();
      const cached = html && pagePath ? this.alertService.getRetainedAnalysis(html, pagePath) : null;
      if (this.lastFrenchPagePath !== pagePath) {
        this.lastFrenchPagePath = pagePath;
        this.lastFrenchIssues.set([]);
      }
      this.canonicalReportableIssueCount.set(cached?.issues.filter((issue) => !isNoAlertIssue(issue)).length ?? 0);
      const hasCompleteFrenchReport = !!cached && this.alertService.hasCompleteFrenchTranslation(cached);
      this.frenchReportComplete.set(hasCompleteFrenchReport);
      const completeFrenchIssues = cached && hasCompleteFrenchReport ? this.sortIssues(this.alertService.getIssuesForDisplay(cached, 'fr')) : null;
      if (completeFrenchIssues) this.lastFrenchIssues.set(completeFrenchIssues);
      this.issues.set(this.isFrench() ? (completeFrenchIssues ?? this.lastFrenchIssues()) : cached ? this.sortIssues(this.alertService.getIssuesForDisplay(cached, currentLanguage)) : []);
      this.analyzedHtmlHash.set(cached?.analyzedHtmlHash ?? '');
      this.analysisCurrent.set(cached?.isCurrent ?? false);
      this.error.set(null);
      untracked(() => this.emitState());

      const autoAnalysisKey = `${pagePath}\u0000${html}`;
      if (this.analyzeOnInit() && html && cached === null && this.alertCount() > 0 && this.autoAnalysisKey !== autoAnalysisKey) {
        this.autoAnalysisKey = autoAnalysisKey;
        untracked(() => void this.analyze());
      }
    });
    effect(() => {
      const selectAll = this.selectAll();
      if (!this.selectAllInitialized) {
        this.selectAllInitialized = true;
        return;
      }
      untracked(() => this.applySelectAll(selectAll));
    });
    effect(() => {
      this.loading();
      untracked(() => this.emitState());
    });
  }

  protected async analyze(): Promise<void> {
    const requestHtml = this.sourceHtml();
    const requestPagePath = this.pagePath();
    if (!requestHtml || !this.alertCount() || this.analysisLoading()) return;

    this.analysisLoading.set(true);
    this.error.set(null);
    this.emitState();
    try {
      await this.alertService.analyze(requestHtml, requestPagePath, this.preferredModel(), true);
      if (this.sourceHtml() !== requestHtml || this.pagePath() !== requestPagePath) return;
      const report = this.alertService.getRetainedAnalysis(requestHtml, requestPagePath);
      this.analyzedHtmlHash.set(report?.analyzedHtmlHash ?? '');
      this.analysisCurrent.set(report?.isCurrent ?? false);
      this.emitState();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : this.translate.instant('problems.alerts.analysisError'));
      this.emitState();
    } finally {
      this.analysisLoading.set(false);
      this.emitState();
    }
  }

  protected onIncludeToggle(): void {
    const sorted = this.sortIssues(this.issues());
    this.issues.set(sorted);
    this.alertService.updateIssues(this.pagePath(), sorted);
    this.emitState();
  }

  protected isNoIssueRow(issue: AlertIssue): boolean {
    return isNoAlertIssue(issue);
  }

  protected severityClass(severity: string): string {
    const normalized = severity.toLowerCase();
    if (normalized === 'low') return 'chip-minor';
    if (normalized === 'medium') return 'chip-med';
    if (normalized === 'high') return 'chip-severe';
    return 'chip-unk';
  }

  protected categoryI18nKey(category: string): string {
    return getAlertCategoryI18nKey(category);
  }

  protected severityI18nKey(severity: string): string {
    return getAlertSeverityI18nKey(severity);
  }

  private sortIssues(issues: AlertIssue[]): AlertIssue[] {
    return [...issues].sort((left, right) => {
      const severityDifference = (ALERT_SEVERITY_RANK[right.severity.toLowerCase()] ?? -1) - (ALERT_SEVERITY_RANK[left.severity.toLowerCase()] ?? -1);
      if (severityDifference) return severityDifference;
      if ((left.alertIndex ?? 0) !== (right.alertIndex ?? 0)) return (left.alertIndex ?? 0) - (right.alertIndex ?? 0);
      return left.category.localeCompare(right.category, undefined, { sensitivity: 'base' });
    });
  }

  private applySelectAll(selectAll: boolean): void {
    if (!this.issues().length) return;
    const updated = this.issues().map((issue) => ({
      ...issue,
      include: isNoAlertIssue(issue) ? false : selectAll,
    }));
    this.issues.set(updated);
    if (this.analyzedHtmlHash()) this.alertService.updateIssues(this.pagePath(), updated);
    this.emitState();
  }

  private emitState(): void {
    const issues = this.issues();
    this.stateChange.emit({
      categories: computeAlertCategories(issues),
      maxSeverity: computeAlertMaxSeverity(issues),
      loading: this.loading(),
      error: this.error() !== null,
      hasAnalysis: this.hasAnalysis(),
    });
  }
}
