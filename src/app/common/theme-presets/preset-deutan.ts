import { definePreset } from '@primeng/themes';
import Material from '@primeng/themes/material';

const DeutanPreset = definePreset(Material, {
    semantic: {
        primary: {
            // primary
            50: '#f4e5ff',
            100: '#e4c2ff',
            200: '#d49eff',
            300: '#c47aff',
            400: '#b557ff', // 5.8 vs. black 
            500: '#7200cc', // 8.1 vs. white 
            600: '#6100ad',
            700: '#50008f',
            800: '#3f0070',
            900: '#33005c',
            950: '#2e0052',
        },
    },
    primitive: {
        green: { // success
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
            50: '#fdf2e7',
            100: '#fbe0c6',
            200: '#f8cea5',
            300: '#f5bc84',
            400: '#f3aa63', // 10.7 vs. black 
            500: '#b3600e', // 4.6 vs. white 
            600: '#98520c',
            700: '#7d430a',
            800: '#623508',
            900: '#512b06',
            950: '#482606',
        },
        yellow: { // warn messages
            50: '#fdf2e7',
            100: '#fbe0c6',
            200: '#f8cea5',
            300: '#f5bc84',
            400: '#f3aa63', // 10.7 vs. black 
            500: '#b3600e', // 4.6 vs. white 
            600: '#98520c',
            700: '#7d430a',
            800: '#623508',
            900: '#512b06',
            950: '#482606',
        },
        sky: { // info buttons
            50: '#e7f9fd',
            100: '#c6f2fb',
            200: '#a5eaf9',
            300: '#83e2f6',
            400: '#62daf4', // 12.9 vs. black 
            500: '#0b8099', // 4.6 vs. white 
            600: '#096d82',
            700: '#085a6b',
            800: '#064654',
            900: '#053a45',
            950: '#04333d',
        },
        blue: { // info messages
            50: '#e7f9fd',
            100: '#c6f2fb',
            200: '#a5eaf9',
            300: '#83e2f6',
            400: '#62daf4', // 12.9 vs. black 
            500: '#0b8099', // 4.6 vs. white 
            600: '#096d82',
            700: '#085a6b',
            800: '#064654',
            900: '#053a45',
            950: '#04333d',
        },
        purple: { // help
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
        }
    },
    dark: {
        primary: {
            50: '#2e0052',
            100: '#33005c',
            200: '#3f0070',
            300: '#50008f',
            400: '#6100ad',
            500: '#7200cc',
            600: '#b557ff',
            700: '#c47aff',
            800: '#d49eff',
            900: '#e4c2ff',
            950: '#f4e5ff',
        },
    }
});

export default DeutanPreset;