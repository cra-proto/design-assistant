import { definePreset } from '@primeng/themes';
import Material from '@primeng/themes/material';

const MyPreset = definePreset(Material, {
    semantic: {
        primary: {
            // primary
            50: '#f3ecf9',
            100: '#e2d0f0',
            200: '#d1b5e8',
            300: '#c09adf',
            400: '#af7fd7', // 6.8 vs. black 
            500: '#7636ab', // 7.3 vs. white 
            600: '#642e91',
            700: '#532678',
            800: '#411e5e',
            900: '#35184d',
            950: '#2f1644',
        },
    },
    primitive: {
        green: { // success
            50: '#eafaf2',
            100: '#cdf4e0',
            200: '#b0edce',
            300: '#93e7bc',
            400: '#75e0aa', // 13.0 vs. black 
            500: '#1e8752', // 4.5 vs. white 
            600: '#197346',
            700: '#155e39',
            800: '#114a2d',
            900: '#0d3d25',
            950: '#0c3621',
        },
        red: { // danger
            50: '#ffe5eb',
            100: '#ffc2ce',
            200: '#ff9eb2',
            300: '#ff7a95',
            400: '#ff5779', // 6.9 vs. black 
            500: '#c50028', // 6.2 vs. white 
            600: '#a70022',
            700: '#8a001c',
            800: '#6c0016',
            900: '#590012',
            950: '#4f0010',
        },
        orange: { // warn buttons
            50: '#fef0e7',
            100: '#fcdac5',
            200: '#fac5a3',
            300: '#f9b081',
            400: '#f79b5f', // 9.8 vs. black 
            500: '#c4530a', // 4.6 vs. white 
            600: '#a74708',
            700: '#893a07',
            800: '#6c2e06',
            900: '#582504',
            950: '#4e2104',
        },
        yellow: { // warn messages
            50: '#fef0e7',
            100: '#fcdac5',
            200: '#fac5a3',
            300: '#f9b081',
            400: '#f79b5f', // 9.8 vs. black 
            500: '#c4530a', // 4.6 vs. white 
            600: '#a74708',
            700: '#893a07',
            800: '#6c2e06',
            900: '#582504',
            950: '#4e2104',
        },
        sky: { // info buttons
            50: '#e8f6fc',
            100: '#c8e8f8',
            200: '#a8dbf5',
            300: '#89cef1',
            400: '#69c1ed', // 10.5 vs. black 
            500: '#157cb0', // 4.6 vs. white 
            600: '#126996',
            700: '#0f577b',
            800: '#0c4461',
            900: '#09384f',
            950: '#083246',
        },
        blue: { // info messages
            50: '#e8f6fc',
            100: '#c8e8f8',
            200: '#a8dbf5',
            300: '#89cef1',
            400: '#69c1ed', // 10.5 vs. black 
            500: '#157cb0', // 4.6 vs. white 
            600: '#126996',
            700: '#0f577b',
            800: '#0c4461',
            900: '#09384f',
            950: '#083246',
        },
        purple: { // help
            50: '#ffe5f8',
            100: '#ffc2ee',
            200: '#ff9ee3',
            300: '#ff7ad9',
            400: '#ff57cf', // 7.5 vs. black 
            500: '#a80078', // 7.2 vs. white 
            600: '#8f0066',
            700: '#760054',
            800: '#5c0042',
            900: '#4c0036',
            950: '#430030',
        }
    },
    dark: {
        primary: {
            50: '#2f1644',
            100: '#35184d',
            200: '#411e5e',
            300: '#532678',
            400: '#642e91',
            500: '#7636ab',
            600: '#af7fd7',
            700: '#c09adf',
            800: '#d1b5e8',
            900: '#e2d0f0',
            950: '#f3ecf9',
        },
    }
});

export default MyPreset;