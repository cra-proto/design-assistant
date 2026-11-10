import { NgTemplateOutlet } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, effect, inject, Injector, input, signal, TemplateRef, untracked, viewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe } from '@ngx-translate/core';

import { TreeNode } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { TabsModule } from 'primeng/tabs';

import { CompareSelectComponent } from '../../../components/compare/compare-select/compare-select.component';
import { CompareAiLangComponent } from './compare-ai/compare-ai.component';
import { CompareDataComponent } from './compare-data/compare-data.component';
import { CompareHiddenComponent } from './compare-hidden/compare-hidden.component';
import { CompareHtmlComponent } from './compare-html/compare-html.component';
import { CompareNumbersComponent } from './compare-numbers/compare-numbers.component';
import { CompareWebComponent } from './compare-web/compare-web.component';

import { FetchService } from '../../../services/fetch.service';
import { HtmlNormalizationService } from '../../../services/html-normalization.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { StyleCardService } from '../../../services/style-card.service';
import { CompareService } from '../compare-versions/compare-versions.service';
import { ReviewLanguagesService } from './compare-languages.service';

import { AidaLinks } from '../../../common/aidaLinks.config';
import { DataVersion, TreeNodeData } from '../../../common/data.model';
import { compareHidden, HiddenRow } from './compare-hidden/compare-hidden';
import { compareHTML, CountRow } from './compare-html/compare-html';
import { alignNumbers, extractNumbers, NumberRow } from './compare-numbers/compare-numbers';

export interface DataMismatch {
  label: string;
  en: string;
  fr: string;
}

type SummaryState = 'ok' | 'problem' | 'loading' | 'error' | 'notRun';

interface SummaryRow {
  tab: string;
  template: TemplateRef<unknown>;
  icon: string;
  label: string;
  state: SummaryState;
  count: number;
  detail?: string;
}

@Component({
  selector: 'aida-compare-languages',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    TranslatePipe,
    BadgeModule,
    ButtonModule,
    DialogModule,
    MessageModule,
    TabsModule,
    CompareAiLangComponent,
    CompareDataComponent,
    CompareHiddenComponent,
    CompareHtmlComponent,
    CompareNumbersComponent,
    CompareSelectComponent,
    CompareWebComponent,
  ],
  templateUrl: './compare-languages.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareLanguagesComponent {
  private readonly injector = inject(Injector);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly projectState = inject(ProjectStateService);
  protected readonly compareService = inject(CompareService);
  private readonly fetchService = inject(FetchService);
  private readonly htmlNormalizationService = inject(HtmlNormalizationService);
  protected readonly styleCardService = inject(StyleCardService);
  protected readonly reviewLanguagesService = inject(ReviewLanguagesService);

  public readonly summaryMode = input<boolean>(false);
  protected readonly activeTab = signal<string | number>('0');
  protected readonly openDialog = signal<SummaryRow | null>(null);

  AidaLinks = AidaLinks;

  /** Signals for data comparison */
  protected readonly selectedNode = signal<TreeNode<TreeNodeData> | undefined>(undefined);
  protected readonly selectedBase = signal<DataMismatch[] | undefined>(undefined);
  protected readonly selectedProto = signal<DataMismatch[] | undefined>(undefined);
  protected readonly selectedLive = signal<DataMismatch[] | undefined>(undefined);

  /** Signal for HTML comparison: a count of all elements, classes, and attributes in English and French */
  protected readonly htmlRows = signal<CountRow[]>([]);

  /** Signal for hidden comparison: an extract of all hidden content in English and French */
  protected readonly hiddenRows = signal<HiddenRow[]>([]);

  /** Signal for numbers comparison: an extract of all numbers with context */
  protected readonly numberRows = signal<NumberRow[]>([]);

  /** Signals for AI summary: cleaned up HTML strings*/
  protected readonly aiEnglish = signal<string>('');
  protected readonly aiFrench = signal<string>('');

  /** Signals for web view: cleaned up SafeHtml */
  protected readonly iframeEnglish = signal<SafeHtml | undefined>(undefined);
  protected readonly iframeFrench = signal<SafeHtml | undefined>(undefined);

  /** Signal is true if page cannot be fetched from source */
  protected readonly is404 = signal<boolean>(false);

  resetSignals() {
    this.selectedNode.set(undefined);
    this.selectedBase.set(undefined);
    this.selectedProto.set(undefined);
    this.selectedLive.set(undefined);

    this.htmlRows.set([]);

    this.hiddenRows.set([]);

    this.numberRows.set([]);

    this.aiEnglish.set('');
    this.aiFrench.set('');

    this.iframeEnglish.set(undefined);
    this.iframeFrench.set(undefined);

    this.is404.set(false);
  }

  /** Computed problems */
  protected readonly dataProblems = computed(() => {
    return { base: (this.selectedBase() ?? []).length, proto: (this.selectedProto() ?? []).length, live: (this.selectedLive() ?? []).length };
  });
  protected readonly htmlProblems = computed(() => {
    return this.htmlRows().filter((r) => r.en !== r.fr).length;
  });
  protected readonly hiddenProblems = computed(() => {
    return this.hiddenRows().filter((r) => r.status !== 'ok').length;
  });
  protected readonly numberProblems = computed(() => {
    return this.numberRows().filter((r) => !r.match).length;
  });
  protected readonly aiProblems = computed(() => {
    const page = this.compareService.selectedPage();
    return { status: this.reviewLanguagesService.getAiJobStatus(page), result: this.reviewLanguagesService.getAiResponse(page).length };
  });
  protected readonly totalProblems = computed(() => this.dataProblems().live + this.htmlProblems() + this.numberProblems() + this.aiProblems().result);

  constructor() {
    effect((onCleanup) => {
      const page = this.compareService.selectedPage();
      const version = this.compareService.selectedSource();
      untracked(() => {
        const bothPaths = this.projectState.getBothPaths(page);
        this.resetSignals();
        if (!bothPaths) return;

        const node = this.projectState.findNodeByPath(this.projectState.getProject().projectData, bothPaths.en, 'en');
        if (node) {
          this.selectedNode.set(node);
          this.selectedBase.set(this.findLanguageMismatches(node.data, 'baseline'));
          this.selectedProto.set(this.findLanguageMismatches(node.data, 'prototype'));
          this.selectedLive.set(this.findLanguageMismatches(node.data, 'live'));
        }

        const { owner, repo } = this.projectState.getProject().github;
        const urlEN = this.fetchService.generateUrl(bothPaths.en, version, owner, repo);
        const urlFR = this.fetchService.generateUrl(bothPaths.fr, version, owner, repo);
        let stale = false;
        onCleanup(() => (stale = true));
        this.setHTML(urlEN, urlFR, () => stale);
      });
    });
  }

  /** Fxn for data comparison: finds any mismatched baseline, prototype, or live data */
  findLanguageMismatches(data: TreeNodeData, version: DataVersion): DataMismatch[] {
    // Date only (so time differences don't trigger diff)
    const day = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }) : '');
    // Sort ; separated lists to reduce diff's
    const list = (s?: string) =>
      (s ?? '')
        .split(';')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join('; ');

    const en = data[version]?.en;
    const fr = data[version]?.fr;
    if (!en || !fr) return [];

    const out: DataMismatch[] = [];
    const add = (label: string, a: unknown, b: unknown) => {
      if (a !== b) out.push({ label, en: String(a ?? ''), fr: String(b ?? '') });
    };

    // Status
    add('is404', en.is404, fr.is404);
    add('iaOrphan', en.isOrphan, fr.isOrphan);
    add('noindex', en.noindex, fr.noindex);
    add('isArchived', en.isArchived, fr.isArchived);
    add('linksToPortal', en.linksToPortal, fr.linksToPortal);
    add('linksToSignIn', en.linksToSignIn, fr.linksToSignIn);
    add('hasChatbot', en.hasChatbot, fr.hasChatbot);

    // Owner & dates
    if (list(en.owner) !== list(fr.owner)) out.push({ label: 'owner', en: en.owner ?? '', fr: fr.owner ?? '' });
    if (list(en.email) !== list(fr.email)) out.push({ label: 'email', en: en.email ?? '', fr: fr.email ?? '' });
    add('lastPublished', day(en.lastPublished), day(fr.lastPublished));
    add('lastModified', day(en.lastModified), day(fr.lastModified));

    // Page data
    add('linkCount', en.linkCount, fr.linkCount);
    add('template', en.template, fr.template);

    // Parent
    const expectedFrParent = en.parentPath ? (this.projectState.getBothPaths(en.parentPath)?.fr ?? '') : '';
    if (expectedFrParent !== (fr.parentPath ?? '')) {
      out.push({ label: 'parentPath', en: en.parentPath ?? '', fr: fr.parentPath ?? '' });
    }

    marker('inventory.header.parentPath');

    return out;
  }

  /** Fxn for all other comparisons: HTML element counts, numbers comparison, AI html, and iFrame html */
  async setHTML(urlEN: string, urlFR: string, isStale: () => boolean) {
    try {
      const htmlEN = await this.fetchService.fetchContent(urlEN, 'both');
      const htmlFR = await this.fetchService.fetchContent(urlFR, 'both');

      this.htmlNormalizationService.updateRelativeURLs(htmlEN, 'https://www.canada.ca');
      this.htmlNormalizationService.updateRelativeURLs(htmlFR, 'https://www.canada.ca');

      const htmlComparison = compareHTML(htmlEN, htmlFR);
      const hiddenComparison = compareHidden(htmlEN, htmlFR);
      const numberComparison = alignNumbers(extractNumbers(htmlEN, 'en'), extractNumbers(htmlFR, 'fr'));

      const srcEN = this.toSrcdoc(htmlEN);
      const srcFR = this.toSrcdoc(htmlFR);

      if (isStale()) return;
      this.htmlRows.set(htmlComparison);
      this.hiddenRows.set(hiddenComparison);
      this.numberRows.set(numberComparison);
      this.aiEnglish.set(this.toPromptHtml(htmlEN));
      this.aiFrench.set(this.toPromptHtml(htmlFR));
      this.iframeEnglish.set(srcEN);
      this.iframeFrench.set(srcFR);
    } catch (error) {
      console.error('Error fetching content', error);
      this.is404.set(true);
    }
  }

  /** Converts doc to SafeHtml for iFrame comparison */
  private toSrcdoc(doc: Document): SafeHtml {
    const style = doc.createElement('style');
    style.textContent = 'a, button { pointer-events: none !important; }';
    doc.head.appendChild(style);
    return this.sanitizer.bypassSecurityTrustHtml('<!DOCTYPE html>' + doc.documentElement.outerHTML);
  }

  /** Converts doc to string for AI prompt */
  private toPromptHtml(doc: Document): string {
    const main = (doc.querySelector('main') ?? doc.body).cloneNode(true) as Element;
    main.querySelectorAll('script,style,noscript,svg,iframe,img').forEach((n) => n.remove());
    main.querySelectorAll('*').forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        if (!(el.tagName === 'A' && attr.name === 'href')) el.removeAttribute(attr.name);
      }
    });
    return main.innerHTML.replace(/[ \t\r\n]+/g, ' ').trim();
  }

  /** Template references */
  private readonly data = viewChild.required<TemplateRef<unknown>>('data');
  private readonly html = viewChild.required<TemplateRef<unknown>>('html');
  private readonly hidden = viewChild.required<TemplateRef<unknown>>('hidden');
  private readonly numbers = viewChild.required<TemplateRef<unknown>>('numbers');
  private readonly ai = viewChild.required<TemplateRef<unknown>>('ai');

  /** Gets a summary of all problems */
  protected readonly summaryRows = computed<SummaryRow[]>(() => {
    const dataCounts = this.dataProblems();
    const htmlCount = this.htmlProblems();
    const hiddenCount = this.hiddenProblems();
    const numberCount = this.numberProblems();
    const ai = this.aiProblems();

    //state options: ok, problem, loading (data refresh or AI running), error (AI only), notRun (AI only)
    const countState = (n: number): SummaryState => (n === 0 ? 'ok' : 'problem');

    marker('languages.summary.ok');
    marker('languages.summary.problem');
    marker('languages.summary.loading');
    marker('languages.summary.error');
    marker('languages.summary.notRun');

    const aiState: SummaryState = ai.status === 'pending' ? 'loading' : ai.status === 'error' ? 'error' : ai.status === 'done' ? countState(ai.result) : 'notRun';
    const dataState: SummaryState = this.projectState.isRefreshing() ? 'loading' : countState(dataCounts.live);
    return [
      {
        tab: '0',
        template: this.data(),
        icon: 'checklist',
        label: 'languages.dataCompare.tab',
        state: dataState,
        count: dataCounts.live,
        detail: `${dataCounts.base} / ${dataCounts.proto} / ${dataCounts.live}`,
      },
      { tab: '1', template: this.html(), icon: 'code', label: 'languages.htmlStructure.tab', state: countState(htmlCount), count: htmlCount },
      { tab: '2', template: this.hidden(), icon: 'visibility_off', label: 'languages.hidden.tab', state: countState(hiddenCount), count: hiddenCount },
      { tab: '3', template: this.numbers(), icon: 'numbers', label: 'languages.numbers.tab', state: countState(numberCount), count: numberCount },
      { tab: '4', template: this.ai(), icon: 'auto_awesome', label: 'languages.aiSummary.tab', state: aiState, count: ai.result },
    ];
  });

  /** Changes tabs and scrolls to tab */
  openTab(tab: string) {
    this.activeTab.set(tab);
    afterNextRender(
      () => {
        const el = document.getElementById('compare-tools');
        if (!el) return;
        window.scrollTo({ left: 0, top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
      },
      { injector: this.injector },
    );
  }
}
