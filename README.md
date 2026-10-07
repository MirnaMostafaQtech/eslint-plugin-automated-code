# Automated Code Documentation

`@qemam/eslint-plugin-automated-code-docs`

ESLint rules for the org-wide Automated Code Documentation standard on Angular projects: every
`@Component`, `@Injectable`, `@Directive`, and `@Pipe` class needs a summary, `@example`, and
`@accessibility` tag, and every `@Input()`/`@Output()` needs a description.

## Install

```bash
npm install --save-dev @qemam/eslint-plugin-automated-code-docs eslint-plugin-jsdoc
```

Not on the org npm feed yet: until it is published, install from a local checkout
(`"file:<path-to-this-folder>"` in `package.json`).

## Documentation

Everything else (the standard, `eslint.config.js` setup, `buildRules()` options, signal inputs,
publishing, running the tests, and the .NET equivalent) is in one place: the
**Automated Code Documentation — Implementation Guide**.
