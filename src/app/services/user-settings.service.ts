import { effect, inject, Injectable, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { TranslateService } from '@ngx-translate/core';

import { PrimeNG } from 'primeng/config';

import MyPreset from '../common/theme-presets/preset';
import CustomPreset from '../common/theme-presets/preset-custom';
import DeutanPreset from '../common/theme-presets/preset-deutan';
import ProtanPreset from '../common/theme-presets/preset-protan';
import TritanPreset from '../common/theme-presets/preset-tritan';

export type ColorScheme = 'default' | 'deutan' | 'protan' | 'tritan' | 'custom';

@Injectable({ providedIn: 'root' })
export class UserSettingsService {
  private readonly primeNGConfig = inject(PrimeNG);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);

  // Language
  public readonly currentLang = signal<string>('en');

  // Dark & Light themes
  public readonly darkMode = signal<boolean>(false);
  public readonly icon = signal<string>('pi pi-sun');

  // Default & Colorblind themes
  private readonly colorSchemeKey = 'color-scheme';
  public readonly colorScheme = signal<ColorScheme>(this.getStoredColorScheme());

  // Toolbox visibility (used by sidebar, undecided if we should surface in user settings)
  public readonly toolbox = signal<string | null>(localStorage.getItem('myToolbox'));

  // User
  public readonly userId = signal<string>(this.getOrCreateUserId());

  //Version
  public readonly includePreview = signal<boolean>(localStorage.getItem('includePreview') === 'true' ? true : false);
  public readonly includeGitHub = signal<boolean>(false);
  public readonly includeLocal = signal<boolean>(false);
  public readonly includeBaseline = signal<boolean>(false);

  constructor() {
    // Language
    const supportedLangs = ['en', 'fr'];
    this.translate.addLangs(supportedLangs);
    const storedLang = localStorage.getItem('lang') || this.translate.getBrowserLang() || 'en';
    this.setLanguage(storedLang);

    // Dark & Light
    const storedTheme = localStorage.getItem('darkMode');
    this.setDarkMode(storedTheme === 'true');

    // Default & Colorblind
    effect(() => {
      this.applyColorScheme(this.colorScheme());
    });

    effect(() => {
      localStorage.setItem('includePreview', this.includePreview().toString());
    });
  }

  // Language
  public setLanguage(lang: string) {
    const useLang = lang === 'en' ? 'en' : 'fr';
    this.currentLang.set(useLang);
    this.translate.use(useLang);
    localStorage.setItem('lang', useLang);
    console.log(`Language set to ${useLang}`);
  }

  public toggleLanguage() {
    const newLang = this.currentLang() === 'en' ? 'fr' : 'en';
    this.setLanguage(newLang);
    //Update title on language change
    const titleKey = this.router.routerState.snapshot.root.firstChild?.title;
    if (titleKey) {
      this.translate.get(titleKey).subscribe((translated: string) => {
        this.title.setTitle(translated);
      });
    }
  }

  // Dark & Light
  private setDarkMode(enabled: boolean) {
    this.darkMode.set(enabled);
    localStorage.setItem('darkMode', String(enabled));
    document.documentElement.classList.toggle('dark-mode', enabled);
    this.icon.set(enabled ? 'pi pi-sun' : 'pi pi-moon');
    console.log(`Dark mode set to ${enabled}`);
  }

  public toggle() {
    this.setDarkMode(!this.darkMode());
  }

  // Default & Colorblind
  private getStoredColorScheme(): ColorScheme {
    const stored = localStorage.getItem(this.colorSchemeKey);
    return stored === 'deutan' || stored === 'protan' || stored === 'tritan' || stored === 'custom' || stored === 'default' ? stored : 'default';
  }

  public setColorScheme(scheme: ColorScheme) {
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
    this.primeNGConfig.theme.set({
      preset: preset,
      options: {
        colorScheme: 'light',
        theme: 'blue',
        ripple: true,
        darkModeSelector: '.dark-mode',
      },
    });
  }

  // UserId
  private getOrCreateUserId(): string {
    const stored = localStorage.getItem('userId');
    if (stored) return stored;
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('userId', id);
    return id;
  }

  public setUserId(id: string): void {
    localStorage.setItem('userId', id);
    this.userId.set(id);
  }
}
