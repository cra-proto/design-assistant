import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

//PrimeNG
import { IftaLabelModule } from 'primeng/iftalabel';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { DialogModule } from 'primeng/dialog';

//Custom
import { ProjectStateService } from '../../services/project-state.service';
import { AddUrlsService } from './add-urls.service';
import { InvalidUrlsComponent } from './invalid-urls/invalid-urls.component';

@Component({
    selector: 'aida-add-urls',
    imports: [
        FormsModule, TranslatePipe,
        IftaLabelModule, TextareaModule, MessageModule, ButtonModule, ProgressBarModule, DialogModule,
        InvalidUrlsComponent
    ],
    templateUrl: './add-urls.component.html',
    styles: ``
})
export class AddUrlsComponent implements OnInit {
    private translate = inject(TranslateService)
    private projectState = inject(ProjectStateService)
    public addUrlsService = inject(AddUrlsService);

    // Skip duplicate, invalid, & opposite language URLs
    duplicatesSkipped: string[] = [];
    invalidUrlsSkipped: string[] = [];
    oppositeLangSkipped: string[] = [];

    // Parse URLs from textarea
    parseUrls(): void {
        const rawUrls = this.addUrlsService.urlState().rawUrls;
        const currentLang = this.translate.currentLang()?.startsWith('fr') ? 'fr' : 'en';
        const existingUrls = new Set(this.projectState.getAllPages(currentLang, "live", "all").map(u => u.url));
        const { parsedUrls, duplicates, invalidUrls, oppositeLangUrls } = this.addUrlsService.parseUrls(rawUrls, existingUrls, currentLang);

        console.log(parsedUrls);

        this.addUrlsService.urlState().rawUrls = [
            ...parsedUrls.map(item => item.href),
            ...duplicates,
            ...invalidUrls,
            ...oppositeLangUrls
        ].join('\n');

        this.duplicatesSkipped = duplicates;
        this.invalidUrlsSkipped = invalidUrls;
        this.oppositeLangSkipped = oppositeLangUrls;

        this.addUrlsService.setUrlState({
            urlsToValidate: parsedUrls,
            isValidating: false,
            isAdding: false,
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
        if (count === 1) return this.translate.instant('addPages.duplicatesSkipped', { count })
        else return this.translate.instant('addPages.duplicatesSkipped.plural', { count })
    }

    // Warning message for invalid URLs skipped
    getInvalidUrlMessage(): string {
        const count = this.invalidUrlsSkipped.length;
        if (count === 1) return this.translate.instant('addPages.invalidUrlsSkipped', { count })
        else return this.translate.instant('addPages.invalidUrlsSkipped.plural', { count })
    }

    // Warning message for opposite language URLs skipped
    getOppositeLangMessage(): string {
        const count = this.oppositeLangSkipped.length;
        if (count === 1) return this.translate.instant('addPages.oppositeLangSkipped', { count })
        else return this.translate.instant('addPages.oppositeLangSkipped.plural', { count })
    }

    //Undo add pages
    undoAddPages(): void {
        const previous = this.addUrlsService.getPreviousProjectData();
        if (previous) {
            this.projectState.setProjectTree(previous);
            this.projectState.saveProject();
            this.addUrlsService.setPreviousProjectData(null);
        }
    }

    //Highlight the component (for users coming from import-pages)
    highlightAddPages = false;
    ngOnInit() {
        if (this.addUrlsService.getHighlight()) {
            this.highlightAddPages = true;
            this.addUrlsService.setHighlight(false); // Reset it
            setTimeout(() => this.highlightAddPages = false, 3000);
        }
    }

    viewInvalidUrls = false;
}