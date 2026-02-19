import { Component, inject, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

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
import { PopoverModule } from 'primeng/popover';
import { AutoCompleteModule, AutoCompleteCompleteEvent, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { TagModule } from 'primeng/tag';

// Services
import { AddPagesStateService } from './services/add-pages-state.service';
import { UrlValidationService } from './services/url-validation.service';
import { BreadcrumbValidationService } from './services/breadcrumb-validation.service';
//import { IaRelationshipService } from '../../views/ia-assistant/services/ia-relationship.service';
//import { IaTreeService } from '../../views/ia-assistant/services/ia-tree.service';
import { ProjectStateService } from '../../services/project-state.service';
import { FetchService } from '../../services/fetch.service';
import { TreeNodeStyleService } from '../../services/treenode-style.service';

// Models
import { UrlItem } from './add-pages.model';
import { TreeNode } from 'primeng/api';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'aida-add-pages',
    imports: [
        CommonModule, FormsModule, TranslateModule,
        TextareaModule, IftaLabelModule, ButtonModule,
        InputTextModule, InputGroupModule, InputGroupAddonModule, ConfirmPopupModule,
        ProgressBarModule, DialogModule, ChipModule, TooltipModule, MessageModule,
        PopoverModule, AutoCompleteModule, TagModule,
    ],
    templateUrl: './add-pages.component.html',
    styles: ``
})
export class AddPagesComponent implements OnInit {
    // Services    
    projectState = inject(ProjectStateService);
    addPagesState = inject(AddPagesStateService);
    urlValidation = inject(UrlValidationService);
    breadcrumbValidation = inject(BreadcrumbValidationService);

    nodeStyles = inject(TreeNodeStyleService)

    translate = inject(TranslateService);

    //iaRelationship = inject(IaRelationshipService);
    //iaTree = inject(IaTreeService);

    fetchService = inject(FetchService);
    confirmationService = inject(ConfirmationService);

    // Output event
    @Output() completed = new EventEmitter<boolean>();

    // UI state
    production = environment.production;
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

    // Translations
    markForTranslation() {
        marker('addPages.duplicatesSkipped');
        marker('addPages.duplicatesSkipped.plural');
        marker('addPages.validated');
        marker('addPages.validated.plural');
        marker('addPages.validating');
        marker('addPages.validating.plural');
        marker('addPages.valid.heading');
        marker('addPages.valid.heading.plural');
        marker('addPages.valid.description');
        marker('addPages.valid.description.plural');
        marker('addPages.broken.heading');
        marker('addPages.broken.heading.plural');
        marker('addPages.broken.description');
        marker('addPages.broken.description.plural');
        marker('addPages.redirect.heading');
        marker('addPages.redirect.heading.plural');
        marker('addPages.redirect.description');
        marker('addPages.redirect.description.plural');
        marker('addPages.blocked.heading');
        marker('addPages.blocked.heading.plural');
        marker('addPages.blocked.description');
        marker('addPages.blocked.description.plural');
        marker('addPages.duplicate.heading');
        marker('addPages.duplicate.heading.plural');
        marker('addPages.duplicate.description');
        marker('addPages.duplicate.description.plural');
        marker('addPages.addPagesButton');
        marker('addPages.addPagesButton.plural');
    }

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
        //console.log('Parsed URLs for validation:', parsedUrls);
        //console.log('Duplicates skipped:', duplicates);
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
        this.parseUrls();
        this.addPagesState.resetBreadcrumbs();
        this.addPagesState.setValidationState({
            isValidating: true,
            isValidated: false,
        });
        //console.log('Starting URL validation...');
        this.urlValidation.validateUrls(this.validationState.urls, (checked, total) => {
            const percent = Math.round((checked / total) * 100);
            this.addPagesState.setValidationState({
                urlChecked: checked,
                urlPercent: percent,
            });
            //console.log(`Validated ${checked} of ${total} URLs (${percent}%)`);
        }).then(() => {
            this.addPagesState.setValidationState({
                isValidating: false,
                isValidated: true,
                isOk: this.validationState.urls.every(u => u.status === 'ok')
            });
            //console.log('URL validation complete.');
            if (this.validationState.isOk) { this.validateBreadcrumbs(); }
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

    // Remove invalid URL
    removeUrl(link: UrlItem): void {
        this.validationState.urls = this.validationState.urls.filter(u => u !== link);
        this.validationState.urlTotal -= 1;
        this.validationState.urlChecked -= 1;
        this.validationState.urlPercent = this.validationState.urlTotal > 0
            ? (this.validationState.urlChecked / this.validationState.urlTotal) * 100
            : 0;
        this.validationState.isOk = this.validationState.urls.every(url => url.status === 'ok');
    }

    // Revalidate URL
    async revalidateUrl(event: Event, link: UrlItem): Promise<void> {
        link.href = link.href.trim().toLowerCase();

        // Check for duplicates in existing project or current validation
        const existingUrls = this.projectState.getAllUrls();
        const currentUrls = this.validationState.urls
            .filter(u => u !== link) // Exclude this specific link object
            .map(u => u.href);
        const allUrls = new Set([...existingUrls, ...currentUrls]);
        if (allUrls.has(link.href)) {
            this.confirmDuplicate(event, link);
            return;
        }

        // Reset status and revalidate
        link.status = 'checking';
        try {
            //update progress
            this.addPagesState.setValidationState({
                urlChecked: --this.validationState.urlChecked,
                urlPercent: Math.round((this.validationState.urlChecked / this.validationState.urlTotal) * 100),
                isValidating: true,
                isValidated: false
            });
            //recheck link
            await this.urlValidation.validateUrl(link);
            //update progress
            this.addPagesState.setValidationState({
                urlChecked: ++this.validationState.urlChecked,
                urlPercent: Math.round((this.validationState.urlChecked / this.validationState.urlTotal) * 100),
                isValidating: false,
                isValidated: true,
                isOk: this.validationState.urls.every(u => u.status === 'ok')
            });
        } catch (error) {
            console.error('Revalidation failed:', error);
        }
    }

    // Popup message for revalidation of duplicate links
    confirmDuplicate(event: Event, link: UrlItem) {
        this.confirmationService.confirm({
            target: event.target as EventTarget,
            message: this.translate.instant('addPages.duplicate.message'),
            icon: 'pi pi-exclamation-triangle text-orange-500',
            defaultFocus: 'accept',
            closeOnEscape: true,
            rejectButtonProps: {
                label: this.translate.instant('common.cancel'),
                severity: 'secondary',
                outlined: true
            },
            acceptButtonProps: {
                label: this.translate.instant('common.yes'),
                severity: 'danger'
            },
            accept: () => {
                this.duplicatesSkipped.push(link.href);
                this.removeUrl(link);
            },
            reject: () => {
                console.log("Cancel adding duplicate link");
            }
        });
    }

    //Confirmation before validating breadcrumbs (if not all urls are valid)
    onAddPages(event: Event) {
        if (!this.validationState.isOk) {
            this.confirmationService.confirm({
                target: event.target as EventTarget,
                message: this.translate.instant('addPages.proceedAnyway.message'),
                header: this.translate.instant('addPages.proceedAnyway.header'),
                icon: 'pi pi-exclamation-triangle',
                acceptButtonStyleClass: 'p-button-primary',
                rejectButtonStyleClass: 'p-button-secondary',
                accept: () => {
                    this.validateBreadcrumbs();
                }
            });
        } else {
            this.validateBreadcrumbs();
        }
    }

    //Validate breadcrumb
    breadcrumbData = this.addPagesState.getBreadcrumbData();
    async validateBreadcrumbs(): Promise<void> {
        this.addPagesState.resetBreadcrumbs();
        this.showBreadcrumbDialog = true;

        try {
            // Step 1: Get all breadcrumbs
            this.addPagesState.setBreadcrumbState({
                isValidating: true,
                progress: 20,
                currentStep: this.translate.instant('addPages.breadcrumb.step1'),
            });
            console.time("getAllBreadcrumbs");
            //const urls = this.validationState.urls
            const urls = this.urlsOk;
            const allPages = await this.breadcrumbValidation.getAllBreadcrumbs(urls);
            console.timeEnd("getAllBreadcrumbs");

            // Step 2: Filter breadcrumbs
            this.addPagesState.setBreadcrumbState({
                progress: 50,
                currentStep: this.translate.instant('addPages.breadcrumb.step2'),
            });
            await this.fetchService.simulateDelay(500);
            console.time("filterBreadcrumbs");
            this.breadcrumbData = this.breadcrumbValidation.filterBreadcrumbs(allPages);
            console.timeEnd("filterBreadcrumbs");

            //Step 3: Validate breadcrumbs
            this.addPagesState.setBreadcrumbState({
                progress: 60,
                currentStep: this.translate.instant('addPages.breadcrumb.step3'),
            });
            console.time("validateBreadcrumbs");
            this.breadcrumbData = await this.breadcrumbValidation.validateBreadcrumbs(this.breadcrumbData);
            console.timeEnd("validateBreadcrumbs");

            //Step 4: Build tree context and merge into project
            this.addPagesState.setBreadcrumbState({
                progress: 90,
                currentStep: this.translate.instant('addPages.breadcrumb.step4'),
            });
            console.time("buildTreeContextAndMerge");
            const treeNodes = this.projectState.getProjectTree();
            this.addPagesState.setPreviousProjectData(treeNodes);
            const updatedTree = await this.breadcrumbValidation.setTreeContext(treeNodes, this.breadcrumbData);
            this.projectState.setProjectTree(updatedTree);
            this.projectState.setScope(this.duplicatesSkipped); //mark any urls we skipped as in-scope
            this.nodeStyles.updateNodeStyles(updatedTree);
            this.projectState.saveProject();
            console.log("Page count")
            console.log(this.projectState.getProject().inScopePages)
            console.timeEnd("buildTreeContextAndMerge");

            //Step 5: Emit completion
            this.addPagesState.setBreadcrumbState({
                progress: 100,
                currentStep: this.translate.instant('common.complete'),
                isValidating: false,
                isValidated: true,
            });
            this.completed.emit(true);
            this.reset();

        } catch (error) {
            console.error('Error validating breadcrumbs:', error);
            this.addPagesState.setBreadcrumbState({
                isValidating: false,
                currentStep: this.translate.instant('common.error'),
            });
        }
    }

    //Reset add pages form
    reset(): void {
        this.addPagesState.resetValidation();
        this.showBreadcrumbDialog = false;
        this.addPagesState.resetBreadcrumbs();
        this.duplicatesSkipped = [];
    }

    //Undo add pages
    undoAddPages(): void {
        const previous = this.addPagesState.getPreviousProjectData();
        if (previous) {
            this.projectState.setProjectTree(previous);
            this.projectState.saveProject();
            this.addPagesState.setPreviousProjectData(null);
        }
    }

    //Add new pages (testing)
    addNewUrl(link: UrlItem) {
        //todo: select parent and set isNew to true
    }
    selectedBrokenUrl: UrlItem | null = null;
    selectedParentUrl: { label: string; url: string; inProject: boolean } | null = null;
    allParentOptions: { label: string; url: string; inProject: boolean }[] = [];
    filteredParentOptions: { label: string; url: string; inProject: boolean }[] = [];

    private extractParentUrl(fullUrl: string): string {
        const lastSlashIndex = fullUrl.lastIndexOf('/');
        if (lastSlashIndex === -1) return fullUrl;

        const basePath = fullUrl.substring(0, lastSlashIndex);
        return basePath + '.html';
    }

    openNewPagePopover(event: Event, link: UrlItem): void {
        this.selectedBrokenUrl = link;

        // Build all possible parent options
        const existingUrls = Array.from(this.projectState.getAllUrls()).map(url => ({
            label: url,
            url: url,
            inProject: true
        }));

        const validatingUrls = this.validationState.urls
            .filter(u => u.status === 'ok') // Only show valid URLs as potential parents
            .map(u => ({
                label: u.href,
                url: u.href,
                inProject: false
            }));

        this.allParentOptions = [...existingUrls, ...validatingUrls];
        this.filteredParentOptions = [...this.allParentOptions];

        // Pre-fill with suggested parent
        const suggestedParent = this.extractParentUrl(link.href);
        const matchingParent = this.allParentOptions.find(p => p.url === suggestedParent);

        this.selectedParentUrl = matchingParent ?? {
            label: suggestedParent,
            url: suggestedParent,
            inProject: false
        };
    }

    // Filter parent options based on user input
    filterParents(event: AutoCompleteCompleteEvent): void {
        const query = event.query.toLowerCase();
        this.filteredParentOptions = this.allParentOptions.filter(option =>
            option.label.toLowerCase().includes(query)
        );
    }

    // Handle parent selection
    onParentSelect(event: AutoCompleteSelectEvent): void {
        console.log('Selected parent:', this.selectedParentUrl);
        // Todo: Implement the merge logic
    }

    confirmParent = false;

    addChildNode(): void {
        if (!this.selectedBrokenUrl || !this.selectedParentUrl) {
            console.error('Missing broken URL or parent URL');
            return;
        }

        // Create the new TreeNode for the broken page
        const newNode: TreeNode = {
            label: 'New page',
            data: {
                h1: 'New page',
                url: this.selectedBrokenUrl.href,
                originalParent: this.selectedParentUrl.url,
                status: {
                    inScope: true,
                    isOrphan: true,
                    isCrawled: false,
                    isNew: true,
                    isMoved: false,
                    isROT: false,
                    isContainer: false
                }
            },
            children: []
        };

        // Find the parent node in the tree and add as child
        const parentNode = this.projectState.findNodeByUrl(
            this.projectState.getProjectTree(),
            this.selectedParentUrl.url
        );

        if (parentNode) {
            // Happy path: parent exists in tree
            parentNode.children ??= [];
            parentNode.children.push(newNode);
            parentNode.expanded = true;

            // Update the project
            this.projectState.saveProject();
            this.nodeStyles.updateNodeStyles(this.projectState.getProjectTree());

            // Remove from broken links list
            this.removeUrl(this.selectedBrokenUrl);

            console.log('Added new page as child of existing parent:', this.selectedParentUrl.url);
        } else {
            // Parent not in tree yet - we'll handle this later
            console.log('Parent not in tree, need to validate parent first');
            // TODO: Implement parent validation path
        }

        // Clean up and close popover
        this.selectedBrokenUrl = null;
        this.selectedParentUrl = null;
        this.confirmParent = false;
    }

    //Highlight the component (for users coming from import-pages)
    highlightAddPages = false;
    ngOnInit() {
        if (this.addPagesState.getHighlight()) {
            this.highlightAddPages = true;
            this.addPagesState.setHighlight(false); // Reset it
            setTimeout(() => this.highlightAddPages = false, 3000);
        }
    }
}