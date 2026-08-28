import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { BadgeModule } from 'primeng/badge';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { PrimeNG } from 'primeng/config';
import { DividerModule } from 'primeng/divider';
import { MessageModule } from 'primeng/message';
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
    FormsModule,
    RouterLink,
    TranslatePipe,
    BadgeModule,
    BreadcrumbModule,
    ButtonModule,
    DividerModule,
    MessageModule,
    TagModule,
    ColorPickerComponent,
    CopyPresetComponent,
    UserSettingsComponent,
    CommonModule,
  ],
  templateUrl: './color-generator.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorGeneratorComponent {
  private readonly primeNGConfig = inject(PrimeNG);
  protected readonly settingsService = inject(UserSettingsService);

  protected readonly customShades = signal<Record<string, Record<number, string>>>({});

  protected readonly breadcrumbs = [{ label: 'dev._title', route: '/dev' }, { label: 'dev.colors._title' }];

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
}
