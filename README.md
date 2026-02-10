# ⌚ Watch Advisor v14

**AI-Powered Watch & Outfit Coordinator for Strategic Watch Collectors**

## 🚀 **[Launch App → https://eiasash.github.io/Watch-advisor/](https://eiasash.github.io/Watch-advisor/)**

---

## What's New in v14

17 features ported from Style Compass v4.1 — the biggest update yet.

| # | Feature | What it does |
|---|---------|-------------|
| 🌙 | **Dark Mode** | Full theme toggle with CSS variable system. Press `D` to switch. |
| 📡 | **Offline Banner** | Live connectivity status indicator |
| ⌨️ | **Keyboard Shortcuts** | `1-8` vibes, `R` refresh, `D` dark mode, `Esc` close, `Ctrl+S` save |
| ⭐ | **Favorites** | Quick-fav outfits with dedicated tab, sorted by recency |
| 🎯 | **OOTD Generator** | Daily outfit suggestion seeded by date |
| 🎲 | **Surprise Me** | Random outfit picker (also via pull-to-refresh) |
| 📸 | **Batch Upload** | Multi-photo drag-drop with AI garment classification |
| 🔍 | **Duplicate Detection** | Flags similar wardrobe items by type/color/name |
| 💡 | **Daily Style Tips** | 21 rotating tips matched to day-of-year |
| 🎨 | **Color Palette Analyzer** | Extracts outfit colors + harmony type (Complementary, Analogous, Triadic, Monochrome, Eclectic) |
| 🧬 | **Style DNA Radar** | Canvas radar chart profiling 5 dimensions: Boldness, Versatility, Formality, Creativity, Consistency |
| 🖼️ | **Composite Image** | Canvas-generated visual outfit preview, downloadable as PNG |
| 🤖 | **AI Insights** | Claude API pattern analysis on outfit history — gaps, deployment strategy, color balance |
| 👆 | **Pull to Refresh** | Touch gesture on home tab (80px swipe threshold) |
| 📍 | **Location Vibes** | Context chips (🏥 Clinic, 🍽️ Restaurant, 🏖️ Beach, etc.) that filter outfit contexts |
| 👤 | **Profile System** | Name, bio, avatar with first-initial display |
| 💾 | **IndexedDB Backup** | Automatic backup/restore if localStorage corrupts |

**File size:** 2,402 lines (up from 2,011)

---

## Quick Start

### 1. Add Your Watches ⌚
- Click the **Watches** tab
- Add each watch: dial color, matching colors, contexts (formal, casual, date night)
- Set status: active, incoming, in service, sold
- Track genuine vs. replica pieces

### 2. Build Your Wardrobe 👔
- Go to **Closet** tab
- **Take photos** — AI identifies colors, patterns, and materials automatically
- Or use **Batch Upload** — drop multiple photos at once
- Check for **duplicates** with the 🔍 button

### 3. Get Outfit Suggestions ✨
- Navigate to **Fits** tab
- Pick a watch + occasion
- Get scored outfit combinations with color harmony analysis
- ⭐ Favorite the ones you love

### 4. Track Your Style 🧬
- **Insights** tab shows your Style DNA radar
- Hit **Analyze My Style** for AI-powered pattern insights
- Daily tips rotate automatically

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1` - `8` | Quick-select context vibes |
| `R` | Refresh / regenerate |
| `D` | Toggle dark mode |
| `Esc` | Close modal |
| `Ctrl+S` | Save current state |

---

## Watch-Outfit Pairing Logic

### Color Matching (40+ colors)

| Dial | Best Pairings | Avoid |
|------|--------------|-------|
| **Black/Charcoal** | Almost everything — grey, navy, white, black | Rarely any issues |
| **White/Cream** | Navy, charcoal, grey, light blue, burgundy | Brown, tan (muddy look) |
| **Blue** | Navy, grey, white, charcoal | Warm browns, orange, rust |
| **Green** | Olive, khaki, cream, tan, brown, navy | Bright/neon colors |
| **Gold/Bronze** | Brown, cream, burgundy, navy, white | Cool greys, light blue |
| **Steel/Silver** | Grey, black, navy, white, blue, charcoal | Rarely any issues |

### Bracelet vs. Strap

- **Steel bracelets** → Hot weather, rain, casual/sport, summer
- **Leather straps** → Cooler weather, formal, dressy, date nights
- **Leather rule:** Strap color must match shoe color (black-to-black, brown-to-brown)

---

## Installation

### No Install Required
Just visit **[eiasash.github.io/Watch-advisor/](https://eiasash.github.io/Watch-advisor/)**

### Install as Mobile App (PWA)
- **Android**: Chrome → Menu (⋮) → "Add to Home Screen"
- **iPhone**: Safari → Share → "Add to Home Screen"
- **Desktop**: Click install icon in address bar

### Enable AI Features
1. Get a Claude API key at [console.anthropic.com](https://console.anthropic.com)
2. Add it in ⚙️ Settings
3. Unlocks: AI outfit descriptions, batch photo classification, AI style insights

---

## Privacy

- **100% local storage** — nothing leaves your device
- No server, no account, no tracking
- Export/import your data as JSON anytime
- IndexedDB auto-backup protects against data loss
- Works offline (except AI features)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| **Framework** | React 18 (no build, createElement) |
| **AI** | Claude API (Anthropic) |
| **Weather** | Open-Meteo API |
| **Storage** | localStorage + IndexedDB backup |
| **Hosting** | GitHub Pages (PWA) |
| **Charts** | Canvas 2D (radar, composite) |

**Works on:** Chrome, Safari, Firefox, Edge — iPhone, Android, Desktop — Offline mode after first load

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **v14** | Feb 2026 | 17 features from Style Compass: dark mode, favorites, OOTD, batch upload, duplicates, daily tips, color palette, Style DNA, composite images, AI insights, pull-to-refresh, location vibes, profile, IndexedDB backup, keyboard shortcuts, offline banner, surprise me |
| **v13** | Feb 2026 | Interactive swap, share version data isolation, wear log, week planner |
| **v12** | Jan 2026 | Weather integration, rotation analytics, context scoring |

---

**Start coordinating your watches with your wardrobe today! ⌚✨**

**[→ Open Watch Advisor](https://eiasash.github.io/Watch-advisor/)**
