import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

// PrimeNG modules
import { TextareaModule } from 'primeng/textarea';
import { IftaLabelModule } from 'primeng/iftalabel';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { ConfirmPopupModule } from 'primeng/confirmpopup';
import { DialogModule } from 'primeng/dialog';
import { ChipModule } from 'primeng/chip';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService } from 'primeng/api';
import { MessageModule } from 'primeng/message';

// Services
import { AddPagesStateService } from './services/add-pages-state.service';
import { UrlValidationService } from './services/url-validation.service';
import { IaRelationshipService } from '../ia-assistant/services/ia-relationship.service';
import { IaTreeService } from '../ia-assistant/services/ia-tree.service';
import { ProjectStateService } from '../../services/project-state.service';
import { FetchService } from '../../services/fetch.service';

// Models
import { UrlItem } from './add-pages.model';
import { TreeNode } from 'primeng/api';

@Component({
    selector: 'aida-add-pages',
    imports: [
        CommonModule, FormsModule, TranslateModule,
        TextareaModule, IftaLabelModule, ButtonModule,
        InputTextModule, InputGroupModule, InputGroupAddonModule, ConfirmPopupModule,
        ProgressBarModule, DialogModule, ChipModule, TooltipModule, MessageModule
    ],
    templateUrl: './add-pages.component.html',
    styles: `
    ::ng-deep .p-stepper .p-stepper-panel {
    flex: 0 0 auto !important;
}
`
})
export class AddPagesComponent {
    // Services
    projectState = inject(ProjectStateService);
    addPagesState = inject(AddPagesStateService);
    urlValidation = inject(UrlValidationService);

    translate = inject(TranslateService);

    iaRelationship = inject(IaRelationshipService);
    iaTree = inject(IaTreeService);

    fetchService = inject(FetchService);
    confirmationService = inject(ConfirmationService);

    // Output event
    @Output() completed = new EventEmitter<boolean>();

    // UI state
    showBreadcrumbDialog = false;
    duplicatesSkipped: string[] = [];

    // Computed getters for template
    get validationState() { return this.addPagesState.getValidationState(); }
    get breadcrumbState() { return this.addPagesState.getBreadcrumbState(); }
    get urlsChecking() { return this.addPagesState.urlsChecking; }
    get urlsOk() { return this.addPagesState.urlsOk; }
    get urlsBad() { return this.addPagesState.urlsBad; }
    get urlsBlocked() { return this.addPagesState.urlsBlocked; }
    get urlsRedirected() { return this.addPagesState.urlsRedirected; }


    // Parse URLs from textarea
    parseUrls(): void {
        const rawUrls = this.validationState.rawUrls;
        const existingUrls = this.projectState.getAllUrls();
        const { parsedUrls, duplicates } = this.urlValidation.parseUrls(rawUrls, existingUrls);

        this.duplicatesSkipped = duplicates;

        this.addPagesState.setValidationState({
            urls: parsedUrls,
            urlTotal: parsedUrls.length,
            isValidated: false,
            isValidating: false,
        });
        console.log('Parsed URLs for validation:', parsedUrls);
        console.log('Duplicates skipped:', duplicates);
    }
    onPasteUrls() {
        setTimeout(() => this.parseUrls(), 0);
    }

    // Warning message for duplicates skipped
    getDuplicateMessage(): string {
        const count = this.duplicatesSkipped.length;
        const key = count === 1
            ? 'addPages.duplicatesSkipped'
            : 'addPages.duplicatesSkipped.plural';
        return this.translate.instant(key, { count });
    }

    // Validate parsed URLs
    validateUrls(): void {
        this.addPagesState.setValidationState({
            isValidating: true,
        });
        console.log('Starting URL validation...');
        this.urlValidation.validateUrls(this.validationState.urls, (checked, total) => {
            const percent = Math.round((checked / total) * 100);
            this.addPagesState.setValidationState({
                urlChecked: checked,
                urlPercent: percent,
            });
            console.log(`Validated ${checked} of ${total} URLs (${percent}%)`);
        }).then(() => {
            this.addPagesState.setValidationState({
                isValidating: false,
                isValidated: true,
            });
            console.log('URL validation complete.');
        }
        );
    }

    // Header for URL validation section
    getValidationHeader(): string {
        const count = this.validationState.urls.length;
        let baseKey: string;
        if (this.validationState.isValidated) {
            baseKey = 'addPages.validated';
        } else if (this.validationState.isValidating) {
            baseKey = 'addPages.validating';
        }
        else {
            baseKey = 'addPages.validating'; // fallback
        }
        const key = count === 1 ? baseKey : `${baseKey}.plural`;
        return this.translate.instant(key, { count });
    }

    // Headers for link lists
    getStatusText(status: 'valid' | 'broken' | 'redirect' | 'blocked' | 'duplicate', type: 'heading' | 'description'): string {
        const countMap = {
            'valid': this.urlsOk.length,
            'broken': this.urlsBad.length,
            'redirect': this.urlsRedirected.length,
            'blocked': this.urlsBlocked.length,
            'duplicate': this.duplicatesSkipped.length
        };
        const count = countMap[status];
        const key = count === 1
            ? `addPages.${status}.${type}`
            : `addPages.${status}.${type}.plural`;
        return this.translate.instant(key);
    }

    // Add pages button
    getAddPagesButtonLabel(): string {
        const count = this.urlsOk.length;
        const baseKey = 'addPages.addPagesButton';
        const key = count === 1 ? baseKey : `${baseKey}.plural`;
        return this.translate.instant(key, { count });
    }


    revalidateUrl(url: UrlItem): void { }
    removeUrl(url: UrlItem): void { }


    /**
   * Validate breadcrumbs and build tree context
   */
    async validateBreadcrumbs(): Promise<void> {
        this.showBreadcrumbDialog = true;

        this.addPagesState.setBreadcrumbState({
            isValidating: true,
            progress: 0,
            currentStep: 'Getting breadcrumbs',
        });

        try {
            // Step 1: Get all breadcrumbs (20%)
            const okUrls = this.urlsOk.map(u => ({
                production: { href: u.href, status: 'ok' as const }
            }));

            const allPages = await this.iaRelationship.getAllBreadcrumbs(okUrls);

            this.addPagesState.setBreadcrumbState({
                progress: 20,
                currentStep: 'Finding root pages',
            });
            await this.fetchService.simulateDelay(500);

            // Step 2: Find roots (40%)
            const rootPages = this.iaRelationship.getRoots(allPages);

            this.addPagesState.setBreadcrumbState({
                progress: 40,
                currentStep: 'Filtering breadcrumbs',
            });
            await this.fetchService.simulateDelay(500);

            // Step 3: Filter breadcrumbs (60%)
            let breadcrumbs = this.iaRelationship.filterBreadcrumbs(allPages);

            this.addPagesState.setBreadcrumbState({
                progress: 60,
                currentStep: 'Validating breadcrumbs',
            });

            // Step 4: Validate breadcrumbs (80%)
            breadcrumbs = await this.iaRelationship.validateBreadcrumbs(breadcrumbs);

            this.addPagesState.setBreadcrumbState({
                progress: 80,
                currentStep: 'Highlighting breadcrumbs',
            });
            await this.fetchService.simulateDelay(500);

            // Step 5: Highlight breadcrumbs (90%)
            const { breadcrumbs: highlighted } = this.iaRelationship.highlightBreadcrumbs(
                breadcrumbs,
                rootPages
            );

            this.addPagesState.setBreadcrumbData(highlighted);

            this.addPagesState.setBreadcrumbState({
                progress: 95,
                currentStep: 'Building tree context',
            });

            // Step 6: Build tree context and merge into project (100%)
            await this.buildTreeContextAndMerge(highlighted);

            this.addPagesState.setBreadcrumbState({
                progress: 100,
                currentStep: 'Complete',
                isComplete: true,
                isValidating: false,
            });

            // Emit completion
            this.completed.emit(true);

        } catch (error) {
            console.error('Error validating breadcrumbs:', error);
            this.addPagesState.setBreadcrumbState({
                isValidating: false,
                currentStep: 'Error occurred',
            });
        }
    }

    /**
     * Build tree context from breadcrumbs and merge into project
     */
    private async buildTreeContextAndMerge(breadcrumbs: any[]): Promise<void> {
        // Save current project data for undo
        const currentProjectData = this.projectState.getProjectTree();
        this.addPagesState.setPreviousProjectData(
            JSON.parse(JSON.stringify(currentProjectData)) // deep copy
        );

        // Build tree context from breadcrumbs
        const newNodes: TreeNode[] = [];
        await this.iaTree.setTreeContext(newNodes, breadcrumbs);

        // Merge new nodes into existing project data
        const mergedData = this.mergeTreeNodes(currentProjectData, newNodes);

        // Update project state
        //this.projectState.setProjectData(mergedData);
        //this.projectState.saveProject();
    }

    /**
     * Merge new tree nodes into existing project data
     */
    private mergeTreeNodes(existing: TreeNode[], newNodes: TreeNode[]): TreeNode[] {
        const map = new Map<string, TreeNode>();

        // Add existing nodes to map
        for (const node of existing) {
            if (node.data?.url) {
                map.set(node.data.url, node);
            }
        }

        // Add or merge new nodes
        for (const node of newNodes) {
            const url = node.data?.url;
            if (!url) continue;

            if (!map.has(url)) {
                map.set(url, node);
            } else {
                const existingNode = map.get(url)!;
                // Merge children if both have them
                if (node.children?.length && existingNode.children?.length) {
                    existingNode.children = this.mergeTreeNodes(existingNode.children, node.children);
                } else if (node.children?.length) {
                    existingNode.children = node.children;
                }
                // Update user-added flag
                if (node.data?.isUserAdded) {
                    existingNode.data.isUserAdded = true;
                }
            }
        }

        return Array.from(map.values());
    }

    /**
     * Undo last addition
     */
    undoLastAddition(): void {
        const previous = this.addPagesState.getPreviousProjectData();
        if (previous) {
            //this.projectState.setProjectData(previous);
            //this.projectState.saveProject();
            this.addPagesState.setPreviousProjectData(null);
        }
    }

    /**
     * Close breadcrumb dialog
     */
    closeBreadcrumbDialog(): void {
        this.showBreadcrumbDialog = false;
    }

    /**
     * Reset component state
     */
    reset(): void {
        this.addPagesState.resetAll();
        this.duplicatesSkipped = [];
        this.showBreadcrumbDialog = false;
    }
}