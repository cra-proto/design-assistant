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
import { GetChildPagesService } from './get-child-pages.service';
import { AddUrlsService } from '../../add-urls/add-urls.service';

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
    public getChildPagesService = inject(GetChildPagesService);
    private addUrlsService = inject(AddUrlsService);

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

        const lang = this.projectState.detectPrimaryLanguage();

        // Get in-scope URLs
        const inScopeUrls = new Set(this.projectState.getAllPages(lang, "live", "inScope").map(u => u.url));

        // Get child pages up to specified depth
        const childPages = await this.getChildPagesService.findChildren(inScopeUrls, depth);

        // Display results
        this.childUrls.set(childPages.map(url => ({ url, selected: true })));
    }

    // Add to project
    addUrlsToProject() {
        const selectedUrls = this.childUrls().filter(item => item.selected).map(item => item.url)
        this.addUrlsService.appendUrlsToInput(selectedUrls);
        // Clear selection after adding
        this.childUrls.set([]);
    }
}