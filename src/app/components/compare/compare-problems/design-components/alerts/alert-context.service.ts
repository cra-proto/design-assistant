import { inject, Injectable } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { coerceInteractiveResultLeadIns, getReportableAlerts } from './alert-reportable.utils';

@Injectable({ providedIn: 'root' })
export class AlertContextService {
  private readonly translate = inject(TranslateService);

  // Builds the compact alert-analysis payload used when we want the model to
  // reason over structured page signals instead of parsing the full page HTML.
  buildCompactAlertsIssuesPayload(sourceHtml: string): Record<string, unknown> {
    const parser = new DOMParser();
    const doc = parser.parseFromString(sourceHtml, 'text/html');
    const context = this.buildCompactPageContext(doc);

    // Placement context describes where each alert sits relative to page
    // landmarks and nearby section text.
    const alertPlacementContext = context.alerts.map((alertEl, index) => this.buildCompactAlertPlacementContext(alertEl, index + 1, context));

    // Alert signals capture the structural facts that usually drive issue
    // decisions: type, heading, text density, links, hidden content, adjacency.
    const alertSignals = context.alerts.map((alertEl, index) => this.buildCompactAlertSignals(alertEl, index + 1));

    // Roll up repeated structural patterns that can indicate page-level alert
    // problems, such as too many alerts before content or clustered alerts.
    const alertsBeforeFirstH2Count = alertPlacementContext.filter((item) => item.is_before_first_h2).length;
    const adjacentAlertCount = alertSignals.filter((item) => item.previous_sibling_is_alert || item.next_sibling_is_alert).length;

    return {
      alerts: context.alerts.map((alertEl) => alertEl.outerHTML),
      alertCount: context.alerts.length,
      pageContext: `Title: ${context.title || 'N/A'}\nH1: ${context.h1 || 'N/A'}\nPage type signal: ${context.pageTypeSignal}\nMain intro: ${context.introSnippet || 'N/A'}\nH2 headings (${context.h2Headings.length}): ${context.h2Headings.join(' | ') || 'N/A'}`,
      pageSignals: {
        title: context.title,
        h1: context.h1,
        pageTypeSignal: context.pageTypeSignal,
        h2Headings: context.h2Headings,
        alertCount: context.alerts.length,
        hasMultipleAlerts: context.alerts.length > 1,
        alertsBeforeFirstH2Count,
        adjacentAlertCount,
      },
      alertPlacementContext,
      alertSignals,
    };
  }

  // Collects the shared page frame used by issue detection and rewrite prompts:
  // reportable alerts, heading landmarks, title/H1 context, and a coarse
  // page-type hint. Keeping this in one place prevents prompt paths from
  // drifting in how they understand the same source document.
  private buildCompactPageContext(sourceDoc: Document): {
    alerts: Element[];
    main: HTMLElement;
    h2Elements: HTMLElement[];
    h2Headings: string[];
    mainElements: Element[];
    mainIndexMap: Map<Element, number>;
    h2IndexPairs: { text: string; idx: number }[];
    firstH2Index: number;
    title: string;
    h1: string;
    introSnippet: string;
    pageTypeSignal: string;
    alertsBeforeFirstH2Count: number;
  } {
    const alerts = getReportableAlerts(sourceDoc, {
      interactiveResultLeadIns: this.getInteractiveResultLeadIns(),
    });
    const main = (sourceDoc.querySelector('main') as HTMLElement | null) ?? sourceDoc.body;

    // H2s act as section landmarks; their text and DOM position let us describe
    // alert placement in useful page terms.
    const h2Elements = Array.from(main.querySelectorAll('h2'));
    const h2Headings = h2Elements
      .map((h2) => this.truncateContextText(h2.textContent || '', 120))
      .filter((value) => !!value)
      .slice(0, 20);

    // A flat element index gives us stable relative positions without sending
    // full ancestor paths or large DOM slices to the model.
    const mainElements = Array.from(main.querySelectorAll('*'));
    const mainIndexMap = new Map<Element, number>(mainElements.map((el, idx) => [el, idx]));
    const h2IndexPairs = h2Elements
      .map((h2) => ({
        text: this.truncateContextText(h2.textContent || '', 120),
        idx: mainIndexMap.get(h2),
      }))
      .filter((item) => Number.isFinite(item.idx)) as { text: string; idx: number }[];
    const firstH2Index = h2IndexPairs.length ? h2IndexPairs[0].idx : -1;

    // Intro text and page type help distinguish task flows from general content
    // pages when judging whether an alert fits its surrounding page.
    const title = this.truncateContextText(sourceDoc.querySelector('title')?.textContent || '', 200);
    const h1 = this.truncateContextText(main.querySelector('h1')?.textContent || '', 200);
    const introSnippet = this.truncateContextText(main.querySelector('p')?.textContent || '', 350);
    const pageTypeSignal = this.inferPageTypeSignal(title, h1);
    const alertsBeforeFirstH2Count = alerts.filter((alertEl) => {
      const mainIndex = mainIndexMap.get(alertEl);
      return typeof mainIndex === 'number' && firstH2Index >= 0 && mainIndex < firstH2Index;
    }).length;

    return {
      alerts,
      main,
      h2Elements,
      h2Headings,
      mainElements,
      mainIndexMap,
      h2IndexPairs,
      firstH2Index,
      title,
      h1,
      introSnippet,
      pageTypeSignal,
      alertsBeforeFirstH2Count,
    };
  }

  // Converts an alert's DOM position into section-aware context: before/after
  // the first H2, nearest surrounding H2s, and nearby body text.
  private buildCompactAlertPlacementContext(alertElement: Element, alertIndex: number, context: ReturnType<AlertContextService['buildCompactPageContext']>) {
    const mainIndex = context.mainIndexMap.get(alertElement);
    const positionPercentInMain = typeof mainIndex === 'number' && context.mainElements.length > 1 ? Math.round((mainIndex / (context.mainElements.length - 1)) * 100) : null;

    // Nearest H2s are more useful to the prompt than raw node indexes because
    // they identify the section an alert is introducing, interrupting, or
    // following.
    const beforeCandidates = context.h2IndexPairs.filter((item) => typeof mainIndex === 'number' && item.idx < mainIndex);
    const afterCandidates = context.h2IndexPairs.filter((item) => typeof mainIndex === 'number' && item.idx > mainIndex);
    const nearestH2Above = beforeCandidates.length ? beforeCandidates[beforeCandidates.length - 1].text : '';
    const nearestH2Below = afterCandidates.length ? afterCandidates[0].text : '';

    return {
      alert_index: alertIndex,
      is_before_first_h2: typeof mainIndex === 'number' && context.firstH2Index >= 0 ? mainIndex < context.firstH2Index : false,
      position_percent_in_main: positionPercentInMain,
      nearest_h2_above: nearestH2Above,
      nearest_h2_below: nearestH2Below,
      section_snippet_before: this.collectSiblingTextSnippet(alertElement, 'before', 220),
      section_snippet_after: this.collectSiblingTextSnippet(alertElement, 'after', 220),
    };
  }

  // Builds the per-alert facts that commonly drive issue decisions.
  private buildCompactAlertSignals(alertElement: Element, alertIndex: number) {
    const heading = this.getAlertHeadingMetadata(alertElement);
    const links = this.getAlertLinks(alertElement);
    const paragraphCount = this.getAlertParagraphCount(alertElement);
    const visibleText = this.truncateContextText(alertElement.textContent || '', 400);
    const previousSiblingIsAlert = alertElement.previousElementSibling?.classList.contains('alert') ?? false;
    const nextSiblingIsAlert = alertElement.nextElementSibling?.classList.contains('alert') ?? false;

    return {
      alert_index: alertIndex,
      alert_type: this.getAlertTypeClass(alertElement),
      heading_text: heading.text,
      heading_level: heading.level,
      heading_source: heading.source,
      heading_tag: heading.tag,
      has_heading: heading.source !== 'none',
      paragraph_count: paragraphCount,
      has_multiple_paragraphs: paragraphCount > 1,
      text_length_chars: visibleText.length,
      link_count: links.length,
      has_multiple_links: links.length > 1,
      links,
      has_hidden_content: this.hasHiddenAlertContent(alertElement),
      previous_sibling_is_alert: previousSiblingIsAlert,
      next_sibling_is_alert: nextSiblingIsAlert,
      adjacent_alert_cluster_size: this.getAdjacentAlertClusterSize(alertElement),
    };
  }

  private getInteractiveResultLeadIns(): string[] {
    return coerceInteractiveResultLeadIns(this.translate.instant('problems.alerts.interactiveResultLeadIns'));
  }

  // Normalizes page text into short snippets so the compact payload stays cheap.
  private truncateContextText(value: string | null | undefined, maxChars: number): string {
    const normalized = (value || '').replace(/\s+/g, ' ').trim();
    if (!normalized) return '';
    return normalized.length > maxChars ? normalized.slice(0, maxChars).trim() : normalized;
  }

  // Pulls nearby sibling text so alerts carry a little surrounding context
  // without shipping the whole DOM back to the model.
  private collectSiblingTextSnippet(alertEl: Element, direction: 'before' | 'after', maxChars: number): string {
    const collected: string[] = [];
    let node = direction === 'before' ? alertEl.previousElementSibling : alertEl.nextElementSibling;
    let hops = 0;

    while (node && hops < 4) {
      const lowerTag = node.tagName.toLowerCase();
      if (lowerTag !== 'script' && lowerTag !== 'style' && !node.classList.contains('alert')) {
        const text = this.truncateContextText(node.textContent || '', maxChars);
        if (text) {
          if (direction === 'before') {
            collected.unshift(text);
          } else {
            collected.push(text);
          }
          const joined = this.truncateContextText(collected.join(' '), maxChars);
          if (joined.length >= maxChars) {
            return joined;
          }
        }
      }
      node = direction === 'before' ? node.previousElementSibling : node.nextElementSibling;
      hops += 1;
    }

    return this.truncateContextText(collected.join(' '), maxChars);
  }

  // A coarse page-type hint gives the issues prompt lightweight task-vs-content context.
  private inferPageTypeSignal(title: string, h1: string): string {
    const context = `${title} ${h1}`.toLowerCase();
    if (!context.trim()) return 'content';
    if (/\b(home|welcome|overview|what'?s new|landing)\b/.test(context)) {
      return 'landing';
    }
    if (/\b(apply|submit|file|register|sign in|log in|payment|pay|request)\b/.test(context)) {
      return 'task';
    }
    return 'content';
  }

  // Supports alert headings that use utility classes instead of semantic heading tags.
  private getHeadingUtilityLevel(element: Element | null): number | null {
    if (!element) return null;
    for (let level = 1; level <= 6; level += 1) {
      if (element.classList.contains(`h${level}`)) {
        return level;
      }
    }
    return null;
  }

  // Normalizes heading metadata so downstream prompts can reason over one shape
  // regardless of whether the alert used semantic headings or utility classes.
  private getAlertHeadingMetadata(alertElement: Element): {
    text: string;
    level: number | null;
    source: 'semantic' | 'utility-class' | 'none';
    tag: string;
  } {
    const semanticHeading = alertElement.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6');
    if (semanticHeading) {
      const headingLevel = Number(semanticHeading.tagName.slice(1));
      return {
        text: this.truncateContextText(semanticHeading.textContent || '', 160),
        level: Number.isFinite(headingLevel) ? headingLevel : null,
        source: 'semantic',
        tag: semanticHeading.tagName.toLowerCase(),
      };
    }

    const utilityHeading = alertElement.querySelector<HTMLElement>('.h1, .h2, .h3, .h4, .h5, .h6');
    const utilityLevel = this.getHeadingUtilityLevel(utilityHeading);
    if (utilityHeading && utilityLevel) {
      return {
        text: this.truncateContextText(utilityHeading.textContent || '', 160),
        level: utilityLevel,
        source: 'utility-class',
        tag: utilityHeading.tagName.toLowerCase(),
      };
    }

    return {
      text: '',
      level: null,
      source: 'none',
      tag: '',
    };
  }

  // Reduces the alert class list to the alert type signal the prompt cares about.
  private getAlertTypeClass(alertElement: Element): string {
    const classNames = Array.from(alertElement.classList).map((name) => name.toLowerCase());
    if (classNames.includes('alert-danger') || classNames.includes('alert-error')) {
      return 'danger';
    }
    if (classNames.includes('alert-warning')) {
      return 'warning';
    }
    if (classNames.includes('alert-success')) {
      return 'success';
    }
    if (classNames.includes('alert-info')) {
      return 'info';
    }
    return 'unknown';
  }

  // Builds compact context for one alert rewrite. This path is useful when the
  // caller already has a specific alert element rather than a full alert list.
  buildCompactAlertRewritePayload(alertElement: Element, sourceDoc: Document, alertIndex: number): Record<string, unknown> {
    const context = this.buildCompactPageContext(sourceDoc);

    return this.buildCompactAlertRewritePayloadFromContext(alertElement, alertIndex, context);
  }

  // Builds rewrite payloads for all reportable alerts while reusing the shared
  // page context. The orchestrator uses this batch path to avoid rescanning the
  // same document for every alert.
  buildCompactAlertRewritePayloads(sourceDoc: Document): Record<string, unknown>[] {
    const context = this.buildCompactPageContext(sourceDoc);

    return context.alerts.map((alertElement, index) => this.buildCompactAlertRewritePayloadFromContext(alertElement, index + 1, context));
  }

  private buildCompactAlertRewritePayloadFromContext(alertElement: Element, alertIndex: number, context: ReturnType<AlertContextService['buildCompactPageContext']>): Record<string, unknown> {
    const alertSignals = this.buildCompactAlertSignals(alertElement, alertIndex);

    // adjacent_alert_cluster_size includes the current alert; adjacentAlertCount
    // exposes only neighbouring alerts so isolated alerts report zero.
    const adjacentAlertCount = alertSignals.previous_sibling_is_alert || alertSignals.next_sibling_is_alert ? Math.max(alertSignals.adjacent_alert_cluster_size - 1, 0) : 0;

    // Rewrite prompts operate on one alert at a time, but page-level context
    // helps the proposed copy fit the alert's actual role.
    return {
      alertIndex,
      alertType: this.getAlertTypeClass(alertElement),
      originalHeading: alertSignals.heading_text,
      originalAlertText: this.truncateContextText(alertElement.textContent || '', 400),
      pageContext: `Title: ${context.title || 'N/A'}\nH1: ${context.h1 || 'N/A'}\nPage type signal: ${context.pageTypeSignal}\nMain intro: ${context.introSnippet || 'N/A'}\nH2 headings (${context.h2Headings.length}): ${context.h2Headings.join(' | ') || 'N/A'}`,
      pageSignals: {
        title: context.title,
        h1: context.h1,
        pageTypeSignal: context.pageTypeSignal,
        h2Headings: context.h2Headings,
        alertCount: context.alerts.length,
        hasMultipleAlerts: context.alerts.length > 1,
        alertsBeforeFirstH2Count: context.alertsBeforeFirstH2Count,
        adjacentAlertCount,
        adjacentAlertClusterSize: alertSignals.adjacent_alert_cluster_size,
      },
      alertPlacementContext: this.buildCompactAlertPlacementContext(alertElement, alertIndex, context),
      alertSignals,
    };
  }

  // Extracts links in a compact form so prompts can reason over link count and intent.
  private getAlertLinks(alertElement: Element): { text: string; href: string }[] {
    return Array.from(alertElement.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .map((anchor) => ({
        text: this.truncateContextText(anchor.textContent || '', 120),
        href: (anchor.getAttribute('href') || '').trim(),
      }))
      .filter((link) => !!link.href);
  }

  // Hidden or collapsible content inside an alert is a useful accessibility signal.
  private hasHiddenAlertContent(alertElement: Element): boolean {
    return Boolean(alertElement.querySelector('details, [hidden], [aria-hidden="true"], [aria-expanded], .wb-toggle, .collapse, .collapsible, .accordion, [data-toggle]'));
  }

  // Counts body paragraphs while ignoring utility-class heading wrappers.
  private getAlertParagraphCount(alertElement: Element): number {
    return Array.from(alertElement.querySelectorAll('p')).filter((paragraph) => {
      const text = this.truncateContextText(paragraph.textContent || '', 80);
      return !!text && !this.getHeadingUtilityLevel(paragraph);
    }).length;
  }

  // Counts the contiguous alert run that contains this alert, including itself.
  private getAdjacentAlertClusterSize(alertElement: Element): number {
    let clusterSize = 1;

    let previous = alertElement.previousElementSibling;
    while (previous?.classList.contains('alert')) {
      clusterSize += 1;
      previous = previous.previousElementSibling;
    }

    let next = alertElement.nextElementSibling;
    while (next?.classList.contains('alert')) {
      clusterSize += 1;
      next = next.nextElementSibling;
    }

    return clusterSize;
  }
}
