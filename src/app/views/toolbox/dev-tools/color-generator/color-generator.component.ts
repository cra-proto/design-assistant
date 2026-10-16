import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { PrimeNG } from 'primeng/config';
import { DividerModule } from 'primeng/divider';
import { IftaLabelModule } from 'primeng/iftalabel';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';

import { UserSettingsComponent } from '../../../../components/user-settings/user-settings.component';
import { ColorPickerComponent } from './color-picker.component';
import { CopyPresetComponent } from './copy-preset.component';

import { UserSettingsService } from '../../../../services/user-settings.service';

/**
 * Reviewed: 2026-08-25 (ng21)
 * Playground for tuning per-scheme accent colors and exporting a PrimeNG preset.
 */
@Component({
  selector: 'aida-color-generator',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslatePipe,
    BadgeModule,
    ButtonModule,
    DividerModule,
    IftaLabelModule,
    MessageModule,
    SelectModule,
    TagModule,
    ColorPickerComponent,
    CopyPresetComponent,
    UserSettingsComponent,
  ],
  templateUrl: './color-generator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorGeneratorComponent {
  private readonly primeNGConfig = inject(PrimeNG);
  protected readonly settingsService = inject(UserSettingsService);

  protected readonly customShades = signal<Record<string, Record<number, string>>>({});

  protected onColorChange(event: { hex: string; shades: Record<number, string> }, color: 'primary' | 'red' | 'green' | 'purple') {
    this.customShades.update((current) => ({ ...current, [color]: event.shades }));
    this.updateTheme();
  }
  protected onInfoColorChange(event: { hex: string; shades: Record<number, string> }) {
    this.customShades.update((current) => ({ ...current, sky: event.shades, blue: event.shades }));
    this.updateTheme();
  }
  protected onWarnColorChange(event: { hex: string; shades: Record<number, string> }) {
    this.customShades.update((current) => ({ ...current, orange: event.shades, yellow: event.shades }));
    this.updateTheme();
  }

  private updateTheme() {
    const scheme = this.settingsService.colorScheme();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let presetPromise: Promise<{ default: any }>;
    switch (scheme) {
      case 'deutan':
        presetPromise = import('../../../../common/theme-presets/preset-deutan');
        break;
      case 'protan':
        presetPromise = import('../../../../common/theme-presets/preset-protan');
        break;
      case 'tritan':
        presetPromise = import('../../../../common/theme-presets/preset-tritan');
        break;
      case 'custom':
        presetPromise = import('../../../../common/theme-presets/preset-custom');
        break;
      default:
        presetPromise = import('../../../../common/theme-presets/preset');
    }

    presetPromise.then((module) => {
      const basePreset = module.default;
      const shades = this.customShades();
      const customPreset = {
        ...basePreset,
        primitive: { ...basePreset.primitive, ...shades },
        semantic: {
          ...basePreset.semantic,
          ...(shades['primary'] ? { primary: shades['primary'] } : {}),
        },
      };
      this.primeNGConfig.theme.set({
        preset: customPreset,
        options: {
          colorScheme: 'light',
          theme: 'blue',
          ripple: true,
          darkModeSelector: '.dark-mode',
        },
      });
    });
  }

  borderWidthOptions = [
    { label: 'Undefined', value: undefined },
    { label: 'border-none', value: 'border-none' },
    { label: 'border-1', value: 'border-1' },
    { label: 'border-2', value: 'border-2' },
    { label: 'border-3', value: 'border-3' },
  ];

  borderColorOptions = [
    { label: 'Undefined', value: undefined },
    { label: 'border-primary', value: 'border-primary' },
    { label: 'surface-border', value: 'surface-border' },
    { label: 'border-0', value: 'border-0' },
    { label: 'border-50', value: 'border-50' },
    { label: 'border-100', value: 'border-100' },
    { label: 'border-200', value: 'border-200' },
    { label: 'border-300', value: 'border-300' },
    { label: 'border-400', value: 'border-400' },
    { label: 'border-500', value: 'border-500' },
    { label: 'border-600', value: 'border-600' },
    { label: 'border-700', value: 'border-700' },
    { label: 'border-800', value: 'border-800' },
    { label: 'border-900', value: 'border-900' },
  ];

  borderRadiusOptions = [
    { label: 'Undefined', value: undefined },
    { label: 'border-noround', value: 'border-noround' },
    { label: 'border-round', value: 'border-round' },
    { label: 'border-round-xs', value: 'border-round-xs' },
    { label: 'border-round-sm', value: 'border-round-sm' },
    { label: 'border-round-md', value: 'border-round-md' },
    { label: 'border-round-lg', value: 'border-round-lg' },
    { label: 'border-round-xl', value: 'border-round-xl' },
    { label: 'border-round-2xl', value: 'border-round-2xl' },
    { label: 'border-round-3xl', value: 'border-round-3xl' },
    { label: 'border-circle', value: 'border-circle' },
  ];

  shadowOptions = [
    { label: 'Undefined', value: undefined },
    { label: 'shadow-none', value: 'shadow-none' },
    { label: 'shadow-1', value: 'shadow-1' },
    { label: 'shadow-2', value: 'shadow-2' },
    { label: 'shadow-3', value: 'shadow-3' },
    { label: 'shadow-4', value: 'shadow-4' },
    { label: 'shadow-5', value: 'shadow-5' },
    { label: 'shadow-6', value: 'shadow-6' },
    { label: 'shadow-7', value: 'shadow-7' },
    { label: 'shadow-8', value: 'shadow-8' },
  ];

  backgroundOptions = [
    { label: 'Undefined', value: undefined },
    { label: 'surface-50', value: 'surface-50' },
    { label: 'surface-100', value: 'surface-100' },
    { label: 'surface-200', value: 'surface-200' },
    { label: 'primary-50', value: 'bg-primary-50' },
    { label: 'primary-100', value: 'bg-primary-100' },
    { label: 'primary-200', value: 'bg-primary-200' },
  ];

  groundOptions = [
    { label: 'Undefined', value: undefined },
    { label: 'slate-50', value: this.getColour('--p-slate-50') },
    { label: 'slate-100', value: this.getColour('--p-slate-100') },
    { label: 'slate-200', value: this.getColour('--p-slate-200') },
    { label: 'gray-50', value: this.getColour('--p-gray-50') },
    { label: 'gray-100', value: this.getColour('--p-gray-100') },
    { label: 'gray-200', value: this.getColour('--p-gray-200') },
    { label: 'zinc-50', value: this.getColour('--p-zinc-50') },
    { label: 'zinc-100', value: this.getColour('--p-zinc-100') },
    { label: 'zinc-200', value: this.getColour('--p-zinc-200') },
    { label: 'neutral-50', value: this.getColour('--p-neutral-50') },
    { label: 'neutral-100', value: this.getColour('--p-neutral-100') },
    { label: 'neutral-200', value: this.getColour('--p-neutral-200') },
    { label: 'stone-50', value: this.getColour('--p-stone-50') },
    { label: 'stone-100', value: this.getColour('--p-stone-100') },
    { label: 'stone-200', value: this.getColour('--p-stone-200') },
  ];

  private getColour(variable: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  }

  selectedBorderWidth = 'border-none';
  selectedBorderColor = 'surface-border';
  selectedBorderRadius = 'border-round-lg';
  selectedShadow = 'shadow-1';
  selectedHoverShadow = 'shadow-3';
  selectedHoverBackground = 'surface-50';
  selectedGround = this.getColour('--p-zinc-50');

  cardStyles() {
    const borderWidth = this.selectedBorderWidth ? this.selectedBorderWidth + ' ' : '';
    const borderColor = this.selectedBorderColor ? this.selectedBorderColor + ' ' : '';
    const borderRadius = this.selectedBorderRadius ? this.selectedBorderRadius + ' ' : '';
    const shadow = this.selectedShadow ? this.selectedShadow + ' ' : '';
    const hoverShadow = this.selectedHoverShadow ? 'hover:' + this.selectedHoverShadow + ' ' : '';
    const hoverBG = this.selectedHoverBackground ? 'hover:' + this.selectedHoverBackground : '';
    return borderWidth + borderColor + borderRadius + shadow + hoverShadow + hoverBG;
  }
}
