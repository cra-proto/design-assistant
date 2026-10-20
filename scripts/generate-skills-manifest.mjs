import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ALLOWED_OUTPUT_MODES = new Set(['any', 'html', 'json', 'text']);
const CONFIG_FILE = 'skill.json';
const INSTRUCTIONS_FILE = 'SKILL.md';

function readArguments(argv) {
  const options = {
    root: 'public/skills',
    output: undefined,
    check: false,
    validate: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') {
      options.check = true;
      continue;
    }
    if (argument === '--validate') {
      options.validate = true;
      continue;
    }
    if (argument === '--root' || argument === '--output') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a path.`);
      }
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  options.root = path.resolve(options.root);
  options.output = path.resolve(options.output ?? path.join(options.root, 'manifest.json'));
  if (options.check && options.validate) {
    throw new Error('Use either --check or --validate, not both.');
  }
  return options;
}

async function findSkillConfigs(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const configs = [];

  for (const entry of entries) {
    if (entry.name === 'manifest.json') continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      configs.push(...(await findSkillConfigs(entryPath)));
    } else if (entry.isFile() && entry.name === CONFIG_FILE) {
      configs.push(entryPath);
    }
  }

  return configs.sort((left, right) => left.localeCompare(right));
}

function parseFrontmatter(markdown, filePath) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    throw new Error(`${filePath}: ${INSTRUCTIONS_FILE} must start with YAML frontmatter.`);
  }

  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  if (!values.name) throw new Error(`${filePath}: frontmatter requires a name.`);
  if (!values.description) throw new Error(`${filePath}: frontmatter requires a description.`);
  return { name: values.name, description: values.description };
}

function readStringArray(config, property, filePath) {
  const value = config[property] ?? [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`${filePath}: ${property} must be an array of non-empty strings.`);
  }
  const normalized = value.map((item) => item.trim());
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${filePath}: ${property} contains duplicate values.`);
  }
  return normalized;
}

function resolveResourcePath(skillDirectory, resourcePath, configPath) {
  if (path.isAbsolute(resourcePath) || resourcePath.includes('\\')) {
    throw new Error(`${configPath}: resource paths must be relative URL-style paths: ${resourcePath}`);
  }

  const resolved = path.resolve(skillDirectory, resourcePath);
  const relative = path.relative(skillDirectory, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${configPath}: resource path must stay inside its skill directory: ${resourcePath}`);
  }
  return resolved;
}

function toUrlPath(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

async function loadSkill(configPath, root) {
  let config;
  try {
    config = JSON.parse(await readFile(configPath, 'utf8'));
  } catch (error) {
    throw new Error(`${configPath}: could not parse ${CONFIG_FILE}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`${configPath}: ${CONFIG_FILE} must contain a JSON object.`);
  }
  if (typeof config.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.id)) {
    throw new Error(`${configPath}: id must use lowercase kebab-case.`);
  }

  const skillDirectory = path.dirname(configPath);
  const instructionsPath = path.join(skillDirectory, INSTRUCTIONS_FILE);
  await access(instructionsPath).catch(() => {
    throw new Error(`${configPath}: missing ${INSTRUCTIONS_FILE}.`);
  });
  const metadata = parseFrontmatter(await readFile(instructionsPath, 'utf8'), instructionsPath);

  const includedSkillIds = readStringArray(config, 'includes', configPath);
  const references = readStringArray(config, 'references', configPath);
  const optionalReferences = readStringArray(config, 'optionalReferences', configPath);
  const assets = readStringArray(config, 'assets', configPath);
  const outputModes = readStringArray(config, 'outputModes', configPath);

  for (const outputMode of outputModes) {
    if (!ALLOWED_OUTPUT_MODES.has(outputMode)) {
      throw new Error(`${configPath}: unsupported output mode "${outputMode}".`);
    }
  }

  const resourceGroups = [references, optionalReferences, assets];
  for (const resources of resourceGroups) {
    for (const resource of resources) {
      const resourceFile = resolveResourcePath(skillDirectory, resource, configPath);
      await access(resourceFile).catch(() => {
        throw new Error(`${configPath}: resource does not exist: ${resource}`);
      });
    }
  }

  const toManifestPaths = (resources) => resources.map((resource) => toUrlPath(root, path.resolve(skillDirectory, resource)));
  return {
    id: config.id,
    name: metadata.name,
    description: metadata.description,
    skillMdPath: toUrlPath(root, instructionsPath),
    includedSkillIds,
    defaultReferencePaths: toManifestPaths(references),
    optionalReferencePaths: toManifestPaths(optionalReferences),
    defaultAssetPaths: toManifestPaths(assets),
    outputModes,
    configPath,
  };
}

function validateDependencies(skills) {
  const byId = new Map();
  for (const skill of skills) {
    const existing = byId.get(skill.id);
    if (existing) {
      throw new Error(`Duplicate skill id "${skill.id}" in ${existing.configPath} and ${skill.configPath}.`);
    }
    byId.set(skill.id, skill);
  }

  for (const skill of skills) {
    for (const includedId of skill.includedSkillIds) {
      if (!byId.has(includedId)) {
        throw new Error(`${skill.configPath}: included skill does not exist: ${includedId}`);
      }
    }
  }

  const visited = new Set();
  const active = new Set();
  const visit = (skill, chain) => {
    if (active.has(skill.id)) {
      throw new Error(`Circular skill dependency: ${[...chain, skill.id].join(' -> ')}`);
    }
    if (visited.has(skill.id)) return;

    active.add(skill.id);
    for (const includedId of skill.includedSkillIds) {
      visit(byId.get(includedId), [...chain, skill.id]);
    }
    active.delete(skill.id);
    visited.add(skill.id);
  };

  for (const skill of skills) visit(skill, []);
}

function createManifest(skills) {
  return {
    version: 1,
    skills: skills
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ configPath: _configPath, ...skill }) => skill),
  };
}

async function run() {
  const options = readArguments(process.argv.slice(2));
  const configPaths = await findSkillConfigs(options.root);
  const skills = [];
  for (const configPath of configPaths) {
    skills.push(await loadSkill(configPath, options.root));
  }
  validateDependencies(skills);

  const output = `${JSON.stringify(createManifest(skills), null, 2)}\n`;
  if (options.validate) {
    console.log(`Validated ${skills.length} skill package${skills.length === 1 ? '' : 's'} in ${options.root}.`);
    return;
  }
  if (options.check) {
    const existing = await readFile(options.output, 'utf8').catch((error) => {
      if (error?.code === 'ENOENT') {
        throw new Error(`Generated manifest is missing: ${options.output}. Run npm run skills:generate.`);
      }
      throw error;
    });
    if (existing !== output) {
      throw new Error(`Generated manifest is out of date: ${options.output}. Run npm run skills:generate.`);
    }
    console.log(`Validated ${skills.length} skill package${skills.length === 1 ? '' : 's'} in ${options.root}.`);
    return;
  }

  await mkdir(path.dirname(options.output), { recursive: true });
  await writeFile(options.output, output, 'utf8');
  console.log(`Generated ${options.output} with ${skills.length} skill package${skills.length === 1 ? '' : 's'}.`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
