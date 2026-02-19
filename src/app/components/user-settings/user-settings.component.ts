import { Component, inject, Input, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from "@ngx-translate/core";
import { marker } from '@colsen1991/ngx-translate-extract-marker';

import { MenuItem } from 'primeng/api';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SelectModule } from 'primeng/select';

import { ThemeService, ColorScheme } from '../../services/theme.service';

export type SettingsMode = 'all' | 'language' | 'theme';

@Component({
    selector: 'aida-user-settings',
    imports: [TranslateModule, FormsModule,
        SelectButtonModule, SelectModule
    ],
    templateUrl: './user-settings.component.html',
    styles: ``
})
export class UserSettingsComponent {
    themeService = inject(ThemeService);

    @Input() mode: SettingsMode = 'all';

    constructor() {
        effect(() => {
            this.selectedTheme = this.themeService.darkMode();
            this.selectedScheme = this.themeService.colorScheme();
        });
    }

    // Language
    langOptions: MenuItem[] = [{ label: 'common.language.english', value: 'en' }, { label: 'common.language.french', value: 'fr' }];

    get selectedLang(): string {
        return this.themeService.currentLang();
    }

    set selectedLang(value: string) {
        this.themeService.setLanguage(value);
    }

    // Dark & Light theme
    themeOptions: MenuItem[] = [{ label: 'settings.theme.light', value: false }, { label: 'settings.theme.dark', value: true }];

    selectedTheme: boolean = this.themeService.darkMode();

    changeTheme() {
        this.themeService.toggle();
    }

    // Default & other themes
    colorSchemes = [
        { label: 'settings.theme.default', value: 'default' as ColorScheme },
        { label: 'settings.theme.deutan', value: 'deutan' as ColorScheme },
        { label: 'settings.theme.protan', value: 'protan' as ColorScheme },
        { label: 'settings.theme.tritan', value: 'tritan' as ColorScheme },
        { label: 'settings.theme.custom', value: 'custom' as ColorScheme }
    ];

    markForTranslation() {
        marker('common.language.english');
        marker('common.language.french');
        marker('settings.theme.light');
        marker('settings.theme.dark');
        marker('settings.theme.default');
        marker('settings.theme.deutan');
        marker('settings.theme.protan');
        marker('settings.theme.tritan');
        marker('settings.theme.custom');
    }

    selectedScheme = this.themeService.colorScheme();

    changeScheme() {
        this.themeService.setColorScheme(this.selectedScheme);
    }
}