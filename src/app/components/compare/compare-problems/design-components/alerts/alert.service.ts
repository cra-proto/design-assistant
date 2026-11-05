import { inject, Injectable, signal } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { OpenRouterService } from '../../../../../services/ai/openrouter.service';
import { FetchService } from '../../../../../services/fetch.service';
import { ProjectStateService } from '../../../../../services/project-state.service';
import { AlertContextService } from './alert-context.service';

import { AI_ALERT_TRANSLATION_MODEL } from '../../../../../common/ai-models.config';
import { AlertIssuesReport, AlertIssueTranslationData } from '../../../../../common/data.model';
import { ProblemPrompts } from '../../../../../common/prompts/problems.prompts';
import { ProblemPromptKey } from '../../../../../common/prompts/prompt.model';
import { coerceInteractiveResultLeadIns, getReportableAlerts } from './alert-reportable.utils';
import { AlertIssue, isNoAlertIssue } from './alert.config';
import fallbackSeverityJson from './severity-include-fallback.json';

const ALERT_SEVERITY_ALIASES: Record<string, 'High' | 'Medium' | 'Low'> = {
  high: 'High',
  critical: 'High',
  severe: 'High',
  major: 'High',
  urgent: 'High',
  medium: 'Medium',
  med: 'Medium',
  moderate: 'Medium',
  important: 'Medium',
  low: 'Low',
  minor: 'Low',
};

export type AlertFrenchTranslationStatus = 'idle' | 'pending' | 'complete' | 'failed';

interface AlertFallbackConfig {
  severity: string;
  include?: boolean;
  display?: boolean;
  severityOverride?: boolean;
  recommendationOverride?: string;
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly openRouter = inject(OpenRouterService);
  private readonly alertContext = inject(AlertContextService);
  private readonly fetchService = inject(FetchService);
  private readonly projectState = inject(ProjectStateService);
  private readonly translate = inject(TranslateService);
  private readonly translationRunIds = new Map<string, number>();
  private readonly frenchTranslationStates = signal<Record<string, { runId: number; status: AlertFrenchTranslationStatus }>>({});

  private readonly fallbackSeverities: Record<string, AlertFallbackConfig> = Object.fromEntries(
    Object.entries(fallbackSeverityJson as Record<string, string | Partial<AlertFallbackConfig>>).map(([key, value]) => {
      if (typeof value === 'string') return [key.toLowerCase(), { severity: value }];
      return [
        key.toLowerCase(),
        {
          severity: value.severity ?? '',
          include: value.include,
          display: value.display,
          severityOverride: value.severityOverride,
          recommendationOverride: value.recommendationOverride,
        },
      ];
    }),
  );

  async analyze(sourceHtml: string, pagePath: string, preferredModel?: string, force = false): Promise<AlertIssue[]> {
    if (!force) {
      const cached = this.getRetainedAnalysis(sourceHtml, pagePath);
      if (cached !== null) return cached.issues;
    }

    const translationRunId = (this.translationRunIds.get(pagePath) ?? 0) + 1;
    this.translationRunIds.set(pagePath, translationRunId);
    this.setFrenchTranslationStatus(pagePath, translationRunId, 'idle');
    this.clearTranslations(pagePath);

    const payload = this.alertContext.buildCompactAlertsIssuesPayload(sourceHtml);
    const alerts = payload['alerts'];
    if (!Array.isArray(alerts) || alerts.length === 0) {
      this.saveAnalysis(sourceHtml, pagePath, [], preferredModel);
      this.setFrenchTranslationStatus(pagePath, translationRunId, 'complete');
      return [];
    }

    const responseText = await this.openRouter.getTextFromAI(ProblemPrompts[ProblemPromptKey.AlertsProblems], JSON.stringify(payload), preferredModel, 0);
    const parsedIssues = this.parseIssues(responseText);
    const visibleIssues = this.suppressDeferredIssues(parsedIssues);
    const validatedIssues = this.validateAlertIssuesAgainstHtml(visibleIssues, sourceHtml);
    const issues = this.addNoIssuePlaceholders(validatedIssues, alerts.length);
    const report = this.saveAnalysis(sourceHtml, pagePath, issues, preferredModel);
    this.requestFrenchTranslation(pagePath, report, translationRunId);
    return this.cloneIssues(report.issues);
  }

  getRetainedAnalysis(sourceHtml: string, pagePath: string): (AlertIssuesReport & { isCurrent: boolean }) | null {
    const report = this.projectState.getAlertIssuesReport(pagePath);
    if (!report) return null;
    return {
      ...report,
      issues: this.cloneIssues(report.issues),
      isCurrent: report.analyzedHtmlHash === this.fetchService.hashString(sourceHtml),
    };
  }

  getSelectedIssues(sourceHtml: string, pagePath: string): AlertIssue[] {
    return (this.getRetainedAnalysis(sourceHtml, pagePath)?.issues ?? []).filter((issue) => issue.include && !isNoAlertIssue(issue));
  }

  getFrenchTranslationStatus(pagePath: string): AlertFrenchTranslationStatus {
    return this.frenchTranslationStates()[pagePath]?.status ?? 'idle';
  }

  hasCompleteFrenchTranslation(report: AlertIssuesReport): boolean {
    const reportableIssues = report.issues.filter((issue) => !isNoAlertIssue(issue));
    if (!reportableIssues.length) return true;
    const translations = new Map((report.translations?.fr?.issues ?? []).map((translation) => [translation.translationId, translation]));
    return reportableIssues.every((issue) => {
      if (!issue.translationId) return false;
      const translation = translations.get(issue.translationId);
      return !!translation?.description.trim() && !!translation.recommendation.trim();
    });
  }

  updateIssues(pagePath: string, issues: AlertIssue[]): void {
    const report = this.projectState.getAlertIssuesReport(pagePath);
    if (!report) return;
    const incomingByTranslationId = new Map(issues.filter((issue) => issue.translationId).map((issue) => [issue.translationId!, issue]));
    const incomingByIdentity = new Map<string, AlertIssue[]>();
    for (const issue of issues) {
      const identity = this.getIssueIdentity(issue);
      incomingByIdentity.set(identity, [...(incomingByIdentity.get(identity) ?? []), issue]);
    }
    const updatedIssues = report.issues.map((issue) => {
      const byId = issue.translationId ? incomingByTranslationId.get(issue.translationId) : undefined;
      const identityMatches = incomingByIdentity.get(this.getIssueIdentity(issue)) ?? [];
      const incoming = byId ?? identityMatches.shift();
      return incoming ? { ...issue, include: isNoAlertIssue(issue) ? false : incoming.include } : issue;
    });
    this.projectState.setAlertIssuesReport(pagePath, {
      ...report,
      issues: this.cloneIssues(updatedIssues),
    });
  }

  getIssuesForDisplay(report: AlertIssuesReport, language: string | null): AlertIssue[] {
    const issues = this.cloneIssues(report.issues);
    if (!(language ?? 'en').toLowerCase().startsWith('fr')) {
      return issues.map((issue) => ({
        ...issue,
        recommendation: this.lookupRecommendationOverride(issue.category, 'en') ?? issue.recommendation,
      }));
    }

    const translations = new Map((report.translations?.fr?.issues ?? []).map((translation) => [translation.translationId, translation]));
    return issues.map((issue) => {
      if (isNoAlertIssue(issue)) {
        return {
          ...issue,
          description: this.translate.instant('problems.alerts.noIssueDescription', { index: issue.alertIndex ?? '' }, 'fr'),
          recommendation: this.translate.instant('problems.alerts.noChangesRequired', undefined, 'fr'),
        };
      }

      const translation = issue.translationId ? translations.get(issue.translationId) : undefined;
      return {
        ...issue,
        description: translation?.description ?? issue.description,
        recommendation: this.lookupRecommendationOverride(issue.category, 'fr') ?? translation?.recommendation ?? issue.recommendation,
      };
    });
  }

  normalizeAlertIssues(issues: AlertIssue[]): AlertIssue[] {
    return issues.map((issue) => {
      const category = this.cleanString(issue.category);
      const noIssues = category.toLowerCase() === 'no issues';
      return {
        ...issue,
        alertIndex: Number.isFinite(Number(issue.alertIndex)) ? Number(issue.alertIndex) : undefined,
        category,
        description: this.cleanString(issue.description),
        recommendation: this.cleanString(issue.recommendation),
        severity: noIssues ? 'N/A' : this.normalizeSeverity(issue.severity, category),
        include: noIssues ? false : typeof issue.include === 'boolean' ? issue.include : this.getDefaultInclude(category),
      };
    });
  }

  parseIssuesFromText(text: string): AlertIssue[] {
    return this.parseIssues(text);
  }

  private parseIssues(text: string): AlertIssue[] {
    const parsed = this.looseJsonParse(this.stripCodeFences(text));
    const root = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    const rawIssues = Array.isArray(root?.['issues']) ? root['issues'] : Array.isArray(root) ? root : [];

    const issues = rawIssues
      .map((raw): AlertIssue | null => {
        if (!raw || typeof raw !== 'object') return null;
        const item = raw as Record<string, unknown>;
        const alertIndex = Number.parseInt(String(item['alert_index'] ?? item['alertIndex'] ?? ''), 10);
        const category = this.cleanString(item['issue_category'] ?? item['category']);
        const description = this.cleanString(item['description']);
        const recommendation = this.cleanString(item['recommendation']);
        if (!category || !description || !recommendation) return null;
        return {
          alertIndex: Number.isFinite(alertIndex) ? alertIndex : undefined,
          category,
          description,
          recommendation,
          severity: this.normalizeSeverity(item['severity'], category),
          include: this.getDefaultInclude(category),
        };
      })
      .filter((issue): issue is AlertIssue => issue !== null);

    return this.normalizeAlertIssues(issues);
  }

  private validateAlertIssuesAgainstHtml(issues: AlertIssue[], sourceHtml: string): AlertIssue[] {
    if (!issues.length || !sourceHtml) return issues;
    const doc = new DOMParser().parseFromString(sourceHtml, 'text/html');
    const alerts = getReportableAlerts(doc.body, { interactiveResultLeadIns: this.getInteractiveResultLeadIns() });
    if (!alerts.length) return [];

    return issues.filter((issue) => {
      if (!this.claimsTargetBlankWithoutRel(issue)) return true;
      const alertIndex = issue.alertIndex;
      if (!alertIndex || !Number.isInteger(alertIndex)) return true;
      const alert = alerts[alertIndex - 1];
      if (!alert) return true;
      const claimIsTrue = Array.from(alert.querySelectorAll<HTMLAnchorElement>('a[target]')).some((anchor) => {
        const target = (anchor.getAttribute('target') || '').trim().toLowerCase();
        return target === '_blank' && !(anchor.getAttribute('rel') || '').trim();
      });
      if (claimIsTrue) return true;
      return false;
    });
  }

  private addNoIssuePlaceholders(issues: AlertIssue[], alertCount: number): AlertIssue[] {
    const realIssues = issues.filter((issue) => !isNoAlertIssue(issue));
    const alertIndexesWithIssues = new Set(realIssues.map((issue) => issue.alertIndex).filter((alertIndex): alertIndex is number => Number.isInteger(alertIndex)));

    for (let alertIndex = 1; alertIndex <= alertCount; alertIndex += 1) {
      if (alertIndexesWithIssues.has(alertIndex)) continue;
      realIssues.push({
        alertIndex,
        category: 'No issues',
        severity: 'N/A',
        description: `Alert ${alertIndex}: No issues found for this alert.`,
        recommendation: 'No changes required.',
        include: false,
      });
    }

    return realIssues;
  }

  private suppressDeferredIssues(issues: AlertIssue[]): AlertIssue[] {
    const visibleIssues: AlertIssue[] = [];
    const suppressedIssues: AlertIssue[] = [];

    for (const issue of issues) {
      const display = this.fallbackSeverities[this.cleanString(issue.category).toLowerCase()]?.display;
      (display === false ? suppressedIssues : visibleIssues).push(issue);
    }

    if (suppressedIssues.length) {
      console.info('[Alert analysis] Suppressed deferred issues.', {
        count: suppressedIssues.length,
        categories: [...new Set(suppressedIssues.map((issue) => issue.category))],
        alertIndexes: suppressedIssues.map((issue) => issue.alertIndex).filter((alertIndex): alertIndex is number => Number.isInteger(alertIndex)),
      });
    }

    return visibleIssues;
  }

  private claimsTargetBlankWithoutRel(issue: AlertIssue): boolean {
    if (issue.category.trim().toLowerCase() !== 'accessibility/code') return false;
    const claim = `${issue.description} ${issue.recommendation}`;
    return /target\s*=\s*["']?_blank["']?/i.test(claim) && (/(?:no|without|missing|lacks?)\s+(?:an?\s+)?rel\b/i.test(claim) || /\badd\s+rel\b/i.test(claim));
  }

  private normalizeSeverity(value: unknown, category?: string): string {
    const fallback = this.fallbackSeverities[this.cleanString(category).toLowerCase()];
    if (fallback?.severityOverride && fallback.severity) return this.normalizeSeverity(fallback.severity);
    const raw = this.cleanString(value).toLowerCase();
    if (!raw) return this.lookupFallbackSeverity(category) ?? 'Unknown';
    return ALERT_SEVERITY_ALIASES[raw] ?? this.lookupFallbackSeverity(category) ?? 'Unknown';
  }

  private lookupFallbackSeverity(category: unknown): string | null {
    const severity = this.fallbackSeverities[this.cleanString(category).toLowerCase()]?.severity;
    return severity ? this.normalizeSeverity(severity) : null;
  }

  private lookupFallbackInclude(category: unknown): boolean | null {
    const include = this.fallbackSeverities[this.cleanString(category).toLowerCase()]?.include;
    return typeof include === 'boolean' ? include : null;
  }

  private getDefaultInclude(category: unknown): boolean {
    return this.lookupFallbackInclude(category) ?? true;
  }

  private lookupRecommendationOverride(category: unknown, language: 'en' | 'fr'): string | null {
    const key = this.fallbackSeverities[this.cleanString(category).toLowerCase()]?.recommendationOverride;
    return key ? this.cleanString(this.translate.instant(key, undefined, language)) || null : null;
  }

  private getInteractiveResultLeadIns(): string[] {
    return coerceInteractiveResultLeadIns(this.translate.instant('problems.alerts.interactiveResultLeadIns'));
  }

  private clearTranslations(pagePath: string): void {
    const report = this.projectState.getAlertIssuesReport(pagePath);
    if (!report?.translations) return;
    const updated = { ...report };
    delete updated.translations;
    this.projectState.setAlertIssuesReport(pagePath, updated);
  }

  private requestFrenchTranslation(pagePath: string, report: AlertIssuesReport, translationRunId: number): void {
    const items = report.issues
      .filter((issue) => !isNoAlertIssue(issue) && !!issue.translationId)
      .map((issue) => ({
        translation_id: issue.translationId!,
        description: issue.description,
        recommendation: issue.recommendation,
      }));
    if (!items.length) {
      this.setFrenchTranslationStatus(pagePath, translationRunId, 'complete');
      return;
    }

    this.setFrenchTranslationStatus(pagePath, translationRunId, 'pending');
    void this.translateFrenchIssues(pagePath, report, items, translationRunId).catch((error: unknown) => {
      console.warn('Unable to translate alert issues into French.', error);
      this.setFrenchTranslationStatus(pagePath, translationRunId, 'failed');
    });
  }

  private async translateFrenchIssues(
    pagePath: string,
    report: AlertIssuesReport,
    items: { translation_id: string; description: string; recommendation: string }[],
    translationRunId: number,
  ): Promise<void> {
    console.log('[Alert translation] Requesting', {
      preferredModel: AI_ALERT_TRANSLATION_MODEL,
      itemCount: items.length,
    });
    const response = await this.openRouter.sendToAI(ProblemPrompts[ProblemPromptKey.TranslateIssueDetails], JSON.stringify({ target_language: 'fr-CA', items }), AI_ALERT_TRANSLATION_MODEL, 0);
    const responseText = response.choices?.[0]?.message?.content ?? '';
    const translatedIssues = this.parseFrenchTranslations(responseText, items);
    if (translatedIssues.length !== items.length) {
      console.warn('Unable to translate all alert issue details into French. The English report remains available.');
      this.setFrenchTranslationStatus(pagePath, translationRunId, 'failed');
      return;
    }
    if (this.translationRunIds.get(pagePath) !== translationRunId) {
      return;
    }

    const current = this.projectState.getAlertIssuesReport(pagePath);
    if (!current || current.analyzedAt !== report.analyzedAt || current.analyzedHtmlHash !== report.analyzedHtmlHash) {
      this.setFrenchTranslationStatus(pagePath, translationRunId, 'failed');
      return;
    }

    this.projectState.setAlertIssuesReport(pagePath, {
      ...current,
      translations: {
        ...current.translations,
        fr: {
          translatedAt: new Date().toISOString(),
          model: response.model ?? AI_ALERT_TRANSLATION_MODEL,
          issues: translatedIssues,
        },
      },
    });
    this.setFrenchTranslationStatus(pagePath, translationRunId, 'complete');
    console.log('[Alert translation] Completed', {
      requestedModel: AI_ALERT_TRANSLATION_MODEL,
      respondingModel: response.model ?? 'unknown',
      translatedItemCount: translatedIssues.length,
    });
  }

  private parseFrenchTranslations(responseText: string, expectedItems: { translation_id: string; description: string; recommendation: string }[]): AlertIssueTranslationData[] {
    const parsed = this.looseJsonParse(this.stripCodeFences(responseText));
    const root = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    const rawItems = Array.isArray(root?.['items']) ? root['items'] : [];
    const expectedById = new Map(expectedItems.map((item) => [item.translation_id, item]));
    const seen = new Set<string>();
    const translations: AlertIssueTranslationData[] = [];

    for (const raw of rawItems) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as Record<string, unknown>;
      const translationId = String(item['translation_id'] ?? '').trim();
      const expected = expectedById.get(translationId);
      if (!expected || seen.has(translationId)) continue;

      const description = this.cleanString(item['description']);
      const recommendation = this.cleanString(item['recommendation']);
      if (!description || !recommendation) continue;
      if (!this.preservesProtectedTokens(expected.description, description) || !this.preservesProtectedTokens(expected.recommendation, recommendation)) continue;

      seen.add(translationId);
      translations.push({ translationId, description, recommendation });
    }

    return translations;
  }

  private setFrenchTranslationStatus(pagePath: string, runId: number, status: AlertFrenchTranslationStatus): void {
    if (this.translationRunIds.get(pagePath) !== runId) return;
    this.frenchTranslationStates.update((states) => ({ ...states, [pagePath]: { runId, status } }));
  }

  private preservesProtectedTokens(source: string, translation: string): boolean {
    const protectedTokens = source.match(/<\/?[^>]+>|https?:\/\/[^\s"'<>]+|\{\{[^}]+\}\}|`[^`]+`|\b(?:alert|aria|wb)-[a-z0-9_-]+\b/gi) ?? [];
    return protectedTokens.every((token) => translation.includes(token));
  }

  private getIssueIdentity(issue: Pick<AlertIssue, 'alertIndex' | 'category'>): string {
    return `${issue.alertIndex ?? ''}\u0000${this.cleanString(issue.category).toLowerCase()}`;
  }

  private stripCodeFences(value: string): string {
    return value
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
  }

  private looseJsonParse(value: string): unknown | null {
    try {
      return JSON.parse(value);
    } catch {
      const objectMatch = value.match(/\{[\s\S]*\}/);
      if (!objectMatch) return null;
      try {
        return JSON.parse(objectMatch[0]);
      } catch {
        return null;
      }
    }
  }

  private cleanString(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private saveAnalysis(sourceHtml: string, pagePath: string, issues: AlertIssue[], model?: string): AlertIssuesReport {
    const report: AlertIssuesReport = {
      analyzedHtmlHash: this.fetchService.hashString(sourceHtml),
      analyzedAt: new Date().toISOString(),
      model,
      issues: this.normalizeAlertIssues(issues).map((issue, index) => ({ ...issue, translationId: String(index + 1) })),
    };
    const saved = this.projectState.setAlertIssuesReport(pagePath, report);
    if (!saved) throw new Error(this.translate.instant('problems.alerts.analysisError'));
    return report;
  }

  private cloneIssues(issues: AlertIssue[]): AlertIssue[] {
    return issues.map((issue) => ({ ...issue }));
  }
}
