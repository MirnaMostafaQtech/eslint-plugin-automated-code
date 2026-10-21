'use strict';

const { RuleTester } = require('eslint');
const tseslint = require('typescript-eslint');
const rule = require('../lib/require-accessibility-tag');

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser },
});

function decoratorStubs() {
  return `
    function Component(..._a) { return (..._b) => {}; }
    function Injectable(..._a) { return (..._b) => {}; }
  `;
}

ruleTester.run('require-accessibility-tag', rule, {
  valid: [
    {
      // No Angular decorator at all — must be ignored regardless of doc state.
      code: `class PlainHelper {}`,
    },
    {
      code: `
        ${decoratorStubs()}
        /**
         * Does a thing.
         * @accessibility N/A — no DOM surface.
         */
        @Injectable()
        class MyService {}
      `,
    },
    {
      code: `
        ${decoratorStubs()}
        /**
         * Renders a widget.
         * @accessibility Keyboard-operable via Enter/Space.
         */
        @Component({})
        class MyWidget {}
      `,
    },
    {
      // Custom decorators option — a decorator not in the configured list is ignored.
      code: `
        function Directive(..._a) { return (..._b) => {}; }
        @Directive({})
        class MyDirective {}
      `,
      options: [{ decorators: ['Component'] }],
    },
    {
      // Tag text on the following lines, with more tags after it.
      code: `
        ${decoratorStubs()}
        /**
         * Renders a widget.
         * @accessibility
         *   Keyboard-operable via Enter/Space.
         * @example <my-widget></my-widget>
         */
        @Component({})
        class MyWidget {}
      `,
    },
    {
      code: `
        ${decoratorStubs()}
        /** @accessibility N/A - no DOM surface. */
        @Injectable()
        class MyService {}
      `,
    },
  ],
  invalid: [
    {
      code: `
        ${decoratorStubs()}
        @Component({})
        class MyWidget {}
      `,
      errors: [{ messageId: 'missing' }],
    },
    {
      code: `
        ${decoratorStubs()}
        /**
         * Renders a widget but forgot accessibility notes.
         * @example <my-widget></my-widget>
         */
        @Component({})
        class MyWidget {}
      `,
      errors: [{ messageId: 'missing' }],
    },
    {
      // Configured decorator list is honored — @Directive flagged when listed.
      code: `
        function Directive(..._a) { return (..._b) => {}; }
        @Directive({})
        class MyDirective {}
      `,
      options: [{ decorators: ['Directive'] }],
      errors: [{ messageId: 'missing' }],
    },
    {
      // Regression: an empty tag used to clear the warning.
      code: `
        ${decoratorStubs()}
        /**
         * Renders a widget.
         * @accessibility
         */
        @Component({})
        class MyWidget {}
      `,
      errors: [{ messageId: 'empty' }],
    },
    {
      // Empty tag followed by another tag: the next tag's text is not the description.
      code: `
        ${decoratorStubs()}
        /**
         * Renders a widget.
         * @accessibility
         * @example <my-widget></my-widget>
         */
        @Component({})
        class MyWidget {}
      `,
      errors: [{ messageId: 'empty' }],
    },
    {
      code: `
        ${decoratorStubs()}
        /** Renders a widget. @accessibility */
        @Component({})
        class MyWidget {}
      `,
      errors: [{ messageId: 'empty' }],
    },
    {
      // Regression: a plain /* */ comment is not a doc comment and must not count.
      code: `
        ${decoratorStubs()}
        /* @accessibility Keyboard-operable via Enter/Space. */
        @Component({})
        class MyWidget {}
      `,
      errors: [{ messageId: 'missing' }],
    },
  ],
});

console.log('require-accessibility-tag: all RuleTester cases passed');
