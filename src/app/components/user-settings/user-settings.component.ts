import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from "@ngx-translate/core";

import { MenuItem } from 'primeng/api';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DropdownModule } from 'primeng/dropdown';

import { ThemeService, ColourScheme } from '../../services/theme.service';

@Component({
    selector: 'aida-user-settings',
    imports: [TranslateModule, FormsModule,
        SelectButtonModule, DropdownModule
    ],
    templateUrl: './user-settings.component.html',
    styles: ``
})
export class UserSettingsComponent {
    translate = inject(TranslateService);
    themeService = inject(ThemeService);

    // Language
    langOptions: MenuItem[] = [];

    ngOnInit() {
        this.translate.stream(['lang.eng', 'lang.fra']).subscribe(translations => {
            this.langOptions = [
                { label: translations['lang.eng'], value: 'en' },
                { label: translations['lang.fra'], value: 'fr' }
            ];
        });
    }

    selectedLang: string = this.translate.currentLang;

    changeLang() {
        const useLang = this.selectedLang === 'en' ? 'en' : 'fr'
        this.translate.use(useLang)
        localStorage.setItem('lang', useLang);
    }

    // Dark & Light theme
    themeOptions: MenuItem[] = [{ label: 'theme.light', value: 'light' }, { label: 'theme.dark', value: 'dark' }];

    selectedTheme: string = 'light';

    // Default & other themes
    colourSchemes = [
        { label: 'Default Colors', value: 'default' as ColourScheme },
        { label: 'Deuteranopia (Green-Deficient)', value: 'deutan' as ColourScheme },
        { label: 'Protanopia (Red-Deficient)', value: 'protan' as ColourScheme },
        { label: 'Tritanopia (Blue-Deficient)', value: 'tritan' as ColourScheme }
    ];

    selectedScheme = this.themeService.colourScheme();

    onSchemeChange() {
        this.themeService.setColourScheme(this.selectedScheme);
        console.log(`Tried to set: `)
    }
}