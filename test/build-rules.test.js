'use strict';

const assert = require('node:assert');
const { Linter } = require('eslint');
const tseslint = require('typescript-eslint');
const jsdoc = require('eslint-plugin-jsdoc');
const docDod = require('..');

const linter = new Linter();

const DECORATOR_STUBS = `
function Component(..._a) { return (..._b) => {}; }
function Input(..._a) { return (..._b) => {}; }
function Output(..._a) { return (..._b) => {}; }
`;

function lint(code, ruleOptions) {
  const messages = linter.verify(code, {
    languageOptions: { parser: tseslint.parser },
    plugins: { jsdoc, 'doc-dod': docDod },
    rules: docDod.buildRules(ruleOptions),
  });
  return messages.map(m => m.ruleId);
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    throw err;
  }
}

test('a class with no Angular decorator is ignored', () => {
  const ruleIds = lint(`${DECORATOR_STUBS}\nclass PlainHelper {}`);
  assert.deepStrictEqual(ruleIds, []);
});

test('a plain top-level function is never flagged (regression: FunctionDeclaration default)', () => {
  const ruleIds = lint(`function helper() { return 1; }`);
  assert.deepStrictEqual(ruleIds, []);
});

test('an undocumented @Component with @Input/@Output flags the class once and each member once', () => {
  const ruleIds = lint(`
    ${DECORATOR_STUBS}
    @Component({})
    class Widget {
      @Input() value = 0;
      @Output() changed = () => {};
    }
  `);
  // Class: missing-comment fires once for require-jsdoc + once for our accessibility rule.
  // require-description/require-example do NOT double-fire when the comment is wholly
  // absent (only when a comment exists but lacks that specific piece) — this asserts
  // that documented behavior stays stable across eslint-plugin-jsdoc upgrades.
  assert.deepStrictEqual(ruleIds.sort(), [
    'doc-dod/require-accessibility-tag',
    'jsdoc/require-jsdoc', // class
    'jsdoc/require-jsdoc', // @Input
    'jsdoc/require-jsdoc', // @Output
  ].sort());
});

test('a class with a comment but no @accessibility tag is flagged only for that', () => {
  const ruleIds = lint(`
    ${DECORATOR_STUBS}
    /**
     * Renders a widget.
     * @example <my-widget></my-widget>
     */
    @Component({})
    class Widget {}
  `);
  assert.deepStrictEqual(ruleIds, ['doc-dod/require-accessibility-tag']);
});

test('a fully documented component is silent', () => {
  const ruleIds = lint(`
    ${DECORATOR_STUBS}
    /**
     * Renders a widget.
     * @example <my-widget [value]="1" (changed)="onChange($event)"></my-widget>
     * @accessibility N/A — fixture only.
     */
    @Component({})
    class Widget {
      /** The value. */
      @Input() value = 0;
      /** Emitted on change. */
      @Output() changed = () => {};
    }
  `);
  assert.deepStrictEqual(ruleIds, []);
});

test('the `decorators` option restricts which class decorators are checked', () => {
  const code = `
    function Directive(..._a) { return (..._b) => {}; }
    @Directive({})
    class MyDirective {}
  `;
  assert.deepStrictEqual(lint(code, { decorators: ['Component'] }), []);
  assert.ok(lint(code, { decorators: ['Directive'] }).includes('jsdoc/require-jsdoc'));
});

test('the `severity` option escalates to error', () => {
  const messages = linter.verify(
    `${DECORATOR_STUBS}\n@Component({})\nclass Widget {}`,
    {
      languageOptions: { parser: tseslint.parser },
      plugins: { jsdoc, 'doc-dod': docDod },
      rules: docDod.buildRules({ severity: 'error' }),
    }
  );
  assert.ok(messages.length > 0);
  assert.ok(messages.every(m => m.severity === 2));
});

console.log('build-rules: all integration cases passed');
