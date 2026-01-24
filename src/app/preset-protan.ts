import { definePreset } from '@primeng/themes';
import Material from '@primeng/themes/material';

const ProtanPreset = definePreset(Material, {
    semantic: {
        primary: {
            // Deep Blue - distinct from cyan success
            50: '#e6eeff',
            100: '#b3ccff',
            200: '#80aaff',
            300: '#4d88ff',
            400: '#1a66ff',
            500: '#0044cc', // Deep blue = primary actions
            600: '#0036a3',
            700: '#00297a',
            800: '#001c52',
            900: '#000e29',
            950: '#000714',
        },
    },
    primitive: {
        green: { // Cyan/Teal for "positive" - protan users see cyan well
            50: '#e6ffff',
            100: '#b3ffff',
            200: '#80ffff',
            300: '#4dffff',
            400: '#1affff',
            500: '#00cccc', // Bright cyan = positive/go
            600: '#00a3a3',
            700: '#007a7a',
            800: '#005252',
            900: '#002929',
            950: '#001414',
        },
        red: { // Deep yellow for "negative"
            50: '#fffce6',
            100: '#fff7b3',
            200: '#fff280',
            300: '#ffed4d',
            400: '#ffe81a',
            500: '#ccba00', // Yellow-gold = caution/stop
            600: '#a39500',
            700: '#7a7000',
            800: '#524b00',
            900: '#292500',
            950: '#141300',
        },
        orange: { // Warm amber
            50: '#fff9e6',
            100: '#ffedb3',
            200: '#ffe180',
            300: '#ffd54d',
            400: '#ffc91a',
            500: '#cca100',
            600: '#a38100',
            700: '#7a6100',
            800: '#524000',
            900: '#292000',
            950: '#141000',
        },
        sky: { // Light cyan
            50: '#e6ffff',
            100: '#b3f7f7',
            200: '#80eded',
            300: '#4de3e3',
            400: '#1ad9d9',
            500: '#00adad',
            600: '#008a8a',
            700: '#006868',
            800: '#004545',
            900: '#002323',
            950: '#001111',
        },
        purple: { // Purple-blue
            50: '#ebe6ff',
            100: '#c9b3ff',
            200: '#a780ff',
            300: '#854dff',
            400: '#631aff',
            500: '#4d00cc',
            600: '#3e00a3',
            700: '#2f007a',
            800: '#1f0052',
            900: '#100029',
            950: '#080014',
        },
    },
    dark: {
        primary: {
            50: '#000714',
            100: '#000e29',
            200: '#001c52',
            300: '#00297a',
            400: '#0036a3',
            500: '#0044cc',
            600: '#1a66ff',
            700: '#4d88ff',
            800: '#80aaff',
            900: '#b3ccff',
            950: '#e6eeff',
        },
    }
});

export default ProtanPreset;