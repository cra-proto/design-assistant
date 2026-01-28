import { definePreset } from '@primeng/themes';

import Material from '@primeng/themes/material';



const CustomPreset = definePreset(Material, {

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

            50: '#eafaea',

            100: '#cdf4cd',

            200: '#b0edb0',

            300: '#93e693',

            400: '#76e076', // 12.7 vs. black

            500: '#2ec92e', // 2.2 vs. white (fail)

            600: '#27ab27',

            700: '#208d20',

            800: '#196f19',

            900: '#155a15',

            950: '#125012',

        },

        red: { // danger

            50: '#fee7e7',

            100: '#fcc5c5',

            200: '#f9a4a4',

            300: '#f78282',

            400: '#f56060', // 6.7 vs. black

            500: '#e80e0e', // 4.7 vs. white

            600: '#c50c0c',

            700: '#a20a0a',

            800: '#800808',

            900: '#680606',

            950: '#5d0606',

        },

        orange: { // warn buttons

            50: '#fdf3e7',

            100: '#fbe3c6',

            200: '#f9d3a4',

            300: '#f6c283',

            400: '#f4b262', // 11.4 vs. black

            500: '#e38410', // 2.8 vs. white (fail)

            600: '#c1700e',

            700: '#9f5c0b',

            800: '#7d4909',

            900: '#663b07',

            950: '#5b3506',

        },

        yellow: { // warn messages

            50: '#fdf3e7',

            100: '#fbe3c6',

            200: '#f9d3a4',

            300: '#f6c283',

            400: '#f4b262', // 11.4 vs. black

            500: '#e38410', // 2.8 vs. white (fail)

            600: '#c1700e',

            700: '#9f5c0b',

            800: '#7d4909',

            900: '#663b07',

            950: '#5b3506',

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



export default CustomPreset;