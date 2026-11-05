import { AlertIssueData } from '../../../../../common/data.model';

export type AlertIssue = AlertIssueData;

export interface AlertGuidanceState {
  categories: { label: string; severity: string }[];
  maxSeverity: string | null;
  loading: boolean;
  error: boolean;
  hasAnalysis: boolean;
}

export const ALERT_SEVERITY_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const ALERT_CATEGORY_I18N_KEYS: Record<string, string> = {
  misuse: 'problems.alerts.categoryValue.misuse',
  'too wordy': 'problems.alerts.categoryValue.tooWordy',
  'generic titles': 'problems.alerts.categoryValue.genericTitles',
  'generic title': 'problems.alerts.categoryValue.genericTitles',
  'unclear impact': 'problems.alerts.categoryValue.unclearImpact',
  outdated: 'problems.alerts.categoryValue.outdated',
  'missing heading': 'problems.alerts.categoryValue.missingHeading',
  'wrong type': 'problems.alerts.categoryValue.wrongType',
  'hidden content': 'problems.alerts.categoryValue.hiddenContent',
  'wrong component': 'problems.alerts.categoryValue.wrongComponent',
  'too many links': 'problems.alerts.categoryValue.tooManyLinks',
  'wrong placement': 'problems.alerts.categoryValue.wrongPlacement',
  'alert overload': 'problems.alerts.categoryValue.alertOverload',
  'low relevance': 'problems.alerts.categoryValue.lowRelevance',
  'incorrect hierarchy': 'problems.alerts.categoryValue.incorrectHierarchy',
  'nothing actionable': 'problems.alerts.categoryValue.nothingActionable',
  'focus order': 'problems.alerts.categoryValue.focusOrder',
  'content clarity': 'problems.alerts.categoryValue.contentClarity',
  'non-text content': 'problems.alerts.categoryValue.nonTextContent',
  'missing alert semantics': 'problems.alerts.categoryValue.missingAlertSemantics',
  'accessibility/code': 'problems.alerts.categoryValue.accessibilityCode',
  'no issues': 'problems.alerts.categoryValue.noIssues',
};

const ALERT_SEVERITY_I18N_KEYS: Record<string, string> = {
  high: 'problems.alerts.severityValue.high',
  medium: 'problems.alerts.severityValue.medium',
  low: 'problems.alerts.severityValue.low',
  'n/a': 'problems.alerts.severityValue.notApplicable',
  na: 'problems.alerts.severityValue.notApplicable',
  unknown: 'problems.alerts.severityValue.unknown',
};

export function getAlertCategoryI18nKey(category: string): string {
  return ALERT_CATEGORY_I18N_KEYS[(category || '').trim().toLowerCase()] ?? category;
}

export function getAlertSeverityI18nKey(severity: string): string {
  return ALERT_SEVERITY_I18N_KEYS[(severity || '').trim().toLowerCase()] ?? severity;
}

export function isNoAlertIssue(issue: Pick<AlertIssue, 'category'>): boolean {
  return (issue.category || '').trim().toLowerCase() === 'no issues';
}

export function computeAlertCategories(issues: AlertIssue[]): { label: string; severity: string }[] {
  const bestSeverity = new Map<string, string>();
  for (const issue of issues) {
    if (isNoAlertIssue(issue) || !issue.category) continue;
    const current = bestSeverity.get(issue.category);
    const currentRank = current ? (ALERT_SEVERITY_RANK[current.toLowerCase()] ?? 0) : -1;
    const nextRank = ALERT_SEVERITY_RANK[issue.severity.toLowerCase()] ?? 0;
    if (nextRank >= currentRank) bestSeverity.set(issue.category, issue.severity);
  }
  return Array.from(bestSeverity.entries()).map(([label, severity]) => ({ label, severity }));
}

export function computeAlertMaxSeverity(issues: AlertIssue[]): string | null {
  let maximum: string | null = null;
  let maximumRank = -1;
  for (const issue of issues) {
    if (isNoAlertIssue(issue)) continue;
    const rank = ALERT_SEVERITY_RANK[issue.severity.toLowerCase()] ?? -1;
    if (rank > maximumRank) {
      maximumRank = rank;
      maximum = issue.severity;
    }
  }
  return maximum;
}
