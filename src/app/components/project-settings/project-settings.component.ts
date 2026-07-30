import { Component, inject, input, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from "@ngx-translate/core";

//PrimeNG
import { SelectButtonModule } from 'primeng/selectbutton';

//Services
import { ProjectStateService } from '../../services/project-state.service';
import { ProjectCacheService } from '../../services/project-cache.service';

@Component({
    selector: 'aida-project-settings',
    imports: [TranslateModule, FormsModule,
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

    showViewIA = input(false);

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
    }

    //Choose language
    get languageOptions() {
        const primaryLang = this.projectState.detectPrimaryLanguage();
        const enLabel = { label: this.translate.instant('common.language.english'), value: 'en' }
        const frLabel = { label: this.translate.instant('common.language.french'), value: 'fr' }
        const bothLabel = { label: this.translate.instant('common.both'), value: 'both' }
        if (primaryLang === 'en') { return [enLabel, frLabel, bothLabel] }
        else { return [frLabel, enLabel, bothLabel] }
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
        const options: { label: string, value: string }[] = []
        //TODO: Adjust options based on cached availability
        options.push(
            { label: this.translate.instant('common.source.canada'), value: 'live' },
            { label: this.translate.instant('common.source.protoGH'), value: 'protoGH' },
            { label: this.translate.instant('common.source.protoUT'), value: 'protoUT' }
        );
        if (this.projectState.getProject().github.hasBaselineRepo) {
            options.push(
                { label: this.translate.instant('common.source.baseGH'), value: 'baseGH' },
                { label: this.translate.instant('common.source.baseUT'), value: 'baseUT' }
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


}