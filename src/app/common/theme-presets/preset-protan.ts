import { definePreset } from '@primeng/themes';
import Material from '@primeng/themes/material';

const ProtanPreset = definePreset(Material, {
    semantic: {
        primary: {
            // primary
            50: '#e5f2ff',
            100: '#c2e0ff',
            200: '#9ecfff',
            300: '#7abdff',
            400: '#57abff', // 8.7 vs. black 
            500: '#0066cc', // 5.6 vs. white 
            600: '#0057ad',
            700: '#00478f',
            800: '#003870',
            900: '#002e5c',
            950: '#002952',
        },
    },
    primitive: {
        green: { // success
            50: '#eafbf2',
            100: '#ccf4e1',
            200: '#afeecf',
            300: '#91e8bd',
            400: '#74e2ab', // 13.2 vs. black 
            500: '#1b824f', // 4.8 vs. white 
            600: '#176f43',
            700: '#135b37',
            800: '#0f482b',
            900: '#0c3b24',
            950: '#0b3420',
        },
        red: { // danger
            50: '#fdf5e8',
            100: '#f9e7c8',
            200: '#f6d9a8',
            300: '#f2cb87',
            400: '#efbe67', // 12.2 vs. black 
            500: '#9e6b11', // 4.6 vs. white 
            600: '#865b0e',
            700: '#6f4b0c',
            800: '#573b09',
            900: '#473008',
            950: '#3f2b07',
        },
        orange: { // warn buttons
            50: '#fefce6',
            100: '#fdf8c4',
            200: '#fcf4a1',
            300: '#fbf07e',
            400: '#faec5c', // 17.2 vs. black 
            500: '#827704', // 4.6 vs. white 
            600: '#6e6503',
            700: '#5b5303',
            800: '#484102',
            900: '#3b3602',
            950: '#343002',
        },
        yellow: { // warn messages
            50: '#fefce6',
            100: '#fdf8c4',
            200: '#fcf4a1',
            300: '#fbf07e',
            400: '#faec5c', // 17.2 vs. black 
            500: '#827704', // 4.6 vs. white 
            600: '#6e6503',
            700: '#5b5303',
            800: '#484102',
            900: '#3b3602',
            950: '#343002',
        },
        sky: { // info buttons
            50: '#e8fcfc',
            100: '#c9f8f8',
            200: '#a9f4f4',
            300: '#89f0f0',
            400: '#69eded', // 14.9 vs. black 
            500: '#108282', // 4.6 vs. white 
            600: '#0e6e6e',
            700: '#0b5b5b',
            800: '#094848',
            900: '#073a3a',
            950: '#063434',
        },
        blue: { // info messages
            50: '#e8fcfc',
            100: '#c9f8f8',
            200: '#a9f4f4',
            300: '#89f0f0',
            400: '#69eded', // 14.9 vs. black 
            500: '#108282', // 4.6 vs. white 
            600: '#0e6e6e',
            700: '#0b5b5b',
            800: '#094848',
            900: '#073a3a',
            950: '#063434',
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
            50: '#002952',
            100: '#002e5c',
            200: '#003870',
            300: '#00478f',
            400: '#0057ad',
            500: '#0066cc',
            600: '#57abff',
            700: '#7abdff',
            800: '#9ecfff',
            900: '#c2e0ff',
            950: '#e5f2ff',
        },
    }
});

export default ProtanPreset;