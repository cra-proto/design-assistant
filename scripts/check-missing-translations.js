// To run this script, use one of these commands after running i18n:clean:
// node scripts/check-missing-translations.js en
// node scripts/check-missing-translations.js fr
// Or use this to run i18:extract and both language versions of this script:
// npm run i18n:check
// Or use this to run i18:extract, i18n:clean and both language versions of compare-translations.js and this script:
// npm run i18n:qa

const fs = require('fs');
const path = require('path');

const lang = process.argv[2] || 'en';

const filePath = `public/i18n/${lang}.json`;

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    cyan: '\x1b[36m'
};

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

const translations = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const keys = Object.keys(translations);

// Find empty or whitespace-only values
const emptyKeys = keys.filter(key => {
    const value = translations[key];
    return value === '' || (typeof value === 'string' && value.trim() === '');
});

// Find keys that are just separators/comments (start with -----)
const separatorKeys = keys.filter(key =>
    translations[key].startsWith('-----')
);

console.log(`${colors.cyan}\n${lang.toUpperCase()} - empty string check:${colors.reset}`);
console.log(`Total keys: ${keys.length}`);
console.log(`Separator keys: ${separatorKeys.length}`);

if (emptyKeys.length > 0) {
    console.log(`\n${emptyKeys.length} empty translations found:`);
    emptyKeys.forEach(key => console.log(`  - ${key}`));
    console.log(`${colors.red}\nAdd content to the ${lang.toUpperCase()} keys above before pushing your changes.\n${colors.reset}`);
} else {
    console.log(`${colors.green}\nAll ${lang.toUpperCase()} translations have values!\n${colors.reset}`);
}