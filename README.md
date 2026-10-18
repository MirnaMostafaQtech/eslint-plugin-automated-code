# Automated Code Documentation

`@qemam/eslint-plugin-automated-code-docs`

ESLint rules for the org-wide Automated Code Documentation standard on Angular projects: every
`@Component`, `@Injectable`, `@Directive`, and `@Pipe` class needs a summary, `@example`, and
`@accessibility` tag, and every `@Input()`/`@Output()` and signal `input()`/`output()`/`model()` needs a
description.

## Install

In an Angular workspace with `eslint.config.js`, one command installs the package and sets it up
(`eslint-plugin-jsdoc`, `eslint.config.js`, and the VS Code settings):

```bash
ng add @qemam/eslint-plugin-automated-code-docs
```

Not on the org npm feed yet: until it is published, pass the path of a local checkout instead of
the name. It installs from that folder and runs the same setup:

```bash
ng add <path-to-this-folder>
```

If the package is already installed, run only the setup with
`ng generate @qemam/eslint-plugin-automated-code-docs:ng-add`.

## Documentation

Everything else (the standard, `eslint.config.js` setup, `buildRules()` options, signal inputs,
publishing, running the tests, and the .NET equivalent) is in one place: the
**Automated Code Documentation — Implementation Guide**.
