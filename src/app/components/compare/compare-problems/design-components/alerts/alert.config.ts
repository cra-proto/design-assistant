export interface AlertIssue {
  alertIndex?: number;
  category: string;
  severity: string;
  description: string;
  recommendation: string;
  include: boolean;
}

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
