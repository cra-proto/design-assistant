import { definePreset } from '@primeng/themes';
import Material from '@primeng/themes/material';

const DeutanPreset = definePreset(Material, {
    semantic: {
        primary: {
            // Purple/Violet - distinct from blue-green success
            50: '#f3e6ff',
            100: '#dab3ff',
            200: '#c180ff',
            300: '#a84dff',
            400: '#8f1aff',
            500: '#7200cc', // Purple = primary actions
            600: '#5b00a3',
            700: '#44007a',
            800: '#2e0052',
            900: '#170029',
            950: '#0c0014',
        },
    },
    primitive: {
        green: { // Blue for "positive" - deutan users see blue well
            50: '#e6f7fc',
            100: '#b3e6f7',
            200: '#80d4f2',
            300: '#4dbfea',
            400: '#1aaae2',
            500: '#0088cc', // Bright blue = positive/success
            600: '#006da3',
            700: '#00527a',
            800: '#003752',
            900: '#001c29',
            950: '#000e14',
        },
        red: { // Yellow/Gold for "negative" - high contrast
            50: '#fffbe6',
            100: '#fff4b3',
            200: '#ffed80',
            300: '#ffe54d',
            400: '#ffde1a',
            500: '#d4aa00', // Gold/amber = warning/danger
            600: '#a88800',
            700: '#7d6600',
            800: '#524400',
            900: '#272200',
            950: '#131100',
        },
        orange: { // Muted yellow-orange
            50: '#fff7e6',
            100: '#ffe8b3',
            200: '#ffd980',
            300: '#ffca4d',
            400: '#ffbb1a',
            500: '#cc9500',
            600: '#a37700',
            700: '#7a5900',
            800: '#523c00',
            900: '#291e00',
            950: '#140f00',
        },
        sky: { // Cyan
            50: '#e6faff',
            100: '#b3f0ff',
            200: '#80e6ff',
            300: '#4ddcff',
            400: '#1ad2ff',
            500: '#00a8cc',
            600: '#0086a3',
            700: '#00657a',
            800: '#004352',
            900: '#002229',
            950: '#001114',
        },
        purple: { // Keep purple distinct
            50: '#f5e6ff',
            100: '#e6b3ff',
            200: '#d680ff',
            300: '#c74dff',
            400: '#b81aff',
            500: '#9400cc',
            600: '#7600a3',
            700: '#59007a',
            800: '#3b0052',
            900: '#1e0029',
            950: '#0f0014',
        },
    },
    dark: {
        primary: {
            50: '#0c0014',
            100: '#170029',
            200: '#2e0052',
            300: '#44007a',
            400: '#5b00a3',
            500: '#7200cc',
            600: '#8f1aff',
            700: '#a84dff',
            800: '#c180ff',
            900: '#dab3ff',
            950: '#f3e6ff',
        },
    }
});

export default DeutanPreset;