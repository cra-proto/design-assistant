import { inject, Injectable } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { OpenRouterService } from '../../../../../services/ai/openrouter.service';
import { AlertContextService } from './alert-context.service';

import { ProblemPrompts } from '../../../../../common/prompts/problems.prompts';
import { ProblemPromptKey } from '../../../../../common/prompts/prompt.model';
import { coerceInteractiveResultLeadIns, getReportableAlerts } from './alert-reportable.utils';
import { AlertIssue, isNoAlertIssue } from './alert.config';
import fallbackSeverityJson from './severity-include-fallback.json';

interface AlertIssuesCacheEntry {
  html: string;
  issues: AlertIssue[];
}

@Injectable({ providedIn: 'root' })
export class AlertService {
  private readonly openRouter = inject(OpenRouterService);
  private readonly alertContext = inject(AlertContextService);
  private readonly translate = inject(TranslateService);
  private readonly cachedIssues = new Map<string, AlertIssuesCacheEntry>();

  private readonly fallbackSeverities: Record<string, { severity: string; include?: boolean }> = Object.fromEntries(
    Object.entries(fallbackSeverityJson as Record<string, string | { severity?: string; include?: boolean }>).map(([key, value]) => {
      if (typeof value === 'string') return [key.toLowerCase(), { severity: value }];
      return [key.toLowerCase(), { severity: value.severity ?? '', include: value.include }];
    }),
  );

  async analyze(sourceHtml: string, preferredModel?: string, force = false): Promise<AlertIssue[]> {
    if (!force) {
      const cached = this.getCachedIssues(sourceHtml);
      if (cached !== null) return cached;
    }

    const payload = this.alertContext.buildCompactAlertsIssuesPayload(sourceHtml);
    if (payload['alertCount'] === 0) {
      this.cacheIssues(sourceHtml, []);
      return [];
    }

    const responseText = await this.openRouter.getTextFromAI(ProblemPrompts[ProblemPromptKey.AlertIssues], JSON.stringify(payload), preferredModel, 0);
    const issues = this.validateAlertIssuesAgainstHtml(this.parseIssues(responseText), sourceHtml);
    this.cacheIssues(sourceHtml, issues);
    return this.cloneIssues(issues);
  }

  getCachedIssues(sourceHtml: string): AlertIssue[] | null {
    const entry = this.cachedIssues.get(this.getCacheKey(sourceHtml));
    return entry ? this.cloneIssues(entry.issues) : null;
  }

  getSelectedIssues(sourceHtml: string): AlertIssue[] {
    return (this.getCachedIssues(sourceHtml) ?? []).filter((issue) => issue.include && !isNoAlertIssue(issue));
  }

  cacheIssues(sourceHtml: string, issues: AlertIssue[]): void {
    const normalized = this.normalizeAlertIssues(issues);
    this.cachedIssues.set(this.getCacheKey(sourceHtml), {
      html: sourceHtml,
      issues: this.cloneIssues(normalized),
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
        include: noIssues ? false : typeof issue.include === 'boolean' ? issue.include : (this.lookupFallbackInclude(category) ?? true),
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
          include: typeof item['include'] === 'boolean' ? item['include'] : (this.lookupFallbackInclude(category) ?? true),
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

    const removedAlertIndexes = new Set<number>();
    const validated = issues.filter((issue) => {
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
      removedAlertIndexes.add(alertIndex);
      return false;
    });

    for (const alertIndex of removedAlertIndexes) {
      if (validated.some((issue) => issue.alertIndex === alertIndex)) continue;
      validated.push({
        alertIndex,
        category: 'No issues',
        severity: 'N/A',
        description: `Alert ${alertIndex}: No issues found for this alert.`,
        recommendation: 'No changes required.',
        include: false,
      });
    }
    return validated;
  }

  private claimsTargetBlankWithoutRel(issue: AlertIssue): boolean {
    if (issue.category.trim().toLowerCase() !== 'accessibility/code') return false;
    const claim = `${issue.description} ${issue.recommendation}`;
    return /target\s*=\s*["']?_blank["']?/i.test(claim) && (/(?:no|without|missing|lacks?)\s+(?:an?\s+)?rel\b/i.test(claim) || /\badd\s+rel\b/i.test(claim));
  }

  private normalizeSeverity(value: unknown, category?: string): string {
    const raw = this.cleanString(value).toLowerCase();
    if (!raw) return this.lookupFallbackSeverity(category) ?? 'Unknown';
    if (raw === 'high' || raw === 'critical') return 'High';
    if (raw === 'medium' || raw === 'med' || raw === 'moderate') return 'Medium';
    if (raw === 'low' || raw === 'minor') return 'Low';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  private lookupFallbackSeverity(category: unknown): string | null {
    const severity = this.fallbackSeverities[this.cleanString(category).toLowerCase()]?.severity;
    return severity ? this.normalizeSeverity(severity) : null;
  }

  private lookupFallbackInclude(category: unknown): boolean | null {
    const include = this.fallbackSeverities[this.cleanString(category).toLowerCase()]?.include;
    return typeof include === 'boolean' ? include : null;
  }

  private getInteractiveResultLeadIns(): string[] {
    return coerceInteractiveResultLeadIns(this.translate.instant('problems.alerts.interactiveResultLeadIns'));
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

  private getCacheKey(sourceHtml: string): string {
    return sourceHtml.trim();
  }

  private cloneIssues(issues: AlertIssue[]): AlertIssue[] {
    return issues.map((issue) => ({ ...issue }));
  }
}
