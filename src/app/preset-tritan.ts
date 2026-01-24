import { definePreset } from '@primeng/themes';
import Material from '@primeng/themes/material';

const TritanPreset = definePreset(Material, {
    semantic: {
        primary: {
            // Red/Magenta - tritan users see red well
            50: '#ffe6f0',
            100: '#ffb3d4',
            200: '#ff80b8',
            300: '#ff4d9c',
            400: '#ff1a80',
            500: '#cc0066', // Magenta-red
            600: '#a30052',
            700: '#7a003d',
            800: '#520029',
            900: '#290014',
            950: '#14000a',
        },
    },
    primitive: {
        green: { // Dark red for "positive" - tritan users see red as safe/good
            50: '#ffe6ec',
            100: '#ffb3c7',
            200: '#ff80a3',
            300: '#ff4d7e',
            400: '#ff1a5a',
            500: '#cc0047', // Deep red = positive (counterintuitive but works for tritan)
            600: '#a30039',
            700: '#7a002b',
            800: '#52001d',
            900: '#29000e',
            950: '#140007',
        },
        red: { // Bright pink/magenta for "negative" - distinct from dark red
            50: '#ffe6ff',
            100: '#ffb3ff',
            200: '#ff80ff',
            300: '#ff4dff',
            400: '#ff1aff',
            500: '#cc00cc', // Bright magenta = warning/danger
            600: '#a300a3',
            700: '#7a007a',
            800: '#520052',
            900: '#290029',
            950: '#140014',
        },
        orange: { // Coral/salmon
            50: '#ffe9ed',
            100: '#ffc2cd',
            200: '#ff9bad',
            300: '#ff748d',
            400: '#ff4d6d',
            500: '#cc3d57',
            600: '#a33146',
            700: '#7a2534',
            800: '#521923',
            900: '#290c11',
            950: '#140609',
        },
        sky: { // Light pink
            50: '#ffebf0',
            100: '#ffc7d4',
            200: '#ffa3b8',
            300: '#ff7f9c',
            400: '#ff5b80',
            500: '#cc4966',
            600: '#a33a52',
            700: '#7a2c3d',
            800: '#521d29',
            900: '#290f14',
            950: '#14070a',
        },
        purple: { // Deep rose
            50: '#ffe6ed',
            100: '#ffb3c9',
            200: '#ff80a6',
            300: '#ff4d82',
            400: '#ff1a5e',
            500: '#cc004b',
            600: '#a3003c',
            700: '#7a002d',
            800: '#52001e',
            900: '#29000f',
            950: '#140007',
        },
    },
    dark: {
        primary: {
            50: '#14000a',
            100: '#290014',
            200: '#520029',
            300: '#7a003d',
            400: '#a30052',
            500: '#cc0066',
            600: '#ff1a80',
            700: '#ff4d9c',
            800: '#ff80b8',
            900: '#ffb3d4',
            950: '#ffe6f0',
        },
    }
});

export default TritanPreset;