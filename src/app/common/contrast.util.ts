import { ColorConverter } from './color-converter.util';
export class ContrastUtil {
    /**
     * Calculate WCAG contrast ratio between two hex colors
     * @param foreground Foreground/text color (e.g., '#000000' or '#000000E6' with alpha)
     * @param background Background color (e.g., '#ffffff')
     * @returns Contrast ratio (1-21)
     */
    static getContrastRatio(foreground: string, background: string): number {

        // If foreground has alpha, composite it over the background
        const compositedForeground = this.compositeColorOverBackground(foreground, background);

        const lum1 = this.getLuminance(compositedForeground);
        const lum2 = this.getLuminance(background);

        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);

        const ratio = (brightest + 0.05) / (darkest + 0.05);

        return ratio;
    }

    /**
  * Composite a foreground color (potentially with alpha) over a background color
  */
    private static compositeColorOverBackground(foreground: string, background: string): string {
        // Remove # if present
        foreground = foreground.replace('#', '');
        background = background.replace('#', '');

        // If no alpha channel (6 characters), return as-is
        if (foreground.length === 6) {
            return '#' + foreground;
        }

        // If 8 characters, we have alpha - composite over background
        if (foreground.length === 8) {
            const fgR = parseInt(foreground.substring(0, 2), 16);
            const fgG = parseInt(foreground.substring(2, 4), 16);
            const fgB = parseInt(foreground.substring(4, 6), 16);
            const alpha = parseInt(foreground.substring(6, 8), 16) / 255;

            const bgR = parseInt(background.substring(0, 2), 16);
            const bgG = parseInt(background.substring(2, 4), 16);
            const bgB = parseInt(background.substring(4, 6), 16);

            // Alpha compositing: result = foreground * alpha + background * (1 - alpha)
            const resultR = Math.round(fgR * alpha + bgR * (1 - alpha));
            const resultG = Math.round(fgG * alpha + bgG * (1 - alpha));
            const resultB = Math.round(fgB * alpha + bgB * (1 - alpha));

            return ColorConverter.rgbToHex(resultR, resultG, resultB);
        }

        // Invalid format, return as-is
        return '#' + foreground;
    }

    /**
     * Get relative luminance of a color
     */
    private static getLuminance(hexColor: string): number {
        const rgb = this.hexToRgb(hexColor);

        // Convert RGB to sRGB
        const [r, g, b] = rgb.map(val => {
            const sRGB = val / 255;
            return sRGB <= 0.03928
                ? sRGB / 12.92
                : Math.pow((sRGB + 0.055) / 1.055, 2.4);
        });

        // Calculate relative luminance
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    // Convert hex color to RGB array
    public static hexToRgb(hex: string): [number, number, number] {
        hex = hex.replace('#', '');
        return [
            parseInt(hex.substring(0, 2), 16),
            parseInt(hex.substring(2, 4), 16),
            parseInt(hex.substring(4, 6), 16)
        ];
    }

    /**
     * Check if contrast meets WCAG AA standard (4.5:1 for normal text)
     */
    static meetsWCAG_AA(color1: string, color2: string): boolean {
        return this.getContrastRatio(color1, color2) >= 4.5;
    }

    /**
     * Check if contrast meets WCAG AAA standard (7:1 for normal text)
     */
    static meetsWCAG_AAA(color1: string, color2: string): boolean {
        return this.getContrastRatio(color1, color2) >= 7;
    }

    /**
     * Get WCAG compliance level
     */
    static getComplianceLevel(color1: string, color2: string): 'AAA' | 'AA' | 'Fail' {
        const ratio = this.getContrastRatio(color1, color2);
        if (ratio >= 7) return 'AAA';
        if (ratio >= 4.5) return 'AA';
        return 'Fail';
    }
}