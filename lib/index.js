'use strict';

const requireAccessibilityTag = require('./require-accessibility-tag');

const DEFAULT_DECORATORS = ['Component', 'Injectable', 'Directive', 'Pipe'];
const DEFAULT_MEMBER_DECORATORS = ['Input', 'Output'];
const DEFAULT_SIGNAL_MEMBERS = ['input', 'output', 'model'];

function classContexts(decorators) {
  return decorators.map(name => `ClassDeclaration:has(Decorator[expression.callee.name="${name}"])`);
}

function memberContexts(memberDecorators) {
  return memberDecorators.map(
    name => `PropertyDefinition:has(Decorator[expression.callee.name="${name}"])`
  );
}

// Signal members (`x = input()`, `x = input.required()`, `x = output()`, `x = model()`) have no
// decorator to match on, so they are matched by the function they are initialised with. They are
// scoped to the direct members of a class carrying one of `decorators`, so a plain class that
// happens to call a function named `input()` is never flagged.
function signalMemberContexts(decorators, signalMembers) {
  if (signalMembers.length === 0) {
    return [];
  }
  const names = signalMembers.join('|');
  const calls = [
    `[value.type="CallExpression"][value.callee.name=/^(${names})$/]`,
    `[value.type="CallExpression"][value.callee.object.name=/^(${names})$/][value.callee.property.name="required"]`,
  ];
  return decorators.flatMap(name =>
    calls.map(
      call =>
        `ClassDeclaration:has(Decorator[expression.callee.name="${name}"]) > ClassBody > PropertyDefinition${call}`
    )
  );
}

const plugin = {
  meta: {
    name: '@qemam/eslint-plugin-automated-code',
    version: '0.2.0',
  },
  rules: {
    'require-accessibility-tag': requireAccessibilityTag,
  },
};

/**
 * Builds the rule entries for the org's Automated Code Documentation standard: every class carrying
 * one of `decorators` needs a summary + @example + @accessibility, and every
 * @Input()/@Output() and signal input()/output()/model() needs a description. Spread the result into an ESLint flat
 * config block that already has `jsdoc` and `automated-code-docs` (this plugin) registered.
 *
 * @example
 * const jsdoc = require('eslint-plugin-jsdoc');
 * const codeDocs = require('@qemam/eslint-plugin-automated-code');
 *
 * module.exports = tseslint.config({
 *   files: ['**\/*.ts'],
 *   plugins: { jsdoc, 'automated-code-docs': codeDocs },
 *   rules: { ...codeDocs.buildRules() },
 * });
 *
 * @param {object} [options]
 * @param {string[]} [options.decorators] Class-level Angular decorators to require
 *   docs on. Defaults to Component/Injectable/Directive/Pipe.
 * @param {string[]} [options.memberDecorators] Property-level decorators to require a
 *   description on. Defaults to Input/Output — deliberately separate from `decorators`
 *   above (a class decorator and a member decorator are never the same name, so mixing
 *   the two lists up silently matches nothing; see the regression this caught in
 *   `test-fixture/`).
 * @param {string[]} [options.signalMembers] Signal functions whose properties need a
 *   description (`input()`, `input.required()`, `output()`, `model()`, `model.required()`).
 *   Defaults to input/output/model; pass `[]` to check decorator members only.
 * @param {'warn'|'error'} [options.severity] Defaults to 'warn' — see the package
 *   README for why this should stay 'warn' until a repo's pre-existing gap is closed.
 * @returns {object} rule entries keyed by `jsdoc/...` and `automated-code-docs/...`
 */
function buildRules(options = {}) {
  const decorators = options.decorators || DEFAULT_DECORATORS;
  const memberDecorators = options.memberDecorators || DEFAULT_MEMBER_DECORATORS;
  const signalMembers = options.signalMembers || DEFAULT_SIGNAL_MEMBERS;
  const severity = options.severity || 'warn';
  const classSelectors = classContexts(decorators);
  const memberSelectors = [
    ...memberContexts(memberDecorators),
    ...signalMemberContexts(decorators, signalMembers),
  ];

  return {
    'jsdoc/require-jsdoc': [
      severity,
      {
        contexts: [...classSelectors, ...memberSelectors],
        checkConstructors: false,
        // `contexts` is ADDITIVE to this rule's own defaults, which check every plain
        // `function foo() {}` declaration (`require.FunctionDeclaration` defaults to
        // `true`) regardless of `contexts`. Without this override the rule would flag
        // unrelated top-level functions repo-wide, not just our decorated classes.
        require: { FunctionDeclaration: false },
        // The fixer inserts an empty `/** */` stub, which clears the warning with no
        // documentation. It would run on `eslint --fix` and on every save for anyone with
        // `source.fixAll.eslint` on, so it is off: the warning stays until someone writes
        // the comment. Other rules' fixes (Prettier, import sorting) are not affected.
        enableFixer: false,
      },
    ],
    'jsdoc/require-description': [severity, { contexts: classSelectors }],
    // Same reason as require-jsdoc above: its fixer adds an empty `@example` tag. With the fixer
    // off the rule still offers a fix that rewrites the comment unchanged, so `eslint --fix`
    // prints an ESLintCircularFixesWarning; the file text is not changed.
    'jsdoc/require-example': [severity, { contexts: classSelectors, enableFixer: false }],
    'automated-code-docs/require-accessibility-tag': [severity, { decorators }],
  };
}

// NOTE: keep this named `buildRules`, never `rules` — ESLint's plugin loader expects
// `plugin.rules` to be the {ruleName: ruleModule} map (see `plugin` above). A same-named
// export here would silently overwrite that map and break `automated-code-docs/*` rule lookup.
module.exports = { ...plugin, buildRules };
