// To run this script, use the command:
// node scripts/convert-task-csv.js
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, '..', 'public', 'Task-Inventory-Dec2025.csv');
const OUTPUT_PATH = path.join(__dirname, '..', 'public', 'task-urls.json');

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

function extractUrls(urlString) {
    if (!urlString) return [];

    // Split by comma and trim
    return urlString
        .split(',')
        .map(url => url.trim())
        .filter(url => url.length > 0);
}

function categorizeUrls(urls) {
    const enUrls = new Set();
    const frUrls = new Set();

    urls.forEach(url => {
        const lowerUrl = url.toLowerCase();
        if (lowerUrl.includes('canada.ca/en')) {
            enUrls.add(url);
        } else if (lowerUrl.includes('canada.ca/fr')) {
            frUrls.add(url);
        }
    });

    return {
        en: Array.from(enUrls),
        fr: Array.from(frUrls)
    };
}

function convertCSVToJSON() {
    console.log('Reading CSV file...');
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');

    console.log('Parsing CSV...');
    const rows = parseCSV(csvContent);

    // Get header row and find column indices
    const headers = rows[0].map(h => h.trim());
    const idIndex = headers.indexOf('Unique ID');
    const taskIndex = headers.indexOf('Task');
    const taskFRIndex = headers.indexOf('Task FR');
    const mainUrlIndex = headers.indexOf('Main URL');
    const lookupPagesIndex = headers.indexOf('Lookup_Pages');

    if (idIndex === -1 || taskIndex === -1 || taskFRIndex === -1 || mainUrlIndex === -1 || lookupPagesIndex === -1) {
        console.error('Missing required columns!');
        console.error('Found headers:', headers);
        process.exit(1);
    }

    console.log(`Found columns at indices: Id=${idIndex}, Task=${taskIndex}, Task FR=${taskFRIndex}, Main URL=${mainUrlIndex}, Lookup_Pages=${lookupPagesIndex}`);

    const tasks = [];
    let skippedCount = 0;

    // Process data rows
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];

        if (row.length <= Math.max(taskIndex, taskFRIndex, mainUrlIndex, lookupPagesIndex)) {
            continue; // Skip incomplete rows
        }

        const taskNameEN = row[taskIndex]?.trim();
        const taskNameFR = row[taskFRIndex]?.trim();
        const mainUrl = row[mainUrlIndex]?.trim();
        const lookupPages = row[lookupPagesIndex]?.trim();

        if (!taskNameEN) {
            continue; // Skip rows without task name
        }

        // Combine all URLs into one set
        const allUrls = [
            ...extractUrls(mainUrl),
            ...extractUrls(lookupPages)
        ];

        // Categorize URLs
        const categorized = categorizeUrls(allUrls);

        // Skip tasks with no valid URLs
        if (categorized.en.length === 0 && categorized.fr.length === 0) {
            skippedCount++;
            continue;
        }

        tasks.push({
            id: parseInt(row[idIndex], 10),
            taskNameEN,
            taskNameFR,
            urlsEN: categorized.en,
            urlsFR: categorized.fr
        });
    }

    console.log(`Processed ${tasks.length} tasks (skipped ${skippedCount} tasks with no valid URLs)`);

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON file
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(tasks, null, 2));
    console.log(`JSON file created at: ${OUTPUT_PATH}`);

    // Print some stats
    const totalEnUrls = tasks.reduce((sum, task) => sum + task.urlsEN.length, 0);
    const totalFrUrls = tasks.reduce((sum, task) => sum + task.urlsFR.length, 0);
    console.log(`  - Total EN URLs: ${totalEnUrls}`);
    console.log(`  - Total FR URLs: ${totalFrUrls}`);
}

try {
    convertCSVToJSON();
} catch (error) {
    console.error('Error converting CSV:', error);
    process.exit(1);
}