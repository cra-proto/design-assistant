const HIDDEN_STYLE_RE = /(display\s*:\s*none|visibility\s*:\s*hidden)/i;
const HIDDEN_CLASS_NAMES = new Set(['hidden', 'hide', 'd-none', 'is-hidden', 'wb-inv']);
const IGNORED_ALERT_IDS = new Set(['norun']);

export interface AlertReportableOptions {
  interactiveResultLeadIns?: string[];
}

// Alert reports should ignore decision-tree result panels that are hidden until
// a user completes a selection path, but still include ordinary page alerts.
export function getReportableAlerts(root: ParentNode, options?: AlertReportableOptions): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('.alert')).filter((alert) => !alert.parentElement?.closest('.alert') && !isConditionalInteractiveAlert(alert, options));
}

export function getReportableAlertsFromHtml(sourceHtml: string, options?: AlertReportableOptions): HTMLElement[] {
  if (!sourceHtml) return [];

  const doc = new DOMParser().parseFromString(sourceHtml, 'text/html');
  return getReportableAlerts(doc, options);
}

export function removeNonReportableAlertsFromHtml(sourceHtml: string, options?: AlertReportableOptions): string {
  if (!sourceHtml) return '';

  const doc = new DOMParser().parseFromString(sourceHtml, 'text/html');
  const alerts = Array.from(doc.querySelectorAll<HTMLElement>('.alert'));
  alerts.forEach((alert) => {
    if (isConditionalInteractiveAlert(alert, options)) {
      alert.remove();
    }
  });
  return doc.body.innerHTML;
}

export function coerceInteractiveResultLeadIns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => !!item);
}

function isConditionalInteractiveAlert(alert: Element, options?: AlertReportableOptions): boolean {
  if (isAlertRewriteStatusMessage(alert)) return true;
  if (isIgnoredAlertId(alert)) return true;

  // Interactive result alerts start with the lead-in sentence, regardless of
  // whether a heading follows later in the container.
  if (hasInteractiveResultLeadIn(alert, options?.interactiveResultLeadIns ?? [])) {
    return true;
  }

  // Hidden alerts are ignored individually, regardless of nearby structure.
  return isHiddenAlert(alert);
}

function hasInteractiveResultLeadIn(alert: Element, leadIns: string[]): boolean {
  const normalizedLeadIns = leadIns.map(normalizeLeadInText).filter((leadIn) => !!leadIn);
  if (!normalizedLeadIns.length) return false;

  const firstLeadInCandidate = getFirstLeadInCandidate(alert);
  const normalizedCandidate = normalizeLeadInText(firstLeadInCandidate);
  return normalizedLeadIns.some((leadIn) => !!normalizedCandidate && normalizedCandidate.startsWith(leadIn));
}

function getFirstLeadInCandidate(alert: Element): string {
  for (const child of Array.from(alert.children)) {
    const tagName = child.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tagName)) continue;

    const text = (child.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }

  return (alert.textContent || '').replace(/\s+/g, ' ').trim();
}

function isIgnoredAlertId(alert: Element): boolean {
  const id = (alert.getAttribute('id') || '').trim().toLowerCase();
  return !!id && IGNORED_ALERT_IDS.has(id);
}

function isAlertRewriteStatusMessage(alert: Element): boolean {
  return !!(alert.getAttribute('data-alert-rewrite-status') || '').trim();
}

function normalizeLeadInText(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/[:.]$/, '').trim();
}

function isHiddenAlert(alert: Element): boolean {
  // These panels are commonly hidden by class, HTML attributes, or inline style
  // before script-driven selection logic reveals the matching answer.
  if (alert.hasAttribute('hidden')) return true;
  if ((alert.getAttribute('aria-hidden') || '').trim().toLowerCase() === 'true') {
    return true;
  }

  const style = (alert.getAttribute('style') || '').trim().toLowerCase();
  if (style && HIDDEN_STYLE_RE.test(style)) return true;

  return Array.from(alert.classList).some((className) => HIDDEN_CLASS_NAMES.has(className.toLowerCase()));
}
