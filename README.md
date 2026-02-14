# Watch Advisor

Personal watch & outfit coordination PWA. ES module React 18 app.
No build step, no npm, no bundler.

**Live:** [eiasash.github.io/Watch-advisor](https://eiasash.github.io/Watch-advisor/)

## Architecture (v25.5)

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | ~107 | CSS + HTML shell |
| `app.js` | ~2,780 | React UI components + application logic |
| `data.js` | ~417 | Constants, color maps, presets, defaults |
| `engine.js` | ~488 | Outfit scoring, rotation, compatibility |
| `utils.js` | ~343 | Garment naming, watch parsing, helpers |
| `ai.js` | ~165 | AI classification, vision, occasion planning |
| `photos.js` | ~101 | IDB photo storage, hashing, compression |
| `crypto.js` | ~26 | API key encryption/decryption |
| `sw.js` | ~73 | Service worker (network-first for code) |

Native ES modules — browser handles imports, no transpilation.

## Install as PWA

1. Open in Chrome on Android
2. Tap ⋮ → **Add to Home Screen**
3. Full-screen app, works offline

## Current Version: v25.5

### Features
- 7-day watch rotation with weather-aware outfit generation
- Watch-first workflow: app picks watch, then builds outfit around it
- **📸 Selfie Check** — AI vision identifies garments + watch, scores impact 1-10
- **🔄 Unworn rotation** — "Fresh" toggle boosts neglected items, 14d+ badges on cards
- **🧊 Neglected wardrobe** — insights section showing dormant garments
- AI Style Coach — full wardrobe analysis with gap detection
- AI Occasion Planner — event-specific outfit recommendations
- Wear Stats Dashboard — 30/60/90 day views, neglected watch alerts
- Strap-specific logging with condition estimates
- Dynamic Outfit Builder — unlimited renameable layer slots
- Weekly rotation planner with lock/swap
- Wardrobe management with photo upload and AI color classification
- Genuine/replica context scoring (genuine bonus for clinic, replica safe for casual)
- Hard strap-shoe color enforcement
- Weather-responsive strap picks
- Undo toasts, haptic feedback, tab animations
- Service worker escape hatch (Force button, auto-reload on SW update)
- Day/night theme toggle
- PWA with offline support

## Changelog

| Version | Changes |
|---------|---------|
| **v25.5** | 🚀 Release: Version bump, all systems verified. Updated documentation and service worker cache. |
| **v25.4** | ⚡ VirtualGrid: hybrid windowing for wardrobe grid. Only visible pages in DOM, off-screen pages become spacers. IO-based auto-pagination replaces "Show More" button. |
| **v25.3** | Fix blank screen — orphaned `const DEFAULT_CX=[` in utils.js broke module parse. |
| **v25.2** | Unworn rotation: "Fresh" toggle, 14d+ badges, neglected wardrobe insight. SW escape hatch: Force button, CLEAR_ALL_CACHES, controllerchange auto-reload. |
| **v25.1** | ES module split (monolith → 7 modules). Undo toasts, haptic feedback, tab slide animations, lazy image loading. |
| **v24.14** | Content-visibility tuning, color sampling accuracy, dHash logging. |
| **v24.13** | Multi-select garments, dHash duplicate detection, constrained AI. |
| **v24.12** | Blob URL lifecycle fix, guarded IDB migration. |
| **v24.10** | Password session-only. Multi-image batch scan. Watch search bar. Quick wear button. Share outfit. CI/CD workflows. |
| **v24.4** | Mobile scroll fix. Strap photo camera/gallery. |
| **v24.3** | Universal toast system. In-app confirm dialogs. Memoized stats. |
| **v23** | Dynamic layers. Error boundary. SW rewrite. |
| **v22** | Full audit: QuotaExceeded, scoreW fix, watch specs on all 24 pieces. |
| **v21** | Selfie Check: AI vision identifies items + watch, scores impact. |
| **v20** | Wear Stats Dashboard, strap-specific logging, dial color heatmap. |

## Friends Fork

[Eiasash/Style-advisor](https://github.com/Eiasash/Style-advisor) — shareable version without personal collection data.

## License

Personal use.
