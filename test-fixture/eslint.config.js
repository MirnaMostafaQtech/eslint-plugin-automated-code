const tseslint = require('typescript-eslint');
const jsdoc = require('eslint-plugin-jsdoc');
const codeDocs = require('..');

module.exports = tseslint.config({
  files: ['**/*.ts'],
  extends: [...tseslint.configs.recommended],
  plugins: { jsdoc, 'automated-code-docs': codeDocs },
  rules: {
    ...codeDocs.buildRules(),
    // Fixture-only noise from the throwaway local decorator stand-ins below — not
    // related to what this fixture is actually verifying.
    '@typescript-eslint/no-unused-vars': 'off',
  },
});
