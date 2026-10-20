import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
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
    { label: 'undefined', value: null },
    { label: 'border-none', value: 'border-none' },
    { label: 'border-1', value: 'border-1' },
    { label: 'border-2', value: 'border-2' },
    { label: 'border-3', value: 'border-3' },
  ];

  borderColorOptions = [
    { label: 'undefined', value: null },
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
    { label: 'undefined', value: null },
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
    { label: 'undefined', value: null },
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

  protected readonly backgroundOptions = computed(() => {
    const primaryShades = this.settingsService.darkMode() ? [900, 800, 700] : [50, 100, 200];
    return [
      { label: 'undefined', value: null },
      { label: 'surface-50', value: 'surface-50' },
      { label: 'surface-100', value: 'surface-100' },
      { label: 'surface-200', value: 'surface-200' },
      ...primaryShades.map((s) => ({ label: `primary-${s}`, value: `bg-primary-${s}` })),
    ];
  });

  private readonly palettes = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
  protected readonly groundOptions = computed(() => {
    const shades = this.settingsService.darkMode() ? [950, 900, 800] : [50, 100, 200];
    return [{ label: 'undefined', value: null }, ...this.palettes.flatMap((palette) => shades.map((shade) => ({ label: `${palette}-${shade}`, value: this.getColour(`--p-${palette}-${shade}`) })))];
  });
  protected readonly selectedGroundLabel = computed(() => this.groundOptions().find((o) => o.value === this.selectedGround())?.label ?? '');

  constructor() {
    effect(() => {
      this.selectedGround.set(this.getColour(this.settingsService.darkMode() ? '--p-zinc-950' : '--p-zinc-50'));
      this.selectedHoverBackground.set('surface-50');
      this.selectedActiveBackground.set(this.settingsService.darkMode() ? 'bg-primary-900' : 'bg-primary-50');
    });
  }

  private getColour(variable: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  }

  //Global card settings
  selectedBorderWidth = null;
  selectedBorderColor = null;
  selectedBorderRadius = 'border-round-lg';
  selectedBackground = 'surface-card';

  //Flat only
  selectedFlatShadow = 'shadow-2';

  //Interactive only
  selectedInteractiveShadow = 'shadow-1';
  selectedHoverShadow = 'shadow-3';
  selectedHoverBorderWidth = null;
  selectedHoverBorderColor = null;

  //Active only
  protected readonly activeCard = signal(2);
  selectedActiveBorderWidth = 'border-3';
  selectedActiveBorderColor = 'border-primary';

  //Background colours
  protected readonly selectedActiveBackground = signal<string | null>('bg-primary-50');
  protected readonly selectedHoverBackground = signal<string | null>('surface-50');
  protected readonly selectedGround = signal<string | null>(null);

  cardStyles(isInteractive = false, isActive = false) {
    //Global card settings
    const borderRadius = this.selectedBorderRadius ? this.selectedBorderRadius + ' ' : '';
    const borderWidth = this.selectedBorderWidth && !isActive ? this.selectedBorderWidth + ' ' : '';
    const borderColor = this.selectedBorderColor && !isActive ? this.selectedBorderColor + ' ' : '';
    //Flat & interactive shadows
    const flatShadow = this.selectedFlatShadow && !isInteractive ? this.selectedFlatShadow + ' ' : '';
    const interactiveShadow = this.selectedInteractiveShadow && isInteractive ? this.selectedInteractiveShadow + ' ' : '';
    //Hover state
    const hoverBorderWidth = this.selectedHoverBorderWidth && isInteractive ? 'hover:' + this.selectedHoverBorderWidth + ' ' : '';
    const hoverBorderColor = this.selectedHoverBorderColor && isInteractive ? 'hover:' + this.selectedHoverBorderColor + ' ' : '';
    const hoverShadow = this.selectedHoverShadow && isInteractive ? 'hover:' + this.selectedHoverShadow + ' ' : '';
    const hoverBG = this.selectedHoverBackground() && isInteractive ? 'hover:' + this.selectedHoverBackground() + ' ' : '';
    const cursor = isInteractive ? 'cursor-pointer ' : '';
    //Active state
    const activeBG = this.selectedActiveBackground() && isActive ? this.selectedActiveBackground() + ' ' : 'surface-card ';
    const activeBorderWidth = this.selectedActiveBorderWidth && isActive ? this.selectedActiveBorderWidth + ' ' : '';
    const activeBorderColor = this.selectedActiveBorderColor && isActive ? this.selectedActiveBorderColor + ' ' : '';
    return (
      borderRadius +
      flatShadow +
      interactiveShadow +
      borderWidth +
      activeBorderWidth +
      borderColor +
      activeBorderColor +
      activeBG +
      hoverShadow +
      hoverBorderWidth +
      hoverBorderColor +
      hoverBG +
      cursor
    ).trim();
  }
}
