import { CommonModule, LocationStrategy } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, EventEmitter, inject, input, OnDestroy, Output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ButtonModule } from 'primeng/button';
import { RadioButtonModule } from 'primeng/radiobutton';
import { SplitButtonModule } from 'primeng/splitbutton';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TooltipModule } from 'primeng/tooltip';

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
  imports: [CommonModule, FormsModule, TranslatePipe, ButtonModule, RadioButtonModule, SplitButtonModule, ToggleButtonModule, TooltipModule],
  templateUrl: './compare-rendered.component.html',
  styleUrl: './compare-rendered.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompareRenderedComponent implements AfterViewInit, OnDestroy {
  private readonly compareRenderedService = inject(CompareRenderedService);
  private readonly translate = inject(TranslateService);

  // Inputs
  public readonly beforeContent = input<htmlProcessingResult | undefined>();
  public readonly afterContent = input<htmlProcessingResult | undefined>();

  // Adjust inputs if one is undefined so we can render page with no changes
  private readonly resolvedBefore = computed(() => this.beforeContent() ?? this.afterContent());
  private readonly resolvedAfter = computed(() => this.afterContent() ?? this.beforeContent());

  // Outputs
  @Output() contentChanged = new EventEmitter<{
    beforeContent: htmlProcessingResult;
    afterContent: htmlProcessingResult;
  }>();

  // Get DOM elements from template
  @ViewChild('liveContainer', { static: false }) liveContainer!: ElementRef;

  // Signals
  private readonly shadowDOM = signal<ShadowRoot | null>(null);

  // Effects
  constructor() {
    effect(async () => {
      const viewType = this.webSelectedView();
      const shadowRoot = this.shadowDOM();
      const beforeContent = this.resolvedBefore();
      const afterContent = this.resolvedAfter();

      if (beforeContent && afterContent && shadowRoot) {
        await this.compareRenderedService.generateShadowDOMContent(shadowRoot, viewType, beforeContent.html, afterContent.html);
        //Click listener for ShadowDom
        if (this.shadowClickHandler) {
          this.shadowClickHandler();
          console.log('Reset shadow click handler');
        }
        this.shadowClickHandler = this.compareRenderedService.handleDocumentClick(shadowRoot, (index: number) => {
          this.currentIndex = index;
        });
        //Selection listener for ShadowDom
        if (this.shadowSelectionHandler) {
          this.shadowSelectionHandler();
          console.log('Reset shadow selection handler');
        }
        this.shadowSelectionHandler = this.compareRenderedService.handleSelection(shadowRoot);

        //Get DOM element with a data-id
        this.elements = this.compareRenderedService.getDataIdElements(shadowRoot);
        if (this.elements.length > 0) {
          this.focusOnIndex(this.currentIndex); //set initial focus to 1st element
          //this.isDisabled = true;
          //this.aiDisabled = 'Accept or reject changes first';
        } else {
          //this.isDisabled = false;
          //this.aiDisabled = '';
        }
      }
    });
  }

  //Runs when view is initialized
  ngAfterViewInit(): void {
    const shadowRoot = this.compareRenderedService.initializeShadowDOM(this.liveContainer.nativeElement);
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
    if (this.shadowClickHandler) {
      this.shadowClickHandler();
    }
    if (this.shadowSelectionHandler) {
      this.shadowSelectionHandler();
    }
  }

  //Web page view options
  protected readonly WebViewType = WebViewType;
  protected readonly webSelectedView = signal<WebViewType>(WebViewType.Diff);

  protected get webViewOptions(): ViewOption<WebViewType>[] {
    const beforeLabel = this.beforeContent()?.version ? this.translate.instant('common.source.' + this.beforeContent()?.version) : this.translate.instant('common.before');
    const afterLabel = this.afterContent()?.version ? this.translate.instant('common.source.' + this.afterContent()?.version) : this.translate.instant('common.after');
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
  protected async onWebViewChange(viewType: WebViewType) {
    this.webSelectedView.set(viewType);
  }

  /* START OF TOOLBAR FUNCTIONS */

  // 1. Shadow DOM navigation
  private shadowClickHandler: (() => void) | null = null;
  private shadowSelectionHandler: (() => void) | null = null;

  private currentIndex = 0;
  private elements: HTMLElement[] = [];

  protected next() {
    if (this.elements.length === 0) return;
    this.currentIndex = (this.currentIndex + 1) % this.elements.length;
    this.focusOnIndex(this.currentIndex);
    this.compareRenderedService.lastSelection = {
      count: 1,
      startId: null,
      endId: null,
    }; //reset selection
  }

  protected prev() {
    if (this.elements.length === 0) return;
    this.currentIndex = (this.currentIndex - 1 + this.elements.length) % this.elements.length;
    this.focusOnIndex(this.currentIndex);
    this.compareRenderedService.lastSelection = {
      count: 1,
      startId: null,
      endId: null,
    }; //reset selection
  }

  private focusOnIndex(index: number) {
    const shadowRoot = this.shadowDOM();
    if (!shadowRoot) return;
    const el = this.elements[index];
    this.compareRenderedService.highlightElement(el);
    this.compareRenderedService.openParentDetails(el);
    this.compareRenderedService.closeAllDetailsExcept(shadowRoot, el);
    this.compareRenderedService.scrollToElement(el);
  }

  protected get displayCounter(): string {
    if (!this.elements?.length) {
      return this.translate.instant('compare.rendered.counter', { range: '0', total: '0' });
    }

    const total = this.elements.length;

    // nothing highlighted
    if (this.compareRenderedService.lastSelection.count === 0) {
      return this.translate.instant('compare.rendered.counter', { range: '–', total });
    }

    // multiple highlighted
    if (this.compareRenderedService.lastSelection.count > 1) {
      if (this.compareRenderedService.lastSelection.startId != null && this.compareRenderedService.lastSelection.endId != null) {
        this.currentIndex = this.compareRenderedService.lastSelection.endId - 1;
        const range = `${this.compareRenderedService.lastSelection.startId}–${this.compareRenderedService.lastSelection.endId}`;
        return this.translate.instant('compare.rendered.counter', { range, total });
      }
      return this.translate.instant('compare.rendered.counter', { range: '–', total });
    }

    // single highlighted
    const range = this.currentIndex + 1;
    return this.translate.instant('compare.rendered.counter', { range, total });
  }

  protected get displayNumHighlighted(): string {
    const count = this.compareRenderedService.lastSelection.count;
    if (count < 1) return '';
    if (this.compareRenderedService.lastSelection.count < 1) return '';
    return this.translate.instant('compare.rendered.itemsSelected', { count });
  }

  // 2. Accept
  protected toolbarAccept(): void {
    this.processDiffChange('accept');
  }

  protected get acceptItems() {
    return [
      {
        label: 'Accept all',
        icon: 'pi pi-check-circle',
        command: () => {
          //this.toolbarAcceptAll();
        },
        disabled: true,
      },
      {
        separator: true,
      },
      {
        label: this.translate.instant('compare.button.undo'),
        icon: 'pi pi-refresh',
        command: () => {
          //this.uploadState.undoLastChange();
        },
        disabled: true,
      },
    ];
  }

  // 3. Reject
  protected toolbarReject(): void {
    this.processDiffChange('reject');
  }

  protected get rejectItems() {
    return [
      {
        label: 'Reject all',
        icon: 'pi pi-times-circle',
        command: () => {
          //this.toolbarRejectAll();
        },
        disabled: true,
      },
      {
        separator: true,
      },
      {
        label: this.translate.instant('compare.button.undo'),
        icon: 'pi pi-refresh',
        command: () => {
          //this.uploadState.undoLastChange();
        },
        disabled: true,
      },
    ];
  }

  // 4. Legend
  private readonly baseLegendItems = signal<{ text: string; colour: string; style: string; lineStyle?: string }[]>([
    { text: 'compare.rendered.legend.previousVersion', colour: '#F3A59D', style: 'highlight' },
    { text: 'compare.rendered.legend.updatedVersion', colour: '#83d5a8', style: 'highlight' },
    { text: 'compare.rendered.legend.updatedLink', colour: '#FFEE8C', style: 'highlight' },
    { text: 'compare.rendered.legend.hiddenContent', colour: '#6F9FFF', style: 'line' },
    { text: 'compare.rendered.legend.modalContent', colour: '#666666', style: 'line', lineStyle: 'dashed' },
    { text: 'compare.rendered.legend.dynamicContent', colour: '#fbc02f', style: 'line', lineStyle: 'dashed' },
  ]);

  private markForTranslation() {
    marker('compare.rendered.legend.previousVersion');
    marker('compare.rendered.legend.updatedVersion');
    marker('compare.rendered.legend.updatedLink');
    marker('compare.rendered.legend.hiddenContent');
    marker('compare.rendered.legend.modalContent');
    marker('compare.rendered.legend.dynamicContent');
  }

  protected get legendItems() {
    const view = this.webSelectedView();
    const items = this.baseLegendItems();
    const beforeFlags = this.beforeContent()?.found;
    const afterFlags = this.afterContent()?.found;
    return items
      .map((item) => {
        if (item.text === 'compare.rendered.legend.previousVersion') {
          if (view === WebViewType.Modified) {
            return null; // hide in Modified view
          }
          if (view === WebViewType.Original) {
            return { ...item, style: 'line' }; // change style in Original view
          }
          return item;
        }

        if (item.text === 'compare.rendered.legend.updatedVersion') {
          if (view === WebViewType.Original) {
            return null; // hide in Original view
          }
          if (view === WebViewType.Modified) {
            return { ...item, style: 'line' }; // change style in Modified view
          }
          return item;
        }

        if (item.text === 'compare.rendered.legend.updatedLink' && (view === WebViewType.Original || view === WebViewType.Modified)) {
          return null; //hide in both original and modified view
        }

        if (item.text === 'compare.rendered.legend.hiddenContent' && !beforeFlags?.hidden && !afterFlags?.hidden) {
          return null; //hide if hidden content not found in either original or modified
        }

        if (item.text === 'compare.rendered.legend.modalContent' && !beforeFlags?.modal && !afterFlags?.modal) {
          return null; //hide if modal content not found in either original or modified
        }

        if (item.text === 'compare.rendered.legend.dynamicContent' && !beforeFlags?.dynamic && !afterFlags?.dynamic) {
          return null; //hide if dynamic content not found in either original or modified
        }

        return item;
      })
      .filter(Boolean) as typeof items;
  }

  // 5. Before/After - Edit
  protected toggleEdit = false;
  protected async toolbarToggleEdit(view: WebViewType): Promise<void> {
    const shadowRoot = this.shadowDOM();
    const editable = shadowRoot?.getElementById('editable');
    if (!editable) {
      console.warn('Editable area not found.');
      this.toggleEdit = false;
      return;
    }
    if (this.toggleEdit) {
      //edit
      editable.setAttribute('contenteditable', 'true');
      editable.focus();
    } else {
      /*save
            this.uploadState.savePreviousUploadData(); //save previous data for undo button
            editable.setAttribute('contenteditable', 'false');
            const editedHtml = await this.urlDataService.formatHtml(
              editable.innerHTML,
              'edit',
            );
            if (view === WebViewType.Original) {
              this.uploadState.mergeOriginalData({
                originalUrl: 'User edited',
                originalHtml: editedHtml,
              });
            } else if (view === WebViewType.Modified) {
              this.uploadState.mergeModifiedData({
                modifiedUrl: 'User edited',
                modifiedHtml: editedHtml,
              });
            }
            this.toggleEdit = false;*/
    }
  }

  // 6. Before/After - Copy
  protected toggleCopy = false;
  protected toolbarToggleCopy(view: WebViewType): void {
    const data = 'test';
    if (!data) return;
    let htmlToCopy = ''; /*
        if (view === WebViewType.Original) {
            htmlToCopy = data.originalHtml ?? '';
        } else if (view === WebViewType.Modified) {
            htmlToCopy = data.modifiedHtml ?? '';
        }*/
    navigator.clipboard
      .writeText(htmlToCopy)
      .then(() => {
        setTimeout(() => (this.toggleCopy = false), 1000);
      })
      .catch((err) => console.error('Clipboard copy failed:', err));
  }

  // 7. Before/After - Open URL
  protected getUrl() {
    if (this.webSelectedView() === WebViewType.Original) {
      return this.beforeContent()?.url;
    } else if (this.webSelectedView() === WebViewType.Modified) {
      return this.afterContent()?.url;
    } else return null;
  }

  /* END OF TOOLBAR FUNCTIONS */

  //this.toggleEdit = false;
  //Disable undo button
  /*
    const undoText = this.translate.instant('page.compare.button.undo');
    [this.acceptItems, this.rejectItems].forEach((arr) => {
        const undoItem = arr.find((item) => item.label === undoText);
        if (undoItem) {
            undoItem.disabled = this.uploadState.isUndoDisabled();
        }
    });
    //Checks if content is shareable
    const canShareOriginal = this.urlDataService.isValidUrl(
        data?.originalUrl,
    );
    const canShareModified = this.urlDataService.isValidUrl(
        data?.modifiedUrl,
    );
    this.canShare = canShareOriginal || canShareModified;
});
 
    //this.baseHref = this.locationStrategy.getBaseHref();
}

 
//Disable AI if there are changes to accept/reject
isDisabled = false;
aiDisabled = '';

acceptItems: MenuItem[] = [];
rejectItems: MenuItem[] = [];

get uploadType(): 'url' | 'paste' | 'word' {
return this.uploadState.getSelectedUploadType(); // returns signal().value
}

get uploadData(): Partial<UploadData> | null {
return this.uploadState.getUploadData(); // returns signal().value
}



*/

  /*
        
        
    
        clearAll(event: Event) {
            console.log('Clicked reset');
            this.confirmationService.confirm({
                target: event.target as EventTarget,
                message: `<p class="mt-0">This will clear all uploaded content and any changes you made.</p>\n\n<p>You will lose your work and return to the upload screen.</p><p class="mb-0">Are you sure you want to reset?</p>`,
                header: 'Confirm reset',
                icon: 'pi pi-exclamation-circle',
                rejectLabel: 'Cancel',
                rejectButtonProps: {
                    label: 'Cancel',
                    icon: 'pi pi-undo',
                    severity: 'secondary',
                    outlined: true,
                },
                acceptButtonProps: {
                    label: 'Reset',
                    icon: 'pi pi-trash',
                    severity: 'danger',
                },
                accept: () => {
                    this.uploadState.resetUploadFlow();
                    this.compareRenderedService.lastSelection = {
                        count: 1,
                        startId: null,
                        endId: null,
                    }; //reset selection
                    this.router.navigate(['page-assistant']);
                    console.log('Reset page comparison');
                },
                reject: () => {
                    console.log('Cancel reset page comparison');
                },
            });
        }
    
        canShare = false;
        baseHref: string | null = null;
        shareLink() {
            console.log('Clicked share');
            const data = this.uploadState.getUploadData();
            if (!data) return;
            const params: Params = {};
            if (this.urlDataService.isValidUrl(data.originalUrl)) {
                params['url'] = data.originalUrl;
            } else if (this.urlDataService.isValidUrl(data.modifiedUrl)) {
                params['url'] = data.modifiedUrl;
            }
            if (
                this.urlDataService.isValidUrl(data.originalUrl) &&
                this.urlDataService.isValidUrl(data.modifiedUrl) &&
                data.originalUrl !== data.modifiedUrl
            ) {
                params['compareUrl'] = data.modifiedUrl;
            }
            const treeLink = this.router.createUrlTree(['page-assistant/share'], {
                queryParams: params,
            });
            const shareLink = `${window.location.origin}${this.baseHref}${this.router.serializeUrl(treeLink).replace(/^\//, '')}`;
    
            navigator.clipboard
                .writeText(shareLink)
                .then(() => {
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Copied share link to clipboard',
                        detail: `${shareLink}`,
                        life: 1000,
                    });
                })
                .catch((err) => console.error('Clipboard copy failed:', err));
        }
    
        
    
        */

  private processDiffChange(mode: 'accept' | 'reject'): void {
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

    this.compareRenderedService.lastSelection = { count: 1, startId: null, endId: null }; //reset selection

    //Merge with modified HTML
    const updatedHtml = diffContainer.innerHTML;

    const beforeContent = this.beforeContent();
    const afterContent = this.afterContent();

    if (!beforeContent || !afterContent) return;

    this.contentChanged.emit({
      beforeContent: mode === 'accept' ? { ...beforeContent, html: updatedHtml, url: 'Change accepted' } : beforeContent,
      afterContent: mode === 'reject' ? { ...afterContent, html: updatedHtml, url: 'Change rejected' } : afterContent,
    });
  }
}
