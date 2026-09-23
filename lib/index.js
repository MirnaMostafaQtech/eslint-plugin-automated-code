'use strict';

const requireAccessibilityTag = require('./require-accessibility-tag');

const DEFAULT_DECORATORS = ['Component', 'Injectable', 'Directive', 'Pipe'];
const DEFAULT_MEMBER_DECORATORS = ['Input', 'Output'];

function classContexts(decorators) {
  return decorators.map(name => `ClassDeclaration:has(Decorator[expression.callee.name="${name}"])`);
}

function memberContexts(memberDecorators) {
  return memberDecorators.map(
    name => `PropertyDefinition:has(Decorator[expression.callee.name="${name}"])`
  );
}

const plugin = {
  meta: {
    name: '@qemam/eslint-plugin-doc-dod',
    version: '0.1.0',
  },
  rules: {
    'require-accessibility-tag': requireAccessibilityTag,
  },
};

/**
 * Builds the rule entries for the org's TSDoc Documentation DoD: every class carrying
 * one of `decorators` needs a summary + @example + @accessibility, and every
 * @Input()/@Output() needs a description. Spread the result into an ESLint flat
 * config block that already has `jsdoc` and `doc-dod` (this plugin) registered.
 *
 * @example
 * const jsdoc = require('eslint-plugin-jsdoc');
 * const docDod = require('@qemam/eslint-plugin-doc-dod');
 *
 * module.exports = tseslint.config({
 *   files: ['**\/*.ts'],
 *   plugins: { jsdoc, 'doc-dod': docDod },
 *   rules: { ...docDod.buildRules() },
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
 * @param {'warn'|'error'} [options.severity] Defaults to 'warn' — see the package
 *   README for why this should stay 'warn' until a repo's pre-existing gap is closed.
 * @returns {object} rule entries keyed by `jsdoc/...` and `doc-dod/...`
 */
function buildRules(options = {}) {
  const decorators = options.decorators || DEFAULT_DECORATORS;
  const memberDecorators = options.memberDecorators || DEFAULT_MEMBER_DECORATORS;
  const severity = options.severity || 'warn';
  const classSelectors = classContexts(decorators);
  const memberSelectors = memberContexts(memberDecorators);

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
      },
    ],
    'jsdoc/require-description': [severity, { contexts: classSelectors }],
    'jsdoc/require-example': [severity, { contexts: classSelectors }],
    'doc-dod/require-accessibility-tag': [severity, { decorators }],
  };
}

// NOTE: keep this named `buildRules`, never `rules` — ESLint's plugin loader expects
// `plugin.rules` to be the {ruleName: ruleModule} map (see `plugin` above). A same-named
// export here would silently overwrite that map and break `doc-dod/*` rule lookup.
module.exports = { ...plugin, buildRules };
