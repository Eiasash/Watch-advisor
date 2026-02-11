# Watch Advisor

Personal watch & outfit coordination PWA. Single-file React 18 app.
No build step, no npm, no bundler.

| File | Purpose |
|------|---------|
| `index.html` | Entire app — HTML, CSS, JS (~329KB) |
| `static/sw.js` | Service worker (cache v21) |
| `static/manifest.json` | PWA manifest |
| `static/icon-192.png` | App icon 192px |
| `static/icon-512.png` | App icon 512px |

## Install as PWA

1. Open in Chrome on Android
2. Tap ⋮ → **Add to Home Screen**
3. Full-screen app, works offline

## Changelog

| Version | Changes |
|---------|---------|
| **v21** | Merge fix: restored PiecePicker, full AI Coach, lightbox from v19 + correct straps[] data from v20 |
| **v20** | Explicit straps[] arrays for all 24 watches (40 straps), removed traded pieces |
| **v19** | Syntax fixes, export/import rotation locks, filter count badges |
| **v18b** | Smart piece-picker filters — color pills, pattern pills, auto-reset |
| **v18** | Piece picker for outfit slots — inline swap UI with scrollable alternatives |
| **v17** | Tap-to-swap alternatives — click alt outfit to promote to main pick |
| **v16** | Complete theme fix — 60+ hardcoded dark colors → CSS variables, light mode |
| **v15a** | 6 algorithm upgrades: formality tiers, rotation freshness, weather straps, genuine/replica context, strap-shoe enforcement, dial color variety |
| **v15** | Collection audit: removed traded watches, added Speedmaster 3861 |
| **v14.5** | Persistent save, image lightbox, multi-item labels, enhanced AI prompts |
| **v14.4** | Duplicate detection, AI Style Coach, AI Occasion Planner, AI Wardrobe Audit |
| **v14.3** | Layered outfit builder, color gap analysis, watch pairing guide, theme toggle |
| **v14** | Alpine Eagle 8HF added, same-color scoring fix, weather error handling |

## Friends Fork

[Eiasash/Style-advisor](https://github.com/Eiasash/Style-advisor) — shareable version without personal collection data.

## License

Personal use.
