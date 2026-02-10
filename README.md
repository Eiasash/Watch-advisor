# ⌚ Watch Advisor v14.3

AI-Powered Watch & Outfit Coordinator for the strategic watch collector.
https://eiasash.github.io/Watch-advisor/

## What's New in v14.3

- **Layered outfit builder** — Create mode now supports 5 slots: Base Layer, Mid Layer, Outer Layer, Bottom, Shoes — build realistic layered outfits (tee + sweater + jacket)
- **Color Gap Analysis** — Insights tab shows which wardrobe colors your watches need but you don't own
- **Watch Pairing Guide** — Per-watch best-match garments from your actual wardrobe
- **AI outfit critique** — Claude-powered analysis with impact scoring on any outfit
- **Day/night theme toggle** — Switch between dark and light modes
- **Seasonal readiness** — See at a glance if your wardrobe covers all seasons
- **Garment rotation tracking** — Freshness indicators and wear-day history

## What's New in v14

- **Alpine Eagle 8HF** — Chopard's GPHG Sports Watch Prize winner added as incoming genuine piece
- **Same-color scoring fix** — Monochrome outfits now score 0.6 (was 0.3)
- **Weather error handling** — Yellow banner with retry when geolocation fails
- **Anti-repeat rotation** — Consecutive same-watch penalty hardened
- **Watch size context** — Formal/clinic bonus ≤39mm, date penalty ≥44mm
- **Temperature-based seasons** — Uses actual weather data when available
- **Storage cleanup** — Purges orphan keys from v8-v13 after migration

## Features

- 25-piece collection management (genuine + replica tracking)
- AI-powered outfit coordination with psychological impact scoring
- **5-slot layered outfit builder** (base, mid, outer, bottoms, shoes)
- 7-day rotation planner with wear history
- Weather-aware recommendations (temperature, rain, UV, wind)
- Context-based scoring (clinic, formal, casual, Riviera, date night, and more)
- Wardrobe management with photo classification
- Strap-shoe color enforcement (brown↔brown, black↔black)
- Color distribution and gap analysis
- Seasonal readiness dashboard
- Export/import full collection data
- Dark/light theme with gold accent
- PWA — installable, works offline

## Stack

Single-file React app — no build step, no dependencies beyond CDN-loaded React.

## Install as PWA

1. Open in Chrome on Android
2. Tap ⋮ → **Add to Home Screen**
3. Full-screen app, works offline

## License

Personal use.
