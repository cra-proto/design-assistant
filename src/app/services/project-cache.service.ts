import { Injectable, signal, inject } from '@angular/core';

//Services
import { ProjectStateService } from './project-state.service';
import { FetchService, urlVersion } from './fetch.service';

/*
 * Use this service to cache temporary variables related to the active project
 */
@Injectable({ providedIn: 'root' })
export class ProjectCacheService {
    private projectState = inject(ProjectStateService);
    private fetchService = inject(FetchService)

    // Track availability of local and github versions (for managing UI state)

    /** Signal will be true if prototype github repo exists (updatable via effect) */
    public hasGitHub = signal<boolean>(false);
    /** Signal will be true if baseline github repo exists (updatable via effect) */
    public hasGitHubBL = signal<boolean>(false);
    /** Signal will be true if local index page is fetchable (updatable via user action only) */
    public hasLocal = signal<boolean | null>(null);
    /** Signal will be true if local baseline index page is fetchable (updatable via user action only) */
    public hasLocalBL = signal<boolean | null>(null);
    /** Signal will be true if AEM preview is fetchable (updatable via user action only) */
    public hasPreview = signal<boolean | null>(null);

    private localCheckInProgress = false;
    private previewCheckInProgress = false;

    // Track user choices on select buttons (for managing UI state)

    /** Signal defaults to project language if 'both' is not a valid option */
    public selectedLang = signal<'en' | 'fr' | 'both'>(this.projectState.detectPrimaryLanguage());

    /** Signal can be used to display all project pages or just the inScope pages */
    public selectedScope = signal<'inScope' | 'all'>('inScope');

    /** Signal can be used to access specific versions stored in AIDA. Defaults to prototype. */
    public selectedVersion = signal<'prototype' | 'live' | 'baseline'>('prototype');

    /** Signal can be used to access specific versions stored outside of AIDA. Defaults to live. */
    public selectedSource = signal<urlVersion>('live');

    /** Signal for the IA diagram view. Defaults to changes. */
    public selectedViewIA = signal<'baseline' | 'changes' | 'final'>('changes');

    /**
    * Checks if a local index page exists for the project so UI can be updated
    ** Updates signals {@link hasLocal} and {@link hasLocalBL}
    *
    * Call this fxn when navigating to any route that adjusts UI based on available local versions 
    *
    * Use {@link checkPreviewStatus} for AEM preview and an effect for GitHub versions
    */
    public checkLocalStatus(): void {
        if (this.localCheckInProgress) return;
        if (this.hasLocal() !== null) return;
        const owner = this.projectState.getProject().github.owner;
        const repo = this.projectState.getProject().github.repo;
        if (!owner || !repo) return;
        this.localCheckInProgress = true;
        const url = this.fetchService.generateUrl("index.html", "protoUT", owner, repo);
        const checks: Promise<void>[] = [
            this.fetchService.fetchStatusViaProxy(url).then(result => this.hasLocal.set(result))
        ];
        if (this.projectState.getProject().github.hasBaselineRepo) {
            const urlBL = this.fetchService.generateUrl("index.html", "baseUT", owner, repo);
            checks.push(
                this.fetchService.fetchStatusViaProxy(urlBL).then(result => this.hasLocalBL.set(result))
            );
        }
        Promise.all(checks).finally(() => { this.localCheckInProgress = false; });
    }

    /**
    * Checks if preview proxy page exists for the project so UI can be updated
    ** Updates signal {@link hasPreview}
    *
    * Call this fxn when navigating to any route that adjusts UI based on availability of preview versions 
    *
    * Use {@link checkLocalStatus} for local versions, an effect for GitHub versions, and statusCache for individual pages
    */
    public checkPreviewStatus(): void {
        if (this.previewCheckInProgress) return;
        if (this.hasPreview() !== null) return;
        this.previewCheckInProgress = true;
        const url = this.fetchService.generateUrl("", "preview");
        const checks: Promise<void>[] = [
            this.fetchService.fetchStatusViaProxy(url).then(result => this.hasPreview.set(result))
        ];
        Promise.all(checks).finally(() => { this.previewCheckInProgress = false; });
    }

    //TODO: move statusCache from compare.service.ts to here (it has status's mapped to different versions of project URLs)
}