import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SplitButtonModule } from 'primeng/splitbutton';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';

import { FetchService } from '../../../services/fetch.service';
import { htmlProcessingResult } from '../../../services/html-normalization.service';
import { CompareRenderedService } from './compare-rendered.service';

export enum WebViewType {
  Original = 'original',
  Modified = 'modified',
  Diff = 'diff',
}

export interface ViewOption<T = string> {
  label: string;
  value: T;
  icon: string;
}

/** This component expects 2 inputs for the before & after content for the diff
 * It expects inputs in htmlProcessingResult format which includes information to populate the legend
 * Format your url or string content through the normalizeHTML function in html-normalization.service convert it to an htmlProcessingResult */
@Component({
  selector: 'aida-compare-rendered',
  imports: [CommonModule, FormsModule, TranslatePipe, ButtonModule, MessageModule, RadioButtonModule, SplitButtonModule, ToastModule, TooltipModule],
  templateUrl: './compare-rendered.component.html',
  styleUrl: './compare-rendered.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareRenderedComponent implements AfterViewInit, OnDestroy {
  private readonly translate = inject(TranslateService);
  private readonly messageService = inject(MessageService);
  private readonly compareRenderedService = inject(CompareRenderedService);
  private readonly fetchService = inject(FetchService);

  // Inputs
  public readonly beforeContent = input<htmlProcessingResult | undefined>();
  public readonly afterContent = input<htmlProcessingResult | undefined>();
  public readonly canUndo = input<boolean>(false);

  // Adjust inputs if one is undefined so we can render page with no changes
  private readonly resolvedBefore = computed(() => this.beforeContent() ?? this.afterContent());
  private readonly resolvedAfter = computed(() => this.afterContent() ?? this.beforeContent());

  // Outputs
  public readonly contentChanged = output<{
    beforeContent: htmlProcessingResult;
    afterContent: htmlProcessingResult;
  }>();
  public readonly hasChanges = output<boolean>();
  public readonly undoChanges = output<void>();

  // Get DOM elements from template
  public readonly liveContainer = viewChild<ElementRef>('liveContainer');

  // Signals
  private readonly shadowDOM = signal<ShadowRoot | null>(null);
  protected readonly enableOriginalEdits = signal<boolean>(false);

  // Prevent duplicate effects
  private renderToken = 0;

  //Web page view options
  protected readonly WebViewType = WebViewType;
  protected readonly webSelectedView = signal<WebViewType>(WebViewType.Diff);

  protected get webViewOptions(): ViewOption<WebViewType>[] {
    const editedText = ` (${this.translate.instant('common.edited').toLowerCase()})`;

    const beforeVersion = this.beforeContent()?.version;
    const beforeBase = beforeVersion ? this.translate.instant('common.source.' + beforeVersion) : this.translate.instant('common.before');
    const beforeLabel = beforeBase + (this.beforeContent()?.edited ? editedText : '');

    const afterVersion = this.afterContent()?.version;
    const afterBase = afterVersion ? this.translate.instant('common.source.' + afterVersion) : this.translate.instant('common.after');
    const afterLabel = afterBase + (this.afterContent()?.edited ? editedText : '');

    return [
      {
        label: beforeLabel,
        value: WebViewType.Original,
        icon: 'pi pi-file',
      },
      {
        label: this.translate.instant('common.comparison'),
        value: WebViewType.Diff,
        icon: 'pi pi-sort-alt',
      },
      {
        label: afterLabel,
        value: WebViewType.Modified,
        icon: 'pi pi-file-edit',
      },
    ];
  }

  //Change web page view
  protected onWebViewChange(viewType: WebViewType) {
    this.webSelectedView.set(viewType);
  }

  // Effects
  constructor() {
    // Update Diff
    effect((onCleanup) => {
      const viewType = this.webSelectedView();
      const shadowRoot = this.shadowDOM();
      const beforeContent = this.resolvedBefore();
      const afterContent = this.resolvedAfter();
      if (beforeContent && afterContent && shadowRoot) {
        this.rebuildShadowContent(shadowRoot, viewType, beforeContent, afterContent);
        onCleanup(() => {
          this.shadowClickHandler?.();
          this.shadowSelectionHandler?.();
          this.shadowClickHandler = null;
          this.shadowSelectionHandler = null;
        });
      }
      this.enableOriginalEdits.set(false);
      this.editing.set(false);
    });
    // Sync currentIndex whenever a multi-element selection lands
    effect(() => {
      const selection = this.compareRenderedService.lastSelection();
      if (selection.count > 1 && selection.startId != null && selection.endId != null) {
        this.currentIndex.set(selection.endId - 1);
      }
    });
  }

  //Runs when view is initialized
  ngAfterViewInit(): void {
    const container = this.liveContainer();
    if (!container) return;
    const shadowRoot = this.compareRenderedService.initializeShadowDOM(container.nativeElement);
    if (shadowRoot) {
      this.shadowDOM.set(shadowRoot);
      console.log('Shadow DOM is initialized.');
    }
  }

  //Runs when component is destroyed
  ngOnDestroy(): void {
    if (this.shadowDOM()) {
      this.compareRenderedService.clearShadowDOM(this.shadowDOM()!);
      this.shadowDOM.set(null);
    }
  }

  // Rebuild ShadowDOM
  private async rebuildShadowContent(shadowRoot: ShadowRoot, viewType: WebViewType, beforeContent: htmlProcessingResult, afterContent: htmlProcessingResult): Promise<void> {
    const token = ++this.renderToken;

    await this.compareRenderedService.generateShadowDOMContent(shadowRoot, viewType, beforeContent.html, afterContent.html);

    if (token !== this.renderToken) return; // cancel if a newer call was started while awaiting

    this.shadowClickHandler = this.compareRenderedService.handleDocumentClick(shadowRoot, (index: number) => {
      this.currentIndex.set(index);
    });

    this.shadowSelectionHandler = this.compareRenderedService.handleSelection(shadowRoot);

    this.elements.set(this.compareRenderedService.getDataIdElements(shadowRoot));
    if (this.elements().length > 0) {
      this.focusOnIndex(this.currentIndex());
      this.hasChanges.emit(true);
    } else if (this.webSelectedView() === WebViewType.Diff) {
      this.hasChanges.emit(false);
    }
    console.log(this.elements().length);
  }

  /* START OF TOOLBAR FUNCTIONS */

  // 1. Shadow DOM navigation
  private shadowClickHandler: (() => void) | null = null;
  private shadowSelectionHandler: (() => void) | null = null;

  private readonly currentIndex = signal<number>(0);
  private readonly elements = signal<HTMLElement[]>([]);

  protected next() {
    if (this.elements().length === 0) return;
    this.currentIndex.set((this.currentIndex() + 1) % this.elements().length);
    this.focusOnIndex(this.currentIndex());
    this.compareRenderedService.resetLastSelection();
  }

  protected prev() {
    if (this.elements().length === 0) return;
    this.currentIndex.set((this.currentIndex() - 1 + this.elements().length) % this.elements().length);
    this.focusOnIndex(this.currentIndex());
    this.compareRenderedService.resetLastSelection();
  }

  private focusOnIndex(index: number) {
    const shadowRoot = this.shadowDOM();
    if (!shadowRoot) return;
    const el = this.elements()[index];
    this.compareRenderedService.highlightElement(el);
    this.compareRenderedService.openParentDetails(el);
    this.compareRenderedService.closeAllDetailsExcept(shadowRoot, el);
    this.compareRenderedService.scrollToElement(el);
  }

  protected readonly displayCounter = computed(() => {
    const selection = this.compareRenderedService.lastSelection();
    if (!this.elements()?.length) {
      return this.translate.instant('compare.rendered.counter', { range: '0', total: '0' });
    }

    const total = this.elements().length;

    // nothing highlighted
    if (selection.count === 0) {
      return this.translate.instant('compare.rendered.counter', { range: '–', total });
    }

    // multiple highlighted
    if (selection.count > 1) {
      if (selection.startId != null && selection.endId != null) {
        const range = `${selection.startId}–${selection.endId}`;
        return this.translate.instant('compare.rendered.counter', { range, total });
      }
      return this.translate.instant('compare.rendered.counter', { range: '–', total });
    }

    // single highlighted
    const range = this.currentIndex() + 1;
    return this.translate.instant('compare.rendered.counter', { range, total });
  });

  protected get displayNumHighlighted(): string {
    const count = this.compareRenderedService.lastSelection().count;
    if (count < 1) return '';
    if (this.compareRenderedService.lastSelection().count < 1) return '';
    return this.translate.instant('compare.rendered.itemsSelected', { count });
  }

  // 2. Accept
  protected readonly acceptItems = computed(() => [
    {
      label: 'Accept all',
      icon: 'pi pi-check-circle',
      command: () => {
        this.processAllChanges('accept');
      },
      disabled: !(this.elements().length > 0),
    },
    {
      separator: true,
    },
    {
      label: this.translate.instant('compare.button.undo'),
      icon: 'pi pi-refresh',
      command: () => {
        this.undoChanges.emit();
      },
      disabled: !this.canUndo(),
    },
  ]);

  // 3. Reject

  protected readonly rejectItems = computed(() => [
    {
      label: 'Reject all',
      icon: 'pi pi-times-circle',
      command: () => {
        this.processAllChanges('reject');
      },
      disabled: !(this.elements().length > 0),
    },
    {
      separator: true,
    },
    {
      label: this.translate.instant('compare.button.undo'),
      icon: 'pi pi-refresh',
      command: () => {
        this.undoChanges.emit();
      },
      disabled: !this.canUndo(),
    },
  ]);

  // 4. Legend
  protected get legendItems() {
    const view = this.webSelectedView();
    const items: { text: string; colour: string; style: string; lineStyle?: string }[] = [];
    const beforeFlags = this.resolvedBefore()?.found;
    const afterFlags = this.resolvedAfter()?.found;

    if (view === WebViewType.Diff) {
      items.push(
        { text: this.translate.instant('compare.rendered.legend.previousVersion'), colour: '#F3A59D', style: 'highlight' },
        { text: this.translate.instant('compare.rendered.legend.updatedVersion'), colour: '#83d5a8', style: 'highlight' },
        { text: this.translate.instant('compare.rendered.legend.updatedLink'), colour: '#FFEE8C', style: 'highlight' },
      );
    } else if (view === WebViewType.Original) {
      items.push({ text: this.translate.instant('compare.rendered.legend.previousVersion'), colour: '#F3A59D', style: 'line' });
    } else if (view === WebViewType.Modified) {
      items.push({ text: this.translate.instant('compare.rendered.legend.updatedVersion'), colour: '#83d5a8', style: 'line' });
    }
    for (const def of this.flagLegendDefs) {
      const show =
        view === WebViewType.Diff
          ? beforeFlags?.[def.flag] || afterFlags?.[def.flag] // eslint-disable-line @typescript-eslint/prefer-nullish-coalescing
          : view === WebViewType.Original
            ? beforeFlags?.[def.flag]
            : view === WebViewType.Modified
              ? afterFlags?.[def.flag]
              : false;

      if (show) {
        items.push({ text: def.text, colour: def.colour, style: def.style, lineStyle: def.lineStyle });
      }
    }
    return items;
  }

  private get flagLegendDefs(): { flag: 'hidden' | 'modal' | 'dynamic'; text: string; colour: string; style: string; lineStyle?: string }[] {
    return [
      { flag: 'hidden', text: this.translate.instant('compare.rendered.legend.hiddenContent'), colour: '#6F9FFF', style: 'line' },
      { flag: 'modal', text: this.translate.instant('compare.rendered.legend.modalContent'), colour: '#666666', style: 'line', lineStyle: 'dashed' },
      { flag: 'dynamic', text: this.translate.instant('compare.rendered.legend.dynamicContent'), colour: '#fbc02f', style: 'line', lineStyle: 'dashed' },
    ];
  }

  // 5. Before/After - Edit
  protected readonly editing = signal<boolean>(false);
  protected async toggleEditing(view: WebViewType): Promise<void> {
    this.editing.set(!this.editing());

    const shadowRoot = this.shadowDOM();
    const editable = shadowRoot?.getElementById('editable');
    if (!editable) {
      console.warn('Editable area not found.');
      this.editing.set(false);
      return;
    }
    if (this.editing()) {
      //edit
      editable.setAttribute('contenteditable', 'true');
      editable.focus();
    } else {
      //save
      editable.setAttribute('contenteditable', 'false');

      const updatedContent = this.compareRenderedService.undoInitShadowPlugins(editable).innerHTML;

      const beforeContent = this.resolvedBefore();
      const afterContent = this.resolvedAfter();

      if (!beforeContent || !afterContent) return;

      this.contentChanged.emit({
        beforeContent: view === WebViewType.Original ? { ...beforeContent, html: updatedContent, edited: true } : beforeContent,
        afterContent: view === WebViewType.Modified ? { ...afterContent, html: updatedContent, edited: true } : afterContent,
      });
    }
  }

  // 6. Before/After - Copy
  protected readonly copying = signal<boolean>(false);
  protected async toggleCopying(view: WebViewType): Promise<void> {
    this.copying.set(true);

    const htmlToCopy = view === WebViewType.Original ? (this.resolvedBefore()?.html ?? '') : view === WebViewType.Modified ? (this.resolvedAfter()?.html ?? '') : '';
    navigator.clipboard
      .writeText(htmlToCopy)
      .then(() => {
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('common.copiedToClipboard'),
          detail: htmlToCopy.slice(0, 100),
          life: 3000,
        });
        setTimeout(() => this.copying.set(false), 1000);
      })
      .catch((err) => {
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('common.copyError'),
          detail: this.translate.instant('compare.rendered.noHtmlToCopy'),
          life: 5000,
        });
        this.copying.set(false);
        console.error('Clipboard copy failed:', err);
      });
  }

  // 7. Before/After - Open URL
  protected getUrl(): string | null {
    const url = this.webSelectedView() === WebViewType.Original ? this.beforeContent()?.url : this.webSelectedView() === WebViewType.Modified ? this.afterContent()?.url : null;

    return this.fetchService.isValidUrl(url) ? url : null;
  }

  // Process Accept/Reject
  protected processDiffChange(mode: 'accept' | 'reject'): void {
    //Get diff container
    const shadowRoot = this.shadowDOM();
    if (!shadowRoot) {
      console.warn('Shadow root not found.');
      return;
    }

    const diffContainer = shadowRoot.querySelector('.diff-content') as HTMLElement;
    if (!diffContainer) {
      console.warn('Diff container not found');
      return;
    }

    //HANDLE HIGHLIGHTED DIFF//
    //Get highlighted <ins> or <del> or <span>
    const highlightedEls = diffContainer.querySelectorAll<HTMLElement>('ins.highlight, del.highlight, span.diff-group.highlight, span.updated-link.highlight');
    if (!highlightedEls.length) {
      console.warn('highlighted elements not found');
      return;
    }

    const keepTag = mode === 'accept' ? 'ins' : 'del';
    const removeTag = mode === 'accept' ? 'del' : 'ins';

    // Moves all child nodes before the element
    const unwrap = (el: HTMLElement) => {
      while (el.firstChild) {
        el.parentNode?.insertBefore(el.firstChild, el);
      }
      el.remove();
    };

    highlightedEls.forEach((highlighted) => {
      //Keep highlighted tag (accept mode keep tag = ins)
      if (highlighted.tagName.toLowerCase() === keepTag) {
        unwrap(highlighted);
      }

      //Remove highlighted tag (accept mode remove tag = del)
      else if (highlighted.tagName.toLowerCase() === removeTag) {
        highlighted.remove();
      }

      //Handle highlighted .diff-group or .updated-link (accept mode keep tag = ins)
      else if (highlighted.tagName.toLowerCase() === 'span') {
        const el = highlighted.querySelector(keepTag);
        const link = highlighted.querySelector('a');
        //console.log(`Highlighted group: `,el);
        //console.log(`Highlighted link: `,link);
        //diff-group
        if (el) {
          unwrap(el);
          highlighted.remove();
        }
        //updated-link
        else if (link) {
          if (mode === 'accept') {
            highlighted.replaceWith(link);
          } else {
            const oldHref = highlighted.getAttribute('title')?.replace(/^Old URL:\s*/, '') || '';
            link.setAttribute('href', oldHref);
            highlighted.replaceWith(link);
          }
        }
        //neither found
        else {
          console.log(`No <${keepTag}> or updated-link found. Leaving content as-is.`);
          return;
        }
      }
    });

    //HANDLE ALL OTHER CHANGES (OPPOSITE OF WHAT IS DONE WITH THE HIGHLIGHTED CHANGE)//
    //Keep and unwrap remaining elements of opposite tag (including inside diff-group)
    diffContainer.querySelectorAll<HTMLElement>(`${removeTag}, span.diff-group`).forEach(unwrap);

    // Remove remaining elements of the keep tag
    diffContainer.querySelectorAll(keepTag).forEach((el) => {
      el.remove();
    });

    // Remove new/old link highlights
    diffContainer.querySelectorAll('span.updated-link').forEach((span) => {
      const link = span.querySelector('a');
      if (!link) return;
      if (mode === 'reject') {
        span.replaceWith(link);
      } else {
        const oldHref = span.getAttribute('title')?.replace(/^Old URL:\s*/, '') || '';
        link.setAttribute('href', oldHref);
        span.replaceWith(link);
      }
    });

    this.compareRenderedService.resetLastSelection();

    //Merge with modified HTML
    const updatedContent = this.compareRenderedService.undoInitShadowPlugins(diffContainer).innerHTML;

    const beforeContent = this.resolvedBefore();
    const afterContent = this.resolvedAfter();

    if (!beforeContent || !afterContent) return;

    this.contentChanged.emit({
      beforeContent: mode === 'accept' ? { ...beforeContent, html: updatedContent, edited: true } : beforeContent,
      afterContent: mode === 'reject' ? { ...afterContent, html: updatedContent, edited: true } : afterContent,
    });
  }

  // Process accept/reject all
  processAllChanges(mode: 'accept' | 'reject') {
    console.log(mode);
    this.compareRenderedService.resetLastSelection();

    const beforeContent = this.resolvedBefore();
    const afterContent = this.resolvedAfter();

    if (!beforeContent || !afterContent) return;

    this.contentChanged.emit({
      beforeContent: mode === 'accept' ? { ...beforeContent, html: afterContent.html, found: afterContent.found, edited: true } : beforeContent,
      afterContent: mode === 'reject' ? { ...afterContent, html: beforeContent.html, found: beforeContent.found, edited: true } : afterContent,
    });
  }
}
