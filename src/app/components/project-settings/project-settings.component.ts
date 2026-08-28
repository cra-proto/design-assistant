import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SelectButtonModule } from 'primeng/selectbutton';

import { ProjectCacheService } from '../../services/project-cache.service';
import { ProjectStateService } from '../../services/project-state.service';

@Component({
  selector: 'aida-project-settings',
  imports: [FormsModule, TranslatePipe, SelectButtonModule],
  templateUrl: './project-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectSettingsComponent {
  protected readonly projectCache = inject(ProjectCacheService);
  private readonly projectState = inject(ProjectStateService);
  private readonly translate = inject(TranslateService);

  public readonly showLang = input(false);
  public readonly allowBoth = input(false);

  public readonly showScope = input(false);

  public readonly showVersion = input(false);
  public readonly allowLive = input(false);
  public readonly isPrototype = input(false);

  public readonly showSource = input(false);
  public readonly allowPreview = input(false);
  public readonly onlyValid = input(false);

  public readonly showViewIA = input(false);

  public readonly showDisplay = input(false);

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
      const validValues = this.sourceOptions.map((opt) => opt.value);
      if (!validValues.includes(this.projectCache.selectedSource())) {
        this.projectCache.selectedSource.set('live');
      }
    });
  }

  //Choose language
  protected get languageOptions() {
    const options: { label: string; value: string }[] = [];
    const primaryLang = this.projectState.detectPrimaryLanguage();
    const enLabel = { label: this.translate.instant('common.language.english'), value: 'en' };
    const frLabel = { label: this.translate.instant('common.language.french'), value: 'fr' };
    const bothLabel = { label: this.translate.instant('common.both'), value: 'both' };
    if (primaryLang === 'en') {
      options.push(enLabel, frLabel);
    } else {
      options.push(frLabel, enLabel);
    }
    if (this.allowBoth()) {
      options.push(bothLabel);
    }
    return options;
  }

  //Choose scope
  protected get scopeOptions() {
    return [
      { label: this.translate.instant('common.scope.inScope'), value: 'inScope' },
      { label: this.translate.instant('common.scope.all'), value: 'all' },
    ];
  }

  //Choose version (for AIDA data storage)
  protected get versionOptions() {
    if (this.allowLive()) {
      return [
        { label: this.translate.instant('common.version.prototype'), value: 'prototype' },
        { label: this.translate.instant('common.version.live'), value: 'live' },
        { label: this.translate.instant('common.version.baseline'), value: 'baseline' },
      ];
    } else {
      return [
        { label: this.translate.instant('common.version.prototype'), value: 'prototype' },
        { label: this.translate.instant('common.version.baseline'), value: 'baseline' },
      ];
    }
  }

  //Choose source (for external data storage)
  protected get sourceOptions() {
    const options = [{ label: this.translate.instant('common.source.live'), value: 'live' }];
    if (this.projectCache.hasGitHub() || !this.onlyValid()) {
      options.push({ label: this.translate.instant('common.source.protoGH'), value: 'protoGH' });
    }
    if (this.projectCache.hasLocal() || !this.onlyValid()) {
      options.push({ label: this.translate.instant('common.source.protoUT'), value: 'protoUT' });
    }
    if (this.projectState.getProject().github.hasBaselineRepo) {
      if (this.projectCache.hasGitHubBL() || !this.onlyValid()) {
        options.push({ label: this.translate.instant('common.source.baseGH'), value: 'baseGH' });
      }
      if (this.projectCache.hasLocalBL() || !this.onlyValid()) {
        options.push({ label: this.translate.instant('common.source.baseUT'), value: 'baseUT' });
      }
    }
    if (this.allowPreview()) {
      options.push({ label: this.translate.instant('common.source.preview'), value: 'preview' });
    }
    return options;
  }

  //Choose view (for IA diagram)
  protected get viewIAOptions() {
    return [
      { label: this.translate.instant('common.view.baseline'), value: 'baseline' },
      { label: this.translate.instant('common.view.changes'), value: 'changes' },
      { label: this.translate.instant('common.view.final'), value: 'final' },
    ];
  }

  //Choose display (for IA diagram)
  protected get displayOptions() {
    return [
      { label: this.translate.instant('common.display.url'), value: 'url' },
      { label: this.translate.instant('common.display.title'), value: 'title' },
    ];
  }
}
