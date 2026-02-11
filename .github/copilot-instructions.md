# Watch Advisor — Copilot Instructions

Single-file React 18 PWA for watch and outfit coordination. No build process, no npm, no server.

## Architecture

```
static/index.html   — Entire app: HTML + CSS + JS (~308KB)
static/sw.js         — Service worker (cache versioned, currently v17)
static/manifest.json — PWA manifest
static/icon-*.png    — App icons
```

Everything lives in `index.html`. Do not split into separate files.

## Tech

- **React 18** via CDN (`react.production.min.js`, `react-dom.production.min.js`)
- **Inline CSS** with CSS variables for theming (`:root` + `body.light` overrides)
- **LocalStorage** for all persistence (versioned with `SK` suffix)
- **Open-Meteo API** for weather (no auth needed)
- **OpenAI API** for AI features (optional, user-provided key)
- **Service Worker** for offline/PWA

## Code Conventions

- ES6+ but no modules/imports — everything global in one `<script>` block
- Short variable names for size: `CM` = Color Map, `SK` = Storage Key, `W` = watches array
- `React.createElement()` everywhere — no JSX (no transpiler)
- Functional components with hooks (`useState`, `useEffect`, `useMemo`, `useCallback`, `memo`)
- CSS variables: `--bg`, `--card`, `--card2`, `--text`, `--sub`, `--dim`, `--gold`, `--border`, `--good`, `--bad`
- Theme toggle: `body.light` class flips all CSS vars. **All UI colors must use `var(--*)` — never hardcode hex for backgrounds, borders, or text.**
- Animation classes: `.fu` (fade-up), `.sp` (spin-pulse), `.pu` (pulse)

## Key State

- `W` / `setW` — watch collection array
- `wardrobe` / `setWardrobe` — garment array
- `wearLog` / `setWearLog` — wear history { watchId: [dateStrings] }
- `rotLock` / `setRotLock` — 7-element array, locked watch ID per day
- `altSwap` / `setAltSwap` — object { dayIndex: altIndex } for alternative outfit swaps
- `expandDay` / `setExpandDay` — which day card is expanded
- `view` / `setView` — current tab ("wardrobe", "fits", "insights", "watches", "saved")

## Scoring Algorithm

The outfit scoring considers: color harmony (warm/cool matching), formality tier (clinic/smart casual/casual/weekend), rotation freshness (days since last worn), genuine/replica context bonus, strap-shoe color enforcement (hard fail if mismatch), weather-responsive strap selection, and weekly dial color variety.

## Rules

- **Do not** add package.json, node_modules, or build tools
- **Do not** split into multiple files
- **Do not** add server-side components
- **Do not** hardcode dark hex colors in inline styles — use CSS variables
- **Do** test on mobile (primary use case)
- **Do** bump `sw.js` cache version on every deploy
- **Do** validate JS syntax with `node --check` before pushing
- **Do** preserve the single-file architecture
