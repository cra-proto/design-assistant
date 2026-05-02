import { Injectable } from '@angular/core';

export interface SelectionTypes {
    count: number;
    startId: number | null;
    endId: number | null;
};

export interface DiffOptions {
    repeatingWordsAccuracy?: number;
    ignoreWhiteSpaceDifferences?: boolean;
    orphanMatchThreshold?: number;
    matchGranularity?: number;
    combineWords?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class CompareRenderedService {

    //Generate HTML diff (web page view) using htmldiff-js
    async generateHtmlDiff(originalHtml: string, modifiedHtml: string): Promise<string> {
        const options: DiffOptions = {
            repeatingWordsAccuracy: 0,
            ignoreWhiteSpaceDifferences: true,
            orphanMatchThreshold: 0,
            matchGranularity: 4,
            combineWords: true,
        };

        const { Diff } = await import('@ali-tas/htmldiff-js');

        const diffResult = Diff.execute(
            originalHtml,
            modifiedHtml,
            options,
        ).replace(
            /<(ins|del)[^>]*>(\s|&nbsp;|&#32;|&#160;|&#x00e2;|&#x0080;|&#x00af;|&#x202f;|&#xa0;)+<\/(ins|del)>/gis, // Remove empty or whitespace-only <ins>/<del> tags
            ' ',
        );

        return diffResult;
    }

    //Styles for HTML diff
    getRenderedDiffStyles(): string {
        return `     
        /* Shadow DOM container and layout fixes */
          :host {
            all: initial;
            display: block;
            width: 100%;
            box-sizing: border-box;
          }
    
          .rendered-content {
            margin: 0;
            padding: 0;
            background-color: #ffffff !important; 
            width: 100%;
            max-width: 100%;
            overflow-wrap: break-word;
            box-sizing: border-box;
            font-family: sans-serif;
          }
    
          .rendered-content table {
            width: 100%;
            table-layout: auto;
          }
    
          .rendered-content td, .rendered-content th, .rendered-content pre {
            word-break: break-word;
          }
    
          .rendered-content pre {
            white-space: pre-wrap;
          }
          
          /* Base styling for ins, del, and updated-link */
          ins,
          del,
          .updated-link {
            display: inline;
            padding: 0 0.3em;
            height: auto;
            border-radius: 0.3em;
            -webkit-box-decoration-break: clone;
            -o-box-decoration-break: clone;
            box-decoration-break: clone;
            margin-left: 0.07em;
            margin-right: 0.07em;
            font-weight: 500;
          }
    
          /* Inserted text (ins) */
          .rendered-content ins {
            background-color: #d4edda !important;
            color: #155724 !important;
            text-decoration: none !important;
            padding: 2px 4px;
            border-radius: 3px;
            border: 1px solid #c3e6cb;
          }
    
          /* Deleted text (del) */
          .rendered-content del {
            background-color: #f8d7da !important;
            color: #721c24 !important;
            text-decoration: line-through !important;
            padding: 2px 4px;
            border-radius: 3px;
            border: 1px solid #f5c6cb;
          }
    
          /* Updated links */
          .updated-link {
            background-color: #FFEE8C;
          }
    
          /* Highlighting for inserted, deleted, and updated elements */
          del.highlight,
          ins.highlight,
          span.diff-group.highlight,
          .updated-link.highlight:not(.overlay-wrapper.updated-link) {
            outline: 3px dotted #6e2ea7;
            padding-left: 0.35em;
            padding-right: 0.35em;
            line-height: unset;
            position: unset;
            top: unset;
            height: unset;
            transition: padding-left ease 0.3s, padding-right ease 0.3s, color ease 0.7s;
          }
    
          /* Overlay wrapper styles */
          .overlay-wrapper {
            position: relative;
            display: inline-block;
            width: 100%;
            height: 100%;
          }
    
          .overlay-wrapper::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(131, 213, 168, 0.4);
            z-index: 10;
            border-radius: 5px;
            pointer-events: none;
          }
    
          .overlay-wrapper.del::before {
            background: rgba(243, 165, 157, 0.5);
          }
    
          .overlay-wrapper.del::after {
            content: "";
            position: absolute;
            top: 50%;
            left: 0;
            width: 100%;
            height: 2px;
            background: rgba(24, 21, 21, 0.5);
            z-index: 20;
            pointer-events: none;
            opacity: 0.8;
          }
    
          .overlay-wrapper.updated-link::before {
            background: rgba(250, 237, 165, 0.23);
          }
    
          .overlay-wrapper.highlight::before {
            border: 2px dotted #000;
          }
    
          .overlay-wrapper img {
            width: 100%;
            display: block;
          }
    
          /* Optional connection type styling */
          .cnjnctn-type-or > [class*=cnjnctn-col]:not(:first-child):before {
            content: "or";
          }
        `;
    }

    //Initialize shadowDOM on an element
    initializeShadowDOM(element: HTMLElement): ShadowRoot | null {
        if (element && !element.shadowRoot) {
            return element.attachShadow({ mode: 'open' });
        }
        return element?.shadowRoot || null;
    }

    //Clear shadowDom content
    clearShadowDOM(shadowRoot: ShadowRoot): void {
        if (shadowRoot) {
            shadowRoot.innerHTML = '';
        }
    }

    //Generate shadow DOM content based on view type
    async generateShadowDOMContent(
        shadowRoot: ShadowRoot,
        viewType: 'original' | 'modified' | 'diff',
        originalHtml: string,
        modifiedHtml: string
    ): Promise<void> {
        if (!shadowRoot) {
            console.error('Shadow DOM not available');
            return;
        }

        // Clear previous content
        this.clearShadowDOM(shadowRoot);

        // Add WET & other stylesheets
        const wetStyles = [
            'https://use.fontawesome.com/releases/v5.15.4/css/all.css',
            'https://www.canada.ca/etc/designs/canada/wet-boew/css/theme.min.css',
            'https://www.canada.ca/etc/designs/canada/wet-boew/méli-mélo/2025-12-mille-iles.min.css'
        ];
        for (const href of wetStyles) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            shadowRoot.appendChild(link);
        }

        // Add base styles
        const style = document.createElement('style');
        style.textContent = this.getRenderedDiffStyles();
        shadowRoot.insertBefore(style, shadowRoot.firstChild);

        // Create container
        const diffContainer = document.createElement('div');
        diffContainer.className = 'rendered-diff-container';

        const renderedContent = document.createElement('div');
        renderedContent.classList.add('rendered-content');

        //Switch views
        switch (viewType) {
            case 'original':
                this.renderHtml(renderedContent, originalHtml, 'original-html');
                break;
            case 'modified':
                this.renderHtml(renderedContent, modifiedHtml, 'modified-html');
                break;
            case 'diff':
                await this.renderDiffHtml(renderedContent, originalHtml, modifiedHtml, 'diff-content');
                break;
        }

        diffContainer.appendChild(renderedContent);
        shadowRoot.appendChild(diffContainer);

        // Load plugins 
        this.initShadowPlugins(shadowRoot);
    }

    //Render HTML
    private renderHtml(container: HTMLElement, html: string, className: string): void {
        container.classList.add(className);
        container.innerHTML = `<div id="editable" contenteditable="false">${html}</div>`;
    }

    //Render Diff
    private async renderDiffHtml(container: HTMLElement, originalHtml: string, modifiedHtml: string, className: string): Promise<void> {
        const diffResult = await this.generateHtmlDiff(originalHtml, modifiedHtml);
        const adjustedDiff = await this.adjustDOM(originalHtml, diffResult);
        container.classList.add(className);
        container.innerHTML = adjustedDiff;
    }

    //Initialize all plugins
    private initShadowPlugins(shadowRoot: ShadowRoot): void {
        this.initTabs(shadowRoot);
        //this.initFieldFlow(shadowRoot);
        //this.initDetails(shadowRoot);
    }

    //Initialize tabs
    private initTabs(shadowRoot: ShadowRoot): void {
        shadowRoot.querySelectorAll('.wb-tabs:not(.wb-tabs-inited)').forEach((tabsContainer, autoId) => {
            const groupId = `wb-shadow-${autoId}`;
            const groupClass = `${groupId}-grp`;

            tabsContainer.classList.add('wb-init', 'wb-tabs-inited', 'tabs-acc');
            tabsContainer.id = tabsContainer.id || groupId;

            const tabpanels = tabsContainer.querySelector('.tabpanels');
            if (!tabpanels) return;

            const details = Array.from(tabpanels.querySelectorAll(':scope > details')) as HTMLDetailsElement[];
            if (details.length === 0) return;

            // Build the <ul role="tablist"> from summaries
            const ul = document.createElement('ul');
            ul.setAttribute('role', 'tablist');
            ul.setAttribute('aria-live', 'off');
            ul.setAttribute('aria-hidden', 'false');
            ul.classList.add('generated');

            details.forEach((detail, i) => {
                const summary = detail.querySelector('summary');
                const detailId = detail.id || `${groupId}-tab${i}`;
                detail.id = detailId;
                const linkId = `${detailId}-lnk`;

                const li = document.createElement('li');
                li.setAttribute('role', 'presentation');
                if (i === 0) li.classList.add('active');

                const a = document.createElement('a');
                a.id = linkId;
                a.href = `#${detailId}`;
                a.setAttribute('role', 'tab');
                a.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
                a.setAttribute('aria-controls', detailId);
                a.setAttribute('tabindex', i === 0 ? '0' : '-1');
                a.innerHTML = summary?.innerHTML || '';

                li.appendChild(a);
                ul.appendChild(li);

                // Transform detail to match WET's output
                const linkIdRef = linkId;
                detail.setAttribute('role', 'tabpanel');
                detail.setAttribute('aria-labelledby', linkIdRef);
                detail.classList.add('wb-init', groupClass, 'fade');
                detail.removeAttribute('open');

                // Wrap existing content div in tgl-panel
                const contentDiv = detail.querySelector('div');
                if (contentDiv) {
                    const tglPanel = document.createElement('div');
                    tglPanel.classList.add('tgl-panel');
                    tglPanel.setAttribute('aria-expanded', 'true');
                    tglPanel.setAttribute('aria-hidden', 'false');
                    contentDiv.parentNode?.insertBefore(tglPanel, contentDiv);
                    tglPanel.appendChild(contentDiv);
                }

                // Hide summary visually (tab list takes over)
                if (summary) {
                    summary.setAttribute('aria-hidden', 'true');
                    summary.classList.add('wb-toggle', 'tgl-tab', 'wb-init', 'wb-toggle-inited');
                }

                if (i === 0) {
                    // Active panel
                    detail.classList.add('in');
                    detail.setAttribute('open', '');
                    detail.setAttribute('aria-hidden', 'false');
                    detail.setAttribute('aria-expanded', 'true');
                } else {
                    // Inactive panels
                    detail.classList.add('out', 'noheight');
                    detail.setAttribute('aria-hidden', 'true');
                    detail.setAttribute('aria-expanded', 'false');
                }
            });

            // Insert tab list before tabpanels
            tabpanels.parentNode?.insertBefore(ul, tabpanels);

            // Wire up tab clicks
            const tabLinks = Array.from(ul.querySelectorAll('a'));
            tabLinks.forEach((link, i) => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();

                    tabLinks.forEach((l, j) => {
                        const isActive = j === i;
                        l.setAttribute('aria-selected', String(isActive));
                        l.setAttribute('tabindex', isActive ? '0' : '-1');
                        l.closest('li')?.classList.toggle('active', isActive);

                        const panel = details[j];
                        if (isActive) {
                            panel.classList.remove('out', 'noheight');
                            panel.classList.add('in');
                            panel.setAttribute('open', '');
                            panel.setAttribute('aria-hidden', 'false');
                            panel.setAttribute('aria-expanded', 'true');
                        } else {
                            panel.classList.remove('in');
                            panel.classList.add('out', 'noheight');
                            panel.removeAttribute('open');
                            panel.setAttribute('aria-hidden', 'true');
                            panel.setAttribute('aria-expanded', 'false');
                        }
                    });
                });
            });
        });
    }

    //Adjust diff result (mark changed links, images, remove nested diff tags)
    private async adjustDOM(originalHtml: string, diffResult: string) {

        // Parse current diff and before content
        const parser = new DOMParser();
        const diffDoc = parser.parseFromString(diffResult, 'text/html');
        /*const beforeDoc = parser.parseFromString(originalHtml, 'text/html');
    
        type LinksMap = Map<string, LinkData[]>;
    
        
        const newLinks: LinksMap = new Map();
    
        const cleanText = (text: string) => text?.trim().replace(/\s+/g, ' ') || '';
    
        const wrapWithSpan = (el: Element, title: string) => {
          return `<span class="updated-link" title="${title}">${el.outerHTML}</span>`;
        };
    
        const findMatchingLinks = (beforeText: string) =>
          newLinks.get(beforeText) ||
          [...newLinks.values()].flat().filter(({ insText }) => insText === beforeText);
    
        // Collect new links from diff
        diffDoc.querySelectorAll('a').forEach(el => {
          const text = cleanText(el.textContent || '');
          const href = el.getAttribute('href');
          if (!text || !href) return;
    
          newLinks.set(text, newLinks.get(text) || []);
          newLinks.get(text)!.push({
            text,
            insText:
              cleanText(Array.from(el.childNodes).filter(n => n.nodeName !== 'INS').map(n => n.textContent || '').join('')) ||
              cleanText(Array.from(el.children).filter(c => c.tagName !== 'INS').map(c => c.textContent || '').join('')),
            href,
            element: el
          });
        });
    
        // Compare with beforeDoc links
        beforeDoc.querySelectorAll('a').forEach(el => {
          const text = cleanText(el.textContent || '');
          const href = el.getAttribute('href');
          if (!text || !href) return;
    
          const matches = findMatchingLinks(text);
          if (!matches.length) return;
    
          const matchingKey = [...newLinks.keys()].find(key =>
            newLinks.get(key)?.some(({ insText }) => insText === text)
          );
          if (matchingKey) newLinks.delete(matchingKey);
    
          if (matches.some(({ href: matchHref }) => matchHref === href)) {
            newLinks.delete(text);
            return;
          }
    
          if (
            matches.find(({ element }) => element.tagName === 'DEL')?.element.textContent?.trim() === text ||
            matches.find(({ element }) => element.querySelector('ins'))?.element.textContent?.trim() === text
          ) {
            newLinks.delete(text);
            return;
          }
    
          for (const { insText, element } of matches) {
            if (insText) {
              element.outerHTML = wrapWithSpan(element, `Old URL: ${href}`);
            }
          }
          newLinks.delete(text);
        });
    
        // Wrap remaining new links
        for (const links of newLinks.values()) {
          for (const { element, insText } of links) {
            if (insText) {
              console.log(`Newly added link text`, insText);
              element.outerHTML = wrapWithSpan(element, 'Newly added link');
            }
          }
        }
    
        */
        // Remove nested ins/del tags
        diffDoc.querySelectorAll('del > del, ins > ins').forEach(el => {
            const parent = el.parentElement;
            if (parent && parent.textContent?.trim() === el.textContent?.trim()) {
                parent.replaceWith(el);
            }
        });

        diffDoc.querySelectorAll('del > ins, ins > del').forEach(el => {
            const parent = el.parentElement;
            if (parent && parent.textContent?.trim() === el.textContent?.trim()) {
                parent.replaceWith(el);
            }
        });

        // Assign IDs
        const uniqueElements = Array.from(diffDoc.querySelectorAll('ins.diffins, del.diffdel, del.diffmod, .updated-link')).map((el, index) => {
            //Group diffmods <--needs QA check
            if (el.matches('del.diffmod') && el.nextElementSibling?.matches('ins.diffmod')) {
                const wrapper = diffDoc.createElement('span');
                wrapper.classList.add('diff-group');
                const matchingIns = el.nextElementSibling;
                el.parentNode?.insertBefore(wrapper, el);
                wrapper.appendChild(el);
                wrapper.appendChild(matchingIns);
                el = wrapper;
            }
            const parent = el.parentElement;
            return {
                element: el,
                outerHTML: parent?.innerHTML?.replace(/\n/g, '').trim() || '',
                id: index + 1
            };
        });

        uniqueElements.forEach(({ element, id }) => {
            element.setAttribute('data-id', `${id}`);
        });
        /* 
            const wrapWithOverlayWrapper = (el: Element, parentClass: string) => {
              const parent = el.parentElement;
              const dataId = parent?.getAttribute('data-id');
              const wrapper = document.createElement('div');
              wrapper.className = `overlay-wrapper ${parentClass}`;
              if (dataId) wrapper.setAttribute('data-id', dataId);
              wrapper.innerHTML = el.outerHTML;
              parent?.replaceWith(wrapper);
            };
        
            diffDoc.querySelectorAll('ins img, del img, .updated-link img').forEach(el => {
              const parent = el.parentElement;
              let parentClass = '';
              if (parent?.tagName === 'INS') parentClass = 'ins';
              else if (parent?.tagName === 'DEL') parentClass = 'del';
        
              if (parentClass) {
                wrapWithOverlayWrapper(el, parentClass);
              }
            });
        */
        return diffDoc.body.innerHTML;
    }

    //Handle clicks inside Shadow DOM
    handleDocumentClick(shadowRoot: ShadowRoot, updateCurrentIndex: (index: number) => void): () => void {
        const clickHandler = (event: Event) => {
            let target = event.target as HTMLElement;

            while (target && target.tagName !== 'A') {
                target = target.parentElement as HTMLElement;
            }
            //link clicks
            if (target?.tagName === 'A') {
                const href = target.getAttribute('href') ?? '';
                //anchor links
                if (href.startsWith('#')) {
                    event.preventDefault();
                    const sectionId = target.getAttribute('href')?.substring(1);
                    const targetSection = shadowRoot.getElementById(sectionId ?? '');

                    if (targetSection) {
                        targetSection.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                        });
                    }
                }
                //other links
                if (!href.startsWith('#')) {
                    event.preventDefault();
                }
            }
            //diff clicks      
            const changeElements = this.getDataIdElements(shadowRoot);

            if (!changeElements.length) return;

            const clickedElement = changeElements.find((el) =>
                el.contains(event.target as Node)
            );

            if (!clickedElement) return;

            //const index = Number(clickedElement.getAttribute('data-id'));
            const index = changeElements.indexOf(clickedElement);
            this.scrollToElement(clickedElement);
            if (updateCurrentIndex) {
                updateCurrentIndex(index);
                this.lastSelection = { count: 1, startId: null, endId: null }; //reset selection
            }

        };

        // Attach listener and return cleanup function
        shadowRoot.addEventListener('click', clickHandler);

        return () => {
            shadowRoot.removeEventListener('click', clickHandler);
        };
    }

    //Handle text selection inside Shadow DOM
    handleSelection(shadowRoot: ShadowRoot): () => void {
        const selectionHandler = () => {
            this.highlightSelected(shadowRoot);
        };

        shadowRoot.addEventListener('mouseup', selectionHandler);
        shadowRoot.addEventListener('keyup', selectionHandler); // for keyboard selection

        return () => {
            shadowRoot.removeEventListener('mouseup', selectionHandler);
            shadowRoot.removeEventListener('keyup', selectionHandler);
        };
    }

    //Helper functions for next/prev buttons
    getDataIdElements(shadowRoot: ShadowRoot): HTMLElement[] {
        return Array.from(shadowRoot.querySelectorAll<HTMLElement>('[data-id]'));
    }

    highlightElement(el: HTMLElement, highlightClass = 'highlight') {
        this.clearHighlights(el.getRootNode() as ShadowRoot, highlightClass);
        el.classList.add(highlightClass);
    }

    clearHighlights(shadowRoot: ShadowRoot, highlightClass = 'highlight') {
        shadowRoot.querySelectorAll(`.${highlightClass}`).forEach((node) => {
            node.classList.remove(highlightClass);
        });
    }

    scrollToElement(el: HTMLElement) {
        const shadowRoot = el.getRootNode() as ShadowRoot;
        shadowRoot.querySelectorAll('.highlight').forEach(h => h.classList.remove('highlight'));
        el.classList.add('highlight');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    openParentDetails(el: HTMLElement) {
        const detailsEl = el.closest('details');
        if (detailsEl) {
            detailsEl.open = true;
        }
    }

    closeAllDetailsExcept(shadowRoot: ShadowRoot, keepOpenEl: HTMLElement) {
        shadowRoot.querySelectorAll('details').forEach((details) => {
            if (details !== keepOpenEl.closest('details')) {
                (details as HTMLDetailsElement).open = false;
            }
        });
    }


    public lastSelection: SelectionTypes = { count: 1, startId: null, endId: null };

    highlightSelected(shadowRoot: ShadowRoot): void {
        //NOTE: window.getSelection() seems limited to text in shadowdom so extra checks needed to match with actual shadowdom elements
        const selection = window.getSelection();
        if (!shadowRoot || !selection) { this.lastSelection = { count: 0, startId: null, endId: null }; return }; //reset lastSelection

        const selectedText = normalize(selection.toString());
        if (!selectedText) return; //no change to lastSelection

        //Step 1: Throw error if selected text not unique
        try {
            this.clearHighlights(shadowRoot);
            findSelectionInShadow(shadowRoot, selectedText); //throws error if not unique
            //Step 2: Find best match      
            const dataIdElements = this.getDataIdElements(shadowRoot);
            // All matches
            const matches = dataIdElements
                .map(element => {
                    const text = normalize(element.textContent || "");
                    return {
                        element,
                        dataId: parseInt(element.getAttribute("data-id") || "0"),
                        text,
                        textLength: text.length
                    };
                })
                .filter(item => item.text && selectedText.includes(item.text));

            if (matches.length === 0) {
                throw new Error("No diffs found in selected text.");
            }
            console.log('All matches:', matches.map(m => `${m.dataId}: "${m.text}"`));

            // Best match = longest match
            let bestMatch = matches.reduce((prev, current) =>
                current.textLength > prev.textLength ? current : prev
            );
            console.log(`Initial best match: data-id="${bestMatch.dataId}", text: "${bestMatch.text}" (${bestMatch.textLength} chars)`);

            // Handle short best match
            if (bestMatch.text.length <= 20) {
                console.log("Selected text: ", selectedText);
                const expanded = expandBestMatch(bestMatch.element, selectedText.length, 3);
                if (!selectedText.includes(expanded)) {
                    console.log("Initial best match was wrong, checking others.");
                    console.log("EXPANDED SHADOWDOM TEXT")
                    console.log(expanded)
                    const sortedMatches = matches.sort((a, b) => b.textLength - a.textLength);
                    let found = false;
                    console.log(sortedMatches)
                    for (const possibleMatch of sortedMatches) {
                        const expanded = expandBestMatch(possibleMatch.element, selectedText.length, 3);
                        console.log("Checking: ", expanded);
                        if (selectedText.includes(expanded)) {
                            bestMatch = possibleMatch;
                            found = true;
                            console.log(`New best match: data-id="${bestMatch.dataId}", text: "${bestMatch.text}" (${bestMatch.textLength} chars)`);
                            console.log("EXPANDED SHADOWDOM TEXT")
                            console.log(expanded)
                            break;
                        }
                    }
                    if (!found) { throw new Error("No expanded matches match the selected text."); }
                }
            }

            // Get continuous range of matches
            const matchedDataIds = new Set(matches.map(m => m.dataId));
            let startId = bestMatch.dataId;
            let endId = bestMatch.dataId;

            // Current best match
            let finalText = checkRange(shadowRoot, startId, endId);

            // Expand left
            while (startId > 0) {
                const includeText = checkRange(shadowRoot, startId - 1, endId);
                if (includeText) {
                    startId--;
                    finalText = includeText;
                } else {
                    break;
                }
            }

            // Expand right
            while (true) {
                const includeText = checkRange(shadowRoot, startId, endId + 1);
                if (includeText) {
                    endId++;
                    finalText = includeText;
                } else {
                    break;
                }
            }

            // Final range
            console.log(`Final match between ${startId} and ${endId}:`, finalText);

            // Step 3: Highlight the range
            let highlightedCount = 0;
            const elementById = Object.fromEntries(dataIdElements.map(el => [parseInt(el.getAttribute('data-id') || '0'), el]));
            for (let id = startId; id <= endId; id++) {
                if (matchedDataIds.has(id)) {
                    const element = elementById[id];
                    if (element) {
                        element.classList.add('highlight');
                        highlightedCount++;
                    }
                }
            }
            console.log(`Highlighted ${highlightedCount} elements from data-id ${startId} to ${endId}`);

            this.lastSelection = { count: highlightedCount, startId: startId, endId: endId };
            return;

        } catch (err) {
            console.error(err);
            this.lastSelection = { count: 0, startId: null, endId: null }; //nothing selected
            return;
        }

        /********************
         * HELPER FUNCTIONS *
         ********************/

        //Normalizes a string of text
        function normalize(text: string): string {
            return text.replace(/\s+/g, " ").trim();
        }

        //Extracts text-only from shadow dom
        function extractShadowText(shadowRoot: ShadowRoot): string {

            const walker = document.createTreeWalker(shadowRoot, NodeFilter.SHOW_TEXT, null);
            let text = "";

            let node: Node | null = walker.nextNode();
            while (node) {
                text += node.textContent || "";
                node = walker.nextNode();
            }

            return normalize(text);
        }

        //Checks if selected text is unique in shadow dom
        function findSelectionInShadow(shadowRoot: ShadowRoot, selectedText: string): number {
            const shadowText = extractShadowText(shadowRoot);

            if (!selectedText) return -1;

            const idx = shadowText.indexOf(selectedText);

            //No match
            if (idx === -1) {
                throw new Error("Selection not found in shadowDOM."); //should never appear
            }
            //2nd match
            const secondIdx = shadowText.indexOf(selectedText, idx + 1);
            if (secondIdx !== -1) {
                throw new Error("Selected text is not unique in shadowDOM.");
            }
            //Unique match position
            return idx;
        }

        function checkRange(root: ParentNode, startId: number, endId: number): string | null {
            const startEl = root.querySelector(`[data-id="${startId}"]`);
            const endEl = root.querySelector(`[data-id="${endId}"]`);

            if (!startEl || !endEl) {
                return null;
            }

            // Create a range of text from start element to end element
            const range = document.createRange();
            range.setStartBefore(startEl);
            range.setEndAfter(endEl);
            const rangeText = normalize(range.toString());

            // Check if range is in the selected text
            return selectedText.includes(rangeText) ? rangeText : null;
        }

        //Include text on either side of match to confirm accuracy
        function expandBestMatch(element: HTMLElement, maxLength: number, chars = 5): string {
            let text = normalize(element.textContent || "");
            // If already longer than maxLength, just trim
            if (text.length >= maxLength) return text.slice(0, maxLength);

            // Expand backwards into previous text
            let remaining = Math.min(chars, maxLength - text.length);
            let prevNode: Node | null = element.previousSibling;
            while (remaining > 0 && prevNode) {
                if (prevNode.nodeType === Node.TEXT_NODE) {
                    const slice = prevNode.textContent?.slice(-remaining) || "";
                    text = joinStrings(slice, text);
                    remaining -= slice.length;
                }
                prevNode = prevNode.previousSibling;
            }

            // Expand forwards into next text
            remaining = Math.min(chars, maxLength - text.length);
            let nextNode: Node | null = element.nextSibling;
            while (remaining > 0 && nextNode) {
                if (nextNode.nodeType === Node.TEXT_NODE) {
                    const slice = nextNode.textContent?.slice(0, remaining) || "";
                    text = joinStrings(text, slice);
                    remaining -= slice.length;
                }
                nextNode = nextNode.nextSibling;
            }

            // Confirm final length is less than selection
            if (text.length > maxLength) {
                text = text.slice(0, maxLength);
            }

            return normalize(text);
        }

        function joinStrings(left: string, right: string): string {
            if (!left) return right;
            if (!right) return left;

            const l = left[left.length - 1]; //last char
            const r = right[0]; //first char

            if (/\s/.test(l) || /\s/.test(r) || /[.,!?;:)]/.test(r)) {
                return left + right;
            }
            return left + " " + right;
        }

    }
}