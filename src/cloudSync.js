/* ══════ src/cloudSync.js — Cloud sync engine ══════ */
/* Config persistence, Supabase client, sync state, snapshot push/pull,
   timestamp-based merge, debounced auto-push with offline detection. */

var _sb = null;
var _syncState = { status: "idle", lastSync: null, error: null, online: navigator.onLine };
var _syncListeners = [];
var _pushTimer = null;
var _pendingPayload = null;

var SB_CONFIG_KEY = "wa_supabase_config";

/* ── Sync state management ── */

function getSyncState() { return Object.assign({}, _syncState); }

function notifySync(patch) {
  Object.assign(_syncState, patch);
  _syncListeners.forEach(function (fn) { try { fn(_syncState); } catch (_) { } });
}

function onSyncChange(fn) {
  _syncListeners.push(fn);
  return function () { _syncListeners = _syncListeners.filter(function (f) { return f !== fn; }); };
}

/* Track online/offline */
if (typeof window !== "undefined") {
  window.addEventListener("online", function () { notifySync({ online: true }); });
  window.addEventListener("offline", function () { notifySync({ online: false }); });
}

/* ── Config persistence ── */

function loadConfig() {
  try { var raw = localStorage.getItem(SB_CONFIG_KEY); return raw ? JSON.parse(raw) : null; }
  catch (_) { return null; }
}

function saveConfig(cfg) {
  try { localStorage.setItem(SB_CONFIG_KEY, JSON.stringify(cfg)); } catch (_) { }
}

function clearConfig() {
  try { localStorage.removeItem(SB_CONFIG_KEY); } catch (_) { }
}

/* ── Client initialization ── */

function initClient(url, anonKey) {
  if (!url || !anonKey) return null;
  if (!window.supabase || !window.supabase.createClient) return null;
  _sb = window.supabase.createClient(url, anonKey);
  return _sb;
}

function getClient() {
  if (_sb) return _sb;
  var cfg = loadConfig();
  if (cfg && cfg.url && cfg.anonKey) return initClient(cfg.url, cfg.anonKey);
  return null;
}

/* ── Session / User queries ── */

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

/* ── Snapshot-based Data Sync ── */
/* Table: user_snapshots (user_id uuid PK, payload jsonb, updated_at timestamptz, version int) */

async function pushSnapshot(payload) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  notifySync({ status: "pushing" });
  try {
    var { error } = await sb.from("user_snapshots").upsert({
      user_id: user.id,
      payload: payload,
      updated_at: new Date().toISOString(),
      version: payload._version || 1
    }, { onConflict: "user_id" });
    if (error) throw error;
    notifySync({ status: "idle", lastSync: Date.now(), error: null });
  } catch (e) {
    notifySync({ status: "error", error: e.message });
    throw e;
  }
}

async function pullSnapshot() {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  notifySync({ status: "pulling" });
  try {
    var { data, error } = await sb.from("user_snapshots")
      .select("payload,updated_at,version")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    notifySync({ status: "idle", lastSync: Date.now(), error: null });
    return data ? data.payload : null;
  } catch (e) {
    notifySync({ status: "error", error: e.message });
    throw e;
  }
}

/* ── Merge Logic ── */
/* Arrays with id: merge by id, prefer newer updatedAt.
   Logs: union by unique signature (no duplicates).
   Preferences: prefer whichever has newer timestamp. */

function _mergeArrayById(local, cloud) {
  if (!local || !local.length) return cloud || [];
  if (!cloud || !cloud.length) return local || [];
  var map = {};
  local.forEach(function (item) { if (item.id) map[item.id] = item; });
  cloud.forEach(function (item) {
    if (!item.id) return;
    var existing = map[item.id];
    if (!existing) { map[item.id] = item; return; }
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
  local.concat(cloud).forEach(function (entry) {
    var sig = sigFn ? sigFn(entry) : JSON.stringify(entry);
    if (!seen[sig]) { seen[sig] = true; result.push(entry); }
  });
  return result;
}

function mergePayloads(local, cloud) {
  if (!cloud) return local;
  if (!local) return cloud;
  var merged = {};

  merged.watches = _mergeArrayById(local.watches, cloud.watches);
  merged.wardrobe = _mergeArrayById(local.wardrobe, cloud.wardrobe);
  merged.outfits = _mergeArrayById(local.outfits, cloud.outfits);

  merged.wearLog = _mergeLogsBySignature(
    local.wearLog, cloud.wearLog,
    function (e) { return e.date + "|" + e.watchId; }
  );
  merged.strapLog = _mergeLogsBySignature(
    local.strapLog, cloud.strapLog,
    function (e) { return (e.ts || 0) + "|" + e.watchId + "|" + (e.strapIdOrSig || ""); }
  );

  merged.selfieHistory = _mergeArrayById(local.selfieHistory, cloud.selfieHistory);

  var localWcTime = local._weekCtxUpdated || 0;
  var cloudWcTime = cloud._weekCtxUpdated || 0;
  merged.weekCtx = cloudWcTime > localWcTime ? (cloud.weekCtx || local.weekCtx) : (local.weekCtx || cloud.weekCtx);
  merged._weekCtxUpdated = Math.max(localWcTime, cloudWcTime);

  var localUcTime = local._userCxUpdated || 0;
  var cloudUcTime = cloud._userCxUpdated || 0;
  merged.userCx = cloudUcTime > localUcTime ? (cloud.userCx || local.userCx) : (local.userCx || cloud.userCx);
  merged._userCxUpdated = Math.max(localUcTime, cloudUcTime);

  var localRlTime = local._rotLockUpdated || 0;
  var cloudRlTime = cloud._rotLockUpdated || 0;
  merged.rotLock = cloudRlTime > localRlTime ? (cloud.rotLock || local.rotLock) : (local.rotLock || cloud.rotLock);
  merged._rotLockUpdated = Math.max(localRlTime, cloudRlTime);

  var localThTime = local._themeUpdated || 0;
  var cloudThTime = cloud._themeUpdated || 0;
  merged.theme = cloudThTime > localThTime ? (cloud.theme || local.theme) : (local.theme || cloud.theme);
  merged._themeUpdated = Math.max(localThTime, cloudThTime);

  merged._version = Math.max(local._version || 1, cloud._version || 1) + 1;
  merged._mergedAt = Date.now();
  return merged;
}

/* ── Debounced Auto-Push (1.5s) ── */
/* Call schedulePush(payloadFn) after any local state change.
   Debounces 1.5s, checks for user session, skips if offline. */

function schedulePush(payloadFn) {
  _pendingPayload = payloadFn;
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(function () {
    _pushTimer = null;
    if (!_pendingPayload) return;
    var payload = typeof _pendingPayload === "function" ? _pendingPayload() : _pendingPayload;
    _pendingPayload = null;
    if (!payload) return;
    getUser().then(function (user) {
      if (!user) return;
      if (!navigator.onLine) { notifySync({ status: "offline-queued" }); return; }
      pushSnapshot(payload).catch(function () { });
    }).catch(function () { });
  }, 1500);
}

function cancelPush() {
  if (_pushTimer) { clearTimeout(_pushTimer); _pushTimer = null; }
  _pendingPayload = null;
}

/* ── High-level helpers ── */

/* restoreAppState: pull cloud snapshot and merge with local payload.
   Returns the merged result, or local if no cloud data exists. */
async function restoreAppState(localPayload) {
  var cloud = await pullSnapshot();
  if (!cloud) return localPayload || null;
  if (!localPayload) return cloud;
  return mergePayloads(localPayload, cloud);
}

/* scheduleCloudSave: convenience alias for schedulePush */
function scheduleCloudSave(payloadFn) {
  return schedulePush(payloadFn);
}

export {
  loadConfig, saveConfig, clearConfig,
  initClient, getClient,
  getSession, getUser,
  getSyncState, onSyncChange, notifySync,
  pushSnapshot, pullSnapshot, mergePayloads,
  schedulePush, cancelPush,
  restoreAppState, scheduleCloudSave
};
