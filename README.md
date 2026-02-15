# Watch Advisor v26.0

Personal watch & outfit coordination PWA with cross-device cloud sync.
ES module React 18 app — no build step, no npm, no bundler.

**Live:** [eiasash.github.io/Watch-advisor](https://eiasash.github.io/Watch-advisor/)

---

## Architecture (v26.0)

| File | Purpose |
|------|---------|
| `index.html` | CSS + HTML shell, responsive styles, safe-area support |
| `app.js` | React UI components + application logic |
| `data.js` | Constants, color maps, presets, defaults |
| `engine.js` | Outfit scoring, rotation, compatibility |
| `utils.js` | Garment naming, watch parsing, helpers |
| `ai.js` | AI classification, vision, occasion planning |
| `photos.js` | IDB photo storage, hashing, compression, original blob cache |
| `supabase.js` | Cloud sync: auth, snapshot DB, storage, offline queue, merge |
| `crypto.js` | API key encryption/decryption |
| `sw.js` | Service worker (network-first for code, caches supabase.js) |

Native ES modules — browser handles imports, no transpilation.

---

## Supabase Setup (Cloud Sync)

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Note your **Project URL** and **anon public key** (Settings > API)

### 2. Create the Snapshot Table

Open **SQL Editor** and run:

```sql
-- Snapshot table: stores all user data as a single JSONB payload
CREATE TABLE IF NOT EXISTS user_snapshots (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  version    int NOT NULL DEFAULT 1
);

-- Enable Row Level Security
ALTER TABLE user_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own data
CREATE POLICY "Users read own snapshot"
  ON user_snapshots FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own snapshot"
  ON user_snapshots FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own snapshot"
  ON user_snapshots FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 3. Create Storage Bucket

1. Go to **Storage** > **New Bucket**
2. Name: `photos`
3. Privacy: **Private**

Then run in SQL Editor:

```sql
-- Users can upload to their own folder: {user_id}/filename
CREATE POLICY "Users upload own photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read own photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users update own photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 4. Configure Auth

In Supabase dashboard > **Authentication** > **Settings**:

1. **Disable email confirmations** (Auth > Providers > Email > Toggle off "Confirm email")
   - The app uses deterministic emails like `username@watchadvisor.local`
   - Users sign up instantly without email verification
2. Set minimum password length to **6** characters

### 5. Configure the App

In the app, open **Settings** (gear icon) > **Cloud Sync (Supabase)**:

1. Enter **Supabase URL** (e.g., `https://abcdefgh.supabase.co`)
2. Enter **Supabase anon key** (the long `eyJ...` string)
3. Storage bucket: `photos` (default)
4. Click **Save Config**

Then use the auth button in the header bar or the sync status bar to sign in / sign up.

---

## How Sync Works

### Data Model

All user data is stored as a single JSONB snapshot per user in `user_snapshots`:

```
{ watches, wardrobe, outfits, wearLog, strapLog,
  selfieHistory, weekCtx, userCx, rotLock, theme,
  _version, _weekCtxUpdated, _userCxUpdated, ... }
```

### Sync Triggers

| Trigger | Action |
|---------|--------|
| Login | Pull snapshot, merge with local, render |
| App start (session exists) | Pull + merge |
| Local data change | Debounced push (1.5s) |
| Online restored | Process offline photo queue |

### Merge Strategy

- **Arrays with IDs** (watches, wardrobe, outfits): merge by `id`, prefer newer `updatedAt`
- **Logs** (wearLog, strapLog): union by unique signature, no duplicates
- **Preferences** (theme, weekCtx): prefer whichever has newer timestamp

### Photos

- Uploaded in **original resolution** (no forced compression)
- Compressed copy in IndexedDB for fast local display
- Original blob cached in IndexedDB for offline viewing
- Offline uploads queued and auto-processed when online
- Path format: `{user_id}/{photo_key}`

---

## Authentication

- **Email**: used as-is
- **Username** (no @): converted to `username@watchadvisor.local`
- Session persists across reloads via Supabase token refresh
- Sign out preserves local data

---

## Install as PWA

1. Open in Chrome on Android
2. Tap the three dots menu > **Add to Home Screen**
3. Full-screen app, works offline

---

## Features

- 7-day watch rotation with weather-aware outfit generation
- AI selfie check and garment identification (Claude Vision)
- Cross-device cloud sync via Supabase
- High-resolution photo storage (no forced compression)
- Offline-first PWA with auto-sync
- Username/password authentication
- Text size scaling (90%–140%) with CSS variable `--uiScale`
- Safe-area support for notched phones
- 44px minimum tap targets
- Unworn rotation tracking with 14-day badges
- Dynamic outfit builder with unlimited layers
- Wear stats dashboard (30/60/90 day views)
- Strap-specific logging with condition tracking
- Dark/light theme
- Encrypted backup (.wabackup) with AES-256-GCM

---

## Test Checklist

### Cloud Sync
- [ ] Sign up on phone, add watches + wardrobe items + 2 photos
- [ ] Close app, open on desktop, sign in — same data appears
- [ ] Photos load (thumbnails ok, original available in lightbox)

### Offline
- [ ] While signed in, go offline
- [ ] Add one wardrobe item + one photo offline
- [ ] Verify it works locally
- [ ] Go online — auto-sync occurs
- [ ] Refresh on other device — new item + photo appears

### Photo Quality
- [ ] Upload a 4000x3000 photo
- [ ] Verify thumbnail displays correctly
- [ ] Lightbox shows full resolution
- [ ] Check Supabase Storage — original file size preserved

### Text Size / Responsive
- [ ] Settings > Text Size > select 140%
- [ ] Navigate all tabs — nothing overflows or clips
- [ ] Buttons remain tappable (>= 44px)
- [ ] Pinch-zoom works
- [ ] Install as PWA — same behavior

### Auth
- [ ] Sign up with username + password
- [ ] Close and reopen — session restores
- [ ] Sign out — local data preserved
- [ ] Sign in again — data merges correctly

---

## Changelog

| Version | Changes |
|---------|---------|
| **v26.0** | Cloud sync (snapshot-based Supabase), auth modal, auto-sync with debounce, offline photo queue, hi-res uploads, sync status bar, text size presets, safe-area padding, 44px tap targets |
| **v25.9** | Pinch-zoom enabled, UI scale slider, responsive grid |
| **v25.5** | Photo display fix, font size increases, larger thumbnails |
| **v25.4** | VirtualGrid hybrid windowing for wardrobe |
| **v25.2** | Unworn rotation, 14d+ badges, SW escape hatch |
| **v25.1** | ES module split, undo toasts, haptic feedback |

## Friends Fork

[Eiasash/Style-advisor](https://github.com/Eiasash/Style-advisor) — shareable version without personal collection data.

## License

Personal use.
