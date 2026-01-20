// To run this script, use the command:
// node scripts/convert-visits-csv.js
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'upd-data-table_export_clean_2026-01-13.csv');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'visits-urls.json');

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
                // Escaped quote
                currentField += '"';
                i++; // Skip next quote
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // End of field
            currentLine.push(currentField);
            currentField = '';
        } else if (char === '\n' && !inQuotes) {
            // End of line
            currentLine.push(currentField);
            lines.push(currentLine);
            currentLine = [];
            currentField = '';
        } else if (char === '\r' && nextChar === '\n' && !inQuotes) {
            // Windows line ending
            currentLine.push(currentField);
            lines.push(currentLine);
            currentLine = [];
            currentField = '';
            i++; // Skip \n
        } else {
            currentField += char;
        }
    }

    // Handle last field/line
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

    // Get header row and find column indices
    const headers = rows[0].map(h => h.trim());
    const titleIndex = headers.indexOf('Title');
    const statusIndex = headers.indexOf('Current status');
    const urlIndex = headers.indexOf('URL');
    const visitsIndex = headers.indexOf('Visits');

    if (titleIndex === -1 || statusIndex === -1 || urlIndex === -1 || visitsIndex === -1) {
        console.error('Missing required columns!');
        console.error('Found headers:', headers);
        process.exit(1);
    }

    console.log(`Found columns at indices: Title=${titleIndex}, Status=${statusIndex}, URL=${urlIndex}, Visits=${visitsIndex}`);

    const visitData = [];
    let skippedCount = 0;

    // Process data rows
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        if (row.length <= Math.max(titleIndex, statusIndex, urlIndex, visitsIndex)) {
            continue; // Skip incomplete rows
        }

        const title = row[titleIndex]?.trim();
        const status = row[statusIndex]?.trim();
        const url = row[urlIndex]?.trim();
        const visits = row[visitsIndex]?.trim();

        if (!url) {
            skippedCount++;
            continue; // Skip rows without URL
        }

        visitData.push({
            url,
            title: title || '',
            status: status || '',
            visits: visits ? parseInt(visits.replace(/,/g, ''), 10) : 0
        });
    }

    console.log(`Processed ${visitData.length} URLs (skipped ${skippedCount} rows without URLs)`);

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON file
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(visitData, null, 2));
    console.log(`JSON file created at: ${OUTPUT_PATH}`);

    // Print some stats
    const totalVisits = visitData.reduce((sum, item) => sum + item.visits, 0);
    console.log(`  - Total visits: ${totalVisits.toLocaleString()}`);
    console.log(`  - Average visits per URL: ${Math.round(totalVisits / visitData.length).toLocaleString()}`);
}

try {
    convertCSVToJSON();
} catch (error) {
    console.error('Error converting CSV:', error);
    process.exit(1);
}