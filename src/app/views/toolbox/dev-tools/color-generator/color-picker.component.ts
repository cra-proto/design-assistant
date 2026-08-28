import { ChangeDetectionStrategy, Component, effect, EventEmitter, input, Output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { ColorPickerModule } from 'primeng/colorpicker';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { InputTextModule } from 'primeng/inputtext';

import { ColorConverter } from '../../../../common/color-converter.util';
import { ContrastUtil } from '../../../../common/contrast.util';

export interface ContrastTest {
  shade: number;
  textColor: string;
  textColorName: string;
  requiredRatio: number;
}

/**
 * Reviewed: 2026-08-25 (ng21)
 * Color picker with live shade generation and contrast testing against the base color.
 */
@Component({
  selector: 'aida-color-picker',
  standalone: true,
  imports: [FormsModule, ButtonModule, ColorPickerModule, InputGroupAddonModule, InputGroupModule, InputTextModule],
  templateUrl: './color-picker.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorPickerComponent {
  public readonly key = input('');
  public readonly initialColor = input('#000000'); // Can be hex like '#00cccc' or CSS class like 'bg-green-500'
  public readonly externalShades = input<Record<number, string>>();
  public readonly contrastTests = input<ContrastTest[]>();
  public readonly showReset = input(true);
  @Output() colorChanged = new EventEmitter<{ hex: string; shades: Record<number, string> }>();

  protected readonly currentColor = signal('');
  private readonly defaultColor = signal('');
  private readonly generatedShades = signal<Record<number, string>>({});

  constructor() {
    effect(() => {
      this.key();
      untracked(() => this.loadColor());
    });

    // Sync in externally-provided presets whenever they change.
    effect(() => {
      const shades = this.externalShades();
      if (shades) {
        untracked(() => {
          this.generatedShades.set(shades);
          this.currentColor.set(shades[500] || this.currentColor());
        });
      }
    });
  }

  private loadColor() {
    this.currentColor.set(this.parseInitialColor(this.initialColor()));
    this.defaultColor.set(this.currentColor());
    this.loadShadesFromTheme();
  }

  private loadShadesFromTheme() {
    const root = getComputedStyle(document.documentElement);

    const colorMatch = this.initialColor().match(/bg-(\w+)-\d+/);
    const colorName = colorMatch ? colorMatch[1] : 'primary';

    const shades: Record<number, string> = {};
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].forEach((shade) => {
      const cssVar = `--p-${colorName}-${shade}`;
      const color = root.getPropertyValue(cssVar).trim();

      if (color?.startsWith('#')) {
        shades[shade] = color;
      } else if (color?.startsWith('rgb')) {
        shades[shade] = ColorConverter.rgbStringToHex(color);
      }
    });

    if (Object.keys(shades).length > 0) {
      this.generatedShades.set(shades);
    } else {
      this.generateShades();
    }
  }

  private parseInitialColor(value: string): string {
    if (value.startsWith('#')) {
      return value;
    }

    if (value.includes('-')) {
      const tempDiv = document.createElement('div');
      tempDiv.className = value;
      tempDiv.style.display = 'none';
      document.body.appendChild(tempDiv);

      const computedColor = window.getComputedStyle(tempDiv).backgroundColor;
      document.body.removeChild(tempDiv);

      if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') {
        return ColorConverter.rgbStringToHex(computedColor);
      }
    }

    return value;
  }

  protected onColorChange() {
    if (!this.currentColor().match(/^#?[0-9A-Fa-f]{6}$/)) {
      return; // Invalid color
    }

    const normalizedHex = this.currentColor().startsWith('#') ? this.currentColor() : '#' + this.currentColor();
    this.currentColor.set(normalizedHex);

    this.generateShades();
    this.emitChange();
  }

  private generateShades() {
    this.generatedShades.set(this.generateColorShades(this.currentColor()));
  }

  private generateColorShades(baseColor: string): Record<number, string> {
    const hsl = ColorConverter.hexToHsl(baseColor);

    const lightnessMap = {
      50: 95,
      100: 88,
      200: 81,
      300: 74,
      400: 67,
      500: hsl.l,
      600: hsl.l * 0.85,
      700: hsl.l * 0.7,
      800: hsl.l * 0.55,
      900: hsl.l * 0.45,
      950: hsl.l * 0.4,
    };

    const shades: Record<number, string> = {};

    Object.entries(lightnessMap).forEach(([shade, lightness]) => {
      shades[Number(shade)] = ColorConverter.hslToHex(hsl.h, hsl.s, lightness);
    });

    return shades;
  }

  protected getContrastRatio(test: ContrastTest): string {
    const bgColor = this.generatedShades()[test.shade] || this.currentColor();
    const ratio = ContrastUtil.getContrastRatio(test.textColor, bgColor);
    return ratio.toFixed(1);
  }

  protected getContrastPasses(test: ContrastTest): boolean {
    const bgColor = this.generatedShades()[test.shade] || this.currentColor();
    const ratio = ContrastUtil.getContrastRatio(test.textColor, bgColor);
    return ratio >= test.requiredRatio;
  }

  protected reset() {
    this.currentColor.set(this.defaultColor());
    this.generateShades();
    this.emitChange();
  }

  private emitChange() {
    this.colorChanged.emit({
      hex: this.currentColor(),
      shades: this.generatedShades(),
    });
  }
}
