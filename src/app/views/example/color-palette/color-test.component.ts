import { Component, inject, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { BadgeModule } from 'primeng/badge';
import { MessageModule } from 'primeng/message';
import { DividerModule } from 'primeng/divider';

import { UserSettingsComponent } from '../../../components/user-settings/user-settings.component';
import { ColorPickerComponent } from './color-picker.component';
import { CopyPresetComponent } from './copy-preset.component';

import { ThemeService } from '../../../services/theme.service';
import { updatePreset } from '@primeng/themes';

@Component({
  selector: 'aida-color-test',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    ButtonModule, TagModule, BadgeModule, MessageModule,
    DividerModule,
    UserSettingsComponent, ColorPickerComponent, CopyPresetComponent
  ],
  templateUrl: './color-test.component.html',
  styles: ``
})
export class ColorTestComponent {
  theme = inject(ThemeService);
  customShades: Record<string, Record<number, string>> = {};

  onColorChange(event: { hex: string; shades: Record<number, string> }, color: 'primary' | 'red' | 'green' | 'purple') {
    this.customShades[color] = event.shades;
    this.updateTheme();
  }
  onInfoColorChange(event: { hex: string; shades: Record<number, string> }) {
    this.customShades['sky'] = event.shades;
    this.customShades['blue'] = event.shades;
    this.updateTheme();
  }
  onWarnColorChange(event: { hex: string; shades: Record<number, string> }) {
    this.customShades['orange'] = event.shades;
    this.customShades['yellow'] = event.shades;
    this.updateTheme();
  }

  updateTheme() {
    const scheme = this.theme.colorScheme();

    let presetPromise: Promise<any>;
    switch (scheme) {
      case 'deutan': presetPromise = import('../../../common/theme-presets/preset-deutan'); break;
      case 'protan': presetPromise = import('../../../common/theme-presets/preset-protan'); break;
      case 'tritan': presetPromise = import('../../../common/theme-presets/preset-tritan'); break;
      case 'custom': presetPromise = import('../../../common/theme-presets/preset-custom'); break;
      default: presetPromise = import('../../../common/theme-presets/preset');
    }

    presetPromise.then(module => {
      const basePreset = module.default;
      const customPreset = {
        ...basePreset,
        primitive: { ...basePreset.primitive, ...this.customShades },
        semantic: {
          ...basePreset.semantic,
          ...(this.customShades['primary'] ? { primary: this.customShades['primary'] } : {})
        }
      };
      updatePreset(customPreset);
    });
  }
}
