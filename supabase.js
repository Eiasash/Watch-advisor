/* ══════ supabase.js — Cloud Sync via Supabase (Auth + DB + Storage) ══════ */

/* Uses the Supabase JS client loaded via CDN (window.supabase) */

var _sb = null;
var _sbConfig = null;

/* ── Config persistence ── */
var SB_CONFIG_KEY = "wa_supabase_config";

function loadConfig() {
  try {
    var raw = localStorage.getItem(SB_CONFIG_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function saveConfig(cfg) {
  try { localStorage.setItem(SB_CONFIG_KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ }
}

function clearConfig() {
  try { localStorage.removeItem(SB_CONFIG_KEY); } catch (e) { /* ignore */ }
}

/* ── Client initialization ── */
function initClient(url, anonKey) {
  if (!url || !anonKey) return null;
  if (!window.supabase || !window.supabase.createClient) {
    console.warn("[CloudSync] Supabase JS not loaded");
    return null;
  }
  _sb = window.supabase.createClient(url, anonKey);
  _sbConfig = { url: url, anonKey: anonKey };
  return _sb;
}

function getClient() {
  if (_sb) return _sb;
  var cfg = loadConfig();
  if (cfg && cfg.url && cfg.anonKey) {
    return initClient(cfg.url, cfg.anonKey);
  }
  return null;
}

/* ── Auth ── */
async function signUp(email, password) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var { data, error } = await sb.auth.signUp({ email: email, password: password });
  if (error) throw error;
  return data;
}

async function signIn(email, password) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var { data, error } = await sb.auth.signInWithPassword({ email: email, password: password });
  if (error) throw error;
  return data;
}

async function signOut() {
  var sb = getClient();
  if (!sb) return;
  await sb.auth.signOut();
}

async function getSession() {
  var sb = getClient();
  if (!sb) return null;
  var { data } = await sb.auth.getSession();
  return data.session;
}

async function getUser() {
  var session = await getSession();
  return session ? session.user : null;
}

/* ── Data Sync (user_data table) ── */
/* Table schema: id (uuid, PK, default gen_random_uuid()), user_id (uuid, FK auth.users),
   data_key (text), data_value (jsonb), updated_at (timestamptz, default now())
   Unique constraint on (user_id, data_key) */

async function pushData(dataKey, dataValue) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  var { error } = await sb.from("user_data").upsert({
    user_id: user.id,
    data_key: dataKey,
    data_value: dataValue,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id,data_key" });
  if (error) throw error;
}

async function pullData(dataKey) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  var { data, error } = await sb.from("user_data")
    .select("data_value")
    .eq("user_id", user.id)
    .eq("data_key", dataKey)
    .maybeSingle();
  if (error) throw error;
  return data ? data.data_value : null;
}

async function pushAllData(payload) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  var now = new Date().toISOString();
  var rows = Object.keys(payload).map(function (key) {
    return {
      user_id: user.id,
      data_key: key,
      data_value: payload[key],
      updated_at: now
    };
  });
  var { error } = await sb.from("user_data").upsert(rows, { onConflict: "user_id,data_key" });
  if (error) throw error;
}

async function pullAllData() {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  var { data, error } = await sb.from("user_data")
    .select("data_key,data_value")
    .eq("user_id", user.id);
  if (error) throw error;
  var result = {};
  if (data) data.forEach(function (row) { result[row.data_key] = row.data_value; });
  return result;
}

/* ── Photo Storage ── */
/* Uploads a photo blob to Supabase Storage.
   Path: {user_id}/{photoKey}.jpg
   Returns public URL */

async function uploadPhoto(photoKey, blob, bucket) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";
  var path = user.id + "/" + photoKey;
  /* Upsert: overwrite if exists */
  var { error } = await sb.storage.from(bucket).upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: true
  });
  if (error) throw error;
  var { data: urlData } = sb.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

async function downloadPhoto(photoKey, bucket) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";
  var path = user.id + "/" + photoKey;
  var { data, error } = await sb.storage.from(bucket).download(path);
  if (error) {
    if (error.message && error.message.includes("not found")) return null;
    throw error;
  }
  return data; /* Blob */
}

async function listPhotos(bucket) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";
  var { data, error } = await sb.storage.from(bucket).list(user.id, { limit: 1000 });
  if (error) throw error;
  return (data || []).map(function (f) { return f.name; });
}

/* ── Bulk photo sync helpers ── */

/* Upload all IDB photos to cloud storage */
async function pushPhotos(items, bucket, onProgress) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";

  /* Collect all idb: refs from watches + wardrobe */
  var refs = [];
  for (var it of items) {
    if (it.photoUrl && it.photoUrl.startsWith("idb:"))
      refs.push({ key: it.photoUrl.slice(4), ref: it.photoUrl });
    if (it.straps) {
      for (var s of it.straps) {
        if (s.photoUrl && s.photoUrl.startsWith("idb:"))
          refs.push({ key: s.photoUrl.slice(4), ref: s.photoUrl });
      }
    }
  }
  if (!refs.length) return 0;

  var uploaded = 0;
  for (var i = 0; i < refs.length; i++) {
    try {
      /* Get blob from IDB */
      var idb = await new Promise(function (ok, no) {
        var req = indexedDB.open("wa-photos", 1);
        req.onsuccess = function () { ok(req.result); };
        req.onerror = function () { no(req.error); };
      });
      var blob = await new Promise(function (ok) {
        var tx = idb.transaction("imgs", "readonly");
        var r = tx.objectStore("imgs").get(refs[i].key);
        r.onsuccess = function () { ok(r.result || null); };
        r.onerror = function () { ok(null); };
      });
      if (!blob) continue;

      var path = user.id + "/" + refs[i].key;
      await sb.storage.from(bucket).upload(path, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: true
      });
      uploaded++;
      if (onProgress) onProgress(uploaded, refs.length);
    } catch (e) {
      console.warn("[CloudSync] Photo upload failed:", refs[i].key, e);
    }
  }
  return uploaded;
}

/* Download all cloud photos into IDB */
async function pullPhotos(items, bucket, onProgress) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";

  /* Collect all idb: refs */
  var refs = [];
  for (var it of items) {
    if (it.photoUrl && it.photoUrl.startsWith("idb:"))
      refs.push({ key: it.photoUrl.slice(4), ref: it.photoUrl });
    if (it.straps) {
      for (var s of it.straps) {
        if (s.photoUrl && s.photoUrl.startsWith("idb:"))
          refs.push({ key: s.photoUrl.slice(4), ref: s.photoUrl });
      }
    }
  }
  if (!refs.length) return 0;

  var downloaded = 0;
  /* Open IDB once */
  var idb = await new Promise(function (ok, no) {
    var req = indexedDB.open("wa-photos", 1);
    req.onupgradeneeded = function () { req.result.createObjectStore("imgs"); };
    req.onsuccess = function () { ok(req.result); };
    req.onerror = function () { no(req.error); };
  });

  for (var i = 0; i < refs.length; i++) {
    try {
      var path = user.id + "/" + refs[i].key;
      var { data, error } = await sb.storage.from(bucket).download(path);
      if (error || !data) continue;

      /* Store in IDB */
      await new Promise(function (ok, no) {
        var tx = idb.transaction("imgs", "readwrite");
        tx.objectStore("imgs").put(data, refs[i].key);
        tx.oncomplete = function () { ok(); };
        tx.onerror = function () { no(tx.error); };
      });
      downloaded++;
      if (onProgress) onProgress(downloaded, refs.length);
    } catch (e) {
      console.warn("[CloudSync] Photo download failed:", refs[i].key, e);
    }
  }
  if (downloaded > 0) window.dispatchEvent(new Event("wa-photo-ready"));
  return downloaded;
}

/* ── High-res photo upload (no compression) ── */
/* Takes a File or Blob directly, uploads at original quality */
async function uploadPhotoHighRes(photoKey, fileOrBlob, bucket) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";
  var path = user.id + "/" + photoKey + "_hires";
  var { error } = await sb.storage.from(bucket).upload(path, fileOrBlob, {
    contentType: fileOrBlob.type || "image/jpeg",
    upsert: true
  });
  if (error) throw error;
  var { data: urlData } = sb.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}


export {
  loadConfig, saveConfig, clearConfig,
  initClient, getClient,
  signUp, signIn, signOut, getSession, getUser,
  pushData, pullData, pushAllData, pullAllData,
  uploadPhoto, downloadPhoto, listPhotos,
  pushPhotos, pullPhotos,
  uploadPhotoHighRes
};
