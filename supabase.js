/* ══════ supabase.js — Cloud Sync via Supabase (Auth + Snapshot DB + Storage) ══════ */
/* Snapshot-based sync: single user_snapshots table with JSONB payload.
   Offline queue for photos. Auto-sync with debounce. Merge with timestamps.
   Vite env var support: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY */

var _sb = null;
var _sbConfig = null;
var _syncState = { status: "idle", lastSync: null, error: null, online: navigator.onLine };
var _syncListeners = [];
var _pushTimer = null;
var _lastCloudPull = 0;
var _isSyncing = false; /* guard against infinite sync loops */
var _reconnectTimer = null;

/* ── Sync state management ── */
function getSyncState() { return Object.assign({}, _syncState); }
function _notifySync(patch) {
  Object.assign(_syncState, patch);
  _syncListeners.forEach(function (fn) { try { fn(_syncState); } catch (e) { /* ignore */ } });
}
function onSyncChange(fn) { _syncListeners.push(fn); return function () { _syncListeners = _syncListeners.filter(function (f) { return f !== fn; }); }; }

/* Track online/offline + auto-sync on reconnect */
if (typeof window !== "undefined") {
  window.addEventListener("online", function () {
    _notifySync({ online: true });
    _processPhotoQueue();
    /* Auto-sync on reconnect: debounce 2s to avoid rapid fire */
    if (_reconnectTimer) clearTimeout(_reconnectTimer);
    _reconnectTimer = setTimeout(function () {
      _reconnectTimer = null;
      syncNow().catch(function (e) { console.warn("[CloudSync] reconnect sync:", e); });
    }, 2000);
  });
  window.addEventListener("offline", function () { _notifySync({ online: false, status: "offline" }); });
}

/* ── Vite env var support ── */
/* Try Vite env vars first (import.meta.env), fall back to localStorage config */
function _getEnvConfig() {
  try {
    var url = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL;
    var key = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (url && key) return { url: url, anonKey: key };
  } catch (e) { /* not in Vite context */ }
  return null;
}

/* ── Config persistence ── */
var SB_CONFIG_KEY = "wa_supabase_config";

function loadConfig() {
  /* Vite env vars take priority */
  var envCfg = _getEnvConfig();
  if (envCfg) return envCfg;
  try { var raw = localStorage.getItem(SB_CONFIG_KEY); if (raw) return JSON.parse(raw); } catch (e) { /* ignore */ }
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
  if (cfg && cfg.url && cfg.anonKey) return initClient(cfg.url, cfg.anonKey);
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
  cancelPush();
  await sb.auth.signOut();
  _notifySync({ status: "signed-out", lastSync: null, error: null });
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

/* ── Auth state change listener ── */
/* Registers a callback for auth state changes (sign in/out/token refresh).
   Returns unsubscribe function. */
function onAuthStateChange(callback) {
  var sb = getClient();
  if (!sb) return function () {};
  var { data } = sb.auth.onAuthStateChange(function (event, session) {
    callback(event, session);
  });
  return data && data.subscription ? function () { data.subscription.unsubscribe(); } : function () {};
}

/* ── Snapshot-based Data Sync ── */
/* Table: user_snapshots
   - user_id uuid PK references auth.users(id)
   - payload jsonb not null
   - updated_at timestamptz not null default now()
   - version bigint not null default 1
*/

async function pushSnapshot(payload) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  if (_isSyncing) return; /* prevent re-entrant sync */
  _isSyncing = true;
  _notifySync({ status: "pushing" });
  try {
    var { error } = await sb.from("user_snapshots").upsert({
      user_id: user.id,
      payload: payload,
      updated_at: new Date().toISOString(),
      version: payload._version || 1
    }, { onConflict: "user_id" });
    if (error) throw error;
    _notifySync({ status: "idle", lastSync: Date.now(), error: null });
  } catch (e) {
    _notifySync({ status: "error", error: e.message });
    throw e;
  } finally {
    _isSyncing = false;
  }
}

async function pullSnapshot() {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  if (_isSyncing) return null; /* prevent re-entrant sync */
  _isSyncing = true;
  _notifySync({ status: "pulling" });
  try {
    var { data, error } = await sb.from("user_snapshots")
      .select("payload,updated_at,version")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    _lastCloudPull = Date.now();
    _notifySync({ status: "idle", lastSync: Date.now(), error: null });
    return data ? data.payload : null;
  } catch (e) {
    _notifySync({ status: "error", error: e.message });
    throw e;
  } finally {
    _isSyncing = false;
  }
}

/* ── syncNow() — manual trigger for immediate push ── */
/* Flushes any pending debounced payload immediately.
   If no pending, pushes the last known payload if provided. */
async function syncNow(payloadFn) {
  /* Clear any pending debounced push */
  if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
  var payload = _pendingPayload;
  _pendingPayload = null;
  if (!payload && payloadFn) payload = payloadFn;
  if (!payload) return;
  payload = typeof payload === "function" ? payload() : payload;
  if (!payload) return;
  try {
    var user = await getUser();
    if (!user || !navigator.onLine) {
      _notifySync({ status: navigator.onLine ? "idle" : "offline" });
      return;
    }
    await pushSnapshot(payload);
  } catch (e) {
    console.warn("[CloudSync] syncNow failed:", e);
  }
}

/* ── Merge Logic ── */
/* Merges cloud payload into local state using timestamps.
   For arrays with id fields: merge by id, prefer newer updatedAt.
   For logs: union by unique signature.
   For preferences: prefer newer updatedAt.
   Returns the merged payload. */

function _mergeArrayById(local, cloud) {
  if (!local || !local.length) return cloud || [];
  if (!cloud || !cloud.length) return local || [];
  var map = {};
  local.forEach(function (item) { if (item.id) map[item.id] = item; });
  cloud.forEach(function (item) {
    if (!item.id) return;
    var existing = map[item.id];
    if (!existing) { map[item.id] = item; return; }
    /* Prefer newer by updatedAt, then ts, then keep local */
    var localTime = existing.updatedAt || existing.ts || 0;
    var cloudTime = item.updatedAt || item.ts || 0;
    if (typeof localTime === "string") localTime = new Date(localTime).getTime();
    if (typeof cloudTime === "string") cloudTime = new Date(cloudTime).getTime();
    if (cloudTime > localTime) map[item.id] = item;
  });
  return Object.values(map);
}

function _mergeLogsBySignature(local, cloud, sigFn) {
  if (!cloud || !cloud.length) return local || [];
  if (!local || !local.length) return cloud || [];
  var seen = {};
  var result = [];
  var all = local.concat(cloud);
  all.forEach(function (entry) {
    var sig = sigFn ? sigFn(entry) : JSON.stringify(entry);
    if (!seen[sig]) { seen[sig] = true; result.push(entry); }
  });
  return result;
}

function mergePayloads(local, cloud) {
  if (!cloud) return local;
  if (!local) return cloud;
  var merged = {};

  /* Watches: merge by id */
  merged.watches = _mergeArrayById(local.watches, cloud.watches);

  /* Wardrobe: merge by id */
  merged.wardrobe = _mergeArrayById(local.wardrobe, cloud.wardrobe);

  /* Outfits: merge by id */
  merged.outfits = _mergeArrayById(local.outfits, cloud.outfits);

  /* Wear log: union by date+watchId signature */
  merged.wearLog = _mergeLogsBySignature(
    local.wearLog, cloud.wearLog,
    function (e) { return e.date + "|" + e.watchId; }
  );

  /* Strap log: union by ts+watchId+strap signature */
  merged.strapLog = _mergeLogsBySignature(
    local.strapLog, cloud.strapLog,
    function (e) { return (e.ts || 0) + "|" + e.watchId + "|" + (e.strapIdOrSig || ""); }
  );

  /* Selfie history: merge by id */
  merged.selfieHistory = _mergeArrayById(local.selfieHistory, cloud.selfieHistory);

  /* Week context: prefer whichever has the more recent _updatedAt */
  var localWcTime = local._weekCtxUpdated || 0;
  var cloudWcTime = cloud._weekCtxUpdated || 0;
  merged.weekCtx = cloudWcTime > localWcTime ? (cloud.weekCtx || local.weekCtx) : (local.weekCtx || cloud.weekCtx);
  merged._weekCtxUpdated = Math.max(localWcTime, cloudWcTime);

  /* User contexts: prefer newer */
  var localUcTime = local._userCxUpdated || 0;
  var cloudUcTime = cloud._userCxUpdated || 0;
  merged.userCx = cloudUcTime > localUcTime ? (cloud.userCx || local.userCx) : (local.userCx || cloud.userCx);
  merged._userCxUpdated = Math.max(localUcTime, cloudUcTime);

  /* Rot lock: prefer newer */
  var localRlTime = local._rotLockUpdated || 0;
  var cloudRlTime = cloud._rotLockUpdated || 0;
  merged.rotLock = cloudRlTime > localRlTime ? (cloud.rotLock || local.rotLock) : (local.rotLock || cloud.rotLock);
  merged._rotLockUpdated = Math.max(localRlTime, cloudRlTime);

  /* Theme: prefer newer */
  var localThTime = local._themeUpdated || 0;
  var cloudThTime = cloud._themeUpdated || 0;
  merged.theme = cloudThTime > localThTime ? (cloud.theme || local.theme) : (local.theme || cloud.theme);
  merged._themeUpdated = Math.max(localThTime, cloudThTime);

  /* Version bump */
  merged._version = Math.max(local._version || 1, cloud._version || 1) + 1;
  merged._mergedAt = Date.now();

  return merged;
}

/* ── Debounced Auto-Push ── */
/* Call schedulePush() after any local state change. It debounces 1.5s then pushes. */
var _pendingPayload = null;

function schedulePush(payloadFn) {
  _pendingPayload = payloadFn;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(function () {
    _pushTimer = null;
    if (!_pendingPayload) return;
    var payload = typeof _pendingPayload === "function" ? _pendingPayload() : _pendingPayload;
    _pendingPayload = null;
    if (!payload) return;
    /* Only push if we have a session */
    getUser().then(function (user) {
      if (!user) return;
      if (!navigator.onLine) { _notifySync({ status: "offline" }); return; }
      pushSnapshot(payload).catch(function (e) {
        console.warn("[CloudSync] auto-push failed:", e);
      });
    }).catch(function () { /* no user, skip */ });
  }, 1500);
}

function cancelPush() {
  if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
  _pendingPayload = null;
}

/* ── Photo Storage ── */

async function uploadPhoto(photoKey, blob, bucket) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";
  var path = user.id + "/" + photoKey;
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
  return data;
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

/* ── Offline Photo Queue ── */
/* Stores photo upload jobs in IndexedDB when offline.
   Processes queue when online + signed in. */

var _QUEUE_DB = "wa-photo-queue";
var _QUEUE_STORE = "queue";
var _photoQueueDb = null;

function _openQueueDb() {
  if (_photoQueueDb) return Promise.resolve(_photoQueueDb);
  return new Promise(function (ok, no) {
    var req = indexedDB.open(_QUEUE_DB, 1);
    req.onupgradeneeded = function () { req.result.createObjectStore(_QUEUE_STORE, { keyPath: "id" }); };
    req.onsuccess = function () { _photoQueueDb = req.result; ok(_photoQueueDb); };
    req.onerror = function () { no(req.error); };
  });
}

async function queuePhotoUpload(photoKey, blob, bucket) {
  try {
    var db = await _openQueueDb();
    await new Promise(function (ok, no) {
      var tx = db.transaction(_QUEUE_STORE, "readwrite");
      tx.objectStore(_QUEUE_STORE).put({
        id: photoKey,
        blob: blob,
        bucket: bucket || "photos",
        ts: Date.now()
      });
      tx.oncomplete = function () { ok(); };
      tx.onerror = function () { no(tx.error); };
    });
  } catch (e) {
    console.warn("[CloudSync] queue photo failed:", e);
  }
}

async function _processPhotoQueue() {
  try {
    var user = await getUser();
    if (!user || !navigator.onLine) return 0;
    var db = await _openQueueDb();
    var items = await new Promise(function (ok) {
      var tx = db.transaction(_QUEUE_STORE, "readonly");
      var req = tx.objectStore(_QUEUE_STORE).getAll();
      req.onsuccess = function () { ok(req.result || []); };
      req.onerror = function () { ok([]); };
    });
    if (!items.length) return 0;
    var processed = 0;
    for (var i = 0; i < items.length; i++) {
      try {
        await uploadPhoto(items[i].id, items[i].blob, items[i].bucket);
        /* Remove from queue */
        await new Promise(function (ok) {
          var tx = db.transaction(_QUEUE_STORE, "readwrite");
          tx.objectStore(_QUEUE_STORE).delete(items[i].id);
          tx.oncomplete = function () { ok(); };
          tx.onerror = function () { ok(); };
        });
        processed++;
      } catch (e) {
        console.warn("[CloudSync] queue upload failed:", items[i].id, e);
      }
    }
    return processed;
  } catch (e) {
    console.warn("[CloudSync] process queue error:", e);
    return 0;
  }
}

/* ── Bulk photo sync helpers ── */

async function pushPhotos(items, bucket, onProgress) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";

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

async function pullPhotos(items, bucket, onProgress) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";

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

/* ── High-res photo upload (original quality, no compression) ── */
async function uploadPhotoOriginal(photoKey, fileOrBlob, bucket) {
  if (!navigator.onLine) {
    await queuePhotoUpload(photoKey, fileOrBlob, bucket);
    return null;
  }
  try {
    var user = await getUser();
    if (!user) {
      await queuePhotoUpload(photoKey, fileOrBlob, bucket);
      return null;
    }
  } catch (e) {
    await queuePhotoUpload(photoKey, fileOrBlob, bucket);
    return null;
  }
  var sb = getClient();
  if (!sb) { await queuePhotoUpload(photoKey, fileOrBlob, bucket); return null; }
  bucket = bucket || "photos";
  var path = user.id + "/" + photoKey;
  var { error } = await sb.storage.from(bucket).upload(path, fileOrBlob, {
    contentType: fileOrBlob.type || "image/jpeg",
    upsert: true
  });
  if (error) throw error;
  var { data: urlData } = sb.storage.from(bucket).getPublicUrl(path);
  return urlData.publicUrl;
}

/* ── Legacy compat: pushAllData/pullAllData mapped to snapshot ── */
async function pushAllData(payload) { return pushSnapshot(payload); }
async function pullAllData() { return pullSnapshot(); }

export {
  loadConfig, saveConfig, clearConfig,
  initClient, getClient,
  signUp, signIn, signOut, getSession, getUser,
  onAuthStateChange,
  pushSnapshot, pullSnapshot, mergePayloads,
  schedulePush, cancelPush, syncNow,
  getSyncState, onSyncChange,
  uploadPhoto, downloadPhoto, listPhotos,
  pushPhotos, pullPhotos,
  uploadPhotoOriginal, queuePhotoUpload,
  pushAllData, pullAllData
};
