import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG modules
import { InputNumberModule } from 'primeng/inputnumber';
import { IftaLabelModule } from 'primeng/iftalabel';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { CheckboxModule } from 'primeng/checkbox';

// Services
import { ProjectStateService } from '../../../services/project-state.service';
import { FetchService } from '../../../services/fetch.service';
import { GetChildPagesService } from './get-child-pages.service';
import { BreadcrumbNode } from '../../add-pages/add-pages.model';
import { AddPagesStateService } from '../../add-pages/services/add-pages-state.service';

interface PageToAdd {
    url: string;
    depthFromInScope: number;
}

interface CachedPage {
    url: string;
    breadcrumbs: BreadcrumbNode[];
}

@Component({
    selector: 'aida-get-child-pages',
    standalone: true,
    imports: [
        CommonModule, FormsModule, TranslateModule,
        InputNumberModule, IftaLabelModule, ButtonModule, ProgressBarModule, CheckboxModule
    ],
    templateUrl: './get-child-pages.component.html',
    styles: ``
})
export class GetChildPagesComponent {
    // Services    
    private projectState = inject(ProjectStateService);
    private addPagesState = inject(AddPagesStateService);
    private fetchService = inject(FetchService);
    public getChildPagesService = inject(GetChildPagesService);

    childUrls = signal<{ url: string; selected: boolean }[]>([]);

    // Count selected child urls
    selectedChildUrlsCount = computed(() =>
        this.childUrls().filter(child => child.selected).length
    );

    // Toggle selection
    toggleChildUrl(index: number, selected: boolean) {
        this.childUrls.update(urls => {
            const updated = [...urls];
            updated[index] = { ...updated[index], selected };
            return updated;
        });
    }

    async findChildPages() {
        const depth = this.getChildPagesService.depth;
        if (depth < 1) return;

        // Get in-scope URLs
        const inScopeUrls = this.projectState.getAllUrls("inScope", "primary");

        // Get child pages up to specified depth
        const childPages = await this.getChildPagesService.findChildren(inScopeUrls, depth);

        // Display results
        this.childUrls.set(childPages.map(url => ({ url, selected: true })));
    }

    // Add to project
    addUrlsToProject() {
        const selectedUrls = this.childUrls()
            .filter(item => item.selected)
            .map(item => item.url)

        // Add to "Add pages" input for user to review
        this.addPagesState.setValidationState({
            rawUrls: selectedUrls.join('\n'),
            urls: selectedUrls.map(url => ({ href: url, status: 'ok' })),
            urlTotal: selectedUrls.length,
            urlChecked: selectedUrls.length,
            urlPercent: 100,
            isValidating: false,
            isValidated: true,
            isOk: true,
        });
        this.childUrls.set([]);
    }
}