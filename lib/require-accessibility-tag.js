'use strict';

/**
 * Requires the leading JSDoc/TSDoc block above an Angular @Component/@Injectable/
 * @Directive/@Pipe class to contain an `@accessibility` tag. `eslint-plugin-jsdoc`
 * has no generic "require this custom tag" rule (its require-* rules only cover
 * standard tags like @param/@returns/@example), so this rule fills that one gap.
 */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require an @accessibility tag in the class JSDoc/TSDoc block',
      url: 'https://github.com/REPLACE_WITH_YOUR_ORG/eslint-plugin-automated-code#require-accessibility-tag',
    },
    schema: [
      {
        type: 'object',
        properties: {
          decorators: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        'Missing @accessibility tag in the doc comment above this class. State the real keyboard/ARIA behavior, or "N/A" if genuinely inapplicable.',
    },
  },
  create(context) {
    const options = context.options[0] || {};
    const decoratorNames = options.decorators || ['Component', 'Injectable', 'Directive', 'Pipe'];

    function hasTargetDecorator(node) {
      return (node.decorators || []).some(
        decorator =>
          decorator.expression &&
          decorator.expression.type === 'CallExpression' &&
          decorator.expression.callee.type === 'Identifier' &&
          decoratorNames.includes(decorator.expression.callee.name)
      );
    }

    return {
      ClassDeclaration(node) {
        if (!hasTargetDecorator(node)) {
          return;
        }

        const sourceCode = context.sourceCode ?? context.getSourceCode();
        const comments = sourceCode.getCommentsBefore(
          node.decorators && node.decorators.length > 0 ? node.decorators[0] : node
        );
        const blockComment = [...comments].reverse().find(comment => comment.type === 'Block');

        if (!blockComment || !/@accessibility\b/.test(blockComment.value)) {
          context.report({ node, messageId: 'missing' });
        }
      },
    };
  },
};
