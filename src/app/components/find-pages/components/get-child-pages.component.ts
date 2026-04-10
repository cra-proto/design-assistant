import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

// PrimeNG modules
import { InputNumberModule } from 'primeng/inputnumber';
import { IftaLabelModule } from 'primeng/iftalabel';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';

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
        InputNumberModule, IftaLabelModule, ButtonModule, ProgressBarModule
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

    async addChildPages() {
        const depth = this.getChildPagesService.depth;
        if (depth < 1) return;

        // Get in-scope URLs
        const inScopeUrls = this.projectState.getAllUrls("inScope", "primary");

        // Get child pages up to specified depth
        const childPages = await this.getChildPagesService.findChildren(inScopeUrls, depth);

        // Add to "Add pages" input for user to review
        this.addPagesState.setValidationState({
            rawUrls: childPages.join('\n'),
            urls: childPages.map(url => ({ href: url, status: 'ok' })),
            urlTotal: childPages.length,
            urlChecked: childPages.length,
            urlPercent: 100,
            isValidating: false,
            isValidated: true,
            isOk: true,
        });

    }
}