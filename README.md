# Watch Advisor

Personal watch & outfit coordination PWA. Single-file React 18 app.
No build step, no npm, no bundler.

**Live:** [eiasash.github.io/Watch-advisor](https://eiasash.github.io/Watch-advisor/)

| File | Purpose |
|------|---------|
| `index.html` | Entire app — HTML, CSS, JS (~368KB) |
| `sw.js` | Service worker |
| `manifest.json` | PWA manifest |
| `icon-192.png` | App icon 192px |
| `icon-512.png` | App icon 512px |

## Install as PWA

1. Open in Chrome on Android
2. Tap ⋮ → **Add to Home Screen**
3. Full-screen app, works offline

## Current Version: v24.10

### Features
- 7-day watch rotation with weather-aware outfit generation
- Watch-first workflow: app picks watch, then builds outfit around it
- **📸 Selfie Check** — snap a selfie or rear camera shot, AI vision identifies every garment + watch, scores impact 1-10, suggests upgrades, saves to history
- AI outfit critique via Anthropic Claude Sonnet (vision)
- AI Style Coach — full wardrobe analysis with gap detection
- AI Occasion Planner — event-specific outfit recommendations
- Wear Stats Dashboard — 30/60/90 day views, per-watch bars, genuine/replica split, neglected watch alerts
- Strap-Specific Logging — per-strap wear tracking with condition estimates
- Wear History Search — filterable chronological log (365-day retention)
- Dial Color Heatmap — 7-day strip with consecutive-color warnings
- Seasonal Presets — save/load/delete watch lineups
- **🧱 Dynamic Outfit Builder** — unlimited renameable layer slots (add/remove/rename layers freely), no 3-slot limit
- Weekly rotation planner with lock/swap
- Wardrobe management with photo upload and AI color classification
- Genuine/replica context scoring (genuine bonus for clinic, replica safe for casual)
- Formality tier system (clinic → smart casual → casual → weekend)
- Hard strap-shoe color enforcement (brown strap → brown shoes, black → black/white)
- Weather-responsive strap picks (leather avoided in rain, NATO for heat)
- Watch specs display: reference number, case size (mm), movement on all watch cards
- Multi-vibe context selection: tap multiple vibes (e.g. Smart Casual + Date)
- React Error Boundary — graceful crash recovery instead of white screen
- Network-first service worker — always serves latest version
- Day/night theme toggle
- PWA with offline support

## Changelog

| Version | Changes |
|---------|---------|
| **v24.10** | 🔐 Password no longer stored in localStorage (session-only). 📷 Multi-image batch scan (up to 10, gallery multi-select). 🔍 Watch search bar (filter by name/dial/ref/movement). ⌚ Quick wear button on watch cards + days-since counter. 📤 Share outfit via native share sheet. 🔧 CI/CD: syntax check + gitleaks workflows. 25 empty catches → console.warn. |
| **v24.4** | 📱 Mobile scroll fix (touch-action: pan-y). 📷 Strap photo camera/gallery on existing + new straps. |
| **v24.3** | 🍞 Universal toast system (replaces all alert/confirm). In-app confirm dialogs. Memoized stats. |
| **v23** | 🧱 **Dynamic layers**: unlimited renameable upper-body slots in Build mode (replaces fixed BASE/MID/OUTER). 🛡️ Error boundary: crash → reload button instead of white screen. 🔧 Service worker rewrite: network-first for HTML (fixes stale cache). 📱 Manifest icon fix: split any/maskable purpose. 🏔️→🔺 Alpine Eagle replica emoji deconflict. 🚫 Brown Loafers→Lace-ups in presets. 📊 Wear log retention 90d→365d for seasonal analysis. |
| **v22** | Full audit: QuotaExceeded handling, scoreW freshness fix, WCard badge fix, export/import selfieHistory+rotLock+theme. Watch specs (ref/size/mvmt) on all 24 pieces, enhanced AI watch detection with ref numbers, strap_call+better_watch in selfie results |
| **v21** | 📸 Selfie Check: front camera, rear camera, gallery upload → AI vision identifies items + watch, scores impact 1-10, critique with upgrade/strap/better-watch suggestions, save history with photos |
| **v20** | Wear Stats Dashboard (30/60/90d), strap-specific logging, wear history search, dial color heatmap, seasonal presets, insight sub-tabs |
| **v19.2** | Explicit straps[] arrays for all 24 watches (40 straps) |
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
