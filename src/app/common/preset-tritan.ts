import { definePreset } from '@primeng/themes';
import Material from '@primeng/themes/material';

const TritanPreset = definePreset(Material, {
    semantic: {
        primary: {
            // primary
            50: '#ffe5f6',
            100: '#ffc2e9',
            200: '#ff9edc',
            300: '#ff7acf',
            400: '#ff57c2', // 7.4 vs. black 
            500: '#cc0082', // 5.4 vs. white 
            600: '#ad006e',
            700: '#8f005b',
            800: '#700047',
            900: '#5c003a',
            950: '#520034',
        },
    },
    primitive: {
        green: { // success
            50: '#e8fce8',
            100: '#c9f8c9',
            200: '#aaf4aa',
            300: '#8aef8a',
            400: '#6beb6b', // 13.7 vs. black 
            500: '#128712', // 4.7 vs. white 
            600: '#0f730f',
            700: '#0d5f0d',
            800: '#0a4a0a',
            900: '#083d08',
            950: '#073607',
        },
        red: { // danger
            50: '#ffe5e5',
            100: '#ffc2c2',
            200: '#ff9e9e',
            300: '#ff7a7a',
            400: '#ff5757', // 6.8 vs. black 
            500: '#cc0000', // 5.9 vs. white 
            600: '#ad0000',
            700: '#8f0000',
            800: '#700000',
            900: '#5c0000',
            950: '#520000',
        },
        orange: { // warn buttons
            50: '#fdf3e7',
            100: '#fae3c6',
            200: '#f8d2a5',
            300: '#f5c284',
            400: '#f2b263', // 11.3 vs. black 
            500: '#ab640e', // 4.6 vs. white 
            600: '#91550c',
            700: '#78460a',
            800: '#5e3708',
            900: '#4d2d06',
            950: '#442806',
        },
        yellow: { // warn messages
            50: '#fdf3e7',
            100: '#fae3c6',
            200: '#f8d2a5',
            300: '#f5c284',
            400: '#f2b263', // 11.3 vs. black 
            500: '#ab640e', // 4.6 vs. white 
            600: '#91550c',
            700: '#78460a',
            800: '#5e3708',
            900: '#4d2d06',
            950: '#442806',
        },
        sky: { // info buttons
            50: '#e7fdfd',
            100: '#c6fbfb',
            200: '#a4f9f9',
            300: '#83f6f6',
            400: '#62f4f4', // 15.8 vs. black 
            500: '#098282', // 4.6 vs. white 
            600: '#086e6e',
            700: '#065b5b',
            800: '#054848',
            900: '#043a3a',
            950: '#043434',
        },
        blue: { // info messages
            50: '#e7fdfd',
            100: '#c6fbfb',
            200: '#a4f9f9',
            300: '#83f6f6',
            400: '#62f4f4', // 15.8 vs. black 
            500: '#098282', // 4.6 vs. white 
            600: '#086e6e',
            700: '#065b5b',
            800: '#054848',
            900: '#043a3a',
            950: '#043434',
        },
        purple: { // help
            50: '#f6e5ff',
            100: '#e9c2ff',
            200: '#dc9eff',
            300: '#cf7aff',
            400: '#c257ff', // 6.1 vs. black 
            500: '#8200cc', // 7.4 vs. white 
            600: '#6e00ad',
            700: '#5b008f',
            800: '#470070',
            900: '#3a005c',
            950: '#340052',
        }
    },
    dark: {
        primary: {
            50: '#520034',
            100: '#5c003a',
            200: '#700047',
            300: '#8f005b',
            400: '#ad006e',
            500: '#cc0082',
            600: '#ff57c2',
            700: '#ff7acf',
            800: '#ff9edc',
            900: '#ffc2e9',
            950: '#ffe5f6',
        },
    }
});

export default TritanPreset;