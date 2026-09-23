const tseslint = require('typescript-eslint');
const jsdoc = require('eslint-plugin-jsdoc');
const docDod = require('..');

module.exports = tseslint.config({
  files: ['**/*.ts'],
  extends: [...tseslint.configs.recommended],
  plugins: { jsdoc, 'doc-dod': docDod },
  rules: {
    ...docDod.buildRules(),
    // Fixture-only noise from the throwaway local decorator stand-ins below — not
    // related to what this fixture is actually verifying.
    '@typescript-eslint/no-unused-vars': 'off',
  },
});
