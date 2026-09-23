# @qemam/eslint-plugin-doc-dod

ESLint rules enforcing the org-wide **TSDoc Documentation DoD** on Angular projects: every
`@Component`, `@Injectable` (service), `@Directive`, and `@Pipe` class needs a summary,
`@example`, and `@accessibility` tag, and every `@Input()`/`@Output()` needs a description.

> Piloted on `qAI.DashBoard` before being extracted here so every Angular repo can install one
> versioned package instead of copy-pasting the same ESLint config and custom rule file.

This package only covers **Angular/TypeScript** repos. .NET/MVC projects get the equivalent via
the compiler's own `CS1591` diagnostic (`<GenerateDocumentationFile>true</GenerateDocumentationFile>`
in the `.csproj`) — no package needed there, see [Non-Angular (.NET) projects](#non-angular-net-projects).

## Status

**Not published yet.** This is being built locally ahead of getting write access to the org's
internal npm feed. Once that's granted, publish with:

```bash
npm publish --registry <your-org-feed-url>
```

(update the placeholder in `package.json`'s `publishConfig.registry` first).

## Install (once published)

```bash
npm install --save-dev @qemam/eslint-plugin-doc-dod eslint-plugin-jsdoc
```

## Usage (flat config, `eslint.config.js`)

```js
const jsdoc = require('eslint-plugin-jsdoc');
const docDod = require('@qemam/eslint-plugin-doc-dod');

module.exports = tseslint.config({
  files: ['**/*.ts'],
  // ...your existing extends/plugins/rules...
  plugins: {
    // ...your existing plugins...
    jsdoc,
    'doc-dod': docDod,
  },
  rules: {
    // ...your existing rules...
    ...docDod.buildRules(),
  },
});
```

That's it — `docDod.buildRules()` returns the four rule entries (`jsdoc/require-jsdoc`,
`jsdoc/require-description`, `jsdoc/require-example`, `doc-dod/require-accessibility-tag`), all
pre-scoped to only fire on `@Component`/`@Injectable`/`@Directive`/`@Pipe` classes and their
`@Input`/`@Output` members, and all at `"warn"` severity by default.

### Options

```js
docDod.buildRules({
  decorators: ['Component', 'Injectable', 'Directive', 'Pipe'], // customize if a repo uses others
  severity: 'warn', // or 'error' once a repo has closed its pre-existing documentation gap
});
```

## Why warnings, not errors, by default

Every repo this has been rolled out to so far already had a backlog of undocumented
components/services predating the DoD. Defaulting to `"warn"` means:

- New/changed code is expected to comply immediately — a warning shows up in the IDE (with the
  ESLint extension installed) and in `npm run lint` the moment it's missing.
- The existing backlog doesn't fail every build the day this is installed.
- Each repo backfills its own backlog on its own schedule, then flips `severity: 'error'` once
  that repo's count reaches zero.

## The standard being enforced

```ts
/**
 * Renders a paginated results table with sortable columns.
 *
 * @example
 * <app-results-table [data]="rows" [pageSize]="20" (rowSelected)="onSelect($event)">
 * </app-results-table>
 *
 * @accessibility Table headers use `scope="col"`; row selection is keyboard-operable
 * (Enter/Space) and announces the selected row via `aria-live="polite"`.
 */
@Component({ selector: 'app-results-table' /* ... */ })
export class ResultsTableComponent {
  /** The rows to render. Required; an empty array renders the empty-state slot. */
  @Input() data: Row[] = [];

  /** Emits the selected row when the user activates it. */
  @Output() rowSelected = new EventEmitter<Row>();
}
```

If a class genuinely has no DOM/ARIA surface (a pure data service, say), write
`@accessibility N/A — <reason>` — a deliberate statement, not a silent gap.

**This package only checks structure** (a comment exists, has these tags) — it cannot know what a
component actually does or what ARIA behavior it really implements. The developer who owns the
component writes the actual sentences; an AI-drafted first pass is fine as a time-saver for
backfilling old code, but every draft needs a human check before committing, especially the
`@accessibility` claim.

## Non-Angular (.NET) projects

No package needed — enable the compiler's built-in diagnostic per `.csproj`:

```xml
<PropertyGroup>
  <GenerateDocumentationFile>true</GenerateDocumentationFile>
</PropertyGroup>
```

Leave `CS1591` ("missing XML comment for publicly visible type or member") at its default
**warning** severity. Optionally add `StyleCop.Analyzers` for `@param`/`@returns`-level rules
(`SA1611`, `SA1615`) if a team wants parity with the `@Input`/`@Output`-level granularity here.

## Testing

```bash
npm test              # automated: RuleTester unit tests + Linter integration tests
npm run lint:fixture  # manual sanity check against test-fixture/sample.component.ts
```

`test/require-accessibility-tag.test.js` unit-tests the custom rule in isolation (ESLint's
`RuleTester`). `test/build-rules.test.js` runs the full rule set produced by `buildRules()`
end-to-end via the `Linter` API — including a regression test for the `FunctionDeclaration`
default-scoping bug and the `Input`/`Output`-vs-class-decorators mix-up, both of which slipped
through manual testing once and are exactly the kind of bug this suite exists to catch on every
change.

## Rolling this out to a new repo

1. `npm install --save-dev @qemam/eslint-plugin-doc-dod eslint-plugin-jsdoc`.
2. Wire it into `eslint.config.js` per [Usage](#usage-flat-config-eslintconfigjs) above.
3. Run `npm run lint` (or `npx eslint . --ext .ts`) once to get that repo's baseline warning count.
4. Record the baseline somewhere the team can see it (a docs file, e.g.
   `docs/engineering/documentation-dod.md`, is what `qAI.DashBoard` used).
5. Make sure the ESLint VS Code extension is recommended in `.vscode/extensions.json` and that
   `.vscode/settings.json` doesn't point `eslint.options.overrideConfigFile` at a stale
   `.eslintrc.json` if the repo migrated to flat config — that silently breaks live IDE warnings.
