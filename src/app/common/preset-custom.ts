import { definePreset } from '@primeng/themes';
import Material from '@primeng/themes/material';

const CustomPreset = definePreset(Material, {
    semantic: {
        primary: {
            // primary
            50: '#f3ebfa',
            100: '#e2cef2',
            200: '#d1b2eb',
            300: '#c196e4',
            400: '#b079dc', // 6.6 vs. black 
            500: '#7c30ba', // 7.0 vs. white 
            600: '#69299e',
            700: '#572282',
            800: '#441a66',
            900: '#381654',
            950: '#32134a',
        },
    },
    primitive: {
        green: { // success
            50: '#e8fdf5',
            100: '#c8f9e8',
            200: '#a8f6da',
            300: '#87f2cd',
            400: '#67efbf', // 14.7 vs. black 
            500: '#0b6646', // 7.0 vs. white 
            600: '#09573c',
            700: '#084731',
            800: '#063827',
            900: '#052e20',
            950: '#04291c',
        },
        red: { // danger
            50: '#fee6e6',
            100: '#fdc4c4',
            200: '#fba2a2',
            300: '#fa7f7f',
            400: '#f95d5d', // 6.8 vs. black 
            500: '#b50707', // 7.0 vs. white 
            600: '#9a0606',
            700: '#7f0505',
            800: '#640404',
            900: '#510303',
            950: '#480303',
        },
        orange: { // warn buttons
            50: '#fdf0e7',
            100: '#fadbc6',
            200: '#f8c5a5',
            300: '#f5b084',
            400: '#f29b63', // 9.6 vs. black 
            500: '#94410c', // 7.0 vs. white 
            600: '#7e370a',
            700: '#682d08',
            800: '#512407',
            900: '#431d05',
            950: '#3b1a05',
        },
        yellow: { // warn messages
            50: '#fdf0e7',
            100: '#fadbc6',
            200: '#f8c5a5',
            300: '#f5b084',
            400: '#f29b63', // 9.6 vs. black 
            500: '#94410c', // 7.0 vs. white 
            600: '#7e370a',
            700: '#682d08',
            800: '#512407',
            900: '#431d05',
            950: '#3b1a05',
        },
        sky: { // info buttons
            50: '#e7f6fd',
            100: '#c6e9fa',
            200: '#a5dcf8',
            300: '#84cff5',
            400: '#63c2f3', // 10.5 vs. black 
            500: '#0b5f8a', // 7.0 vs. white 
            600: '#095175',
            700: '#084361',
            800: '#06344c',
            900: '#052b3e',
            950: '#042637',
        },
        blue: { // info messages
            50: '#e7f6fd',
            100: '#c6e9fa',
            200: '#a5dcf8',
            300: '#84cff5',
            400: '#63c2f3', // 10.5 vs. black 
            500: '#0b5f8a', // 7.0 vs. white 
            600: '#095175',
            700: '#084361',
            800: '#06344c',
            900: '#052b3e',
            950: '#042637',
        },
        purple: { // help
            50: '#fde8f7',
            100: '#f9c8eb',
            200: '#f6a8df',
            300: '#f287d4',
            400: '#ef67c8', // 7.4 vs. black 
            500: '#a6127c', // 7.0 vs. white 
            600: '#8d0f69',
            700: '#740d57',
            800: '#5b0a44',
            900: '#4b0838',
            950: '#420732',
        }
    },
    dark: {
        primary: {
            50: '#32134a',
            100: '#381654',
            200: '#441a66',
            300: '#572282',
            400: '#69299e',
            500: '#7c30ba',
            600: '#b079dc',
            700: '#c196e4',
            800: '#d1b2eb',
            900: '#e2cef2',
            950: '#f3ebfa',
        },
    }
});

export default CustomPreset;