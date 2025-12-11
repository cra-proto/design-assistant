import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TreeNode } from 'primeng/api';

import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TextareaModule } from 'primeng/textarea';
import { IftaLabelModule } from 'primeng/iftalabel';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { MessageModule } from 'primeng/message';

import { UrlItem, BreadcrumbNode } from '../ia-assistant/data/data.model';
import { LinkListComponent } from './components/link-list.component';
import { FetchService } from '../../services/fetch.service';
import { ProjectStateService, ProjectTreeNodeData } from '../../services/project-state.service';

interface PageDataForTree {
    url: string;
    h1: string;
    oppUrl: string;
    breadcrumb: BreadcrumbNode[];
    isUserAdded: boolean;
}

@Component({
    selector: 'aida-add-pages',
    imports: [
        CommonModule,
        FormsModule,
        ProgressBarModule,
        ConfirmPopupModule,
        TextareaModule,
        IftaLabelModule,
        ButtonModule,
        ChipModule,
        MessageModule,
        LinkListComponent
    ],
    templateUrl: './temp.component.html',
    styles: ``
})
export class AddPagesComponent implements OnInit {
    projectState = inject(ProjectStateService);
    fetchService = inject(FetchService);
    confirmationService = inject(ConfirmationService);
    messageService = inject(MessageService);

    // URL input and parsing
    rawUrls = '';
    urls: UrlItem[] = [];

    // Validation state
    isValidating = false;
    isValidated = false;
    urlTotal = 0;
    urlChecked = 0;
    urlPercent = 0;

    // Duplicate tracking
    urlsDuplicate: string[] = [];

    // Building tree state
    isAddingToProject = false;
    buildProgress = 0;
    buildStep = '';
    addedSuccessfully = false;

    ngOnInit(): void {
        // Load project if exists
        this.projectState.loadFromLocalStorage();
    }

    // Parse URLs from textarea
    parseUrls() {
        const existingUrls = this.projectState.getAllUrls();
        this.urlsDuplicate = [];

        this.urls = this.rawUrls
            .split(/\r?\n/)
            .map(line => line.trim().toLowerCase())
            .filter(Boolean)
            .map(href => {
                // Check for duplicates
                if (existingUrls.has(href)) {
                    this.urlsDuplicate.push(href);
                    return null;
                }
                return { href, status: 'checking' as const };
            })
            .filter((url): url is UrlItem => url !== null);

        // Remove duplicate URLs in the input itself
        const uniqueUrls = new Map(this.urls.map(u => [u.href, u]));
        this.urls = Array.from(uniqueUrls.values());

        this.isValidated = false;
    }

    // Validate a single URL
    private async checkStatus(link: UrlItem) {
        try {
            const response = await this.fetchService.fetchStatus(link.href, 'prod', 3, 'random', 100);

            if (!response.ok || response.url.includes('404.html')) {
                link.status = 'bad';
            } else if (response.url !== link.href) {
                link.status = 'redirect';
                link.originalHref = link.href;
                link.href = response.url;
            } else {
                link.status = 'ok';
            }
        } catch (error) {
            console.error(error);
            if ((error as Error).message.startsWith('Blocked host')) {
                link.status = 'blocked';
            } else {
                link.status = 'bad';
            }
        }
    }

    // Validate all URLs
    async validateUrls() {
        if (!this.urls.length) return;

        this.isValidating = true;
        this.isValidated = false;
        this.urlTotal = this.urls.length;
        this.urlChecked = 0;
        this.urlPercent = 0;

        // Check all URLs sequentially
        for (const url of this.urls) {
            await this.checkStatus(url);
            this.urlChecked++;
            this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
        }

        // Recheck bad URLs
        const badUrls = this.urls.filter(url => url.status === 'bad');
        if (badUrls.length > 0) {
            badUrls.forEach(badUrl => (badUrl.status = 'checking'));
            this.urlChecked -= badUrls.length;

            for (const badUrl of badUrls) {
                await this.checkStatus(badUrl);
                this.urlChecked++;
                this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
            }
        }

        this.isValidating = false;
        this.isValidated = true;
    }

    // Remove a URL from the list
    removeUrl(link: UrlItem) {
        this.urls = this.urls.filter(u => u !== link);
        this.urlTotal--;
        this.urlChecked--;
        this.urlPercent = this.urlTotal > 0 ? (this.urlChecked / this.urlTotal) * 100 : 0;
    }

    // Revalidate a single URL
    revalidate(link: UrlItem, $event: Event) {
        link.href = link.href.trim().toLowerCase();

        // Check for duplicates in current list
        if (this.urls.some(u => u !== link && u.href === link.href)) {
            this.confirmationService.confirm({
                target: $event.currentTarget as EventTarget,
                message: 'This URL is already in the list. Do you want to remove the duplicate?',
                icon: 'pi pi-exclamation-triangle',
                rejectButtonProps: {
                    label: 'Cancel',
                    severity: 'secondary',
                    outlined: true
                },
                acceptButtonProps: {
                    label: 'Yes',
                    severity: 'danger'
                },
                accept: () => {
                    this.removeUrl(link);
                }
            });
            return;
        }

        // Recheck the URL
        link.status = 'checking';
        this.urlChecked--;
        this.urlPercent = (this.urlChecked / this.urlTotal) * 100;

        this.checkStatus(link).finally(() => {
            this.urlChecked++;
            this.urlPercent = (this.urlChecked / this.urlTotal) * 100;
        });
    }

    // Get H1 and opposite language URL from page
    private async getPageInfo(url: string): Promise<{ h1: string; oppUrl: string }> {
        try {
            const doc = await this.fetchService.fetchContent(url, 'prod', 5, 'random');

            // Get H1
            const h1Elements = Array.from(doc.querySelectorAll('h1'));
            const h1 = h1Elements.map(e => e.textContent?.trim()).filter(Boolean).join('<br>');

            // Get opposite language URL
            const langToggle = doc.querySelector('.wb-sl a');
            const oppUrl = langToggle ? new URL(langToggle.getAttribute('href') || '', url).href : '';

            return { h1, oppUrl };
        } catch (error) {
            console.error(`Failed to get page info for ${url}:`, error);
            return { h1: 'Unknown', oppUrl: '' };
        }
    }

    // Get breadcrumb from page
    private async getBreadcrumb(url: string): Promise<BreadcrumbNode[]> {
        try {
            const doc = await this.fetchService.fetchContent(url, 'prod', 5, 'random');

            const breadcrumbItems = doc.querySelectorAll('.breadcrumb li a');
            const breadcrumbArray: BreadcrumbNode[] = [];

            breadcrumbItems.forEach((el) => {
                const rawHref = el.getAttribute('href') || '';
                let absoluteUrl = '';
                try {
                    absoluteUrl = new URL(rawHref, 'https://www.canada.ca').href;
                } catch {
                    console.warn(`Invalid breadcrumb href: ${rawHref}`);
                }
                breadcrumbArray.push({
                    label: el.textContent?.trim() || '',
                    url: absoluteUrl,
                });
            });

            return breadcrumbArray;
        } catch (error) {
            console.error(`Failed to get breadcrumb for ${url}:`, error);
            return [];
        }
    }

    // Check if parent page links to child
    private async validateParentChildLink(parentUrl: string, childUrl: string): Promise<boolean> {
        try {
            const doc = await this.fetchService.fetchContent(parentUrl, 'prod', 5, 'random');
            const links = Array.from(doc.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter((href): href is string => !!href)
                .map(href => {
                    try {
                        return new URL(href, parentUrl).href;
                    } catch {
                        return href;
                    }
                });

            return links.includes(childUrl);
        } catch (error) {
            console.error(`Failed to validate link from ${parentUrl} to ${childUrl}:`, error);
            return false;
        }
    }

    // Build tree structure from validated URLs
    async addToProject() {
        if (!this.urlsOk.length) return;

        this.isAddingToProject = true;
        this.buildProgress = 0;
        this.buildStep = 'Fetching page data...';
        this.addedSuccessfully = false;

        try {
            // Step 1: Fetch breadcrumbs, H1s, and opposite language URLs for all valid URLs
            const pageData: PageDataForTree[] = [];

            for (let i = 0; i < this.urlsOk.length; i++) {
                const url = this.urlsOk[i].href;
                this.buildStep = `Fetching data (${i + 1}/${this.urlsOk.length})...`;
                this.buildProgress = ((i + 1) / this.urlsOk.length) * 30;

                const [pageInfo, breadcrumb] = await Promise.all([
                    this.getPageInfo(url),
                    this.getBreadcrumb(url)
                ]);

                pageData.push({
                    url,
                    h1: pageInfo.h1,
                    oppUrl: pageInfo.oppUrl,
                    breadcrumb,
                    isUserAdded: true
                });
            }

            // Step 2: Build breadcrumb trails with all pages
            this.buildStep = 'Building page structure...';
            this.buildProgress = 40;

            const allPages = new Map<string, PageDataForTree>();

            // Add user-added pages
            for (const page of pageData) {
                allPages.set(page.url, page);
            }

            // Add parent pages from breadcrumbs
            for (const page of pageData) {
                for (const crumb of page.breadcrumb) {
                    if (!allPages.has(crumb.url!)) {
                        allPages.set(crumb.url!, {
                            url: crumb.url!,
                            h1: crumb.label,
                            oppUrl: '', // We don't fetch opp URL for parent pages
                            breadcrumb: [], // We don't need to fetch breadcrumbs for parent pages
                            isUserAdded: false
                        });
                    }
                }
            }
        });
    }
}
      }

// Step 3: Validate parent-child relationships
this.buildStep = 'Validating page relationships...';
this.buildProgress = 50;

const orphanStatus = new Map<string, boolean>();

let validationCount = 0;
const totalValidations = pageData.length;

for (const page of pageData) {
    const parentUrl = page.breadcrumb[page.breadcrumb.length - 1]?.url;

    if (parentUrl) {
        const isLinked = await this.validateParentChildLink(parentUrl, page.url);
        orphanStatus.set(page.url, !isLinked);
    } else {
        orphanStatus.set(page.url, false); // No parent means it's a root page (not orphaned)
    }

    validationCount++;
    this.buildProgress = 50 + ((validationCount / totalValidations) * 30);
    this.buildStep = `Validating relationships (${validationCount}/${totalValidations})...`;
}

// Step 4: Build TreeNode structure
this.buildStep = 'Building tree structure...';
this.buildProgress = 85;

const tree = this.buildTreeFromPages(allPages, orphanStatus);

// Step 5: Merge into existing project
this.buildStep = 'Adding to project...';
this.buildProgress = 95;

this.projectState.mergePages(tree);
this.projectState.saveToLocalStorage();

this.buildProgress = 100;
this.buildStep = 'Complete!';
this.addedSuccessfully = true;

// Show success message
this.messageService.add({
    severity: 'success',
    summary: 'Success',
    detail: `Added ${this.urlsOk.length} pages to project`
});

// Reset form after a delay
setTimeout(() => {
    this.resetForm();
}, 2000);

    } catch (error) {
    console.error('Failed to add pages to project:', error);
    this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to add pages to project'
    });
} finally {
    setTimeout(() => {
        this.isAddingToProject = false;
        this.buildProgress = 0;
        this.buildStep = '';
    }, 2000);
}
  }

  // Build tree structure from page data
  private buildTreeFromPages(
    allPages: Map<string, PageDataForTree>,
    orphanStatus: Map<string, boolean>
): TreeNode < ProjectTreeNodeData > [] {
    const nodeMap = new Map<string, TreeNode<ProjectTreeNodeData>>();

    // Create nodes for all pages with full PageMeta and PageStatus data
    for (const [url, page] of allPages) {
        const parentUrl = page.breadcrumb[page.breadcrumb.length - 1]?.url || null;

        nodeMap.set(url, {
            label: page.h1,
            data: {
                // PageMeta fields
                url: url,
                oppUrl: page.oppUrl,
                baselineParent: parentUrl,
                h1: page.h1,
                title: undefined,
                description: undefined,
                keywords: undefined,
                oppTitle: undefined,
                owner: undefined,
                email: undefined,
                lastPublished: undefined,
                lastModified: undefined,
                // PageStatus fields
                inScope: page.isUserAdded,
                isOrphan: orphanStatus.get(url) || false,
                isCrawled: false,
                isNew: false,
                isMoved: false,
                isROT: false,
                isContainer: false
            },
            expanded: true,
            children: []
        });
    }

    // Build parent-child relationships
    for (const [url, page] of allPages) {
        const node = nodeMap.get(url)!;
        const parentUrl = page.breadcrumb[page.breadcrumb.length - 1]?.url;

        if (parentUrl && nodeMap.has(parentUrl)) {
            const parentNode = nodeMap.get(parentUrl)!;
            if (!parentNode.children) {
                parentNode.children = [];
            }
            parentNode.children.push(node);
        }
    }

    // Find root nodes (pages without parents in our set)
    const roots: TreeNode<ProjectTreeNodeData>[] = [];
    for (const [url, page] of allPages) {
        const parentUrl = page.breadcrumb[page.breadcrumb.length - 1]?.url;
        if (!parentUrl || !nodeMap.has(parentUrl)) {
            roots.push(nodeMap.get(url)!);
        }
    }

    return roots;
}

  // Reset form
  private resetForm() {
    this.rawUrls = '';
    this.urls = [];
    this.isValidated = false;
    this.urlTotal = 0;
    this.urlChecked = 0;
    this.urlPercent = 0;
    this.urlsDuplicate = [];
    this.addedSuccessfully = false;
}

  // Filtered URL lists for display
  get urlsChecking() { return this.urls.filter(u => u.status === 'checking'); }
  get urlsBlocked() { return this.urls.filter(u => u.status === 'blocked'); }
  get urlsBad() { return this.urls.filter(u => u.status === 'bad'); }
  get urlsRedirected() { return this.urls.filter(u => u.status === 'redirect'); }
  get urlsOk() { return this.urls.filter(u => u.status === 'ok'); }
}