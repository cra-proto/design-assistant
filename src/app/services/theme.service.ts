import { Injectable, signal } from '@angular/core';
import { updatePreset, updatePrimaryPalette } from '@primeng/themes';
import MyPreset from '../preset';
import DeutanPreset from '../preset-duetan';
import ProtanPreset from '../preset-protan';
import TritanPreset from '../preset-tritan';

export type ColourScheme = 'default' | 'deutan' | 'protan' | 'tritan';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {

  // Dark & Light themes
  public darkMode = signal<boolean>(false);
  public icon = signal<string>('pi pi-sun');

  // Default & Colorblind themes
  private colourSchemeKey = 'colour-scheme';
  colourScheme = signal<ColourScheme>(this.getStoredColorScheme());

  constructor() {
    // Dark & Light
    const storedTheme = localStorage.getItem('darkMode');
    this.setDarkMode(storedTheme === 'true')

    // Default & Colorblind
    this.applyColourScheme(this.colourScheme());
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

  // Default & Colourblind
  private getStoredColorScheme(): ColourScheme {
    const stored = localStorage.getItem(this.colourSchemeKey);
    return (stored === 'deutan' || stored === 'protan' || stored === 'tritan' || stored === 'default')
      ? stored
      : 'default';
  }

  setColourScheme(scheme: ColourScheme) {
    this.colourScheme.set(scheme);
    localStorage.setItem(this.colourSchemeKey, scheme);
    this.applyColourScheme(scheme);
  }

  private applyColourScheme(scheme: ColourScheme) {
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
      default:
        preset = MyPreset;
    }
    updatePreset(preset);
  }
}
