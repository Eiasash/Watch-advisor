# Supabase Cloud Sync Setup

Watch Advisor supports optional cloud sync via your own Supabase project. This lets you log in on any device, pull your data, and keep photos stored in original quality.

## 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (free tier is fine)
3. Note your **Project URL** and **anon public key** from Settings > API

## 2. Create the `user_data` Table

Go to the **SQL Editor** in your Supabase dashboard and run:

```sql
create table public.user_data (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  data_key text not null,
  data_value jsonb,
  updated_at timestamptz default now(),
  unique(user_id, data_key)
);

-- Index for fast lookups
create index idx_user_data_user_key on public.user_data(user_id, data_key);
```

## 3. Enable Row Level Security (RLS)

Run this in the SQL Editor:

```sql
alter table public.user_data enable row level security;

-- Users can only read their own data
create policy "Users read own data"
  on public.user_data for select
  using (auth.uid() = user_id);

-- Users can only insert their own data
create policy "Users insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

-- Users can only update their own data
create policy "Users update own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can only delete their own data
create policy "Users delete own data"
  on public.user_data for delete
  using (auth.uid() = user_id);
```

## 4. Create the Photos Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. Click **New Bucket**
3. Name it `photos`
4. Set it to **Public** (so the app can display images via public URLs)

Then run this SQL to set storage policies:

```sql
-- Allow authenticated users to upload to their own folder
create policy "Users upload own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow authenticated users to update/overwrite their own photos
create policy "Users update own photos"
  on storage.objects for update
  using (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow anyone to read photos (public bucket)
create policy "Public photo read"
  on storage.objects for select
  using (bucket_id = 'photos');

-- Allow authenticated users to delete their own photos
create policy "Users delete own photos"
  on storage.objects for delete
  using (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

## 5. Configure Auth

1. Go to **Authentication > Providers** in your Supabase dashboard
2. Make sure **Email** provider is enabled
3. (Optional) Under **Authentication > Settings**, disable "Confirm email" if you want instant sign-up without email verification

## 6. Configure Watch Advisor

1. Open Watch Advisor and go to **Settings** (gear icon)
2. Scroll to **Cloud Sync (Supabase)**
3. Paste your **Supabase URL** and **anon key**
4. Click **Save Config**
5. Set your **Recovery Credentials** (username + password) above the Cloud Sync section
6. Click **Login** (existing account) or **Sign Up** (new account)
7. Use **Push to Cloud** to upload your current data
8. On a new device: configure Supabase, Login, then **Pull from Cloud**

## How It Works

- **Push**: Sends all your watches, wardrobe, outfits, wear logs, contexts, rotation locks, selfie history, theme, and strap logs to your Supabase database. Also uploads all local photos to cloud storage.
- **Pull**: Downloads everything from the cloud and replaces your local data. Also downloads photos into local IndexedDB.
- **Photos**: When you're signed in, new photos are automatically uploaded in original quality (no compression) to your Supabase Storage bucket in the background.
- **Auth**: Your Recovery Credentials (username + password) are used as email + password for Supabase Auth. If your username doesn't contain `@`, it gets `@watchadvisor.local` appended.

## Data Keys Stored

| Key | Contents |
|-----|----------|
| `watches` | Watch collection |
| `wardrobe` | Garment items |
| `outfits` | Saved outfits |
| `wearLog` | Watch wear history |
| `weekCtx` | Weekly context schedule |
| `userCx` | Custom context categories |
| `rotLock` | Rotation lock slots |
| `selfieHistory` | Selfie check history |
| `strapLog` | Strap wear logs |
| `theme` | Dark/light theme preference |

## Security Notes

- Each user can only access their own data (enforced by RLS)
- Photos are stored under `{user_id}/` paths with per-user write policies
- The anon key is safe to use client-side (it only grants access through RLS policies)
- Your Supabase password is never stored locally (same as Recovery Credentials)
