import { Component, inject, computed, ViewChild, TemplateRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';



//PrimeNG
import { TabsModule } from 'primeng/tabs';
import { BadgeModule } from 'primeng/badge';
import { CheckboxModule } from 'primeng/checkbox';
import { ButtonModule } from 'primeng/button';
import { IftaLabelModule } from 'primeng/iftalabel';
import { SelectModule } from 'primeng/select';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { TreeNode } from 'primeng/api';
import { MessageModule } from 'primeng/message';

//Custom
import { AddUrlsService } from '../add-urls.service';
import { ProjectStateService } from '../../../services/project-state.service';
import { EditNodeComponent } from '../../edit-node/edit-node.component';
import { FetchService } from '../../../services/fetch.service';


@Component({
    selector: 'aida-invalid-urls',
    imports: [
        CommonModule, FormsModule, TranslatePipe,
        TabsModule, BadgeModule, CheckboxModule, ButtonModule, IftaLabelModule, SelectModule, DialogModule, TooltipModule, MessageModule,
        EditNodeComponent
    ],
    templateUrl: './invalid-urls.component.html',
    styles: ``
})
export class InvalidUrlsComponent {
    private addUrlsService = inject(AddUrlsService);
    private projectState = inject(ProjectStateService);
    private translate = inject(TranslateService);
    private fetchService = inject(FetchService);

    urlsBroken = computed(() => this.addUrlsService.urlState().urlsToReview.filter(url => url.status === "bad"));
    urlsRedirect = computed(() => this.addUrlsService.urlState().urlsToReview.filter(url => url.status === "redirect"));
    urlsBlocked = computed(() => this.addUrlsService.urlState().urlsToReview.filter(url => url.status === "blocked"));

    urlsNew = computed(() => this.addUrlsService.urlState().urlsToReview.filter(url => url.status === "new"));

    tabs = computed(() => [
        { value: '0', status: 'broken', label: 'invalidUrls.broken.header', items: this.urlsBroken() },
        { value: '1', status: 'redirect', label: 'invalidUrls.redirect.header', items: this.urlsRedirect() },
        { value: '2', status: 'blocked', label: 'invalidUrls.blocked.header', items: this.urlsBlocked() },
    ].filter(tab => tab.status === 'broken'
        ? (tab.items.length > 0 || this.urlsNew().length > 0)
        : tab.items.length > 0
    ));

    initialTab = computed(() => this.tabs()[0]?.value ?? '0');

    //Template references
    @ViewChild('broken', { static: true }) brokenTemplate!: TemplateRef<unknown>;
    @ViewChild('redirect', { static: true }) redirectTemplate!: TemplateRef<unknown>;
    @ViewChild('blocked', { static: true }) blockedTemplate!: TemplateRef<unknown>;

    get outlets(): Record<string, TemplateRef<unknown>> {
        return {
            broken: this.brokenTemplate,
            redirect: this.redirectTemplate,
            blocked: this.blockedTemplate,
        };
    }

    selectedBrokenUrls = signal<string[]>([]);
    isSelected(href: string): boolean {
        return this.selectedBrokenUrls().includes(href);
    }
    toggleBrokenUrl(href: string, selected: boolean) {
        this.selectedBrokenUrls.update(current =>
            selected ? [...current, href] : current.filter(h => h !== href)
        );
    }



    protected readonly parentPages = computed(() =>
        this.projectState.getAllPages(this.projectState.detectPrimaryLanguage(), 'live', 'all')
    );
    selectedParent?: string;

    addUrlsToProject() {
        console.log("ADDING!")
        console.log('Selected URLs: ', this.selectedBrokenUrls());
        console.log('Selected Parent: ', this.selectedParent);
        if (!this.selectedParent) return;
        const parentNode = this.projectState.findNodeByPath(this.projectState.getProjectTree(), this.selectedParent, this.projectState.detectPrimaryLanguage());
        console.log('Parent: ', parentNode);
        if (!parentNode) return;
        for (const url of this.selectedBrokenUrls()) {
            console.log('URL: ', url);
            this.projectState.createNode(parentNode, url);
        }
        this.addUrlsService.updateReviewStatus(this.selectedBrokenUrls(), "new");
        this.selectedBrokenUrls.set([]);
        const newestUrl = this.urlsNew().at(-1)?.href;
        if (newestUrl) this.edit(newestUrl);
    }

    currentLang = this.translate.currentLang() === 'fr' ? 'fr' : 'en'
    editNode = false; // Tracks if currently making dialog edits
    selectedNode: TreeNode = {}; // TreeNode data for edit node dialog
    edit(url: string) {
        const path = this.fetchService.generatePath(url);
        const lang = this.fetchService.getLang(url) ?? 'en';
        this.selectedNode = this.projectState.findNodeByPath(this.projectState.getProjectTree(), path, lang) ?? {};
        this.editNode = true;
    }

    async copyToClipboard(url: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(url);
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
        }
    }
}