'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { HostTree } = require('@angular-devkit/schematics');
const { SchematicTestRunner } = require('@angular-devkit/schematics/testing');
const { Linter } = require('eslint');
const tseslint = require('typescript-eslint');
const codeDocs = require('..');

const runner = new SchematicTestRunner('automated-code-docs', path.join(__dirname, '../schematics/collection.json'));

const PACKAGE_JSON = JSON.stringify(
  { name: 'app', dependencies: { '@angular/core': '^21.0.0' }, devDependencies: { eslint: '^9.0.0' } },
  null,
  2
);

const CJS_CONFIG = `// @ts-check
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
`;

const UNDOCUMENTED_COMPONENT = `
function Component(..._a: unknown[]) { return (..._b: unknown[]) => {}; }
const input = (..._a: unknown[]) => {};
@Component({})
export class Widget {
  readonly value = input(0);
}
`;

function makeTree(files) {
  const tree = new HostTree();
  for (const [file, content] of Object.entries(files)) {
    tree.create(file, content);
  }
  return tree;
}

async function runNgAdd(files, options = { skipInstall: true }) {
  const logs = [];
  const subscription = runner.logger.subscribe(entry => logs.push(entry.message));
  try {
    const tree = await runner.runSchematic('ng-add', options, makeTree(files));
    return { tree, logs, read: file => tree.readContent(file) };
  } finally {
    subscription.unsubscribe();
  }
}

/** Evaluates a generated CommonJS eslint.config.js with the real packages and lints a sample component. */
function lintWithConfig(configSource, filename = 'widget.ts') {
  const module = { exports: null };
  const localRequire = id => (id === '@qemam/eslint-plugin-automated-code' ? codeDocs : require(id));
  new Function('require', 'module', 'exports', configSource)(localRequire, module, module.exports);
  const messages = new Linter({ configType: 'flat' }).verify(UNDOCUMENTED_COMPONENT, module.exports, filename);
  return messages.map(m => m.ruleId);
}

/** Fails if a generated ESM config is not a valid module (for example a binding declared twice). */
function assertValidModule(configSource) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ng-add-'));
  const file = path.join(dir, 'eslint.config.mjs');
  try {
    fs.writeFileSync(file, configSource);
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.strictEqual(result.status, 0, result.stderr);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('wires the rules into a CommonJS eslint.config.js and the result lints', async () => {
  const { read } = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.js': CJS_CONFIG });
  const config = read('/eslint.config.js');

  assert.match(config, /const tseslint = require\('typescript-eslint'\);\nconst jsdoc = require\('eslint-plugin-jsdoc'\);\nconst codeDocs = require\('@qemam\/eslint-plugin-automated-code'\);/);
  assert.match(config, /rules: \{ \.\.\.codeDocs\.buildRules\(\) \}/);
  assert.deepStrictEqual(lintWithConfig(config).sort(), [
    'automated-code-docs/require-accessibility-tag',
    'jsdoc/require-jsdoc', // class
    'jsdoc/require-jsdoc', // signal input
  ]);
});

test('the added block skips spec files, so test host components are not flagged', async () => {
  const { read } = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.js': CJS_CONFIG });
  const config = read('/eslint.config.js');
  assert.match(config, /ignores: \['\*\*\/\*\.spec\.ts'\]/);
  assert.deepStrictEqual(lintWithConfig(config, 'widget.spec.ts'), []);
  assert.ok(lintWithConfig(config, 'widget.ts').includes('jsdoc/require-jsdoc'));
});

test('package.json engines matches the oldest Node the setup accepts', () => {
  const { jsdocVersionFor } = require('../schematics/ng-add');
  const ownPackage = require('../package.json');
  const minimum = /^>=(\d+\.\d+\.\d+)$/.exec(ownPackage.engines.node)[1];
  const [major, minor, patch] = minimum.split('.').map(Number);
  assert.ok(jsdocVersionFor(minimum));
  assert.strictEqual(jsdocVersionFor(patch > 0 ? `${major}.${minor}.${patch - 1}` : `${major}.${minor - 1}.99`), null);
});

test('plugin meta comes from package.json, so the version cannot drift', () => {
  const ownPackage = require('../package.json');
  assert.deepStrictEqual(codeDocs.meta, { name: ownPackage.name, version: ownPackage.version });
});

test('running ng add twice does not add the block twice', async () => {
  const first = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.js': CJS_CONFIG });
  const second = await runNgAdd({
    '/package.json': first.read('/package.json'),
    '/eslint.config.js': first.read('/eslint.config.js'),
  });
  const config = second.read('/eslint.config.js');
  assert.strictEqual(config.match(/codeDocs\.buildRules/g).length, 1);
  assert.strictEqual(config.match(/require\('eslint-plugin-jsdoc'\)/g).length, 1);
});

test('reuses an existing eslint-plugin-jsdoc import instead of declaring it again', async () => {
  const source = CJS_CONFIG.replace(
    "const tseslint = require('typescript-eslint');",
    "const tseslint = require('typescript-eslint');\nconst jsdocPlugin = require('eslint-plugin-jsdoc');"
  );
  const { read } = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.js': source });
  const config = read('/eslint.config.js');
  assert.strictEqual(config.match(/require\('eslint-plugin-jsdoc'\)/g).length, 1);
  assert.match(config, /plugins: \{ jsdoc: jsdocPlugin, 'automated-code-docs': codeDocs \}/);
  assert.ok(lintWithConfig(config).includes('jsdoc/require-jsdoc'));
});

test('handles an ESM config with multi-line imports', async () => {
  const source = `import {
  defineConfig,
} from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  { files: ['**/*.ts'], extends: [tseslint.configs.recommended] }
]);
`;
  const { read } = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.mjs': source });
  const config = read('/eslint.config.mjs');
  assert.match(config, /import tseslint from 'typescript-eslint';\nimport jsdoc from 'eslint-plugin-jsdoc';\nimport codeDocs from '@qemam\/eslint-plugin-automated-code';/);
  assert.match(config, /extends: \[tseslint\.configs\.recommended\] \},\n {2}\{\n/);
  assert.match(config, /buildRules\(\) \},\n {2}\},\n\]\);\n$/);
});

test('a namespace jsdoc import gets a separate default import, never a duplicate binding', async () => {
  const source = `import * as jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  jsdoc.configs['flat/recommended'],
);
`;
  const { read } = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.mjs': source });
  const config = read('/eslint.config.mjs');
  assert.match(config, /^import jsdocPlugin from 'eslint-plugin-jsdoc';$/m);
  assert.match(config, /plugins: \{ jsdoc: jsdocPlugin, 'automated-code-docs': codeDocs \}/);
  assertValidModule(config);
});

test('reuses a default jsdoc import that also has named imports', async () => {
  const source = `import jsdoc, { configs } from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  configs['flat/recommended'],
);
`;
  const { read } = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.mjs': source });
  const config = read('/eslint.config.mjs');
  assert.strictEqual(config.match(/from 'eslint-plugin-jsdoc'/g).length, 1);
  assert.match(config, /plugins: \{ jsdoc, 'automated-code-docs': codeDocs \}/);
  assertValidModule(config);
});

test('adds eslint-plugin-jsdoc to devDependencies, or leaves an existing version alone', async () => {
  const added = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.js': CJS_CONFIG });
  assert.ok(JSON.parse(added.read('/package.json')).devDependencies['eslint-plugin-jsdoc']);

  const existing = JSON.stringify({ name: 'app', devDependencies: { 'eslint-plugin-jsdoc': '^50.0.0' } });
  const kept = await runNgAdd({ '/package.json': existing, '/eslint.config.js': CJS_CONFIG });
  assert.strictEqual(JSON.parse(kept.read('/package.json')).devDependencies['eslint-plugin-jsdoc'], '^50.0.0');
});

test('stops with the angular-eslint command for the repo\'s Angular major when there is no ESLint config', async () => {
  await assert.rejects(runNgAdd({ '/package.json': PACKAGE_JSON }), /ng add angular-eslint@21/);
});

test('stops with a migration message when only .eslintrc.json exists', async () => {
  await assert.rejects(
    runNgAdd({ '/package.json': PACKAGE_JSON, '/.eslintrc.json': '{}' }),
    /Found \.eslintrc\.json but no eslint\.config\.js/
  );
});

for (const oldName of ['@qemam/eslint-plugin-doc-dod', '@qemam/eslint-plugin-automated-code-docs']) {
  test(`leaves a config on the old package name ${oldName} untouched and warns`, async () => {
    const source = CJS_CONFIG.replace(
      "const tseslint = require('typescript-eslint');",
      `const tseslint = require('typescript-eslint');\nconst codeDocs = require('${oldName}');`
    );
    const { read, logs } = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.js': source });
    assert.strictEqual(read('/eslint.config.js'), source);
    assert.ok(logs.some(line => line.includes(`old package name ${oldName}`)));
  });
}

test('creates .vscode/extensions.json, or adds the ESLint extension keeping comments', async () => {
  const created = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.js': CJS_CONFIG });
  assert.deepStrictEqual(JSON.parse(created.read('/.vscode/extensions.json')).recommendations, ['dbaeumer.vscode-eslint']);

  const existing = '{\n  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=827846\n  "recommendations": ["angular.ng-template"]\n}\n';
  const updated = await runNgAdd({
    '/package.json': PACKAGE_JSON,
    '/eslint.config.js': CJS_CONFIG,
    '/.vscode/extensions.json': existing,
  });
  const text = updated.read('/.vscode/extensions.json');
  assert.match(text, /\/\/ For more information/);
  assert.match(text, /"recommendations": \["dbaeumer\.vscode-eslint", "angular\.ng-template"\]/);
});

test('removes VS Code settings that stop live warnings and keeps the rest', async () => {
  const settings = JSON.stringify({
    'editor.formatOnSave': true,
    'eslint.options': { overrideConfigFile: '.eslintrc.json' },
    'eslint.workingDirectories': ['../other-repo', './src'],
    'eslint.useFlatConfig': false,
  });
  const { tree, read } = await runNgAdd({
    '/package.json': PACKAGE_JSON,
    '/eslint.config.js': CJS_CONFIG,
    '/.vscode/settings.json': settings,
  });
  assert.deepStrictEqual(JSON.parse(read('/.vscode/settings.json')), {
    'editor.formatOnSave': true,
    'eslint.workingDirectories': ['./src'],
  });

  const untouched = await runNgAdd({ '/package.json': PACKAGE_JSON, '/eslint.config.js': CJS_CONFIG });
  assert.strictEqual(untouched.tree.exists('/.vscode/settings.json'), false);
  assert.ok(tree.exists('/.vscode/settings.json'));
});

test('skipVscode leaves .vscode alone', async () => {
  const { tree } = await runNgAdd(
    { '/package.json': PACKAGE_JSON, '/eslint.config.js': CJS_CONFIG },
    { skipInstall: true, skipVscode: true }
  );
  assert.strictEqual(tree.exists('/.vscode/extensions.json'), false);
});

test('picks the newest eslint-plugin-jsdoc major that supports the running Node', () => {
  const { jsdocVersionFor } = require('../schematics/ng-add');
  assert.strictEqual(jsdocVersionFor('24.15.0'), '^64.5.4');
  assert.strictEqual(jsdocVersionFor('22.22.2'), '^64.5.4');
  assert.strictEqual(jsdocVersionFor('22.13.1'), '^63.3.3');
  assert.strictEqual(jsdocVersionFor('20.20.2'), '^62.9.0');
  assert.strictEqual(jsdocVersionFor('20.11.0'), '^61.7.1');
  assert.strictEqual(jsdocVersionFor('18.18.0'), '^50.8.0');
  assert.strictEqual(jsdocVersionFor('16.20.0'), null);
});

test('stops before changing anything when Node is too old for ESLint 9', () => {
  const { checkNodeVersion } = require('../schematics/ng-add');
  assert.throws(() => checkNodeVersion('16.20.0'), /Node 16\.20\.0 is too old.*Nothing was changed/);
  assert.throws(() => checkNodeVersion('18.17.1'), /too old/);
  assert.doesNotThrow(() => checkNodeVersion('18.18.0'));
  assert.doesNotThrow(() => checkNodeVersion('20.20.2'));
});
