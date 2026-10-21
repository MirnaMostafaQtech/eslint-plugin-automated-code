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
      url: 'https://github.com/MirnaMostafaQtech/eslint-plugin-automated-code/blob/master/docs/implementation-guide.md#what-buildrules-returns',
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
      empty:
        'The @accessibility tag is empty. State the real keyboard/ARIA behavior, or "N/A - <reason>" if genuinely inapplicable.',
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
        // Only a `/** ... */` doc comment counts, the same as for the jsdoc rules: a plain
        // `/* @accessibility */` is not documentation and would otherwise clear this warning alone.
        const docComment = [...comments]
          .reverse()
          .find(comment => comment.type === 'Block' && comment.value.startsWith('*'));
        const description = docComment ? accessibilityText(docComment.value) : null;

        if (description === null) {
          context.report({ node, messageId: 'missing' });
        } else if (description === '') {
          context.report({ node, messageId: 'empty' });
        }
      },
    };
  },
};

/**
 * Returns the text of the `@accessibility` tag in a doc comment (it may continue on the next
 * lines, up to the next tag), `''` when the tag has no text, or `null` when there is no tag.
 */
function accessibilityText(commentValue) {
  const match = /@accessibility\b([\s\S]*?)(?=^[ \t]*\*?[ \t]*@\w|$(?![\s\S]))/m.exec(commentValue);
  if (!match) {
    return null;
  }
  return match[1].replace(/^[ \t]*\*/gm, '').trim();
}
