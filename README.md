# ⌚ Watch Advisor v14

AI-Powered Watch & Outfit Coordinator for the strategic watch collector.

## What's New in v14

- **Alpine Eagle 8HF** — Chopard's GPHG Sports Watch Prize winner added as incoming genuine piece (replaces GMT-II pending trade)
- **Same-color scoring fix** — Monochrome outfits now score 0.6 (was 0.3). Intentional all-black no longer penalized
- **Weather error handling** — Yellow banner with retry when geolocation fails, graceful degradation to mid-weight defaults
- **Anti-repeat rotation** — Consecutive same-watch penalty hardened to -15, 2-day gap to -10
- **Watch size context** — Formal/clinic bonus ≤39mm, date penalty ≥44mm, Riviera sweet spot 40-42mm
- **Temperature-based seasons** — Uses actual weather data when available instead of crude month boundaries
- **Storage cleanup** — Purges orphan keys from v8-v13 after migration
- **Collection status badges** — 📦 incoming and 🔄 pending-trade counts in stats panel

## Features

- 25-piece collection management (genuine + replica tracking)
- AI-powered outfit coordination with psychological impact scoring
- 7-day rotation planner with wear history
- Weather-aware recommendations (temperature, rain, UV)
- Context-based scoring (clinic, formal, casual, Riviera, date night)
- Wardrobe management with photo classification
- Strap-shoe color enforcement (brown↔brown, black↔black)
- Export/import full collection data
- Dark/light theme with gold accent

## Stack

Single-file React app — no build step, no dependencies beyond CDN-loaded React + Babel.

## Install as PWA

1. Open in Chrome on Android
2. Tap ⋮ → **Add to Home Screen**
3. Full-screen app, works offline

## License

Personal use.
