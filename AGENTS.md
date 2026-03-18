# AGENTS.md

## Project Overview
KOURAKS is a no-build, single-page idle/clicker game.
There is no compilation step, no server, no backend — ever.
When in doubt, keep it simple. This stack is intentionally minimal.

---

## Stack — Hard Constraints

**Runtime dependencies (CDN only, already in index.html):**
- Alpine.js — reactivity, state, DOM interactions
- Pico CSS — semantic HTML styling, no utility classes

**Project files:**
- `src/index.html` — single entry point, all CDN imports live here
- `src/app.js` — all JavaScript, Alpine stores and components
- `src/app.css` — custom styles on top of Pico CSS
- `package.json` — dev tooling only (Biome linter), never runtime
- `biome.json` — linter config

---

## Absolute Rules

**Never do this:**
- `import` / `export` statements in `src/app.js` — there is no bundler
- `npm install <anything>` for a runtime dependency — use CDN instead
- Create `.ts`, `.jsx`, `.tsx`, `.vue` files
- Suggest Vite, Webpack, Rollup, esbuild or any build tool
- Add a backend, REST API, or server-side logic
- Write Jest, Vitest or any test file
- Use `document.getElementById` or manual DOM queries — use Alpine.js instead

**Always do this:**
- Add new CDN dependencies as `<script>` or `<link>` tags in `src/index.html`
- Keep all reactive state in `src/app.js` via `Alpine.store()` or `Alpine.data()`
- Use semantic HTML elements with Pico CSS (no custom class soup)
- Run `npm run lint` after every change and fix all errors before finishing

---

## Alpine.js Patterns

**Available globals:** `Alpine`, `$store`, `$el`, `$dispatch`, `$watch`, `$refs`, `$event`, `$nextTick`

**Defining a store (in app.js):**
```js
document.addEventListener('alpine:init', () => {
  Alpine.store('game', {
    tick: 0,
    increment() { this.tick++ }
  })
})
```

**Defining a reusable component (in app.js):**
```js
document.addEventListener('alpine:init', () => {
  Alpine.data('myComponent', () => ({
    open: false,
    toggle() { this.open = !this.open }
  }))
})
```

**Referencing a store in HTML:**
```html
<span x-text="$store.game.tick"></span>
<button @click="$store.game.increment()">+</button>
```

---

## Pico CSS Guidelines

- Prefer native HTML elements over custom classes: `<dialog>`, `<details>`, `<article>`, `<nav>`
- Use `role="button"` on `<a>` tags to style them as buttons
- Pico's grid is based on `<div class="grid">` with direct children as columns
- Dark/light mode is handled by `data-theme="dark"` on `<html>` — no custom CSS needed

---

## Workflow

1. Make the change
2. Run `npm run lint`
3. Fix all reported errors
4. Only then consider the task done

If a lint error requires a structural change to `app.js`, make it — do not suppress rules.
