// To run this script, use one of these commands after running i18n:clean:
// node scripts/compare-translations.js en
// node scripts/compare-translations.js fr
// Or use this to run i18:clean and both language versions of this script:
// npm run i18n:compare
// Or use this to run i18n:extract, i18n:clean and both language versions of this script and check-missing-translations.js:
// npm run i18n:qa

const fs = require('fs');
const path = require('path');

const lang = process.argv[2] || 'en';

const file1Path = `public/i18n/${lang}.json`;
const file2Path = `public/i18n/${lang}-clean.json`;

const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    cyan: '\x1b[36m'
};

if (!fs.existsSync(file1Path) || !fs.existsSync(file2Path)) {
    console.error(`${colors.red}\nFiles not found for language: ${lang}. Try running "npm run i18n:compare"\n${colors.reset}`);
    process.exit(1);
}

const file1 = JSON.parse(fs.readFileSync(file1Path, 'utf-8'));
const file2 = JSON.parse(fs.readFileSync(file2Path, 'utf-8'));

const keys1 = Object.keys(file1);
const keys2 = Object.keys(file2);

const onlyInFile1 = keys1.filter(key => !keys2.includes(key));
const onlyInFile2 = keys2.filter(key => !keys1.includes(key));

console.log(`${colors.cyan}\n${lang.toUpperCase()} - translation comparison results:${colors.reset}`);
console.log(`${lang}.json: ${keys1.length} keys`);
console.log(`${lang}-clean.json: ${keys2.length} keys`);

if (onlyInFile1.length > 0) {
    console.log(`\n${onlyInFile1.length} keys only in ${lang}.json:`);
    onlyInFile1.forEach(key => console.log(`  - ${key}`));
    console.log(`\nIf the keys above are:`);
    console.log(`  - dynamic, use marker to mark them for translation `)
    console.log(`  - temporarily commented out, do not remove them`)
    console.log(`  - no longer used, remove them from the translation file`)
    console.log(`${colors.red}\nIdentify and fix the issues with the ${lang.toUpperCase()} keys above before pushing your changes.\n${colors.reset}`)
}

if (onlyInFile2.length > 0) {
    console.log(`\n${onlyInFile2.length} keys only in ${lang}-clean.json:`);
    onlyInFile2.forEach(key => console.log(`  - ${key}`));
    console.log('\nUse "npm run i18n:extract" to add the keys to the translation file and then add your text.')
    console.log(`${colors.red}\nThe ${lang.toUpperCase()} keys above are missing translations. Add them before you push your updates.\n${colors.reset}`)
}

if (onlyInFile1.length === 0 && onlyInFile2.length === 0) {
    fs.unlinkSync(file2Path);
    console.log(`\nComparison complete. Deleted temporary file ${lang}-clean.json`);
    console.log(`${colors.green}\n${lang.toUpperCase()} files have identical keys! Go ahead and push your updates.${colors.reset}\n`);
}
