// To run this script, use the command:
// node scripts/convert-vanities-csv.js
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'vanities-mar2026.csv');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'vanity-urls.json');

// Simple CSV parser (handles quoted fields with commas)
function parseCSV(csvText) {
    const lines = [];
    let currentLine = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentField += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentLine.push(currentField);
            currentField = '';
        } else if (char === '\n' && !inQuotes) {
            currentLine.push(currentField);
            lines.push(currentLine);
            currentLine = [];
            currentField = '';
        } else if (char === '\r' && nextChar === '\n' && !inQuotes) {
            currentLine.push(currentField);
            lines.push(currentLine);
            currentLine = [];
            currentField = '';
            i++;
        } else {
            currentField += char;
        }
    }

    if (currentField || currentLine.length > 0) {
        currentLine.push(currentField);
        lines.push(currentLine);
    }

    return lines;
}

function convertCSVToJSON() {
    console.log('Reading CSV file...');
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');

    console.log('Parsing CSV...');
    const rows = parseCSV(csvContent);

    const headers = rows[0].map(h => h.trim());
    const vanityIndex = headers.indexOf('Vanity');
    const destinationIndex = headers.indexOf('Destination Page URL (Final)');

    if (vanityIndex === -1 || destinationIndex === -1) {
        console.error('Missing required columns!');
        console.error('Found headers:', headers);
        process.exit(1);
    }

    const map = {};
    let skipped = 0;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length <= Math.max(vanityIndex, destinationIndex)) { skipped++; continue; }

        const vanity = row[vanityIndex]?.trim();
        const destination = row[destinationIndex]?.trim().split('?')[0];

        if (!vanity || !destination) { skipped++; continue; }

        if (!map[destination]) map[destination] = [];
        map[destination].push(vanity);
    }

    const result = Object.entries(map).map(([destination, vanity]) => ({ destination, vanity }));

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
    console.log(`Done: ${result.length} destination entries, ${skipped} rows skipped`);
    console.log(`JSON file created at: ${OUTPUT_PATH}`);
}

try {
    convertCSVToJSON();
} catch (error) {
    console.error('Error converting CSV:', error);
    process.exit(1);
}