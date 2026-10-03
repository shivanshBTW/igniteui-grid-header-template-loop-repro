# IgrGrid header-template regression in 19.9.0 (works correctly in 19.4.0)

## Summary

Upgrading `@infragistics/igniteui-react` and `@infragistics/igniteui-react-grids`
from `19.4.0` to `19.9.0` breaks any `IgrGrid` that uses a header-icon-style
template prop — confirmed with `sortHeaderIconTemplate` and
`excelStyleHeaderIconTemplate`, but the defect is in shared code used by any
template whose context object exposes `implicit` (several other grid template
props share this same context shape).

**Symptom in a real application:** enabling either prop causes the grid to
spiral into a React `Maximum update depth exceeded` crash — the tab becomes
unresponsive. Disabling both props makes it stable again.

**Root cause:** both `@infragistics/igniteui-react` and
`@infragistics/igniteui-react-grids` 19.9.0 ship their own copy of a template
rendering bridge (`react-props-DvdRCtwq.js`) that determines whether a
template callback should be re-invoked. In 19.4.0 this did a deep-equality
check and skipped the callback when nothing had changed. In 19.9.0 that check
was removed — the method now unconditionally returns `true`, so the callback
re-fires on every internal grid update tick regardless of whether the
column's content actually changed.

## The diff

**19.4.0** — `@infragistics/igniteui-react-grids/template-renderer.js`
(and the matching file in `@infragistics/igniteui-react`):

```js
_shouldUpdateNG(t) {
  return d(t.$implicit, this._state.previous)
    ? !1
    : (this._state.previous = t.$implicit, !0);
}
```

(`d` is the module's deep-equal helper — this skips re-invoking the callback
when `$implicit` hasn't changed.)

**19.9.0** — `@infragistics/igniteui-react-grids/react-props-DvdRCtwq.js`
(byte-identical copy also present in `@infragistics/igniteui-react`):

```js
_shouldUpdateNG(_data) {
  return true;
}
```

The equality check was dropped entirely. `_shouldUpdate()` still contains a
proper equality-gated branch for the *other* (non-`implicit`) context shape a
few lines below it — only the `implicit`-context path (used by header icon
templates, among others) regressed:

```js
_shouldUpdate() {
  const data = this._state.current;
  if (Reflect.has(data, "implicit")) return this._shouldUpdateNG(data); // always true now
  if (equal(this._state.previous, data)) return false; // this branch is still correct
  this._state.previous = data;
  return true;
}
```

## Reproduction

```bash
cp .npmrc.local.example .npmrc.local   # fill in your own Infragistics licensed-feed credentials
npm_config_userconfig="$(pwd)/.npmrc.local" npm install
npm_config_userconfig="$(pwd)/.npmrc.local" npm run dev
```

Open the printed `localhost` URL. Within a couple of seconds you'll see two
counters on the page — "`sortHeaderIconTemplate` invocations" and
"`excelStyleHeaderIconTemplate` invocations" — climbing into the thousands,
even though nothing about the grid's data, sorting, filtering, or column
widths is changing. That is the defect, deterministically, with no timing
dependence.

In our production application (a much larger grid — dozens of columns, plus
an app-level polling/layout-diff hook that legitimately touches grid state
every ~1.2s) this same unconditional re-invocation compounds into a full
`Maximum update depth exceeded` crash within a few seconds of opening the
view. This minimal shell is deliberately small and doesn't carry that app's
polling hook, so it reliably demonstrates the over-invocation but isn't
guaranteed to tip into the full crash on its own — the "Run 200 rapid sorts"
button on the page is one attempt at forcing it synchronously via the grid's
`sort()` API; it may or may not trip the crash depending on your machine/React
version, but the invocation counters above prove the bug independently of
that.

## Expected vs. actual

- **Expected (19.4.0 behavior):** the counters stabilize shortly after mount
  and only increase when a column's actual header content changes (sort
  direction, filter state, etc.).
- **Actual (19.9.0):** the counters climb continuously and unboundedly for as
  long as the page is open, for every column using either template prop.

## Environment

- `@infragistics/igniteui-react`: `19.9.0`
- `@infragistics/igniteui-react-grids`: `19.9.0`
- `react` / `react-dom`: `18.3.1`
- Reproduced in Chrome (latest) via Vite 5 dev server; not browser-specific.

## Workaround we're using in the meantime

We've applied a local `pnpm patch` to `@infragistics/igniteui-react-grids`
that restores the 19.4.0 equality check (and adds a defensive null-check
around the `createPortal` call a few lines below it, since the `WeakRef`-held
render target can legitimately be garbage-collected between scheduling and
invocation — a secondary, smaller robustness fix). Happy to share that patch
file if useful for a fix on your end.
