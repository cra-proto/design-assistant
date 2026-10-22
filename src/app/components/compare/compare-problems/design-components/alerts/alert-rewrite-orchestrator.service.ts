import { inject, Injectable } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { OpenRouterService } from '../../../../../services/ai/openrouter.service';
import { HtmlNormalizationService } from '../../../../../services/html-normalization.service';
import { AlertContextService } from './alert-context.service';
import { AlertRewriteGuardService } from './alert-rewrite-guard.service';
import { AlertRewriteIssueInput, AlertRewriteRepairCandidate, AlertRewriteResult, AlertRewriteService } from './alert-rewrite.service';

import { coerceInteractiveResultLeadIns, getReportableAlerts } from './alert-reportable.utils';
import { getAlertRewriteRules } from './alert-rewrite-rules';

export interface AlertRewriteFallbackNotice {
  alertIndex: number;
  reasons: string[];
}

type AlertRewriteTimingKey =
  | 'loadRulesMs'
  | 'parseAlertsMs'
  | 'loadExamplesMs'
  | 'buildCompactContextMs'
  | 'rewritePromptMs'
  | 'rewriteAiMs'
  | 'parseAndGuardMs'
  | 'localRepairMs'
  | 'applyRewritesMs'
  | 'formatHtmlMs';

type AlertRewriteTimings = Record<AlertRewriteTimingKey, number>;

@Injectable({ providedIn: 'root' })
export class AlertRewriteOrchestratorService {
  private alertRewrite = inject(AlertRewriteService);
  private alertRewriteGuard = inject(AlertRewriteGuardService);
  private alertContext = inject(AlertContextService);
  private htmlNormalization = inject(HtmlNormalizationService);
  private openRouter = inject(OpenRouterService);
  private translate = inject(TranslateService);

  private formatReasonsForLog(reasons: string[]): string {
    return reasons.length ? reasons.join(', ') : 'none';
  }

  private createTimings(): AlertRewriteTimings {
    return {
      loadRulesMs: 0,
      parseAlertsMs: 0,
      loadExamplesMs: 0,
      buildCompactContextMs: 0,
      rewritePromptMs: 0,
      rewriteAiMs: 0,
      parseAndGuardMs: 0,
      localRepairMs: 0,
      applyRewritesMs: 0,
      formatHtmlMs: 0,
    };
  }

  private addElapsed(timings: AlertRewriteTimings, key: AlertRewriteTimingKey, start: number): void {
    timings[key] += performance.now() - start;
  }

  private roundTimings(timings: AlertRewriteTimings): AlertRewriteTimings {
    return Object.fromEntries(Object.entries(timings).map(([key, value]) => [key, Math.round(value)])) as AlertRewriteTimings;
  }

  private isDebugLoggingEnabled(): boolean {
    try {
      return localStorage.getItem('pageAssistant.alertRewriteDebug') === 'true';
    } catch {
      return false;
    }
  }

  private debugLog(message: string, details: Record<string, unknown>): void {
    if (this.isDebugLoggingEnabled()) {
      console.debug(message, details);
    }
  }

  // Runs the full alert-rewrite workflow:
  // plan each alert, generate rewrites, apply retry/repair guards, then patch the page HTML.
  async generateRecommendations(params: {
    html: string;
    issues: AlertRewriteIssueInput[];
    preferredModel?: string;
    includeExamples: boolean;
    useCompactAlertsPageContext: boolean;
    forceLocalRepairForTesting: boolean;
  }): Promise<{
    formattedHtml: string;
    fallbackNotices: AlertRewriteFallbackNotice[];
  }> {
    const start = performance.now();
    const timings = this.createTimings();
    let timingStart = performance.now();
    const rewriteRules = await getAlertRewriteRules();
    this.addElapsed(timings, 'loadRulesMs', timingStart);
    const retryInstructions = rewriteRules.alertRewrite.retryInstructions;

    timingStart = performance.now();
    const alertDoc = new DOMParser().parseFromString(params.html, 'text/html');
    const alertEls = getReportableAlerts(alertDoc, {
      interactiveResultLeadIns: this.getInteractiveResultLeadIns(),
    });
    this.addElapsed(timings, 'parseAlertsMs', timingStart);
    if (!alertEls.length) {
      throw new Error('No reportable .alert elements found in the page.');
    }

    timingStart = performance.now();
    const examples = params.includeExamples ? await this.alertRewrite.loadExamples() : [];
    this.addElapsed(timings, 'loadExamplesMs', timingStart);
    const rewrites: {
      alert_index: number;
      rewritten_alert_html: string;
    }[] = [];
    const fallbackNotices: AlertRewriteFallbackNotice[] = [];
    timingStart = performance.now();
    const compactAlertPayloads = params.useCompactAlertsPageContext ? this.alertContext.buildCompactAlertRewritePayloads(alertDoc) : [];
    this.addElapsed(timings, 'buildCompactContextMs', timingStart);

    // Each alert is planned and rewritten independently so a bad output for one
    // alert does not block the others from being generated.
    for (let i = 0; i < alertEls.length; i += 1) {
      const alertElement = alertEls[i];
      if (!alertElement) continue;
      const alertIndex = i + 1;
      const relevantIssues = this.alertRewriteGuard.getIssuesForAlertIndex(params.issues, alertIndex);
      if (!params.includeExamples && !relevantIssues.length) {
        console.info('Alert rewrite skipped for alert without selected issues', {
          alertIndex,
        });
        continue;
      }

      const alertHtml = alertElement.outerHTML;
      const originalHeading = this.alertRewriteGuard.getAlertHeadingForRewrite(alertElement);
      const alertText = this.alertRewriteGuard.getAlertTextForRewrite(alertElement);
      if (!alertText) continue;
      const compactAlertPayload = params.useCompactAlertsPageContext ? compactAlertPayloads[i] : undefined;

      const initialPlan = this.alertRewrite.buildHeuristicPlan({
        alertHtml,
        alertText,
        alertType: this.alertRewrite.inferAlertType(alertHtml),
        issues: relevantIssues,
      });

      const selectedExamples = params.includeExamples
        ? this.alertRewrite.selectExamples(initialPlan, examples, 2, {
            originalHeading,
            originalAlertText: alertText,
          })
        : [];
      let rewriteResult = null;
      let rewriteModelName = 'unknown';
      let copyGuardTriggered = false;
      let blockedExampleId: string | null = null;
      let lastRepairCandidate: AlertRewriteRepairCandidate | null = null;
      let softRejectedResult: AlertRewriteResult | null = null;
      let softRejectedReasons: string[] = [];
      let lastRetryReasons: string[] = [];
      let rewriteResultSource: 'model' | 'local-repair' | 'soft-failure-candidate' | 'passthrough' = 'model';
      const originalHasAnchor = /<a\b/i.test(alertHtml);
      const allowLinkRemoval = this.alertRewriteGuard.shouldAllowAlertLinkRemoval(relevantIssues, initialPlan);

      // We allow one retry with additional corrective instructions before
      // falling back to deterministic local repair.
      let retryInstructionsForAttempt: string[] = [];
      for (let attempt = 0; attempt < 2; attempt += 1) {
        // Rebuild the rewrite prompt on each attempt so any retry instructions
        // are appended to the style rules seen by the model.
        timingStart = performance.now();
        const alertRewriteMessages = await this.alertRewrite.buildAlertRewriteMessages({
          originalHeading,
          originalAlertText: alertText,
          originalAlertHtml: alertHtml,
          compactAlertPayload,
          plan: initialPlan,
          issues: relevantIssues,
          examples: selectedExamples,
          retryInstructions: retryInstructionsForAttempt,
        });
        this.addElapsed(timings, 'rewritePromptMs', timingStart);

        timingStart = performance.now();
        const rewriteResponse = await this.openRouter.sendMessages(alertRewriteMessages, params.preferredModel, attempt > 0 ? 0.2 : 0);
        const rewriteAiElapsedMs = performance.now() - timingStart;
        timings.rewriteAiMs += rewriteAiElapsedMs;
        rewriteModelName = rewriteResponse.usedModel;
        this.debugLog('Alert rewrite AI call timing', {
          alertIndex,
          attempt: attempt + 1,
          requestedModel: params.preferredModel,
          usedModel: rewriteModelName,
          elapsedMs: Math.round(rewriteAiElapsedMs),
          responseCharacters: rewriteResponse.text.length,
        });

        // Parse the model response back into the normalized rewrite contract
        // used by the rest of the pipeline. If parsing fails we cannot safely
        // patch the alert into the page, so we retry with a structure-specific instruction.
        timingStart = performance.now();
        let parsedResult = this.alertRewrite.parseAlertRewriteResponse(rewriteResponse.text, initialPlan, selectedExamples);
        this.debugLog('Alert rewrite parsed model output', {
          alertIndex,
          attempt: attempt + 1,
          rewrittenAlertHtml: parsedResult?.rewrittenAlertHtml,
          rewrittenAlert: parsedResult?.rewrittenAlert,
        });
        if (!parsedResult?.rewrittenAlertHtml) {
          const repairCandidate = this.alertRewrite.parseAlertRewriteRepairCandidate(rewriteResponse.text, selectedExamples);
          if (repairCandidate) {
            lastRepairCandidate = repairCandidate;
          }
          console.warn(`Alert rewrite retry triggered for alert ${alertIndex}, attempt ${attempt + 1}: ${this.formatReasonsForLog(['invalidWrapperHtml'])}`, {
            alertIndex,
            attempt: attempt + 1,
            reasons: ['invalidWrapperHtml'],
            reasonsText: 'invalidWrapperHtml',
            willRetryWithNewModelCall: true,
          });
          lastRetryReasons = ['invalidWrapperHtml'];
          retryInstructionsForAttempt = [retryInstructions.invalidWrapperHtml];
          this.addElapsed(timings, 'parseAndGuardMs', timingStart);
          continue;
        }

        const preservedLeadInHtml = this.alertRewriteGuard.preserveOriginalStandaloneLinkLeadIns(parsedResult.rewrittenAlertHtml, alertHtml);
        if (preservedLeadInHtml !== parsedResult.rewrittenAlertHtml) {
          const leadInPreservedResult = this.alertRewrite.parseAlertRewriteResponse(
            JSON.stringify({
              ...parsedResult,
              rewrittenAlertHtml: preservedLeadInHtml,
            }),
            initialPlan,
            selectedExamples,
          );
          if (leadInPreservedResult?.rewrittenAlertHtml) {
            parsedResult = leadInPreservedResult;
          }
        }
        lastRepairCandidate = parsedResult;

        const retryReasons: string[] = [];
        const retryInstructionsForResult: string[] = [];
        const addRetryInstruction = (reason: string, instruction: string): void => {
          retryReasons.push(reason);
          retryInstructionsForResult.push(instruction);
        };

        // Guard 1: semantic alert headings are required for accessibility.
        if (!this.alertRewriteGuard.hasSemanticHeading(parsedResult.rewrittenAlertHtml)) {
          addRetryInstruction('mustHaveHeading', retryInstructions.mustHaveHeading);
        }

        // Guard 2: placeholder tokens are never valid final output. This catches
        // cases where the model copied a prompt convention instead of returning
        // real HTML anchors or plain text.
        const hasLinkPlaceholders =
          this.alertRewriteGuard.containsLinkPlaceholderSyntax(parsedResult.rewrittenAlertHtml) || this.alertRewriteGuard.containsLinkPlaceholderSyntax(parsedResult.rewrittenAlert);
        if (hasLinkPlaceholders) {
          addRetryInstruction('placeholderLinks', retryInstructions.placeholderLinks);
        }

        // Guard 3: compare link presence before vs after rewrite so we do not
        // accidentally add links that were never in the source alert.
        const rewrittenHasAnchor = /<a\b/i.test(parsedResult.rewrittenAlertHtml);
        if (!originalHasAnchor && rewrittenHasAnchor) {
          addRetryInstruction('noLinksAllowed', retryInstructions.noLinksAllowed);
        }

        // Guard 4: if the source alert had links, do not let the rewrite drop
        // every link. Link-removal issues may remove extras, not all links.
        if (originalHasAnchor && !rewrittenHasAnchor) {
          addRetryInstruction('mustKeepLink', retryInstructions.mustKeepLink);
        }

        // Guard 5: enforce the paragraph-level link-direction conventions
        // handled by AlertRewriteGuardService. This is where malformed
        // "refer to <link>" or link-only sentence patterns trigger a retry.
        const linkLeadInIssue = rewrittenHasAnchor ? this.alertRewriteGuard.getFullSentenceLinkLeadInIssue(parsedResult.rewrittenAlertHtml) : null;
        if (linkLeadInIssue) {
          addRetryInstruction(linkLeadInIssue, retryInstructions.fullSentenceLinksNeedLeadIn);
        }

        // Guard 6: if examples are enabled, reject outputs that are too close
        // to an example rewrite instead of specific to the current alert.
        const copyCheck = this.alertRewrite.detectExampleCopy({
          result: parsedResult,
          selectedExamples,
          originalHeading,
          originalAlertText: alertText,
        });
        if (copyCheck.isCopy) {
          copyGuardTriggered = true;
          blockedExampleId = copyCheck.exampleId || null;
          addRetryInstruction('avoidExampleCopy', retryInstructions.avoidExampleCopy);
          console.warn('Alert rewrite copy guard triggered', {
            alertIndex,
            attempt: attempt + 1,
            reason: copyCheck.reason,
            exampleId: copyCheck.exampleId,
            similarity: copyCheck.similarity,
          });
        }

        if (!params.forceLocalRepairForTesting && retryReasons.length === 1 && retryReasons[0] === 'linkLeadInNotStandalone') {
          const repairedHtml = this.alertRewriteGuard.repairEmbeddedStandaloneLeadInParagraphs(parsedResult.rewrittenAlertHtml);
          if (repairedHtml !== parsedResult.rewrittenAlertHtml) {
            const repairedResult = this.alertRewrite.parseAlertRewriteResponse(
              JSON.stringify({
                ...parsedResult,
                rewrittenAlertHtml: repairedHtml,
              }),
              initialPlan,
              selectedExamples,
            );
            if (
              repairedResult?.rewrittenAlertHtml &&
              !this.alertRewriteGuard.getFullSentenceLinkLeadInIssue(repairedResult.rewrittenAlertHtml) &&
              !this.alertRewrite.detectExampleCopy({
                result: repairedResult,
                selectedExamples,
                originalHeading,
                originalAlertText: alertText,
              }).isCopy
            ) {
              rewriteResult = repairedResult;
              lastRepairCandidate = repairedResult;
              this.addElapsed(timings, 'parseAndGuardMs', timingStart);
              break;
            }
          }
        }

        if (retryReasons.length) {
          const hardRetryReasons = retryReasons.filter((reason) => reason !== 'mustHaveHeading' && reason !== 'fullSentenceLinksNeedLeadIn' && reason !== 'linkLeadInNotStandalone');
          if (!hardRetryReasons.length) {
            softRejectedResult = parsedResult;
            softRejectedReasons = [...retryReasons];
          }
          console.warn(`Alert rewrite retry triggered for alert ${alertIndex}, attempt ${attempt + 1}: ${this.formatReasonsForLog(retryReasons)}`, {
            alertIndex,
            attempt: attempt + 1,
            reasons: retryReasons,
            reasonsText: retryReasons.join(', '),
            willRetryWithNewModelCall: true,
          });
          lastRetryReasons = [...retryReasons];
          retryInstructionsForAttempt = Array.from(new Set(retryInstructionsForResult));
          this.addElapsed(timings, 'parseAndGuardMs', timingStart);
          continue;
        }

        if (!copyCheck.isCopy) {
          if (params.forceLocalRepairForTesting) {
            console.warn('Forcing local repair for testing', { alertIndex });
            this.addElapsed(timings, 'parseAndGuardMs', timingStart);
            break;
          }
          rewriteResult = parsedResult;
          rewriteResultSource = 'model';
          this.addElapsed(timings, 'parseAndGuardMs', timingStart);
          break;
        }
        this.addElapsed(timings, 'parseAndGuardMs', timingStart);
      }

      // If model retries still fail, attempt one deterministic repair pass locally.
      if (!rewriteResult && lastRepairCandidate) {
        timingStart = performance.now();
        console.warn(`Alert rewrite attempting local repair for alert ${alertIndex}: ${this.formatReasonsForLog(lastRetryReasons)}`, {
          alertIndex,
          hadModelOutput: true,
          lastRetryReasons,
          lastRetryReasonsText: lastRetryReasons.join(', '),
          willRetryWithNewModelCall: false,
        });
        rewriteResult = this.alertRewriteGuard.tryLocalAlertRewriteRepair({
          result: lastRepairCandidate,
          originalAlertHtml: alertHtml,
          originalHeading,
          originalAlertText: alertText,
          plan: initialPlan,
          selectedExamples,
          allowLinkRemoval,
        });
        if (rewriteResult) {
          rewriteResultSource = 'local-repair';
        }
        this.addElapsed(timings, 'localRepairMs', timingStart);
      }

      if (!rewriteResult && softRejectedResult) {
        console.warn(`Alert rewrite using soft-failure candidate for alert ${alertIndex}: ${this.formatReasonsForLog(softRejectedReasons)}`, {
          alertIndex,
          softRejectedReasons,
          softRejectedReasonsText: softRejectedReasons.join(', '),
          willRetryWithNewModelCall: false,
        });
        rewriteResult = softRejectedResult;
        rewriteResultSource = 'soft-failure-candidate';
        lastRetryReasons = [...softRejectedReasons];
      }

      // Final safety net: preserve the original alert rather than dropping it.
      if (!rewriteResult) {
        console.warn(`Alert rewrite falling back to passthrough result for alert ${alertIndex}: ${this.formatReasonsForLog(lastRetryReasons)}`, {
          alertIndex,
          lastRetryReasons,
          lastRetryReasonsText: lastRetryReasons.join(', '),
          willRetryWithNewModelCall: false,
        });
        rewriteResult = this.alertRewrite.buildPassthroughResult({
          alertHtml,
          originalHeading,
          originalAlertText: alertText,
        });
        rewriteResultSource = 'passthrough';
        fallbackNotices.push({
          alertIndex,
          reasons: [...lastRetryReasons],
        });
      }
      rewriteResult.rewrittenAlertHtml = this.alertRewriteGuard.ensureSemanticHeading(rewriteResult.rewrittenAlertHtml, rewriteResult.rewrittenHeading);
      rewriteResult.rewrittenAlertHtml = this.alertRewriteGuard.removeRedundantLeadInsBeforeActionLinks(rewriteResult.rewrittenAlertHtml);
      rewriteResult.rewrittenAlertHtml = this.alertRewriteGuard.preserveOriginalStandaloneLinkLeadIns(rewriteResult.rewrittenAlertHtml, alertHtml);
      rewriteResult.rewrittenAlertHtml = this.alertRewriteGuard.removeStandaloneLinkTerminalPunctuation(rewriteResult.rewrittenAlertHtml);

      // At this point we have exactly one final rewrite for the current alert,
      // whether it came from the model, local repair, or passthrough fallback.
      rewrites.push({
        alert_index: alertIndex,
        rewritten_alert_html: rewriteResult.rewrittenAlertHtml,
      });

      // These debug logs keep a clean distinction between the examples we
      // selected and the subset the model explicitly reported using.
      const compactExampleDetails = (examples: typeof selectedExamples) =>
        examples.map((example) => ({
          id: example.id,
          alertType: example.alertType,
          criteria: example.criteria,
          tags: example.tags,
          egHeading: example.egHeading || '',
        }));
      const examplesUsedDetails = compactExampleDetails(
        rewriteResult.exampleIdsUsed.map((id) => selectedExamples.find((example) => example.id === id)).filter((example): example is NonNullable<typeof example> => !!example),
      );
      const suppliedExampleIds = selectedExamples.map((example) => example.id);

      console.info('Alert rewrite examples', {
        alertIndex,
        suppliedExampleIds,
        exampleIdsUsed: rewriteResult.exampleIdsUsed,
      });

      this.debugLog('Alert rewrite examples used', {
        alertIndex,
        suppliedExampleIds,
        suppliedExamples: compactExampleDetails(selectedExamples),
        usedExamples: examplesUsedDetails,
        suppliedCount: selectedExamples.length,
        usedCount: rewriteResult.exampleIdsUsed.length,
        exampleIdsUsed: rewriteResult.exampleIdsUsed,
      });

      this.debugLog('Alert rewrite iteration', {
        alertIndex,
        resultSource: rewriteResultSource,
        plan: initialPlan,
        selectedExampleIds: selectedExamples.map((example) => example.id),
        originalHeading,
        finalHeading: rewriteResult.rewrittenHeading,
        finalRewrite: rewriteResult.rewrittenAlert,
        finalRewriteHtml: rewriteResult.rewrittenAlertHtml,
        appliedDirectives: rewriteResult.appliedDirectives,
        exampleIdsUsed: rewriteResult.exampleIdsUsed,
        planModel: 'heuristic',
        rewriteModel: rewriteModelName,
        copyGuardTriggered,
        blockedExampleId,
        lastRetryReasons,
        humanRating: null,
      });
    }

    // Once each alert has a final rewrite, patch them back into the original page.
    timingStart = performance.now();
    const finalHtml = this.alertRewriteGuard.applyAlertHtmlRewrites(params.html, rewrites);
    this.addElapsed(timings, 'applyRewritesMs', timingStart);
    if (!finalHtml) {
      console.info('Alert rewrite skipped because no alerts had selected issues.');
      timingStart = performance.now();
      const formattedHtml = await this.htmlNormalization.formatHtml(params.html);
      this.addElapsed(timings, 'formatHtmlMs', timingStart);
      console.info('Alert rewrite timing', {
        requestedModel: params.preferredModel,
        rewrites: 0,
        totalMs: Math.round(performance.now() - start),
        timings: this.roundTimings(timings),
      });
      return {
        formattedHtml,
        fallbackNotices,
      };
    }

    // Keep final output formatting consistent with the rest of the assistant flow.
    timingStart = performance.now();
    const formattedHtml = await this.htmlNormalization.formatHtml(finalHtml);
    this.addElapsed(timings, 'formatHtmlMs', timingStart);
    console.info('Alert rewrite timing', {
      requestedModel: params.preferredModel,
      rewrites: rewrites.length,
      totalMs: Math.round(performance.now() - start),
      timings: this.roundTimings(timings),
    });
    return { formattedHtml, fallbackNotices };
  }

  private getInteractiveResultLeadIns(): string[] {
    return coerceInteractiveResultLeadIns(this.translate.instant('problems.alerts.interactiveResultLeadIns'));
  }
}
