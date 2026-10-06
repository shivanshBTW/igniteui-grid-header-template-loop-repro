# IgrGrid 19.9.0: "Maximum update depth exceeded" with header icon templates

## Summary

With `@infragistics/igniteui-react-grids` **19.9.0**, an `IgrGrid` that has a
header icon template (`sortHeaderIconTemplate` or
`excelStyleHeaderIconTemplate`) **and** any template prop explicitly passed as
`undefined` (for example `rowEditTextTemplate={isEditable ? Tpl : undefined}`)
hangs on mount. React throws `Maximum update depth exceeded`, logged by
Angular's error handler as `ERROR Error: Maximum update depth exceeded ...`.

The same code works on 19.4.0.

## Reproduce

```bash
cp .npmrc.local.example .npmrc.local   # add your Infragistics licensed-feed credentials
npm_config_userconfig="$(pwd)/.npmrc.local" npm install
npm_config_userconfig="$(pwd)/.npmrc.local" npm run dev
```

Open the printed URL with DevTools open. The page links to three variants:

| URL | Header icon templates | `rowEditTextTemplate` | Result |
| --- | --- | --- | --- |
| `/` | on | passed as `undefined` | hangs, `Maximum update depth exceeded` |
| `/?undefinedProp=omit` | on | key omitted | works |
| `/?headerTemplates=off` | off | passed as `undefined` | works |

All of the code is in `src/App.tsx` (about 70 lines).

## Root cause

The loop is a single synchronous call chain (captured stack, trimmed):

```
dispatchSetState                       (react-dom)
renderFunc                             react-props-DvdRCtwq.js   setRenderers(new Map(...))
RequestRenderer.update                 react-props-DvdRCtwq.js   _shouldUpdate() -> _shouldUpdateNG() === true
litRender                              igniteui-webcomponents-grids  header icon template view
ApplicationRef tick / synchronize      igniteui-webcomponents-grids  zone exit -> change detection
Eb.setInputValue                       igniteui-webcomponents-grids  input considered changed
set rowEditTextTemplate                igniteui-webcomponents-grids
setProperty                            @lit/react create-component   useLayoutEffect re-assigns every prop
commitLayoutEffects                    (react-dom)               setState above is SyncLane -> nested
```

Two things combine:

1. **An `undefined` template prop gets a new function on every render.** In
   `react-props-DvdRCtwq.js`, `createComponent$1` deletes the cached listener
   for any prop whose value is `undefined` (`hasNestedProperty` returns false),
   but `processProps` still iterates that key and creates a fresh
   `createPatched(...)` wrapper. `@lit/react` then assigns it to the element in
   its layout effect. `Eb.setInputValue` sees a function it has never seen,
   wraps it in a new `TemplateRef`, sets the input, and the zone exit runs
   change detection synchronously, still inside React's commit.
2. **`_shouldUpdateNG` no longer de-duplicates.** Change detection re-runs the
   header icon template views, whose `RequestRenderer.update` now always invokes
   the callback, which calls `setRenderers(...)`. Because this happens during
   React's commit phase it gets a sync lane, so React re-renders the wrapper
   immediately, the layout effect re-assigns the `undefined` template prop
   (new function again), and the cycle repeats until React aborts.

In 19.4.0 step 2 compared `ctx.$implicit` and skipped the callback when it was
unchanged, which broke the cycle:

```js
// 19.4.0 template-renderer.js
_shouldUpdateNG(t) {
  return d(t.$implicit, this._state.previous) ? !1 : (this._state.previous = t.$implicit, !0);
}

// 19.9.0 react-props-DvdRCtwq.js
_shouldUpdateNG(_data) {
  return true;
}
```

Either fix on your side would stop it: restore the equality check in
`_shouldUpdateNG`, and/or keep the cached listener (or skip the prop) when a
template prop's value is `undefined`.

## Workaround

Never pass a template prop as `undefined`; omit the key instead:

```tsx
<IgrGrid
  {...(isEditable && { rowEditTextTemplate, rowEditActionsTemplate })}
  sortHeaderIconTemplate={SortIcon}
/>
```

## Environment

- `@infragistics/igniteui-react-grids` 19.9.0 (`@infragistics/igniteui-webcomponents-grids` 7.2.1)
- `@infragistics/igniteui-react` 19.9.0, `@lit/react` 1.0.8
- `react` / `react-dom` 18.3.1
- Chrome, Vite dev server
