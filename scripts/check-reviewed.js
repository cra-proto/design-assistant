#!/usr/bin/env node
/**
 * Scans component/service folders for a "Reviewed: <date> (ngNN)" JSDoc
 * comment and reports which files have/haven't been reviewed. Read-only —
 * never modifies files.
 *
 * Usage:
 *   node scripts/check-reviewed.js
 *   node scripts/check-reviewed.js --dir=components
 *   node scripts/check-reviewed.js --dir=template
 *   node scripts/check-reviewed.js --dir=views
 *   node scripts/check-reviewed.js --dir=services
 *   node scripts/check-reviewed.js --dir=component-services
 *   node scripts/check-reviewed.js --unreviewed
 *   node scripts/check-reviewed.js --json
 *   node scripts/check-reviewed.js --older-than=90        (days since review)
 *   node scripts/check-reviewed.js --older-than-ng=22      (reviewed before ngNN)
 *   node scripts/check-reviewed.js --older-than=90 --older-than-ng=22   (either counts as stale)
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

// Folder shortcuts — adjust here if the project structure changes.
const DIR_MAP = {
    components: ['src/app/components'],
    template: ['src/app/template'],
    views: ['src/app/views'],
    services: ['src/app/services'],
    // component-specific services live inside the component folders themselves
    'component-services': ['src/app/components', 'src/app/template', 'src/app/views'],
    all: ['src/app/components', 'src/app/template', 'src/app/views', 'src/app/services'],
};

const REVIEWED_PATTERN = /Reviewed:\s*(\d{4}-\d{2}-\d{2})\s*\(ng(\d+)\)/;

const args = process.argv.slice(2);
const getFlag = (name) => {
    const arg = args.find((a) => a.startsWith(`--${name}=`));
    return arg ? arg.split('=')[1] : null;
};
const hasFlag = (name) => args.includes(`--${name}`);

const dirFlag = getFlag('dir') || 'all';
const showUnreviewedOnly = hasFlag('unreviewed');
const jsonOutput = hasFlag('json');
const olderThanDays = getFlag('older-than') ? parseInt(getFlag('older-than'), 10) : null;
const olderThanNgVersion = getFlag('older-than-ng') ? parseInt(getFlag('older-than-ng'), 10) : null;

if (!DIR_MAP[dirFlag]) {
    console.error(`Unknown --dir value "${dirFlag}". Valid: ${Object.keys(DIR_MAP).join(', ')}`);
    process.exit(1);
}

function findFiles(dir, suffix, results = []) {
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'dist') continue;
            findFiles(fullPath, suffix, results);
        } else if (entry.isFile() && entry.name.endsWith(suffix)) {
            results.push(fullPath);
        }
    }
    return results;
}

function daysAgo(dateStr) {
    const then = new Date(dateStr);
    const now = new Date();
    return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function collectFiles(dirKey, suffix) {
    const dirs = DIR_MAP[dirKey].map((d) => path.join(ROOT, d));
    let files = dirs.flatMap((d) => findFiles(d, suffix));

    // component-services: only keep *.service.ts co-located with components
    // (this IS the suffix filter already — findFiles with '.service.ts' inside
    // component dirs naturally captures only colocated services)

    return files;
}

function analyze(files) {
    const reviewed = [];
    const unreviewed = [];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const match = content.match(REVIEWED_PATTERN);
        const relPath = path.relative(ROOT, file);

        if (match) {
            const [, date, ngVersionStr] = match;
            const ngVersion = parseInt(ngVersionStr, 10);
            const age = daysAgo(date);

            const isStaleByAge = olderThanDays !== null && age > olderThanDays;
            const isStaleByVersion = olderThanNgVersion !== null && ngVersion < olderThanNgVersion;

            if (isStaleByAge || isStaleByVersion) {
                const reasons = [];
                if (isStaleByAge) reasons.push(`${age}d old`);
                if (isStaleByVersion) reasons.push(`ng${ngVersion} < ng${olderThanNgVersion}`);
                unreviewed.push({ file: relPath, reason: `stale (${reasons.join(', ')})` });
            } else {
                reviewed.push({ file: relPath, date, ngVersion: `ng${ngVersion}`, age });
            }
        } else {
            unreviewed.push({ file: relPath });
        }
    }

    return { reviewed, unreviewed };
}

function printSummary(label, { reviewed, unreviewed }) {
    const total = reviewed.length + unreviewed.length;
    if (total === 0) {
        console.log(`\n${label}: no files found`);
        return;
    }
    console.log(`\n${label}: ${reviewed.length} / ${total} reviewed`);

    if (showUnreviewedOnly || unreviewed.length > 0) {
        console.log(`  Not yet reviewed (${unreviewed.length}):`);
        for (const item of unreviewed) {
            const reason = item.reason ? ` [${item.reason}]` : '';
            console.log(`    - ${item.file}${reason}`);
        }
    }

    if (!showUnreviewedOnly && reviewed.length > 0) {
        console.log(`  Reviewed (${reviewed.length}):`);
        for (const item of reviewed) {
            console.log(`    - ${item.file} (${item.date}, ${item.ngVersion}, ${item.age}d ago)`);
        }
    }
}

function main() {
    const categories = dirFlag === 'all' ? ['components', 'services'] : [dirFlag];

    const results = {};

    if (dirFlag === 'all') {
        results.components = analyze([
            ...collectFiles('components', '.component.ts'),
            ...collectFiles('template', '.component.ts'),
            ...collectFiles('views', '.component.ts'),
        ]);
        results.services = analyze(collectFiles('services', '.service.ts'));
        results['component-services'] = analyze(collectFiles('component-services', '.service.ts'));
    } else if (dirFlag === 'services' || dirFlag === 'component-services') {
        results[dirFlag] = analyze(collectFiles(dirFlag, '.service.ts'));
    } else {
        // components / template / views
        results[dirFlag] = analyze(collectFiles(dirFlag, '.component.ts'));
    }

    if (jsonOutput) {
        console.log(JSON.stringify(results, null, 2));
        return;
    }

    for (const [key, value] of Object.entries(results)) {
        printSummary(key, value);
    }

    const totalReviewed = Object.values(results).reduce((sum, r) => sum + r.reviewed.length, 0);
    const totalFiles = Object.values(results).reduce(
        (sum, r) => sum + r.reviewed.length + r.unreviewed.length,
        0
    );
    console.log(`\nOverall: ${totalReviewed} / ${totalFiles} reviewed\n`);
}

main();