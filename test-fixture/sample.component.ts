// Minimal local decorator stand-ins so this fixture has zero dependency on
// @angular/core — only the *names* Component/Injectable/Directive/Pipe/Input/Output
// matter to the rule, since it matches on decorator identifier name, not on type info.
function Component(..._args: unknown[]) {
  return (..._decoratorArgs: unknown[]) => {};
}
function Input(..._args: unknown[]) {
  return (..._decoratorArgs: unknown[]) => {};
}
function Output(..._args: unknown[]) {
  return (..._decoratorArgs: unknown[]) => {};
}

// No decorator at all — must NOT be flagged.
export class PlainHelper {
  doThing(): void {}
}

// Undocumented — class and both members must each be flagged.
@Component({})
export class UndocumentedWidget {
  @Input() value = 0;
  @Output() changed = () => {};
}

/**
 * A fully documented widget, used to confirm the rules go quiet once compliant.
 *
 * @example
 * <app-documented-widget [value]="5" (changed)="onChange($event)"></app-documented-widget>
 *
 * @accessibility N/A — fixture only, no real template.
 */
@Component({})
export class DocumentedWidget {
  /** The current value. */
  @Input() value = 0;

  /** Emitted when the value changes. */
  @Output() changed = () => {};
}

// Signal-member stand-ins (Angular 17+ `input()` / `output()` / `model()`).
const input = Object.assign((..._args: unknown[]) => {}, { required: (..._args: unknown[]) => {} });
const output = (..._args: unknown[]) => {};

/**
 * A widget using signal members, used to confirm undocumented signals are flagged.
 *
 * @example
 * <app-signal-widget [status]="s" (cleared)="reload()" />
 *
 * @accessibility N/A — fixture only, no real template.
 */
@Component({})
export class SignalWidget {
  // Undocumented — must be flagged.
  readonly status = input.required();

  /** Emitted when the widget is cleared. */
  readonly cleared = output();
}
