import { Injectable, signal, effect, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { updatePreset, updatePrimaryPalette } from '@primeng/themes';
import MyPreset from '../common/theme-presets/preset';
import DeutanPreset from '../common/theme-presets/preset-deutan';
import ProtanPreset from '../common/theme-presets/preset-protan';
import TritanPreset from '../common/theme-presets/preset-tritan';
import CustomPreset from '../common/theme-presets/preset-custom';

export type ColorScheme = 'default' | 'deutan' | 'protan' | 'tritan' | 'custom';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private translate = inject(TranslateService);

  // Language
  public currentLang = signal<string>('en');

  // Dark & Light themes
  public darkMode = signal<boolean>(false);
  public icon = signal<string>('pi pi-sun');

  // Default & Colorblind themes
  private colorSchemeKey = 'color-scheme';
  colorScheme = signal<ColorScheme>(this.getStoredColorScheme());

  constructor() {
    // Language
    this.translate.addLangs(['en', 'fr']);
    this.translate.setDefaultLang('en');
    const storedLang = localStorage.getItem('lang') || this.translate.getBrowserLang() || 'en';
    this.setLanguage(storedLang);

    // Dark & Light
    const storedTheme = localStorage.getItem('darkMode');
    this.setDarkMode(storedTheme === 'true')

    // Default & Colorblind
    effect(() => {
      this.applyColorScheme(this.colorScheme());
    });

  }

  // Language
  setLanguage(lang: string) {
    const useLang = lang === 'en' ? 'en' : 'fr';
    this.currentLang.set(useLang);
    this.translate.use(useLang);
    localStorage.setItem('lang', useLang);
    console.log(`Language set to ${useLang}`);
  }

  toggleLanguage() {
    const newLang = this.currentLang() === 'en' ? 'fr' : 'en';
    this.setLanguage(newLang);
  }

  // Dark & Light
  setDarkMode(enabled: boolean) {
    this.darkMode.set(enabled);
    localStorage.setItem('darkMode', String(enabled));
    document.documentElement.classList.toggle('dark-mode', enabled);
    this.icon.set(enabled ? 'pi pi-sun' : 'pi pi-moon');
    console.log(`Dark mode set to ${enabled}`);
  }

  toggle() {
    this.setDarkMode(!this.darkMode());
  }

  // Default & Colorblind
  private getStoredColorScheme(): ColorScheme {
    const stored = localStorage.getItem(this.colorSchemeKey);
    return (stored === 'deutan' || stored === 'protan' || stored === 'tritan' || stored === 'custom' || stored === 'default')
      ? stored
      : 'default';
  }

  setColorScheme(scheme: ColorScheme) {
    this.colorScheme.set(scheme);
    localStorage.setItem(this.colorSchemeKey, scheme);
  }

  private applyColorScheme(scheme: ColorScheme) {
    console.log('Applying color scheme:', scheme);
    let preset;
    switch (scheme) {
      case 'deutan':
        preset = DeutanPreset;
        break;
      case 'protan':
        preset = ProtanPreset;
        break;
      case 'tritan':
        preset = TritanPreset;
        break;
      case 'custom':
        preset = CustomPreset;
        break;
      default:
        preset = MyPreset;
    }
    updatePreset(preset);
  }

}
