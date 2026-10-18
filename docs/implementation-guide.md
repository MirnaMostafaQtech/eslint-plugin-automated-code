# Automated Code Documentation — Implementation Guide

Oct 6, 2026 (updated Oct 18, 2026) · @Mirna Mostafa

## Purpose

Every public building block, Angular UI and .NET back-end, must carry complete documentation, and the build must warn automatically when it is missing. This guide gives the exact steps for Angular and ASP.NET MVC projects so every team applies it the same way.

**Standard:** in Angular, every public component, service, directive, and pipe has a complete TSDoc comment covering a summary, its inputs/outputs, a usage example, and accessibility notes. In .NET, every public controller, action, service, and model has an XML `<summary>` (plus `<param>` / `<returns>` where they apply). Lint or build warns on any missing documentation going forward.

**Business impact:** cuts UI developer onboarding time and enables IDE IntelliSense tooltips, reducing time wasted reading source code to understand component contracts.

**Reference implementations:** `qAI.DashBoard` (Angular 19, mostly signal inputs, branch `feature/tsdoc-documentation-dod`), and `qElite-DGA` (.NET 10, `Directory.Build.props`).

## The documentation standard

Each stack uses its native doc format, so IDE tooltips work without extra tools.

| Stack | What must be documented | Required content |
| --- | --- | --- |
| Angular | Every class with `@Component`, `@Injectable`, `@Directive`, `@Pipe` | Summary, `@example`, `@accessibility`, a line on every `@Input()` / `@Output()` (or signal `input()` / `output()` / `model()`) |
| .NET MVC | Every public controller, action, service, and model | `<summary>`, plus `<param>` / `<returns>` where they apply |

### Angular example

```ts
/**
 * Renders a paginated results table with sortable columns.
 *
 * @example
 * <app-results-table [data]="rows" (rowSelected)="onSelect($event)"></app-results-table>
 *
 * @accessibility Headers use scope="col"; rows are selectable with Enter/Space
 * and the selection is announced via aria-live="polite".
 */
@Component({ selector: 'app-results-table', ... })
export class ResultsTableComponent {
    /** The rows to render. An empty array shows the empty state. */
    @Input() data: Row[] = [];

    /** Emits the selected row when the user activates it. */
    @Output() rowSelected = new EventEmitter<Row>();
}
```

A class with no DOM surface (a data service, a pipe) still needs the tag: write `@accessibility N/A - <reason>` so it is a deliberate statement, not a silent gap.

### .NET MVC example

```csharp
/// <summary>
/// Returns the inbox of the current user, newest first.
/// </summary>
/// <param name="page">1-based page number.</param>
/// <returns>The inbox view with one page of letters.</returns>
public ActionResult Inbox(int page = 1)
```

## How to write good docs

The tools only check that a comment and its tags exist. This section covers what goes inside them.

### JSDoc vs TSDoc: what we use

- **JSDoc** is the original `/** ... */` comment format for JavaScript. It carries types in braces (`@param {string} name`) because JavaScript has no type syntax.
- **TSDoc** is Microsoft's standard for the same `/** ... */` comments in TypeScript. The types come from the code, so the comment never repeats them.

We write **TSDoc-style comments** (no types in braces) and check them with `eslint-plugin-jsdoc`, which reads both formats. VS Code and WebStorm show these comments as IntelliSense tooltips with no extra tool.

`@accessibility` is **our own custom tag**. It is not part of JSDoc or TSDoc. If a repo turns on `jsdoc/check-tag-names` (for example through `jsdoc.configs['flat/recommended']`), register the tag or every class gets a false "unknown tag" warning:

```js
settings: { jsdoc: { structuredTags: { accessibility: { type: false } } } },
```

If a repo also uses `eslint-plugin-tsdoc` (rule `tsdoc/syntax`), it reports `@accessibility` as an unknown tag too. Define the tag in a `tsdoc.json` next to `tsconfig.json`:

```json
{
  "$schema": "https://developer.microsoft.com/json-schemas/tsdoc/v0/tsdoc.schema.json",
  "extends": ["@microsoft/api-extractor/extends/tsdoc-base.json"],
  "tagDefinitions": [{ "tagName": "@accessibility", "syntaxKind": "block" }]
}
```

Drop the `extends` line if the repo does not have `@microsoft/api-extractor`.

### Writing the summary

1. The first sentence stands alone and fits on one line. IntelliSense shows it first, sometimes on its own.
2. Start with a verb in the third person: "Renders...", "Loads...", "Formats...", "Returns...".
3. Say what the class or member does and why someone would use it. Do not repeat its name.
4. Add a second paragraph only for things the code does not show: side effects, caching, required call order, or edge cases such as `null` or an empty list.
5. Write in English.
6. Mention units, formats, and ranges (milliseconds, ISO dates, 1-based pages).

| Bad | Why | Good |
| --- | --- | --- |
| `/** Results table component. */` | Repeats the class name | `/** Renders a paginated results table with sortable columns. */` |
| `/** The data. */` | Says nothing | `/** The rows to render. An empty array shows the empty state. */` |
| `/** Gets user. */` | Hides the real behaviour | `/** Loads the current user from the API and caches it for the session. */` |
| `/** @param {string} id the id */` | Repeats the type and the name | `/** @param id The letter's GUID, as returned by the inbox API. */` |
| `/** TODO */` or an empty `/** */` | Clears the warning with no content | Write the real summary, or leave the warning visible |

### Services: public methods

Lint does not require it, but every public method of a service should have a summary, `@param` for each parameter, and `@returns` when it returns something. These are the tooltips developers read most.

```ts
/**
 * Loads and caches the letters in the current user's inbox.
 *
 * @example
 * this.inbox.getPage(1).subscribe(page => this.rows = page.items);
 *
 * @accessibility N/A - data service with no DOM output.
 */
@Injectable({ providedIn: 'root' })
export class InboxService {
    /**
     * Fetches one page of the inbox, newest first.
     *
     * @param page 1-based page number.
     * @param pageSize Letters per page. Defaults to 20.
     * @returns An observable that emits the page once and completes.
     * @throws {HttpErrorResponse} When the API returns 401 or 5xx.
     */
    getPage(page: number, pageSize = 20): Observable<Page<Letter>> { ... }
}
```

### Signal inputs

Signal members are documented the same way as decorator members, with one line above each property.

```ts
/**
 * Shows a status badge with a colour for each state.
 *
 * @example
 * <app-status-badge [status]="letter.status" (cleared)="reload()" />
 *
 * @accessibility The colour is never the only signal: the status text is always
 * rendered, and the badge has role="status".
 */
@Component({ selector: 'app-status-badge', ... })
export class StatusBadgeComponent {
    /** The status to display. Required. */
    readonly status = input.required<LetterStatus>();

    /** Shows a smaller badge for dense tables. */
    readonly compact = input(false);

    /** Emits when the user dismisses the badge. */
    readonly cleared = output<void>();
}
```

### Writing `@example`

- Show the smallest real usage: the template tag for a component or directive, a call for a service, and the template expression for a pipe (a pipe is used in templates, not called):

  ```ts
  /**
   * Formats a date in the Hijri calendar.
   *
   * @example
   * {{ letter.sentAt | hijriDate: 'short' }}
   *
   * @accessibility N/A - returns text only; the host element decides how it is announced.
   */
  @Pipe({ name: 'hijriDate' })
  export class HijriDatePipe implements PipeTransform { ... }
  ```
- One line needs no fence. For several lines, wrap the code in a fenced block inside the comment so the IDE keeps the formatting:

````ts
/**
 * @example
 * ```html
 * <app-results-table
 *     [data]="rows"
 *     (rowSelected)="onSelect($event)">
 * </app-results-table>
 * ```
 */
````

- Never write `@Input` or `@Output` as plain text inside a comment. The parser reads it as a tag. Write `` `@Input()` `` in backticks, or just "input".

### Writing `@accessibility`

State what the class does for keyboard users and screen-reader users. Cover only what applies:

- Keyboard: which keys work and where focus moves.
- Semantics and ARIA: roles, labels, and `aria-live` announcements.
- What the consumer must supply, for example "the host must pass `ariaLabel`".

For a class with no DOM output, write `@accessibility N/A - <reason>`. Verify every claim in the running app before you commit. A wrong accessibility note is worse than none.

### Other useful tags

| Purpose | TSDoc (Angular) | XML doc (.NET) |
| --- | --- | --- |
| Summary | First paragraph | `<summary>` |
| Extra detail | Later paragraphs, or `@remarks` | `<remarks>` |
| Parameter | `@param name Description` | `<param name="name">` |
| Return value | `@returns` | `<returns>` |
| Error thrown | `@throws {Type} When...` | `<exception cref="Type">` |
| Usage example | `@example` | `<example><code>` |
| Link to another symbol | `{@link OtherClass}` | `<see cref="OtherClass"/>` |
| Obsolete API | `@deprecated Use X instead.` | `[Obsolete("Use X instead.")]` plus a note in `<summary>` |
| Reuse the base or interface doc | none (document the interface) | `<inheritdoc/>` |

**.NET tip:** document the interface once and put `/// <inheritdoc/>` on the implementation. This clears `CS1591` with no copied text, and the tooltip shows the interface doc. Apply it in large DTO and service sets such as `qElite.Models`.

## Why this approach

Enforcement lives in tools the team already runs daily, at warning level, so gaps show instantly without blocking anyone.

| Decision | Chosen | Why |
| --- | --- | --- |
| Enforcement tool (Angular) | ESLint + `eslint-plugin-jsdoc` | Already part of `npm run lint`; shows warnings live in VS Code; no new pipeline step |
| Enforcement tool (.NET) | Compiler warning `CS1591` | Built into the C# compiler; shows in Visual Studio's Error List; no package needed |
| `@accessibility` check | Shared package @qemam/eslint-plugin-automated-code-docs | `eslint-plugin-jsdoc` has no rule to require a custom tag, so the package adds one; one versioned package means a fix lands once for every repo |
| Severity | `warn` in existing repos, `error` in new ones | Existing code has a large gap (177 in qAI.DashBoard before its TSDoc work, 3,832 in qElite-DGA); errors would break every build on day one. A new repo starts at zero, so it can use `error` from the start (see [Rollout](#rollout)) |
| Rejected: manual review checklist | - | Depends on memory; no automatic signal |
| Rejected: separate Compodoc step | - | Runs after the build only; no live IDE feedback |

**What is automatic and what is not.** The tools check that a doc comment exists and has the required tags. They do not write the content. The developer who owns the class writes the summary, example, and accessibility note. An AI assistant may draft a first version from the real code, but a developer must verify it before commit, especially the `@accessibility` claim.

## Angular: implementation steps

The rules come from one shared package, so no rule code is copied between repos.

1. Confirm the repo uses ESLint flat config (`eslint.config.js`). If it still uses `.eslintrc.json`, migrate first; if it has no ESLint, run `ng add angular-eslint@<your Angular major>` (e.g. `@21`; without it, `ng add` installs the latest major, which may not match).

   Older repos cannot always follow this step as written. The package needs ESLint 9 and flat config, and angular-eslint matches the Angular major:

   | Repo state | What to do first |
   | --- | --- |
   | Angular 18 or newer, no ESLint | `ng add angular-eslint@<major>`. It creates `eslint.config.js` on ESLint 9 |
   | Angular 18 or newer, `.eslintrc.json` | Migrate to `eslint.config.js` (ESLint's `npx @eslint/migrate-config .eslintrc.json` gives a first draft), then check that `ng lint` still runs |
   | Angular 12 to 17 | angular-eslint for these majors supports ESLint 8 only (`.eslintrc.json`), so the package cannot plug into `ng lint`. Upgrade Angular to 18 or newer first, or postpone this repo |
   | Angular 11 or older, TSLint | Move from TSLint to ESLint and upgrade Angular first; same as the row above after that |
   | Node older than 18.18 | ESLint 9 does not run. Upgrade Node first |

   The `ng add` setup in step 2 picks the `eslint-plugin-jsdoc` version from the developer's Node: `^64` on Node 22.22.2 or newer, `^63` on 22.13, `^62` on 20.19, `^61` on 20.11, `^50` on 18.18. Use the same Node major in CI.

   `ng add angular-eslint` also turns on angular-eslint's default rules at `error`. On existing code they usually report errors unrelated to documentation (mostly template accessibility), so `npm run lint` exits with code 1 and would fail CI. Decide per repo: fix those errors, or keep only the documentation rules for now and add the defaults later. Record the count either way.
2. Install and set up the package with one command:

   ```bash
   ng add @qemam/eslint-plugin-automated-code-docs
   ```

   Until the package is on the org npm feed, pass the path of a local checkout instead of the name. It installs from that folder (saved as a `file:` entry) and runs the same setup:

   ```bash
   ng add D:/General/eslint-plugin-qemam-doc-dod
   ```

   If the package is already installed, run only the setup with `ng generate @qemam/eslint-plugin-automated-code-docs:ng-add`.

   The setup does the following, and prints each change:

   - Adds `eslint-plugin-jsdoc` to `devDependencies` if it is missing (the version that matches the developer's Node, see step 1), and runs `npm install`.
   - Adds the two `require` lines (or `import` lines for ESM) to `eslint.config.js` and appends a separate `**/*.ts` block with `...codeDocs.buildRules()`. Flat config merges every block that matches a file, so the repo's own `**/*.ts` block is not touched.
   - Adds `dbaeumer.vscode-eslint` to `.vscode/extensions.json` (creates the file if needed).
   - Removes the `.vscode/settings.json` entries that silently stop live warnings: an `eslint.options.overrideConfigFile` pointing to a missing file, `eslint.workingDirectories` outside the repo, and `eslint.useFlatConfig: false`. It never creates `settings.json`.

   It stops with a message, and changes nothing, when Node is older than 18.18 (ESLint 9 does not run there), when the repo has no `eslint.config.js` (it prints the `ng add angular-eslint@<major>` command for the repo's Angular version), or when it still uses `.eslintrc.*`. Running it twice is safe. Options: `--skip-vscode` leaves `.vscode` alone; `--skip-install` skips `npm install`.

   `buildRules()` adds four rules at `warn`, scoped only to `@Component`/`@Injectable`/`@Directive`/`@Pipe` classes and their members: decorator `@Input`/`@Output` and signal `input()`/`output()`/`model()` (including `.required()`). Options and rule details: see [The shared ESLint package](#the-shared-eslint-package). If the repo also uses `jsdoc/check-tag-names`, register `@accessibility` as described in [JSDoc vs TSDoc](#jsdoc-vs-tsdoc-what-we-use).
3. If the repo already used the package before version 0.2.0, the setup leaves `eslint.config.js` as it is. Check two things by hand: replace the old package name `@qemam/eslint-plugin-doc-dod` with `@qemam/eslint-plugin-automated-code-docs`, and delete any old signal-member workaround (a `signalMemberContexts` list added to `jsdoc/require-jsdoc`). The setup prints a warning for both. Keeping the workaround reports every undocumented signal member twice.
4. Run **Developer: Reload Window** in VS Code so the extension picks up the new settings.
5. Run `npm run lint` and record the documentation warning count as the repo's baseline in `docs/engineering/automated-code-documentation.md`.
6. Add a line to the repo's `CLAUDE.md` or `README.md` linking to that doc.

`eslint --fix` and fix-on-save (`source.fixAll.eslint`) never clear these warnings. Since version 0.2.0, `buildRules()` turns off the fixers of `jsdoc/require-jsdoc` and `jsdoc/require-example`, which would otherwise insert an empty `/** */` stub or an empty `@example` tag and hide the gap. Other rules (Prettier, import sorting) still fix as before. On a `--fix` run, ESLint may print an `ESLintCircularFixesWarning`: `require-example` still offers a fix that rewrites the comment unchanged. The file is not changed, and the warning can be ignored.

## The shared ESLint package

`@qemam/eslint-plugin-automated-code-docs` holds the Angular rules, so every repo installs one versioned package instead of copying rule code. It was piloted in qAI.DashBoard, then extracted. Source: `D:\General\eslint-plugin-qemam-doc-dod`.

### What `buildRules()` returns

| Rule | Checks |
| --- | --- |
| `jsdoc/require-jsdoc` | A doc comment exists on the class and on every `@Input` / `@Output` and signal `input()` / `output()` / `model()` |
| `jsdoc/require-description` | The class comment has a summary |
| `jsdoc/require-example` | The class comment has an `@example` tag |
| `automated-code-docs/require-accessibility-tag` | The class comment has an `@accessibility` tag (the package's own rule) |

All four fire only on classes with one of the listed decorators. Plain functions, functional guards, and models are never flagged; a class-based guard has `@Injectable`, so it is checked like any service.

### What the rules do not catch

The standard still applies to these, but no warning shows when they are missing, so reviewers check them:

- Inputs and outputs declared in the decorator metadata, `@Component({ inputs: [...], outputs: [...] })`, and host bindings in `host: { ... }`. The rules only see class properties.
- Base classes without a decorator (for example an abstract base component). Their members are not checked, even when subclasses inherit them as inputs.
- Public methods of services. The guide asks for a summary, `@param`, and `@returns` on them ([Services: public methods](#services-public-methods)); the rules do not require it.
- Quality. A comment that exists but says nothing (`/** The data. */`) clears the warning.

### Options

```js
codeDocs.buildRules({
  decorators: ['Component', 'Injectable', 'Directive', 'Pipe'], // class decorators to check
  memberDecorators: ['Input', 'Output'],                        // member decorators to check
  signalMembers: ['input', 'output', 'model'],                  // signal functions to check; [] turns this off
  severity: 'warn',                                             // 'error' once the repo's gap is zero
});
```

Keep `decorators` and `memberDecorators` separate: a class decorator name never matches a member, so mixing the lists silently checks nothing.

### Signal-member support

Since version 0.2.0 the package checks signal members with no extra setup: `input()`, `input.required()`, `output()`, `model()`, and `model.required()`. It checks only direct properties of a class that has one of the `decorators`, so a plain class that calls a function named `input()` is never flagged. Other signal functions (`signal()`, `computed()`, `viewChild()`) are not inputs and are not checked.

Repos on version 0.1.0 may have a workaround in `eslint.config.js` that added these selectors by hand. Delete it when moving to 0.2.0, or every undocumented signal member is reported twice.

### Publishing

The package is not on the org npm feed yet, so repos install it from a local checkout (step 2 above). That path only works on a machine that has the package folder, so `npm install` fails in CI and on other machines until it is published. To publish: set `publishConfig.registry` in the package's `package.json` to the feed URL, then run `npm publish`. After that, each repo changes its `file:` entry to a version range (e.g. `"^0.2.0"`) and runs `npm install`; `eslint.config.js` does not change.

### Maintaining the package

Run the tests after every change to the package:

```bash
npm test
```

```bash
npm run lint:fixture
```

`npm test` runs three files:

- `test/require-accessibility-tag.test.js`: the custom rule alone, via `RuleTester`.
- `test/build-rules.test.js`: the full `buildRules()` set via the `Linter` API, including signal members. It holds regression tests for two bugs that once slipped through manual testing: plain functions being flagged (fixed with `require: { FunctionDeclaration: false }`) and class/member decorator lists being mixed up.
- `test/ng-add.test.js`: the `ng add` setup, run on in-memory files with `SchematicTestRunner`. It covers CommonJS and ESM configs, running twice, an existing `eslint-plugin-jsdoc` import, the old package name, the missing-config and `.eslintrc` messages, the VS Code changes, the `eslint-plugin-jsdoc` version picked for each Node version, and the stop on Node older than 18.18. One test loads the generated `eslint.config.js` and lints a sample component with it, so a broken config fails the test.

`npm run lint:fixture` is a manual check against `test-fixture/sample.component.ts`.

The `ng add` setup lives in `schematics/ng-add/index.js`. After changing it, also run it through the Angular CLI on a throwaway copy of a real repo (for example `git archive` of qAI.DashBoard into a temp folder, then `npm ci` and `ng add <path to the package>`), and check the diff. The test runner does not run the CLI's install step.

## .NET MVC: implementation steps

One file at the solution root turns it on for every project; no package is needed. Reference implementation: `qElite-DGA` (I-line).

1. Create a branch (or a TFVC shelveset) for the change.
2. Add `Directory.Build.props` next to the `.sln` file. MSBuild imports it into every `.csproj` below that folder, including projects added later:

   ```xml
   <Project>
     <PropertyGroup>
       <GenerateDocumentationFile>true</GenerateDocumentationFile>
     </PropertyGroup>
   </Project>
   ```

   If the file already exists, add the property to its `PropertyGroup`.
3. Check that no `.csproj` lists `1591` in `<NoWarn>`; remove it if it does, or the warning stays hidden. If a project has `TreatWarningsAsErrors` on, do not turn it off for this change. Keep it, and exclude only this warning so it stays a warning:

   ```xml
   <WarningsNotAsErrors>$(WarningsNotAsErrors);CS1591</WarningsNotAsErrors>
   ```
4. Old-style (non-SDK) .NET Framework projects do not read `GenerateDocumentationFile`. Set `DocumentationFile` instead, in the same `Directory.Build.props`:

   ```xml
   <DocumentationFile>$(MSBuildProjectDirectory)\bin\$(MSBuildProjectName).xml</DocumentationFile>
   ```

   Use `$(MSBuildProjectName)`, not `$(AssemblyName)`. `Directory.Build.props` is read before the `.csproj` sets `AssemblyName`, so `$(AssemblyName)` is still empty there, and every project would write the same `bin\.xml` file.
5. Exclude code the standard does not cover. `CS1591` fires on every public member, but the standard asks for controllers, actions, services, and models. Without exclusions the baseline fills with warnings nobody will fix, and people learn to ignore the list.

   EF migrations (generated code), in an `.editorconfig` next to the `.sln`:

   ```ini
   [**/Migrations/*.cs]
   dotnet_diagnostic.CS1591.severity = none
   ```

   Test projects, in a `Directory.Build.targets` file next to `Directory.Build.props`. `IsTestProject` is set by the `Microsoft.NET.Test.Sdk` package, which loads after `Directory.Build.props`, so this condition only works in the `.targets` file:

   ```xml
   <Project>
     <PropertyGroup Condition="'$(IsTestProject)' == 'true'">
       <NoWarn>$(NoWarn);CS1591</NoWarn>
     </PropertyGroup>
   </Project>
   ```

   Other noise to expect, and leave on: enum members and public constants. Document the enum once and its members with a short line each; they show in IntelliSense too.
6. Rebuild the solution with `dotnet build --no-incremental` (old-style projects: `msbuild /t:Rebuild`) and record the `CS1591` warning count as the baseline. If the repo had a baseline from before step 5, measure it again: it drops. Count each warning once: the build prints every warning twice (inline and in the summary), so a raw count is double (qElite-DGA once recorded 86 for `qElite.Web`; the same build shows 41 unique warnings). An incremental build only reports files it recompiles, so it undercounts. If a project listed in the `.sln` is missing on disk, the solution build fails; build the existing projects one by one and note what was left out.
7. Optional: add `StyleCop.Analyzers` for parameter-level rules (`SA1611` params, `SA1615` returns), kept at warning.

## IDE setup: warnings while typing

Without this step the warning only appears when someone runs the lint or build by hand.

**VS Code (Angular)**

The `ng add` setup (Angular step 2) does this automatically. What it changes, for reference or for a repo where it was run with `--skip-vscode`:

- `.vscode/extensions.json`: `dbaeumer.vscode-eslint` in `recommendations`, so VS Code prompts every developer to install it.
- `.vscode/settings.json`: no `eslint.options.overrideConfigFile` pointing to a file that no longer exists, no `eslint.workingDirectories` outside the repo, and no `"eslint.useFlatConfig": false`. Each one silently stops live warnings; qAI.DashBoard had the first two. A dry run of the setup on qAI.DashBoard's old config removed exactly those two.
- After the change, run **Developer: Reload Window**. This is per developer and is not saved in the repo.

**Visual Studio (.NET)**

- No setup. `CS1591` appears in the Error List and as a green squiggle under the class or method name after the next build or background analysis.

## Verification checklist

Tick every item before the PR is approved.

**Angular**

- [ ] `npm run lint` runs without a config error, and the documentation warning count is recorded.
- [ ] A file with no Angular decorator (a guard, a plain function) shows zero documentation warnings.
- [ ] A component with inputs shows one warning on the class and one per `@Input` / `@Output` or `input()` / `output()` / `model()` (never two warnings on the same member).
- [ ] Fully documenting one file makes its warnings disappear, and the total drops by that amount.
- [ ] A file with only documentation warnings exits with code 0 (warnings never fail the build).
- [ ] In VS Code, an undocumented class is underlined while typing.

**.NET MVC**

- [ ] The solution builds, and the `CS1591` count is recorded.
- [ ] A new public method without `<summary>` shows `CS1591` in the Error List.
- [ ] Adding the `<summary>` clears the warning.
- [ ] The build still succeeds (warning, not error).

## Rollout

The standard covers new and changed code only; existing undocumented code is not a blocker.

### New projects: error from day one

A new project has no undocumented code, so it starts at `error` and never builds up a gap:

- Angular: run the `ng add` setup, then change the generated line to `...codeDocs.buildRules({ severity: 'error' })`.
- .NET: add `<WarningsAsErrors>$(WarningsAsErrors);CS1591</WarningsAsErrors>` next to `GenerateDocumentationFile` in `Directory.Build.props`.

### Existing projects: warn, with a ratchet

1. **New or changed code complies from day one.** A PR that adds a component, service, directive, pipe, controller, or input/output (`@Input`/`@Output` or `input()`/`output()`/`model()`) must not raise the warning count. The CI ratchet in point 4 enforces this; it does not depend on reviewers remembering.
2. **Existing gap is tracked, not required.** Record each repo's baseline; backfill it when a file is touched for other work, or as a separate cleanup task.
3. **Hard gate only after the gap is closed.** When a repo's count reaches zero, switch it to errors as for a new project.
4. **CI ratchet.** A warning never fails a build on its own, so the pipeline compares the count with the baseline and fails only when it goes up. Each time the count goes down, lower the baseline number in the pipeline to the new count.

   Angular: `--max-warnings` fails the lint when the warning count is higher than the number given:

   ```bash
   ng lint --max-warnings=177
   ```

   This counts every ESLint warning, not only documentation ones, so set it to the repo's total warning count. Lint must already pass without errors; if the default angular-eslint rules still report errors (Angular step 1), fix or turn them off first, or this step fails for unrelated reasons.

   .NET: count each `CS1591` warning once and fail when the count is higher than the baseline (`-clp:NoSummary` drops the summary, so warnings are not printed twice):

   ```powershell
   $baseline = 3832
   $count = (dotnet build --no-incremental -clp:NoSummary | Select-String 'warning CS1591' | Sort-Object Line -Unique).Count
   if ($count -gt $baseline) { Write-Error "CS1591 warnings rose from $baseline to $count"; exit 1 }
   ```

## Approval and open items

Two pilots are in place, see Status. Approval is needed to roll this out to every Angular and MVC repo.

| Repo | Stack | Status | Baseline |
| --- | --- | --- | --- |
| qAI.DashBoard | Angular 19 | Implemented and committed; the rename to `@qemam/eslint-plugin-automated-code-docs` is local, not committed yet (the committed version still uses `@qemam/eslint-plugin-doc-dod`) | 119 warnings, recorded with package 0.1.0, which did not check signal inputs. The repo uses them a lot: on the commit before the TSDoc work, package 0.2.0 reports 177 (35 classes, 3 decorator members, 56 signal members, 60 missing `@accessibility`, 23 missing `@example`). Re-measure on the current branch after moving to 0.2.0 |
| qElite-DGA (I-line) | .NET 10 | Implemented; the wording update ("Automated Code Documentation", corrected baseline in `Docs/architecture/AutomatedCodeDocumentation.md`) is local, not checked in to TFVC yet | 3,832 `CS1591` warnings in 557 files across 13 projects (most in `qElite.Models`: 1,963). Recorded Oct 7, 2026; the 5 GIS projects in the `.sln` were not on disk, so they are not counted. Recorded before migrations and test projects were excluded (.NET step 5); measure again after adding the exclusions |

**Open items**

| Item | Impact | Next step |
| --- | --- | --- |
| The ESLint package is not published to an npm feed | `npm install` fails in CI and on every machine except the author's (repos use a `file:` path) | Create a git repo for the package and an npm feed in Azure Artifacts on `tfs25.alqemam.com`, publish it, then switch each repo to `"^0.2.0"`. It does not belong in `qMarketPlace`, which holds Claude Code plugins, not npm packages |
| qElite-DGA baseline excludes 5 GIS projects | The real total is higher than 3,832 | Get the GIS projects, rebuild, and update the table |
