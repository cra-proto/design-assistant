import { Project, SyntaxKind } from 'ts-morph';
import path from 'path';
import fs from 'fs';
import { PRIMENG_SELECTORS } from './prime-selectors.mjs';

const args = process.argv.slice(2);
const isCheck = args.includes('--check');
const targetFile = args.find(a => !a.startsWith('--'));
const glob = targetFile ?? 'src/**/*.component.ts';

const GROUPS = [/^@angular\//, /^@ngx-translate\//, /^primeng\//];
function groupIndex(modulePath) {
  const i = GROUPS.findIndex(re => re.test(modulePath));
  return i === -1 ? GROUPS.length : i;
}

const project = new Project({ tsConfigFilePath: 'tsconfig.json' });
const files = project.addSourceFilesAtPaths(glob);

if (files.length === 0) {
  console.log(`No files matched: ${glob}`);
  process.exit(0);
}

const report = { unused: [], unmapped: [], reordered: [] };

for (const sourceFile of files) {
  const filePath = sourceFile.getFilePath();
  const identifierToModule = new Map();
  for (const imp of sourceFile.getImportDeclarations()) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    for (const named of imp.getNamedImports()) {
      identifierToModule.set(named.getName(), moduleSpecifier);
    }
  }

  for (const decorator of sourceFile.getDescendantsOfKind(SyntaxKind.Decorator)) {
    if (decorator.getName() !== 'Component') continue;
    const arg = decorator.getArguments()[0];
    const obj = arg?.asKind(SyntaxKind.ObjectLiteralExpression);
    if (!obj) continue;

    let templateText = '';
    const templateProp = obj.getProperty('template');
    const templateUrlProp = obj.getProperty('templateUrl');
    if (templateProp) {
      templateText = templateProp.getFirstDescendantByKind(SyntaxKind.NoSubstitutionTemplateLiteral)?.getText()
        ?? templateProp.getFirstDescendantByKind(SyntaxKind.StringLiteral)?.getText()
        ?? '';
    } else if (templateUrlProp) {
      const urlMatch = templateUrlProp.getText().match(/['"`](.*?)['"`]/);
      if (urlMatch) {
        const htmlPath = path.resolve(path.dirname(filePath), urlMatch[1]);
        if (fs.existsSync(htmlPath)) templateText = fs.readFileSync(htmlPath, 'utf-8');
      }
    }

    const importsProp = obj.getProperty('imports');
    const arrayLiteral = importsProp?.getFirstDescendantByKind(SyntaxKind.ArrayLiteralExpression);
    if (arrayLiteral) {
      const items = arrayLiteral.getElements().map(el => el.getText());
      const sorted = [...items].sort((a, b) => {
        const ga = groupIndex(identifierToModule.get(a) ?? '');
        const gb = groupIndex(identifierToModule.get(b) ?? '');
        return ga !== gb ? ga - gb : a.localeCompare(b);
      });

      if (sorted.join(',') !== items.join(',')) {
        report.reordered.push({
          file: path.relative('.', filePath),
          before: items.join(', '),
          after: sorted.join(', '),
        });
        if (!isCheck) {
          arrayLiteral.replaceWithText(`[${sorted.join(', ')}]`);
        }
      }

      for (const item of items) {
        const modulePath = identifierToModule.get(item);
        if (!modulePath?.startsWith('primeng/')) continue;

        const selectors = PRIMENG_SELECTORS[item];
        if (!selectors) {
          report.unmapped.push({ file: path.relative('.', filePath), name: item });
          continue;
        }
        const used = selectors.some(sel => templateText.includes(sel));
        if (!used) {
          report.unused.push({ file: path.relative('.', filePath), name: item });
        }
      }
    }
  }
}

if (!isCheck) {
  await project.save();
}

console.log(isCheck ? '\n=== DRY RUN — no files written ===' : '\n=== Changes applied ===');

console.log('\n--- Import order changes ---');
if (report.reordered.length === 0) console.log('None found.');
report.reordered.forEach(r => {
  console.log(`  ${r.file}`);
  console.log(`    before: [${r.before}]`);
  console.log(`    after:  [${r.after}]`);
});

console.log('\n--- Unused PrimeNG imports ---');
if (report.unused.length === 0) console.log('None found.');
report.unused.forEach(r => console.log(`  ${r.file}: ${r.name}`));

console.log('\n--- Unmapped PrimeNG imports (add to prime-selectors.mjs) ---');
if (report.unmapped.length === 0) console.log('None found.');
report.unmapped.forEach(r => console.log(`  ${r.file}: ${r.name}`));