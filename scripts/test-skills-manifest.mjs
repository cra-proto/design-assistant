import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const generator = path.resolve('scripts/generate-skills-manifest.mjs');
const cases = [
  {
    name: 'valid package',
    root: 'scripts/fixtures/skills/valid',
    success: true,
    message: 'Validated 1 skill package',
  },
  {
    name: 'missing resource',
    root: 'scripts/fixtures/skills/invalid-missing',
    success: false,
    message: 'resource does not exist',
  },
  {
    name: 'circular dependency',
    root: 'scripts/fixtures/skills/invalid-cycle',
    success: false,
    message: 'Circular skill dependency',
  },
];

for (const testCase of cases) {
  const result = spawnSync(process.execPath, [generator, '--root', testCase.root, '--validate'], {
    encoding: 'utf8',
  });
  const output = `${result.stdout}${result.stderr}`;
  const succeeded = result.status === 0;

  if (succeeded !== testCase.success || !output.includes(testCase.message)) {
    console.error(`Skill manifest test failed: ${testCase.name}`);
    console.error(output.trim());
    process.exit(1);
  }
  console.log(`Passed: ${testCase.name}`);
}
