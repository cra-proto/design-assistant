import { Component, inject, Input, OnChanges, SimpleChanges, ViewChild, ElementRef, computed, signal, effect } from '@angular/core';
import { CommonModule, LocationStrategy } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { FormsModule } from '@angular/forms';

// PrimeNG modules
import { ButtonModule } from 'primeng/button';
import { SplitButtonModule } from 'primeng/splitbutton';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ToolbarModule } from 'primeng/toolbar';
import { TooltipModule } from 'primeng/tooltip';
import { ToggleButtonModule } from 'primeng/togglebutton';

import { MessageModule } from 'primeng/message';
import { MessageService, ConfirmationService, MenuItem } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

// Services
import { CompareRenderedService } from './compare-rendered.service';
import { htmlProcessingResult } from '../../services/html-normalization.service';

export enum WebViewType {
    Original = 'original',
    Modified = 'modified',
    Diff = 'diff'
}

export interface ViewOption<T = string> {
    label: string;
    value: T;
    icon: string;
}

@Component({
    selector: 'aida-compare-rendered',
    imports: [TranslateModule, CommonModule, FormsModule,
        ButtonModule, SplitButtonModule, RadioButtonModule, ToolbarModule, TooltipModule, ToggleButtonModule],
    templateUrl: './compare-rendered.component.html',
    styleUrl: './compare-rendered.component.css'
})
export class CompareRenderedComponent implements OnChanges {
    private compareRenderedService = inject(CompareRenderedService);
    private translate = inject(TranslateService);
    private locationStrategy = inject(LocationStrategy);

    @Input() beforeContent: htmlProcessingResult | undefined;
    @Input() afterContent: htmlProcessingResult | undefined;

    getUrl() {
        if (this.webSelectedView() === WebViewType.Original) {
            return this.beforeContent?.url
        }
        else if (this.webSelectedView() === WebViewType.Modified) {
            return this.afterContent?.url
        }
        else return null
    }

    // Run diff when inputs change
    async ngOnChanges(changes: SimpleChanges) {
        if (changes['beforeContent'] || changes['afterContent']) {
            console.log("Change detected!")
            const shadowRoot = this.shadowDOM();
            const viewType = this.webSelectedView();
            if (this.beforeContent && !this.afterContent) this.afterContent = this.beforeContent;
            if (!this.beforeContent && this.afterContent) this.beforeContent = this.afterContent;
            if (this.beforeContent && this.afterContent && shadowRoot) {
                await this.compareRenderedService.generateShadowDOMContent(
                    shadowRoot,
                    viewType,
                    this.beforeContent.html,
                    this.afterContent.html,
                );
            }
        }
    }

    /* START OF TOOLBAR FUNCTIONS */

    // 1. Shadow DOM navigation
    private shadowClickHandler: (() => void) | null = null;
    private shadowSelectionHandler: (() => void) | null = null;

    currentIndex = 0;
    elements: HTMLElement[] = [];

    next() {
        if (this.elements.length === 0) return;
        this.currentIndex = (this.currentIndex + 1) % this.elements.length;
        this.focusOnIndex(this.currentIndex);
        this.compareRenderedService.lastSelection = {
            count: 1,
            startId: null,
            endId: null,
        }; //reset selection
    }

    prev() {
        if (this.elements.length === 0) return;
        this.currentIndex =
            (this.currentIndex - 1 + this.elements.length) % this.elements.length;
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

    get displayCounter(): string {
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
            if (
                this.compareRenderedService.lastSelection.startId != null &&
                this.compareRenderedService.lastSelection.endId != null
            ) {
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

    get displayNumHighlighted(): string {
        const count = this.compareRenderedService.lastSelection.count;
        if (count < 1) return '';
        if (this.compareRenderedService.lastSelection.count < 1) return '';
        return this.translate.instant('compare.rendered.itemsSelected', { count });
    }

    // 2. Accept

    acceptItems = [
        {
            label: 'Accept all',
            icon: 'pi pi-check-circle',
            command: () => {
                //this.toolbarAcceptAll();
            },
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
    rejectItems = [

        // 3. Reject

        {
            label: 'Reject all',
            icon: 'pi pi-times-circle',
            command: () => {
                //this.toolbarRejectAll();
            },
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

    // 4. Legend

    readonly baseLegendItems = signal<{ text: string; colour: string; style: string; lineStyle?: string }[]>([
        { text: 'compare.rendered.legend.previousVersion', colour: '#F3A59D', style: 'highlight' },
        { text: 'compare.rendered.legend.updatedVersion', colour: '#83d5a8', style: 'highlight' },
        { text: 'compare.rendered.legend.updatedLink', colour: '#FFEE8C', style: 'highlight' },
        { text: 'compare.rendered.legend.hiddenContent', colour: '#6F9FFF', style: 'line' },
        { text: 'compare.rendered.legend.modalContent', colour: '#666666', style: 'line', lineStyle: 'dashed', },
        { text: 'compare.rendered.legend.dynamicContent', colour: '#fbc02f', style: 'line', lineStyle: 'dashed', },
    ]);

    markForTranslation() {
        marker('compare.rendered.legend.previousVersion');
        marker('compare.rendered.legend.updatedVersion');
        marker('compare.rendered.legend.updatedLink');
        marker('compare.rendered.legend.hiddenContent');
        marker('compare.rendered.legend.modalContent');
        marker('compare.rendered.legend.dynamicContent');
    }

    get legendItems() {
        const view = this.webSelectedView();
        const items = this.baseLegendItems();
        const beforeFlags = this.beforeContent?.found;
        const afterFlags = this.afterContent?.found;
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
            }).filter(Boolean) as typeof items;
    };

    // 5. Before/After - Edit

    toggleEdit = false;
    async toolbarToggleEdit(view: WebViewType): Promise<void> {
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

    toggleCopy = false;
    toolbarToggleCopy(view: WebViewType): void {
        const data = "test"
        if (!data) return;
        let htmlToCopy = '';/*
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

    /* END OF TOOLBAR FUNCTIONS */


    constructor() {
        effect(async () => {
            const viewType = this.webSelectedView();
            const shadowRoot = this.shadowDOM();
            //console.log("[Web tab] received new data");
            if (this.beforeContent && this.afterContent && shadowRoot) {
                await this.compareRenderedService.generateShadowDOMContent(
                    shadowRoot,
                    viewType,
                    this.beforeContent.html,
                    this.afterContent.html,
                );
                //Click listener for ShadowDom
                if (this.shadowClickHandler) {
                    this.shadowClickHandler();
                    console.log('Reset shadow click handler');
                }
                this.shadowClickHandler = this.compareRenderedService.handleDocumentClick(
                    shadowRoot,
                    (index: number) => {
                        this.currentIndex = index;
                    },
                );
                //Selection listener for ShadowDom
                if (this.shadowSelectionHandler) {
                    this.shadowSelectionHandler();
                    console.log('Reset shadow selection handler');
                }
                this.shadowSelectionHandler =
                    this.compareRenderedService.handleSelection(shadowRoot);

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


        })
    }
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
    //Web view options
    WebViewType = WebViewType;
    webSelectedView = signal<WebViewType>(WebViewType.Diff);

    get webViewOptions(): ViewOption<WebViewType>[] {
        return [
            {
                label: `compare.pageOptions.${this.beforeContent?.version ?? 'before'}`,
                value: WebViewType.Original,
                icon: 'pi pi-file',
            },
            {
                label: 'compare.view.comparison',
                value: WebViewType.Diff,
                icon: 'pi pi-sort-alt',
            },
            {
                label: `compare.pageOptions.${this.afterContent?.version ?? 'after'}`,
                value: WebViewType.Modified,
                icon: 'pi pi-file-edit',
            },
        ];
    }



    //Change web view
    async onWebViewChange(viewType: WebViewType) {
        this.webSelectedView.set(viewType);
    }



    //Get DOM elements from template
    @ViewChild('liveContainer', { static: false }) liveContainer!: ElementRef;

    shadowDOM = signal<ShadowRoot | null>(null);
    sourceContainerSignal = signal<ElementRef | null>(null);

    //Runs when view is initialized
    ngAfterViewInit(): void {
        const shadowRoot = this.compareRenderedService.initializeShadowDOM(
            this.liveContainer.nativeElement,
        );
        if (shadowRoot) {
            this.shadowDOM.set(shadowRoot);
            console.log('Shadow DOM is initialized.');
        }
    }
    /*
        ngOnInit(): void {
            this.observeDarkMode();
    
            //Translations
            const undoText = this.translate.instant('page.compare.button.undo');
            //Button array
            this.acceptItems = [
                {
                    label: 'Accept all',
                    icon: 'pi pi-check-circle',
                    command: () => {
                        this.toolbarAcceptAll();
                    },
                },
                {
                    separator: true,
                },
                {
                    label: undoText,
                    icon: 'pi pi-refresh',
                    command: () => {
                        this.uploadState.undoLastChange();
                    },
                    disabled: true,
                },
            ];
            this.rejectItems = [
                {
                    label: 'Reject all',
                    icon: 'pi pi-times-circle',
                    command: () => {
                        this.toolbarRejectAll();
                    },
                },
                {
                    separator: true,
                },
                {
                    label: undoText,
                    icon: 'pi pi-refresh',
                    command: () => {
                        this.uploadState.undoLastChange();
                    },
                    disabled: true,
                },
            ];
        }
        ngOnDestroy(): void {
            if (this.shadowDOM) {
                this.compareRenderedService.clearShadowDOM(this.shadowDOM()!);
                this.shadowDOM.set(null);
            }
            this.sourceContainerSignal.set(null);
            this.darkModeObserver?.disconnect();
            if (this.shadowClickHandler) {
                this.shadowClickHandler();
            }
            if (this.shadowSelectionHandler) {
                this.shadowSelectionHandler();
            }
        }
    
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
    
        private darkModeObserver?: MutationObserver;
        private observeDarkMode(): void {
            this.darkModeObserver = new MutationObserver(() => {
                this.sourceDiffService.loadPrismTheme();
            });
    
            //Checks for any changes to classes on <html> ie. dark-mode
            this.darkModeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['class'],
            });
        }
    
        */


    toolbarAccept(): void {
        this.processDiffChange('accept');
    }

    toolbarReject(): void {
        this.processDiffChange('reject');
    }

    processDiffChange(mode: 'accept' | 'reject'): void {
        //Get diff container
        const shadowRoot = this.shadowDOM();
        if (!shadowRoot) {
            console.warn('Shadow root not found.');
            return;
        }
        const diffContainer = shadowRoot.querySelector(
            '.diff-content',
        ) as HTMLElement;
        if (!diffContainer) {
            console.warn('Diff container not found');
            return;
        }

        //HANDLE HIGHLIGHTED DIFF//
        //Get highlighted <ins> or <del> or <span>
        const highlightedEls = diffContainer.querySelectorAll<HTMLElement>(
            'ins.highlight, del.highlight, span.diff-group.highlight, span.updated-link.highlight',
        );
        if (!highlightedEls.length) {
            console.warn('highlighted elements not found');
            return;
        }

        const keepTag = mode === 'accept' ? 'ins' : 'del';
        const removeTag = mode === 'accept' ? 'del' : 'ins';

        highlightedEls.forEach((highlighted) => {
            //Keep highlighted tag (accept mode keep tag = ins)
            if (highlighted.tagName.toLowerCase() === keepTag) {
                highlighted.insertAdjacentHTML('beforebegin', highlighted.innerHTML);
                highlighted.remove();
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
                    highlighted.insertAdjacentHTML('beforebegin', el.innerHTML);
                    highlighted.remove();
                }
                //updated-link
                else if (link) {
                    if (mode === 'accept') {
                        highlighted.replaceWith(link);
                    } else {
                        const oldHref =
                            highlighted.getAttribute('title')?.replace(/^Old URL:\s*/, '') ||
                            '';
                        link.setAttribute('href', oldHref);
                        highlighted.replaceWith(link);
                    }
                }
                //neither found
                else {
                    console.log(
                        `No <${keepTag}> or updated-link found. Leaving content as-is.`,
                    );
                    return;
                }
            }
        });

        //HANDLE ALL OTHER CHANGES (OPPOSITE OF WHAT IS DONE WITH THE HIGHLIGHTED CHANGE)//
        //Keep and unwrap remaining elements of opposite tag (including inside diff-group)
        diffContainer
            .querySelectorAll(`${removeTag}, span.diff-group`)
            .forEach((el) => {
                const parent = el.parentNode;
                while (el.firstChild) {
                    parent?.insertBefore(el.firstChild, el);
                }
                parent?.removeChild(el);
            });

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
                const oldHref =
                    span.getAttribute('title')?.replace(/^Old URL:\s*/, '') || '';
                link.setAttribute('href', oldHref);
                span.replaceWith(link);
            }
        });

        this.compareRenderedService.lastSelection = {
            count: 1,
            startId: null,
            endId: null,
        }; //reset selection
        //Merge with modified HTML
        const updatedHtml = diffContainer.innerHTML;


        /*const data = this.uploadState.getUploadData();
        if (!data) return;
        this.uploadState.savePreviousUploadData(); //save previous data for undo button
        if (mode === 'accept') {
            this.uploadState.mergeOriginalData({
                originalUrl: 'Change accepted',
                originalHtml: updatedHtml,
            });
            const modHtml = data.modifiedHtml?.replace(
                /<(\w+)([\s\S]*?)\s*\/>/g,
                '<$1$2>',
            ); //removes self-closing slash
            this.uploadState.mergeModifiedData({
                modifiedUrl: data.modifiedUrl!,
                modifiedHtml: modHtml!,
            });
        } else {
            this.uploadState.mergeModifiedData({
                modifiedUrl: 'Change rejected',
                modifiedHtml: updatedHtml,
            });
            const oriHtml = data.originalHtml?.replace(
                /<(\w+)([\s\S]*?)\s*\/>/g,
                '<$1$2>',
            ); //removes self-closing slash
            this.uploadState.mergeOriginalData({
                originalUrl: data.originalUrl!,
                originalHtml: oriHtml!,
            });
        }*/
    }
}