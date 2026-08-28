import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { marker } from '@colsen1991/ngx-translate-extract-marker';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TooltipModule } from 'primeng/tooltip';

import { ProjectStateService } from '../../services/project-state.service';
import { ColorScheme, UserSettingsService } from '../../services/user-settings.service';

export type SettingsMode = 'all' | 'language' | 'theme' | 'versions';

@Component({
  selector: 'aida-user-settings',
  imports: [CommonModule, FormsModule, TranslatePipe, ButtonModule, CheckboxModule, DialogModule, SelectButtonModule, SelectModule, TooltipModule],
  templateUrl: './user-settings.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserSettingsComponent {
  protected readonly settingsService = inject(UserSettingsService);
  private readonly translate = inject(TranslateService);
  private readonly projectState = inject(ProjectStateService);

  public readonly mode = input<SettingsMode>('all');

  constructor() {
    effect(() => {
      this.selectedTheme = this.settingsService.darkMode();
      this.selectedScheme = this.settingsService.colorScheme();
    });
  }

  // Language
  protected get langOptions(): MenuItem[] {
    return [
      { label: this.translate.instant('common.language.english'), value: 'en' },
      { label: this.translate.instant('common.language.french'), value: 'fr' },
    ];
  }

  protected get selectedLang(): string {
    return this.settingsService.currentLang();
  }

  protected set selectedLang(value: string) {
    this.settingsService.setLanguage(value);
  }

  // Dark & Light theme
  protected get themeOptions(): MenuItem[] {
    return [
      { label: this.translate.instant('settings.theme.light'), value: false },
      { label: this.translate.instant('settings.theme.dark'), value: true },
    ];
  }

  protected selectedTheme: boolean = this.settingsService.darkMode();

  protected changeTheme() {
    this.settingsService.toggle();
  }

  // Default & other themes
  protected get colorSchemes(): MenuItem[] {
    return [
      { label: this.translate.instant('settings.theme.default'), value: 'default' as ColorScheme },
      { label: this.translate.instant('settings.theme.deutan'), value: 'deutan' as ColorScheme },
      { label: this.translate.instant('settings.theme.protan'), value: 'protan' as ColorScheme },
      { label: this.translate.instant('settings.theme.tritan'), value: 'tritan' as ColorScheme },
      { label: this.translate.instant('settings.theme.custom'), value: 'custom' as ColorScheme },
    ];
  }

  protected selectedScheme = this.settingsService.colorScheme();

  protected changeScheme() {
    this.settingsService.setColorScheme(this.selectedScheme);
  }

  // Versions
  protected get versionOptions(): MenuItem[] {
    const options = [
      { label: this.translate.instant('common.source.preview'), value: this.settingsService.includePreview },
      { label: this.translate.instant('project.repo.storage.github'), value: this.settingsService.includeGitHub },
      { label: this.translate.instant('project.repo.storage.local'), value: this.settingsService.includeLocal },
    ];
    if (this.projectState.getProject().github.hasBaselineRepo) {
      options.push({ label: this.translate.instant('common.version.baseline'), value: this.settingsService.includeBaseline });
    }
    return options;
  }

  protected showVersionHelp = false;

  private markForTranslation() {
    marker('settings.versions.help');
  }
}
