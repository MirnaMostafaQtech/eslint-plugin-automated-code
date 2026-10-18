'use strict';

const path = require('node:path');
const ownPackage = require('../../package.json');

const PACKAGE_NAME = ownPackage.name;
const OLD_PACKAGE_NAME = '@qemam/eslint-plugin-doc-dod';
const JSDOC_PACKAGE = 'eslint-plugin-jsdoc';
const ESLINT_EXTENSION = 'dbaeumer.vscode-eslint';
const FLAT_CONFIG_FILES = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs'];
const LEGACY_CONFIG_FILES = ['.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.yml', '.eslintrc.yaml', '.eslintrc'];

/**
 * `ng add @qemam/eslint-plugin-automated-code-docs` entry point. Runs after the CLI has installed
 * this package, and does the per-repo setup from the implementation guide in one step:
 * adds eslint-plugin-jsdoc, wires `buildRules()` into eslint.config.js, and fixes the VS Code
 * settings that stop warnings from showing while typing.
 *
 * @param {{ skipVscode?: boolean, skipInstall?: boolean }} options
 * @returns {Function} schematic rule
 */
function ngAdd(options = {}) {
  return (tree, context) => {
    const logger = context.logger;
    const pkg = readJson(tree, '/package.json');
    if (!pkg) {
      throw new Error('No package.json found. Run "ng add" from the root of an Angular workspace.');
    }

    const configPath = FLAT_CONFIG_FILES.map(file => `/${file}`).find(file => tree.exists(file));
    if (!configPath) {
      throw new Error(missingConfigMessage(tree, pkg));
    }

    const jsdocAdded = addJsdocDependency(tree, pkg, logger);
    wireEslintConfig(tree, configPath, logger);
    if (!options.skipVscode) {
      setUpVscode(tree, logger);
    }

    if (!options.skipInstall && jsdocAdded) {
      scheduleInstall(context, logger);
    }

    logger.info('');
    logger.info('Next: run "npm run lint" and record the documentation warning count as this repo\'s baseline.');
    logger.info('Do not run "eslint --fix" to clear the warnings: it inserts empty /** */ stubs.');
    return tree;
  };
}

function missingConfigMessage(tree, pkg) {
  const legacy = LEGACY_CONFIG_FILES.find(file => tree.exists(`/${file}`));
  if (legacy) {
    return `Found ${legacy} but no eslint.config.js. This package needs ESLint flat config: migrate ` +
      `${legacy} to eslint.config.js first, then run "ng add ${PACKAGE_NAME}" again.`;
  }
  const major = angularMajor(pkg);
  const command = major ? `ng add angular-eslint@${major}` : 'ng add angular-eslint@<your Angular major>';
  return `No ESLint config found. Run "${command}" first, then run "ng add ${PACKAGE_NAME}" again.`;
}

function angularMajor(pkg) {
  const version = (pkg.dependencies || {})['@angular/core'] || (pkg.devDependencies || {})['@angular/core'];
  const match = version && /(\d+)/.exec(version);
  return match ? match[1] : null;
}

function addJsdocDependency(tree, pkg, logger) {
  const installed = (pkg.dependencies || {})[JSDOC_PACKAGE] || (pkg.devDependencies || {})[JSDOC_PACKAGE];
  if (installed) {
    logger.info(`${JSDOC_PACKAGE} is already in package.json (${installed}).`);
    return false;
  }
  const version = ownPackage.devDependencies[JSDOC_PACKAGE];
  pkg.devDependencies = sortKeys({ ...(pkg.devDependencies || {}), [JSDOC_PACKAGE]: version });
  writeJson(tree, '/package.json', pkg, tree.read('/package.json').toString('utf8'));
  logger.info(`Added ${JSDOC_PACKAGE}@${version} to devDependencies.`);
  return true;
}

function scheduleInstall(context, logger) {
  try {
    const { NodePackageInstallTask } = require('@angular-devkit/schematics/tasks');
    context.addTask(new NodePackageInstallTask());
  } catch {
    logger.warn(`Could not schedule "npm install". Run it yourself to install ${JSDOC_PACKAGE}.`);
  }
}

/**
 * Adds the two requires/imports and a separate `**\/*.ts` config block at the end of the exported
 * config. A separate block is used instead of editing the repo's own `**\/*.ts` block because flat
 * config merges every block that matches a file, and appending is safe whatever the existing
 * block looks like.
 */
function wireEslintConfig(tree, configPath, logger) {
  const source = tree.read(configPath).toString('utf8');

  if (source.includes(OLD_PACKAGE_NAME)) {
    logger.warn(`${configPath} still uses the old package name ${OLD_PACKAGE_NAME}. ` +
      `Replace it with ${PACKAGE_NAME} by hand; nothing was added, to avoid running the rules twice.`);
    return;
  }
  if (source.includes(PACKAGE_NAME)) {
    logger.info(`${configPath} already uses ${PACKAGE_NAME}; left unchanged.`);
    warnAboutSignalWorkaround(source, configPath, logger);
    return;
  }

  const esm = configPath.endsWith('.mjs') || /^\s*export\s+default\b/m.test(source);
  const existingJsdoc = findImportName(source, JSDOC_PACKAGE, esm);
  const jsdocName = existingJsdoc || 'jsdoc';
  const lines = [];
  if (!existingJsdoc) {
    lines.push(esm ? `import ${jsdocName} from '${JSDOC_PACKAGE}';` : `const ${jsdocName} = require('${JSDOC_PACKAGE}');`);
  }
  lines.push(esm ? `import codeDocs from '${PACKAGE_NAME}';` : `const codeDocs = require('${PACKAGE_NAME}');`);

  const pluginEntry = jsdocName === 'jsdoc' ? 'jsdoc' : `jsdoc: ${jsdocName}`;
  const block = [
    '  {',
    '    // Automated Code Documentation: summary, @example and @accessibility on every',
    '    // @Component/@Injectable/@Directive/@Pipe, and a description on every input/output.',
    "    files: ['**/*.ts'],",
    `    plugins: { ${pluginEntry}, 'automated-code-docs': codeDocs },`,
    '    rules: { ...codeDocs.buildRules() },',
    '  },',
  ].join('\n');

  const withBlock = appendConfigBlock(source, block);
  if (!withBlock) {
    logger.warn(`Could not find the exported config array in ${configPath}. Add this by hand:\n\n` +
      `${lines.join('\n')}\n\n// in the exported config list:\n${block}\n`);
    return;
  }
  tree.overwrite(configPath, insertImports(withBlock, lines, esm));
  logger.info(`Wired ${PACKAGE_NAME} into ${configPath}.`);
  warnAboutSignalWorkaround(source, configPath, logger);
}

function warnAboutSignalWorkaround(source, configPath, logger) {
  if (/signalMemberContexts|value\.callee\.name=\/\^\(input/.test(source)) {
    logger.warn(`${configPath} still has the old signal-input workaround. Remove it and use ` +
      '"...codeDocs.buildRules()" directly: the package checks signal members itself, and keeping ' +
      'the workaround reports every undocumented signal member twice.');
  }
}

function findImportName(source, packageName, esm) {
  const escaped = packageName.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
  const pattern = esm
    ? new RegExp(`^import\\s+(\\w+)\\s+from\\s+['"]${escaped}['"]`, 'm')
    : new RegExp(`^(?:const|let|var)\\s+(\\w+)\\s*=\\s*require\\(\\s*['"]${escaped}['"]\\s*\\)`, 'm');
  const match = pattern.exec(source);
  return match ? match[1] : null;
}

function appendConfigBlock(source, block) {
  const exportMatch = /module\.exports\s*=|export\s+default\b/.exec(source);
  const endMatch = /([)\]])\s*;?\s*$/.exec(source);
  if (!exportMatch || !endMatch || endMatch.index < exportMatch.index) {
    return null;
  }
  let end = endMatch.index;
  let before = source.slice(0, end).replace(/\s*$/, '');
  // `defineConfig([ ... ])`: put the block inside the array, not after it as a second argument.
  if (source[end] === ')' && before.endsWith(']')) {
    end = before.length - 1;
    before = source.slice(0, end).replace(/\s*$/, '');
  }
  const separator = /[,([]$/.test(before) ? '' : ',';
  return `${before}${separator}\n${block}\n${source.slice(end)}`;
}

function insertImports(source, lines, esm) {
  const pattern = esm
    ? /^import\s[^;]*?from\s*['"][^'"]+['"];?[ \t]*$/gm
    : /^(?:const|let|var)\s[^;]*?require\(\s*['"][^'"]+['"]\s*\)[^;\n]*;?[ \t]*$/gm;
  let insertAt = -1;
  for (const match of source.matchAll(pattern)) {
    insertAt = match.index + match[0].length;
  }
  const text = lines.join('\n');
  if (insertAt === -1) {
    const checkComment = /^\/\/ @ts-check[^\n]*\n/.exec(source);
    const at = checkComment ? checkComment[0].length : 0;
    return `${source.slice(0, at)}${text}\n${at ? '' : '\n'}${source.slice(at)}`;
  }
  return `${source.slice(0, insertAt)}\n${text}${source.slice(insertAt)}`;
}

function setUpVscode(tree, logger) {
  addEslintExtension(tree, logger);
  cleanVscodeSettings(tree, logger);
}

/** Adds the ESLint extension to the workspace recommendations, keeping the file's comments. */
function addEslintExtension(tree, logger) {
  const file = '/.vscode/extensions.json';
  if (!tree.exists(file)) {
    tree.create(file, `${JSON.stringify({ recommendations: [ESLINT_EXTENSION] }, null, 2)}\n`);
    logger.info(`Created ${file} recommending ${ESLINT_EXTENSION}.`);
    return;
  }
  const text = tree.read(file).toString('utf8');
  const parsed = parseJsonc(text);
  if (!parsed) {
    logger.warn(`Could not parse ${file}. Add "${ESLINT_EXTENSION}" to "recommendations" by hand.`);
    return;
  }
  const recommendations = Array.isArray(parsed.recommendations) ? parsed.recommendations : null;
  if (recommendations && recommendations.includes(ESLINT_EXTENSION)) {
    return;
  }
  const arrayStart = /"recommendations"\s*:\s*\[/.exec(text);
  if (recommendations && arrayStart) {
    const at = arrayStart.index + arrayStart[0].length;
    const separator = recommendations.length > 0 ? ', ' : '';
    tree.overwrite(file, `${text.slice(0, at)}"${ESLINT_EXTENSION}"${separator}${text.slice(at)}`);
  } else {
    writeJson(tree, file, { ...parsed, recommendations: [ESLINT_EXTENSION] }, text);
  }
  logger.info(`Added ${ESLINT_EXTENSION} to ${file}.`);
}

/**
 * Removes the settings that silently stop live ESLint warnings: an `overrideConfigFile` that
 * points to a missing file, `workingDirectories` outside the repo, and `useFlatConfig: false`.
 * Never creates the file.
 */
function cleanVscodeSettings(tree, logger) {
  const file = '/.vscode/settings.json';
  if (!tree.exists(file)) {
    return;
  }
  const text = tree.read(file).toString('utf8');
  const settings = parseJsonc(text);
  if (!settings) {
    logger.warn(`Could not parse ${file}; check its eslint.* settings by hand.`);
    return;
  }

  const removed = [];
  const options = settings['eslint.options'];
  if (options && typeof options.overrideConfigFile === 'string' && !tree.exists(toTreePath(options.overrideConfigFile))) {
    removed.push(`eslint.options.overrideConfigFile ("${options.overrideConfigFile}" does not exist)`);
    delete options.overrideConfigFile;
    if (Object.keys(options).length === 0) {
      delete settings['eslint.options'];
    }
  }

  const dirs = settings['eslint.workingDirectories'];
  if (Array.isArray(dirs)) {
    const kept = dirs.filter(entry => {
      const dir = typeof entry === 'string' ? entry : entry && entry.directory;
      return typeof dir !== 'string' || !isOutsideRepo(dir);
    });
    if (kept.length !== dirs.length) {
      removed.push('eslint.workingDirectories entries outside the repo');
      if (kept.length === 0) {
        delete settings['eslint.workingDirectories'];
      } else {
        settings['eslint.workingDirectories'] = kept;
      }
    }
  }

  if (settings['eslint.useFlatConfig'] === false) {
    removed.push('eslint.useFlatConfig: false');
    delete settings['eslint.useFlatConfig'];
  }

  if (removed.length === 0) {
    return;
  }
  writeJson(tree, file, settings, text);
  logger.info(`Removed from ${file}: ${removed.join('; ')}.`);
  if (/\/\/|\/\*/.test(stripStrings(text))) {
    logger.warn(`${file} was rewritten without its comments.`);
  }
}

function toTreePath(file) {
  const cleaned = file.replace(/\$\{workspaceFolder\}[\\/]?/, '').replace(/\\/g, '/');
  return `/${path.posix.normalize(cleaned).replace(/^\.?\//, '')}`;
}

function isOutsideRepo(dir) {
  const cleaned = dir.replace(/\$\{workspaceFolder\}[\\/]?/, '').replace(/\\/g, '/');
  if (path.posix.isAbsolute(cleaned) || /^[a-zA-Z]:/.test(cleaned)) {
    return true;
  }
  return path.posix.normalize(cleaned).startsWith('..');
}

function readJson(tree, file) {
  if (!tree.exists(file)) {
    return null;
  }
  return parseJsonc(tree.read(file).toString('utf8'));
}

function writeJson(tree, file, value, originalText) {
  const indent = (/\n([ \t]+)"/.exec(originalText) || [, '  '])[1];
  tree.overwrite(file, `${JSON.stringify(value, null, indent)}\n`);
}

function stripStrings(text) {
  return text.replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/** Parses JSON with comments and trailing commas (the format VS Code uses), or returns null. */
function parseJsonc(text) {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (inString) {
      out += char;
      if (char === '\\') {
        out += next;
        i++;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (char === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += char;
    }
  }
  try {
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
  } catch {
    return null;
  }
}

function sortKeys(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

module.exports = { ngAdd };
