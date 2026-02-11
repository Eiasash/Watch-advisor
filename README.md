# ⌚ Watch Advisor v17

AI-powered watch & outfit coordinator for the strategic watch collector.

**Live:** https://eiasash.github.io/Watch-advisor/

## What It Does

Manages a 23-piece watch collection (genuine + replica), pairs watches with wardrobe items, and generates 7-day outfit rotations scored by color harmony, context, weather, formality, and rotation freshness — all client-side, no backend.

## Current Features

### Rotation Engine
- 7-day watch rotation with weather-aware outfit generation
- Watch-first workflow: picks watch, then builds outfit around it
- Formality tier scoring (clinic → smart casual → casual → weekend)
- Genuine/replica context bonuses (genuine for clinic/formal, replica for casual)
- Rotation freshness rewards (penalizes repeat wears, rewards variety)
- Weekly dial color variety tracking
- Tap-to-swap alternatives (click any alt outfit to promote it)
- Watch lock per day (pin a specific watch to any day slot)
- Wear logging with date tracking

### Outfit Intelligence
- Hard strap-shoe color enforcement (brown↔brown, black↔black/white)
- Weather-responsive strap picks (leather avoided in rain, NATO for heat)
- Temperature-based seasonal adjustments
- AI outfit critique via OpenAI API (optional, user-provided key)
- 5-slot layered outfit builder (base, mid, outer, bottoms, shoes)
- Color distribution and gap analysis

### Collection Management
- Watch collection with dial colors, straps, materials, contexts
- Structured strap system with per-watch assignments
- Markdown collection import (parses structured .md files)
- Wardrobe management with photo upload and AI color classification
- Duplicate detection with side-by-side comparison
- Export/import full collection data

### AI Features (Optional — requires OpenAI API key)
- AI Style Coach — wardrobe strengths, gaps, next-buy advice
- AI Occasion Planner — event-specific outfit recommendations
- AI Wardrobe Audit — A-F grading with seasonal scores
- AI outfit critique with impact scoring
- AI material/fabric detection from photos

### UI
- Day/night theme toggle (fully CSS-variable-driven)
- PWA — installable, works offline
- Image lightbox with multi-item photo labels
- Persistent floating save button
- Responsive mobile-first design

## Stack

Single-file React 18 PWA. No build step, no npm, no bundler.

| File | Purpose |
|------|---------|
| `static/index.html` | Entire app — HTML, CSS, JS (~308KB) |
| `static/sw.js` | Service worker (cache v17) |
| `static/manifest.json` | PWA manifest |
| `static/icon-192.png` | App icon 192px |
| `static/icon-512.png` | App icon 512px |
| `.github/workflows/deploy.yml` | GitHub Pages deploy on push to main |
| `.github/copilot-instructions.md` | AI coding assistant context |

## Install as PWA

1. Open in Chrome on Android
2. Tap ⋮ → **Add to Home Screen**
3. Full-screen app, works offline

## Changelog

| Version | Changes |
|---------|---------|
| **v17** | Tap-to-swap alternatives — click alt outfit to promote to main pick |
| **v16** | Complete theme fix — 60+ hardcoded dark colors → CSS variables, light mode works |
| **v15a** | 6 algorithm upgrades: formality tiers, rotation freshness, weather straps, genuine/replica context, strap-shoe enforcement, dial color variety |
| **v15** | Collection audit: removed traded watches, added Speedmaster 3861, fixed OP color |
| **PR #21** | Parser fuzzy matching and strap-to-watch assignment fixes |
| **PR #20** | Markdown watch collection import with parser |
| **PR #19** | Structured strap system with legacy fallback |
| **v14.5** | Persistent save, image lightbox, multi-item labels, enhanced AI prompts |
| **v14.4** | Duplicate detection, AI Style Coach, AI Occasion Planner, AI Wardrobe Audit |
| **v14.3** | Layered outfit builder, color gap analysis, watch pairing guide, theme toggle |
| **v14** | Alpine Eagle 8HF added, same-color scoring fix, weather error handling |

## Friends Fork

[Eiasash/Style-advisor](https://github.com/Eiasash/Style-advisor) — shareable version without personal collection data.

## License

Personal use.
