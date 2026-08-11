import { Component, inject, input, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from "@ngx-translate/core";

//PrimeNG
import { SelectButtonModule } from 'primeng/selectbutton';

//Services
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectCacheService } from '../../services/project-cache.service';

@Component({
    selector: 'aida-project-settings',
    imports: [TranslatePipe, FormsModule,
        SelectButtonModule,
    ],
    templateUrl: './project-settings.component.html',
    styles: ``
})
export class ProjectSettingsComponent {
    public projectCache = inject(ProjectCacheService);
    private projectState = inject(ProjectStateService);
    private translate = inject(TranslateService);

    showLang = input(false);
    allowBoth = input(false);

    showScope = input(false);

    showVersion = input(false);
    allowLive = input(false);
    isPrototype = input(false);

    showSource = input(false);
    allowPreview = input(false);
    onlyValid = input(false);

    showViewIA = input(false);

    showDisplay = input(false);

    constructor() {
        effect(() => {
            if (!this.allowBoth() && this.projectCache.selectedLang() === 'both') {
                this.projectCache.selectedLang.set(this.projectState.detectPrimaryLanguage()); // fallback to project default
            }
        });
        effect(() => {
            if (!this.allowLive() && this.projectCache.selectedVersion() === 'live') {
                this.projectCache.selectedVersion.set('prototype'); // fallback to prototype if live was selected and not available
            }
        });
        effect(() => {
            const isPrototype = this.isPrototype();
            if (isPrototype) {
                this.projectCache.selectedVersion.set('prototype'); // fallback to prototype when it's the only option
            }
        });
        effect(() => {
            if (!this.allowPreview() && this.projectCache.selectedSource() === 'preview') {
                this.projectCache.selectedSource.set('live'); // fallback to live if preview was selected and not available
            }
        });
        effect(() => {
            const validValues = this.sourceOptions.map(opt => opt.value);
            if (!validValues.includes(this.projectCache.selectedSource())) {
                this.projectCache.selectedSource.set('live');
            }
        });
    }

    //Choose language
    get languageOptions() {
        const options: { label: string, value: string }[] = []
        const primaryLang = this.projectState.detectPrimaryLanguage();
        const enLabel = { label: this.translate.instant('common.language.english'), value: 'en' }
        const frLabel = { label: this.translate.instant('common.language.french'), value: 'fr' }
        const bothLabel = { label: this.translate.instant('common.both'), value: 'both' }
        if (primaryLang === 'en') { options.push(enLabel, frLabel) }
        else { options.push(frLabel, enLabel) }
        if (this.allowBoth()) { options.push(bothLabel) }
        return options
    }

    //Choose scope
    get scopeOptions() {
        return [
            { label: this.translate.instant('common.scope.inScope'), value: 'inScope' },
            { label: this.translate.instant('common.scope.all'), value: 'all' }
        ]
    }

    //Choose version (for AIDA data storage)
    get versionOptions() {
        if (this.allowLive()) {
            return [
                { label: this.translate.instant('common.version.prototype'), value: 'prototype' },
                { label: this.translate.instant('common.version.live'), value: 'live' },
                { label: this.translate.instant('common.version.baseline'), value: 'baseline' }
            ]
        } else {
            return [
                { label: this.translate.instant('common.version.prototype'), value: 'prototype' },
                { label: this.translate.instant('common.version.baseline'), value: 'baseline' }
            ]
        }
    }

    //Choose source (for external data storage)
    get sourceOptions() {
        const options = [{ label: this.translate.instant('common.source.canada'), value: 'live' }];
        if (this.projectCache.hasGitHub() || !this.onlyValid()) {
            options.push({ label: this.translate.instant('common.source.protoGH'), value: 'protoGH' })
        }
        if (this.projectCache.hasLocal() || !this.onlyValid()) {
            options.push({ label: this.translate.instant('common.source.protoUT'), value: 'protoUT' })
        }
        if (this.projectState.getProject().github.hasBaselineRepo) {
            if (this.projectCache.hasGitHubBL() || !this.onlyValid()) {
                options.push({ label: this.translate.instant('common.source.baseGH'), value: 'baseGH' })
            }
            if (this.projectCache.hasLocalBL() || !this.onlyValid()) {
                options.push({ label: this.translate.instant('common.source.baseUT'), value: 'baseUT' })
            }
        }
        if (this.allowPreview()) {
            options.push(
                { label: this.translate.instant('common.source.preview'), value: 'preview' }
            );
        }
        return options
    }

    get urlVersionOptions() {
        const options = [
            { label: this.translate.instant('common.version.canada'), value: 'live' },
            { label: this.translate.instant('common.version.prototype.github'), value: 'protoGH' },
            { label: this.translate.instant('common.version.prototype.local'), value: 'protoUT' }];
        if (this.projectState.getProject().github.hasBaselineRepo) {
            options.push(
                { label: this.translate.instant('common.version.baseline.github'), value: 'baseGH' },
                { label: this.translate.instant('common.version.baseline.local'), value: 'baseUT' }
            )
        }
        return options;
    }

    //Choose view (for IA diagram)
    get viewIAOptions() {
        return [
            { label: this.translate.instant('common.view.baseline'), value: 'baseline' },
            { label: this.translate.instant('common.view.changes'), value: 'changes' },
            { label: this.translate.instant('common.view.final'), value: 'final' }
        ]
    }

    //Choose display (for IA diagram)
    get displayOptions() {
        return [
            { label: this.translate.instant('common.display.url'), value: 'url' },
            { label: this.translate.instant('common.display.title'), value: 'title' },
        ]
    }

}