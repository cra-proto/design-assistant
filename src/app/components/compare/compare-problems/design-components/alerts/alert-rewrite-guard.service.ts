/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import { inject, Injectable } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { AlertRewriteExample, AlertRewriteIssueInput, AlertRewritePlan, AlertRewriteRepairCandidate, AlertRewriteResult, AlertRewriteService } from './alert-rewrite.service';

import { coerceInteractiveResultLeadIns, getReportableAlerts } from './alert-reportable.utils';

export interface AlertHtmlRewrite {
  alert_index: number;
  rewritten_alert_html: string;
}

export type AlertLinkLeadInIssue = 'fullSentenceLinksNeedLeadIn' | 'linkLeadInNotStandalone';

@Injectable({ providedIn: 'root' })
export class AlertRewriteGuardService {
  private alertRewrite = inject(AlertRewriteService);
  private translate = inject(TranslateService);

  // Extracts the alert body text used by planning and copy-detection logic.
  getAlertTextForRewrite(alertElement: Element): string {
    const firstParagraph = alertElement.querySelector('p');
    const paragraphText = firstParagraph?.textContent?.trim() || '';
    if (paragraphText) return paragraphText;
    return (alertElement.textContent || '').trim();
  }

  // Pulls the alert heading so rewrite prompts and diagnostics can preserve it.
  getAlertHeadingForRewrite(alertElement: Element): string {
    const headingEl = alertElement.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6');
    return (headingEl?.textContent || '').trim();
  }

  // Keeps per-alert issues aligned with the alert being rewritten while still
  // preserving any global issues that apply to every alert.
  getIssuesForAlertIndex(issues: AlertRewriteIssueInput[], alertIndex: number): AlertRewriteIssueInput[] {
    const hasIndexedIssues = issues.some((issue) => Number.isFinite(issue.alertIndex));
    const globalIssues = issues.filter((issue) => !Number.isFinite(issue.alertIndex));
    const specificIssues = issues.filter((issue) => issue.alertIndex === alertIndex);

    if (!hasIndexedIssues) {
      return issues;
    }
    if (specificIssues.length) {
      return [...globalIssues, ...specificIssues];
    }
    return globalIssues;
  }

  // Placeholder link tokens are always invalid at this stage because the final
  // rewrite contract expects real anchors or plain text.
  containsLinkPlaceholderSyntax(value: string): boolean {
    return /\[(?:\/?\s*LINK|END\s+LINK)\]/i.test(value || '');
  }

  // Alerts must expose a semantic heading for screen reader navigation.
  hasSemanticHeading(alertHtml: string): boolean {
    try {
      const doc = new DOMParser().parseFromString(alertHtml, 'text/html');
      return !!doc.body.querySelector('h1, h2, h3, h4, h5, h6');
    } catch {
      return false;
    }
  }

  // Final heading insertion keeps the wrapper valid if retries and local repair
  // still return body-only content.
  ensureSemanticHeading(alertHtml: string, headingText: string): string {
    try {
      const doc = new DOMParser().parseFromString(alertHtml, 'text/html');
      if (doc.body.childElementCount !== 1) return doc.body.innerHTML.trim();
      const root = doc.body.firstElementChild as HTMLElement | null;
      if (!root) return alertHtml;
      if (root.querySelector('h1, h2, h3, h4, h5, h6')) return root.outerHTML.trim();

      const normalizedHeading = (headingText || '').trim();
      if (!normalizedHeading) return root.outerHTML.trim();

      const headingEl = doc.createElement('h3');
      headingEl.textContent = normalizedHeading;
      root.insertBefore(headingEl, root.firstChild);
      return root.outerHTML.trim();
    } catch {
      return alertHtml;
    }
  }

  // Rejects outputs where link-direction text is malformed:
  // link-only sentences, embedded lead-ins, or lead-ins in the wrong paragraph shape.
  hasFullSentenceLinkWithoutAllowedLeadIn(alertHtml: string): boolean {
    return this.getFullSentenceLinkLeadInIssue(alertHtml) !== null;
  }

  getFullSentenceLinkLeadInIssue(alertHtml: string): AlertLinkLeadInIssue | null {
    try {
      const doc = new DOMParser().parseFromString(alertHtml, 'text/html');
      const root = doc.body.firstElementChild as HTMLElement | null;
      if (!root) return null;

      const blocks = this.getLeadInCheckBlocks(root, doc);
      for (const block of blocks) {
        const anchors = Array.from(block.querySelectorAll('a'));
        if (!anchors.length) continue;

        const markerPrefix = '[[link:';
        const markerSuffix = ']]';
        const paragraphWithMarkers = this.normalizeLeadInText(
          Array.from(block.childNodes)
            .map((node) => {
              if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName.toLowerCase() === 'a') {
                const anchorText = this.normalizeLeadInText(node.textContent || '');
                return `${markerPrefix}${anchorText}${markerSuffix}`;
              }
              return node.textContent || '';
            })
            .join(' '),
        );
        if (!paragraphWithMarkers) continue;

        const sentences =
          paragraphWithMarkers
            .match(/[^.!?]+[.!?]?/g)
            ?.map((sentence) => sentence.trim())
            .filter((sentence) => !!sentence) ?? [];
        if (!sentences.length) continue;

        for (const sentence of sentences) {
          if (!sentence.includes(markerPrefix)) continue;

          const sentenceWithoutLinks = this.normalizeLeadInText(sentence.replace(/\[\[link:[^\]]+\]\]/g, ' '));
          const leadInText = sentenceWithoutLinks.replace(/[.!?]\s*$/g, '').trim();
          const hasAllowedLeadIn = this.isValidStandaloneLinkLeadIn(leadInText);
          const hasDirectionalLeadIn = this.hasDirectionalLinkLeadIn(leadInText);
          const nonLinkText = sentenceWithoutLinks.replace(/[:;,.!?()\-\u2013\u2014]/g, '').trim();
          const linkSentenceOnly = !nonLinkText;

          if (hasAllowedLeadIn && sentences.length > 1) {
            return 'linkLeadInNotStandalone';
          }

          if (hasAllowedLeadIn) {
            continue;
          }

          if (hasDirectionalLeadIn) {
            return 'fullSentenceLinksNeedLeadIn';
          }
          if (linkSentenceOnly && this.hasStandaloneActionVerbLinkText(sentence, markerPrefix, markerSuffix)) {
            continue;
          }

          if (linkSentenceOnly) return 'fullSentenceLinksNeedLeadIn';
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  repairEmbeddedStandaloneLeadInParagraphs(alertHtml: string): string {
    try {
      const doc = new DOMParser().parseFromString(alertHtml || '', 'text/html');
      const root = doc.body.firstElementChild as HTMLElement | null;
      if (!root) return alertHtml;

      Array.from(root.querySelectorAll('p')).forEach((paragraph) => {
        const anchors = Array.from(paragraph.querySelectorAll('a'));
        if (anchors.length !== 1) return;

        const anchor = anchors[0];
        if (anchor.parentElement !== paragraph) return;

        const childNodes = Array.from(paragraph.childNodes);
        const anchorIndex = childNodes.indexOf(anchor);
        if (anchorIndex !== 1) return;

        const beforeNode = childNodes[0];
        if (beforeNode.nodeType !== Node.TEXT_NODE) return;
        const afterNodes = childNodes.slice(anchorIndex + 1);
        if (afterNodes.some((node) => node.nodeType !== Node.TEXT_NODE)) return;

        const beforeText = beforeNode.textContent || '';
        const afterText = afterNodes.map((node) => node.textContent || '').join('');
        if (afterText.replace(/[.!?\s]/g, '')) return;

        const split = beforeText.match(/^([\s\S]*[.!?])\s+([^.!?]+)$/);
        if (!split) return;

        const explanatoryText = (split[1] || '').trim();
        const leadInText = (split[2] || '').trim();
        if (!explanatoryText || !this.isValidStandaloneLinkLeadIn(leadInText)) {
          return;
        }

        const explanatoryParagraph = doc.createElement('p');
        explanatoryParagraph.textContent = explanatoryText;

        const linkParagraph = doc.createElement('p');
        linkParagraph.appendChild(doc.createTextNode(`${leadInText} `));
        linkParagraph.appendChild(anchor.cloneNode(true));

        paragraph.replaceWith(explanatoryParagraph, linkParagraph);
      });

      return root.outerHTML.trim();
    } catch {
      return alertHtml;
    }
  }

  // Local repair is the last deterministic cleanup pass after model retries are exhausted.
  // It fixes wrapper/link issues without making another network call.
  tryLocalAlertRewriteRepair(params: {
    result: AlertRewriteRepairCandidate;
    originalAlertHtml: string;
    originalHeading?: string;
    originalAlertText: string;
    plan: AlertRewritePlan;
    selectedExamples: AlertRewriteExample[];
    allowLinkRemoval: boolean;
  }): AlertRewriteResult | null {
    const originalHasAnchor = /<a\b/i.test(params.originalAlertHtml);

    const initialCandidate = this.alertRewrite.parseAlertRewriteResponse(
      JSON.stringify({
        rewrittenAlertHtml: this.stripLinkPlaceholders(params.result.rewrittenAlertHtml || ''),
        rewrittenHeading: this.stripLinkPlaceholders(params.result.rewrittenHeading || ''),
        rewrittenAlert: this.stripLinkPlaceholders(params.result.rewrittenAlert || ''),
        appliedDirectives: params.result.appliedDirectives,
        exampleIdsUsed: params.result.exampleIdsUsed,
      }),
      params.plan,
      params.selectedExamples,
    );

    const wrapperFallbackHtml =
      this.buildAlertWrapperFromOriginal({
        originalAlertHtml: params.originalAlertHtml,
        heading: this.stripLinkPlaceholders(params.result.rewrittenHeading || '') || params.originalHeading || '',
        text: this.stripLinkPlaceholders(params.result.rewrittenAlert || '') || params.originalAlertText,
      }) || '';

    let candidate = initialCandidate;
    if (!candidate?.rewrittenAlertHtml && wrapperFallbackHtml) {
      candidate = this.alertRewrite.parseAlertRewriteResponse(
        JSON.stringify({
          rewrittenAlertHtml: wrapperFallbackHtml,
          rewrittenHeading: this.stripLinkPlaceholders(params.result.rewrittenHeading || '') || params.originalHeading || '',
          rewrittenAlert: this.stripLinkPlaceholders(params.result.rewrittenAlert || '') || params.originalAlertText,
          appliedDirectives: params.result.appliedDirectives,
          exampleIdsUsed: params.result.exampleIdsUsed,
        }),
        params.plan,
        params.selectedExamples,
      );
    }

    if (!candidate?.rewrittenAlertHtml) return null;

    let repairedHtml = candidate.rewrittenAlertHtml;
    if (!originalHasAnchor) {
      repairedHtml = this.removeAnchorsPreservingText(repairedHtml);
    } else if (!/<a\b/i.test(repairedHtml)) {
      repairedHtml = this.ensureAtLeastOneOriginalLink(repairedHtml, params.originalAlertHtml);
    }
    if (!this.hasSemanticHeading(repairedHtml)) {
      repairedHtml = this.ensureSemanticHeading(repairedHtml, candidate.rewrittenHeading || params.originalHeading || '');
    }
    repairedHtml = this.stripRedundantLeadInsBeforeActionLinks(repairedHtml);
    repairedHtml = this.stripStandaloneLinkTerminalPunctuation(repairedHtml);

    const repaired = this.alertRewrite.parseAlertRewriteResponse(
      JSON.stringify({
        rewrittenAlertHtml: repairedHtml,
        rewrittenHeading: candidate.rewrittenHeading,
        rewrittenAlert: candidate.rewrittenAlert,
        appliedDirectives: candidate.appliedDirectives,
        exampleIdsUsed: candidate.exampleIdsUsed,
      }),
      params.plan,
      params.selectedExamples,
    );
    if (!repaired?.rewrittenAlertHtml) return null;

    if (this.containsLinkPlaceholderSyntax(repaired.rewrittenAlertHtml) || this.containsLinkPlaceholderSyntax(repaired.rewrittenAlert)) {
      return null;
    }

    const repairedHasAnchor = /<a\b/i.test(repaired.rewrittenAlertHtml);
    if (!this.hasSemanticHeading(repaired.rewrittenAlertHtml)) return null;
    if (!originalHasAnchor && repairedHasAnchor) return null;
    if (originalHasAnchor && !repairedHasAnchor) {
      return null;
    }
    if (repairedHasAnchor && this.hasFullSentenceLinkWithoutAllowedLeadIn(repaired.rewrittenAlertHtml)) {
      return null;
    }

    const copyCheck = this.alertRewrite.detectExampleCopy({
      result: repaired,
      selectedExamples: params.selectedExamples,
      originalHeading: params.originalHeading,
      originalAlertText: params.originalAlertText,
    });
    if (copyCheck.isCopy) return null;

    return repaired;
  }

  // The rewrite may only drop links when the issue list or plan explicitly supports it.
  shouldAllowAlertLinkRemoval(issues: AlertRewriteIssueInput[], plan: AlertRewritePlan): boolean {
    const hasTooManyLinksIssue = issues.some((issue) => (issue.category || '').toLowerCase().includes('too many links'));
    return hasTooManyLinksIssue || plan.criteriaMatched.includes('C3_too_many_links') || plan.directives.some((directive) => directive.op === 'limit_links');
  }

  // Applies the successful per-alert rewrites back onto the original document.
  applyAlertHtmlRewrites(originalHtml: string, rewrites: AlertHtmlRewrite[]): string | null {
    if (!rewrites.length) return null;

    const parser = new DOMParser();
    const doc = parser.parseFromString(originalHtml, 'text/html');
    const alerts = getReportableAlerts(doc, {
      interactiveResultLeadIns: this.getInteractiveResultLeadIns(),
    });
    if (!alerts.length) return null;

    for (const rewrite of rewrites) {
      const target = alerts[rewrite.alert_index - 1];
      if (!target) continue;
      const updatedDoc = parser.parseFromString(rewrite.rewritten_alert_html, 'text/html');
      const replacementNodes = Array.from(updatedDoc.body.childNodes).filter((node) => {
        if (node.nodeType !== Node.TEXT_NODE) return true;
        return !!(node.textContent || '').trim();
      });
      const replacementAlerts = replacementNodes.filter((node): node is HTMLElement => node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains('alert'));
      if (!replacementNodes.length || !replacementAlerts.length) continue;

      const rewrittenAlert = replacementAlerts[replacementAlerts.length - 1];
      if (!rewrittenAlert) continue;
      if (rewrittenAlert.tagName !== target.tagName) {
        const normalizedAlert = updatedDoc.createElement(target.tagName.toLowerCase());
        Array.from(rewrittenAlert.attributes).forEach((attribute) => {
          normalizedAlert.setAttribute(attribute.name, attribute.value);
        });
        normalizedAlert.append(...Array.from(rewrittenAlert.childNodes));
        const rewrittenAlertIndex = replacementNodes.indexOf(rewrittenAlert);
        rewrittenAlert.replaceWith(normalizedAlert);
        if (rewrittenAlertIndex >= 0) {
          replacementNodes[rewrittenAlertIndex] = normalizedAlert;
        }
      }

      const importedNodes = replacementNodes.map((node) => doc.importNode(node, true));
      target.replaceWith(...importedNodes);
    }

    return doc.body.outerHTML;
  }

  removeRedundantLeadInsBeforeActionLinks(alertHtml: string): string {
    return this.stripRedundantLeadInsBeforeActionLinks(alertHtml);
  }

  removeStandaloneLinkTerminalPunctuation(alertHtml: string): string {
    return this.stripStandaloneLinkTerminalPunctuation(alertHtml);
  }

  preserveOriginalStandaloneLinkLeadIns(rewrittenHtml: string, originalAlertHtml: string): string {
    try {
      const originalDoc = new DOMParser().parseFromString(originalAlertHtml || '', 'text/html');
      const originalLeadInsByHref = new Map<string, string>();
      const originalLeadInsByNormalizedHref = new Map<string, string>();
      const originalLeadInsByLinkText = new Map<string, string>();
      originalDoc.body.querySelectorAll('a[href]').forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        if (!href || originalLeadInsByHref.has(href)) return;
        const leadIn = this.getOriginalStandaloneLinkLeadIn(anchor);
        if (!leadIn) return;

        originalLeadInsByHref.set(href, leadIn);
        this.setUniqueLeadIn(originalLeadInsByNormalizedHref, this.normalizeHrefForLeadInMatch(href), leadIn);
        this.setUniqueLeadIn(originalLeadInsByLinkText, this.normalizeLinkTextForLeadInMatch(anchor.textContent || ''), leadIn);
      });
      if (!originalLeadInsByHref.size && !originalLeadInsByNormalizedHref.size && !originalLeadInsByLinkText.size) {
        return rewrittenHtml;
      }

      const rewrittenDoc = new DOMParser().parseFromString(rewrittenHtml || '', 'text/html');
      const root = rewrittenDoc.body.firstElementChild as HTMLElement | null;
      if (!root) return rewrittenHtml;

      root.querySelectorAll('a[href]').forEach((anchor) => {
        const href = anchor.getAttribute('href') || '';
        const originalLeadIn =
          originalLeadInsByHref.get(href) ||
          originalLeadInsByNormalizedHref.get(this.normalizeHrefForLeadInMatch(href)) ||
          originalLeadInsByLinkText.get(this.normalizeLinkTextForLeadInMatch(anchor.textContent || ''));
        if (!originalLeadIn) return;
        this.restoreInlineStandaloneLeadIn(anchor, originalLeadIn);
        this.restorePreviousStandaloneLeadIn(anchor, originalLeadIn);
      });

      return root.outerHTML.trim();
    } catch {
      return rewrittenHtml;
    }
  }

  // The remaining helpers support the guard logic above and stay private so the
  // orchestration layer only depends on the high-level validation/repair API.
  private normalizeLeadInText(value: string): string {
    return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  // Reuses paragraph validation when present, and falls back to direct alert-body
  // nodes when the model omits paragraph wrappers entirely.
  private getLeadInCheckBlocks(root: HTMLElement, doc: Document): HTMLElement[] {
    const blocks = Array.from(root.querySelectorAll('p'));
    const fallback = doc.createElement('div');

    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if ((node.textContent || '').trim()) {
          fallback.appendChild(node.cloneNode(true));
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tagName) || tagName === 'p') return;
      fallback.appendChild(element.cloneNode(true));
    });

    if (fallback.querySelector('a')) {
      blocks.push(fallback);
    }

    return blocks;
  }

  private getInteractiveResultLeadIns(): string[] {
    return coerceInteractiveResultLeadIns(this.translate.instant('page.alerts.interactiveResultLeadIns'));
  }

  private isValidStandaloneLinkLeadIn(leadInText: string): boolean {
    const normalized = this.normalizeLeadInText(leadInText.replace(/[.!?]\s*$/g, ''));
    if (!normalized) return false;

    if (normalized === 'refer to:' || normalized === 'for details:' || normalized === 'learn more:' || /^learn about(?: the)?$/.test(normalized)) {
      return true;
    }
    return normalized.startsWith('find out');
  }

  // Broader than the valid-lead-in check: used to catch malformed directional
  // sentences such as "refer to <link>" inside a substantive paragraph.
  private hasDirectionalLinkLeadIn(leadInText: string): boolean {
    const normalized = this.normalizeLeadInText(leadInText.replace(/[.!?]\s*$/g, ''));
    if (!normalized) return false;

    return /\b(?:for details|learn more)\b/.test(normalized);
  }

  private hasStandaloneActionVerbLinkText(sentence: string, markerPrefix: string, markerSuffix: string): boolean {
    const escapedPrefix = markerPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedSuffix = markerSuffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const linkTextPattern = new RegExp(`${escapedPrefix}([^\\]]+)${escapedSuffix}`, 'g');
    const linkTexts = Array.from(sentence.matchAll(linkTextPattern))
      .map((match) => this.normalizeLeadInText(match[1] || ''))
      .filter((text) => !!text);

    return linkTexts.length > 0 && linkTexts.every((text) => this.containsActionVerbLinkText(text));
  }

  private containsActionVerbLinkText(linkText: string): boolean {
    const normalized = this.normalizeLeadInText(linkText);
    if (!normalized || /^learn more\b/.test(normalized)) return false;

    return /^(?:how to\s+)?(?:view|get|apply|register|sign in|sign up|log in|login|file|review|check|submit|download|pay|request|update|manage|start|use|learn|find out|create|cancel|send|confirm)\b/.test(
      normalized,
    );
  }

  private stripRedundantLeadInsBeforeActionLinks(alertHtml: string): string {
    try {
      const doc = new DOMParser().parseFromString(alertHtml || '', 'text/html');
      const root = doc.body.firstElementChild as HTMLElement | null;
      if (!root) return alertHtml;

      Array.from(root.querySelectorAll('p')).forEach((paragraph) => {
        const anchors = Array.from(paragraph.querySelectorAll('a'));
        if (anchors.length !== 1) return;

        const anchor = anchors[0];
        const anchorText = (anchor.textContent || '').trim();
        if (!this.containsActionVerbLinkText(anchorText)) return;

        const beforeRange = doc.createRange();
        beforeRange.setStart(paragraph, 0);
        beforeRange.setEndBefore(anchor);
        const beforeText = this.normalizeLeadInText(beforeRange.toString());
        beforeRange.detach();
        if (beforeText !== 'refer to:' && beforeText !== 'for details:' && beforeText !== 'learn more:') return;

        const afterRange = doc.createRange();
        afterRange.setStartAfter(anchor);
        afterRange.setEnd(paragraph, paragraph.childNodes.length);
        const afterText = afterRange.toString();
        afterRange.detach();
        if (afterText.replace(/[.!?\s]/g, '')) return;

        while (paragraph.firstChild && paragraph.firstChild !== anchor) {
          paragraph.removeChild(paragraph.firstChild);
        }
        this.removeTextAfterNode(anchor);
      });

      return root.outerHTML;
    } catch {
      return alertHtml;
    }
  }

  private stripStandaloneLinkTerminalPunctuation(alertHtml: string): string {
    try {
      const doc = new DOMParser().parseFromString(alertHtml || '', 'text/html');
      const root = doc.body.firstElementChild as HTMLElement | null;
      if (!root) return alertHtml;

      Array.from(root.querySelectorAll('p')).forEach((paragraph) => {
        const anchors = Array.from(paragraph.querySelectorAll('a'));
        if (anchors.length !== 1) return;

        const anchor = anchors[0];
        const beforeRange = doc.createRange();
        beforeRange.setStart(paragraph, 0);
        beforeRange.setEndBefore(anchor);
        const beforeText = this.normalizeLeadInText(beforeRange.toString());
        beforeRange.detach();

        const isStandaloneLink = !beforeText || this.isValidStandaloneLinkLeadIn(beforeText) || this.containsActionVerbLinkText(anchor.textContent || '');
        if (!isStandaloneLink) return;

        const afterRange = doc.createRange();
        afterRange.setStartAfter(anchor);
        afterRange.setEnd(paragraph, paragraph.childNodes.length);
        const afterText = afterRange.toString();
        afterRange.detach();
        if (!/^[\s.!?]+$/.test(afterText)) return;

        this.removeTextAfterNode(anchor);
      });

      return root.outerHTML.trim();
    } catch {
      return alertHtml;
    }
  }

  private removeTextAfterNode(node: Node): void {
    const parent = node.parentNode;
    if (!parent) return;

    while (node.nextSibling) {
      parent.removeChild(node.nextSibling);
    }
  }

  private stripLinkPlaceholders(value: string): string {
    return (value || '').replace(/\[(?:\/?\s*LINK|END\s+LINK)\]/gi, '').trim();
  }

  // Converts unexpected anchors back to plain text when the original alert had no links.
  private removeAnchorsPreservingText(alertHtml: string): string {
    try {
      const doc = new DOMParser().parseFromString(alertHtml, 'text/html');
      const root = doc.body.firstElementChild as HTMLElement | null;
      if (!root) return alertHtml;
      root.querySelectorAll('a').forEach((anchor) => {
        const textNode = doc.createTextNode(anchor.textContent || '');
        anchor.replaceWith(textNode);
      });
      return root.outerHTML.trim();
    } catch {
      return alertHtml;
    }
  }

  // Restores one original link when the rewrite incorrectly removed a required anchor.
  // Keep it in a standalone final paragraph so link-direction validation can pass.
  private ensureAtLeastOneOriginalLink(rewrittenHtml: string, originalAlertHtml: string): string {
    try {
      const sourceDoc = new DOMParser().parseFromString(originalAlertHtml, 'text/html');
      const sourceAnchor = sourceDoc.body.querySelector('a');
      if (!sourceAnchor) return rewrittenHtml;

      const rewrittenDoc = new DOMParser().parseFromString(rewrittenHtml, 'text/html');
      const root = rewrittenDoc.body.firstElementChild as HTMLElement | null;
      if (!root) return rewrittenHtml;
      if (root.querySelector('a')) return root.outerHTML.trim();

      const leadIn = this.getOriginalStandaloneLinkLeadIn(sourceAnchor) || 'Refer to:';
      const linkParagraph = rewrittenDoc.createElement('p');
      linkParagraph.insertAdjacentHTML('beforeend', `${leadIn} ${sourceAnchor.outerHTML}`);
      root.appendChild(linkParagraph);
      return root.outerHTML.trim();
    } catch {
      return rewrittenHtml;
    }
  }

  private getOriginalStandaloneLinkLeadIn(sourceAnchor: Element): string | null {
    const inlineParagraph = sourceAnchor.closest('p');
    if (inlineParagraph && inlineParagraph.querySelectorAll('a').length === 1) {
      const ownerDocument = inlineParagraph.ownerDocument;
      const beforeRange = ownerDocument.createRange();
      beforeRange.setStart(inlineParagraph, 0);
      beforeRange.setEndBefore(sourceAnchor);
      const leadIn = this.cleanOriginalLeadIn(beforeRange.toString());
      beforeRange.detach();
      if (leadIn) return leadIn;
    }

    const linkBlock = sourceAnchor.closest('p, ul, ol');
    let previous = linkBlock?.previousElementSibling || null;
    while (previous) {
      const text = (previous.textContent || '').trim();
      if (text) {
        return this.cleanOriginalLeadIn(text);
      }
      previous = previous.previousElementSibling;
    }
    return null;
  }

  private restoreInlineStandaloneLeadIn(anchor: Element, originalLeadIn: string): void {
    const paragraph = anchor.closest('p');
    if (!paragraph || paragraph.querySelectorAll('a').length !== 1) return;

    const ownerDocument = paragraph.ownerDocument;
    const beforeRange = ownerDocument.createRange();
    beforeRange.setStart(paragraph, 0);
    beforeRange.setEndBefore(anchor);
    const currentLeadIn = this.cleanOriginalLeadIn(beforeRange.toString());
    beforeRange.detach();
    if (!currentLeadIn || currentLeadIn === originalLeadIn) return;

    while (paragraph.firstChild && paragraph.firstChild !== anchor) {
      paragraph.removeChild(paragraph.firstChild);
    }
    paragraph.insertBefore(ownerDocument.createTextNode(`${originalLeadIn} `), anchor);
  }

  private restorePreviousStandaloneLeadIn(anchor: Element, originalLeadIn: string): void {
    const linkBlock = anchor.closest('ul, ol');
    if (!linkBlock) return;

    let previous = linkBlock.previousElementSibling;
    while (previous) {
      const currentLeadIn = this.cleanOriginalLeadIn(previous.textContent || '');
      if (currentLeadIn) {
        if (currentLeadIn !== originalLeadIn) {
          previous.textContent = originalLeadIn;
        }
        return;
      }
      if ((previous.textContent || '').trim()) return;
      previous = previous.previousElementSibling;
    }
  }

  private cleanOriginalLeadIn(leadInText: string): string | null {
    const leadIn = leadInText.replace(/[.!?]\s*$/g, '').trim();
    return this.isValidStandaloneLinkLeadIn(leadIn) ? leadIn : null;
  }

  private setUniqueLeadIn(map: Map<string, string>, key: string, leadIn: string): void {
    if (!key) return;
    if (map.has(key) && map.get(key) !== leadIn) {
      map.delete(key);
      return;
    }
    map.set(key, leadIn);
  }

  private normalizeHrefForLeadInMatch(href: string): string {
    const value = (href || '').trim();
    if (!value) return '';
    try {
      const url = new URL(value, 'https://www.canada.ca');
      return `${url.pathname}${url.search}${url.hash}`.toLowerCase();
    } catch {
      return value.toLowerCase();
    }
  }

  private normalizeLinkTextForLeadInMatch(value: string): string {
    return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  // Rebuilds a minimal alert wrapper when the model returns usable text but invalid structure.
  private buildAlertWrapperFromOriginal(params: { originalAlertHtml: string; heading: string; text: string }): string | null {
    try {
      const sourceDoc = new DOMParser().parseFromString(params.originalAlertHtml, 'text/html');
      const sourceRoot = sourceDoc.body.firstElementChild as HTMLElement | null;

      const doc = document.implementation.createHTMLDocument('');
      const wrapperTag = sourceRoot?.tagName?.toLowerCase() || 'div';
      const wrapper = doc.createElement(wrapperTag);
      wrapper.setAttribute('class', sourceRoot?.getAttribute('class') || 'alert alert-info');

      const headingText = (params.heading || '').trim();
      if (headingText) {
        const headingEl = doc.createElement('h3');
        headingEl.textContent = headingText;
        wrapper.appendChild(headingEl);
      }

      const bodyText = (params.text || '').trim();
      if (bodyText) {
        const bodyEl = doc.createElement('p');
        bodyEl.textContent = bodyText;
        wrapper.appendChild(bodyEl);
      }

      return wrapper.outerHTML.trim();
    } catch {
      return null;
    }
  }
}
