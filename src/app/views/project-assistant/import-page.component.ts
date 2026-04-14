import { Component, OnInit, inject } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { RouterModule, ActivatedRoute, Router } from '@angular/router';

import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { ProjectStorageService } from '../../services/storage/project-storage.service';
import { AddPagesStateService } from '../../components/add-pages/services/add-pages-state.service';
import { ProjectStateService } from '../../services/project-state.service';
import { marker } from '@colsen1991/ngx-translate-extract-marker';

@Component({
    selector: 'aida-import-page',
    imports: [TranslateModule, RouterModule, ProgressSpinnerModule],
    templateUrl: 'import-page.component.html',
    styles: ``
})
export class ImportPageComponent implements OnInit {
    router = inject(Router);
    route = inject(ActivatedRoute);
    private projectState = inject(ProjectStateService);
    private projectStorageService = inject(ProjectStorageService);
    addPagesState = inject(AddPagesStateService);

    isLoading = false;

    markForTranslation() {
        marker('importPage._title');
    }

    async ngOnInit(): Promise<void> {
        this.isLoading = true;

        try {
            this.route.queryParams.subscribe(params => {
                const url = params['url']?.trim();
                const title = params['title']?.replaceAll("- Canada.ca", "").trim();

                // Check if params exist
                if (!url) {
                    console.warn("Missing URL parameter. Redirecting to new project.");
                    this.router.navigate(['/new-project']);
                    return;
                }

                try {
                    const parsedUrl = new URL(url);
                    if (parsedUrl.hostname === 'canada.ca' || parsedUrl.hostname === 'www.canada.ca') {
                        //Add to "Add pages" input
                        this.addPagesState.setValidationState({
                            rawUrls: parsedUrl.href,
                        });
                        //Set project name if unnamed
                        if (title && !this.projectState.getProject().projectName) {
                            this.projectState.setProjectName(title);
                        }
                        //Set highlight signal
                        this.addPagesState.setHighlight(true);
                        this.router.navigate(['/new-project']);
                        return;
                    }
                    else {
                        const active = this.projectStorageService.getActiveProject();
                        if (active) {
                            console.warn("Invalid URL domain. Skipping new project creation and redirecting user to dashboard for previously opened project.")
                            this.router.navigate(['/dashboard']);
                            return;
                        }
                        else {
                            console.warn("Invalid URL domain. Redirecting user to create a new project.")
                            this.router.navigate(['/new-project']);
                            return;
                        }
                    }
                }
                catch (urlError) {
                    // Invalid URL format
                    console.warn(`Invalid URL format. Redirecting user. ${urlError}`);
                    this.router.navigate(['/dashboard']);
                    return;
                }
            });
        }
        catch (error) {
            console.error(error);
            this.router.navigate(['/new-project']);
            return;
        }
        finally { this.isLoading = false; }
    }
}
