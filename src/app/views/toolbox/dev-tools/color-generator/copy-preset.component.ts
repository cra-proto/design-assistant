import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';

import { ColorConverter } from '../../../../common/color-converter.util';
import { ContrastUtil } from '../../../../common/contrast.util';

/**
 * Reviewed: 2026-08-25 (ng21)
 * Renders a copy/pasteable PrimeNG preset from the currently generated custom shades
 */
@Component({
  selector: 'aida-copy-preset',
  standalone: true,
  imports: [ButtonModule, TextareaModule],
  templateUrl: './copy-preset.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CopyPresetComponent {
  public readonly customShades = input<Record<string, Record<number, string>>>({});

  protected readonly copied = signal(false);

  protected readonly generatedCode = computed(() => this.generatePresetCode(this.customShades()));

  private generatePresetCode(shades: Record<string, Record<number, string>>): string {
    // Helper to format shade with comment
    const formatShade = (shade: number, hex: string): string => {
      let comment = '';

      if (shade === 400) {
        const ratio = ContrastUtil.getContrastRatio('#000000', hex);
        const pass = ContrastUtil.meetsWCAG_AA('#000000', hex) ? '' : '(fail)';
        comment = ` // ${ratio.toFixed(1)} vs. black ${pass}`;
      } else if (shade === 500) {
        const ratio = ContrastUtil.getContrastRatio('#ffffff', hex);
        const pass = ContrastUtil.meetsWCAG_AA('#ffffff', hex) ? '' : '(fail)';
        comment = ` // ${ratio.toFixed(1)} vs. white ${pass}`;
      }

      return `            ${shade}: '${hex}',${comment}`;
    };

    // Generate primary semantic color
    const primaryShades = shades['primary'] || this.getDefaultShades('primary');
    const primaryLines = Object.entries(primaryShades)
      .map(([shade, hex]) => formatShade(Number(shade), hex))
      .join('\n');

    // Generate primitive colors
    const primitiveColors = [
      { key: 'green', name: 'success' },
      { key: 'red', name: 'danger' },
      { key: 'orange', name: 'warn buttons' },
      { key: 'yellow', name: 'warn messages' },
      { key: 'sky', name: 'info buttons' },
      { key: 'blue', name: 'info messages' },
      { key: 'purple', name: 'help' },
    ];

    const primitiveSections = primitiveColors
      .map(({ key, name }) => {
        const colorShades = shades[key] || this.getDefaultShades(key);
        const lines = Object.entries(colorShades)
          .map(([shade, hex]) => formatShade(Number(shade), hex))
          .join('\n');

        return `        ${key}: { // ${name}\n${lines}\n        }`;
      })
      .join(',\n');

    // Generate dark mode primary (reverse of light primary)
    const darkPrimaryShades = this.reversePrimaryShades(primaryShades);
    const darkPrimaryLines = Object.entries(darkPrimaryShades)
      .map(([shade, hex]) => `            ${shade}: '${hex}',`)
      .join('\n');

    return `import { definePreset } from '@primeng/themes';
import Material from '@primeng/themes/material';

const CustomPreset = definePreset(Material, {
    semantic: {
        primary: {
            // primary
${primaryLines}
        },
    },
    primitive: {
${primitiveSections}
    },
    dark: {
        primary: {
${darkPrimaryLines}
        },
    }
});

export default CustomPreset;`;
  }

  private getDefaultShades(key: string): Record<number, string> {
    // Get current theme colors from CSS custom properties
    const root = getComputedStyle(document.documentElement);
    const shades: Record<number, string> = {};

    // Map keys to CSS variable prefixes
    const cssVarPrefix = key === 'primary' ? 'primary' : key;

    // Read each shade from CSS variables
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach((shade) => {
      const cssVar = `--p-${cssVarPrefix}-${shade}`;
      const color = root.getPropertyValue(cssVar).trim();

      if (color) {
        // If it's already a hex color, use it
        if (color.startsWith('#')) {
          shades[shade] = color;
        }
        // If it's rgb format, convert to hex
        else if (color.startsWith('rgb')) {
          shades[shade] = this.rgbStringToHex(color);
        }
        // Otherwise use as-is
        else {
          shades[shade] = color;
        }
      }
    });

    // If we got values, return them
    if (Object.keys(shades).length > 0) {
      return shades;
    }

    // Fallback: return empty object (shouldn't happen)
    return {
      50: '#e5e7eb',
      100: '#d1d5db',
      200: '#9ca3af',
      300: '#6b7280',
      400: '#4b5563',
      500: '#374151',
      600: '#1f2937',
      700: '#111827',
      800: '#030712',
      900: '#000000',
      950: '#000000',
    };
  }

  private rgbStringToHex(rgb: string): string {
    const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return ColorConverter.rgbToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
    }
    return '#000000';
  }

  private reversePrimaryShades(lightShades: Record<number, string>): Record<number, string> {
    return {
      50: lightShades[950],
      100: lightShades[900],
      200: lightShades[800],
      300: lightShades[700],
      400: lightShades[600],
      500: lightShades[500],
      600: lightShades[400],
      700: lightShades[300],
      800: lightShades[200],
      900: lightShades[100],
      950: lightShades[50],
    };
  }

  protected copyToClipboard() {
    navigator.clipboard.writeText(this.generatedCode()).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 3000);
    });
  }
}
