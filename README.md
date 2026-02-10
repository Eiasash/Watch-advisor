# ⌚ Watch Advisor v14.5

AI-Powered Watch & Outfit Coordinator for the strategic watch collector.
https://eiasash.github.io/Watch-advisor/

## What's New in v14.5

- **Persistent save button** — Floating save button saves all changes (watches, wardrobe, outfits, settings) with visual confirmation toast
- **Image lightbox** — Tap any garment photo to view it enlarged fullscreen with item labels (color, name, material, pattern)
- **Multi-item photo labels** — Photos with multiple detected garments show labeled overlays identifying each piece with color dot, name, and fabric type
- **Enhanced AI prompts** — All AI features now return richer, more detailed analysis with upgrade suggestions, signature combos, power moves, and style identity
- **AI material detection** — Photo AI now identifies fabric/material (cotton, wool, linen, denim, leather, silk, cashmere)
- **AI Critique upgrade field** — Outfit critiques now suggest one specific change to elevate the look
- **AI Style Coach signatures** — Get 3 killer outfit combinations from your current wardrobe, plus seasonal gap analysis
- **AI Occasion Planner layers** — Occasion outfits now suggest layering options and power moves

## What's New in v14.4

- **Duplicate detection** — Scan wardrobe for duplicate items, view them enlarged side-by-side, and delete extras with confirmation
- **AI Style Coach** — Get personalized wardrobe advice: strengths, gaps, next buys, and a versatility score
- **AI Occasion Planner** — Describe any event and get 2 complete outfit recommendations from your actual wardrobe
- **AI Wardrobe Audit** — Comprehensive grading (A-F), seasonal scores, declutter suggestions, and investment recommendations
- **Manual watch selection** — Tap any watch in Create mode to choose it for your outfit instead of only the auto-recommended top pick

## What's New in v14.3

- **Layered outfit builder** — Create mode now supports 5 slots: Base Layer, Mid Layer, Outer Layer, Bottom, Shoes
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
- **Manual watch selection** in Create mode — pick any watch, not just the top-ranked
- **Duplicate detection** — find and remove duplicate wardrobe items with enlarged preview
- **AI Style Coach** — personalized wardrobe strengths, gaps, and next-buy advice
- **AI Occasion Planner** — event-specific outfit recommendations from your closet
- **AI Wardrobe Audit** — comprehensive A-F grading with seasonal scores
- **Persistent save button** — floating save with visual confirmation
- **Image lightbox** — tap any photo to view enlarged with item labels
- **Multi-item photo labels** — color dot, name, and material overlay for multi-garment photos
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
