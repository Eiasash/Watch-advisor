/* ══════ src/photoQueue.js — Photo storage + offline upload queue ══════ */
/* Uploads/downloads photos to Supabase Storage. Queues uploads in IndexedDB
   when offline and auto-processes when connectivity returns. */

import { getClient, getUser } from './cloudSync.js';

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

/* ── Queue management ── */

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
  } catch (_) { }
}

async function processPhotoQueue() {
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
        await new Promise(function (ok) {
          var tx = db.transaction(_QUEUE_STORE, "readwrite");
          tx.objectStore(_QUEUE_STORE).delete(items[i].id);
          tx.oncomplete = function () { ok(); };
          tx.onerror = function () { ok(); };
        });
        processed++;
      } catch (_) { }
    }
    return processed;
  } catch (_) { return 0; }
}

/* Auto-process queue when coming back online */
if (typeof window !== "undefined") {
  window.addEventListener("online", function () { processPhotoQueue(); });
}

/* ── Single photo operations ── */

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

/* ── Bulk photo sync ── */

function _collectPhotoRefs(items) {
  var refs = [];
  for (var it of items) {
    if (it.photoUrl && it.photoUrl.startsWith("idb:"))
      refs.push({ key: it.photoUrl.slice(4) });
    if (it.straps) {
      for (var s of it.straps) {
        if (s.photoUrl && s.photoUrl.startsWith("idb:"))
          refs.push({ key: s.photoUrl.slice(4) });
      }
    }
  }
  return refs;
}

async function pushPhotos(items, bucket, onProgress) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";

  var refs = _collectPhotoRefs(items);
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
    } catch (_) { }
  }
  return uploaded;
}

async function pullPhotos(items, bucket, onProgress) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var user = await getUser();
  if (!user) throw new Error("Not signed in");
  bucket = bucket || "photos";

  var refs = _collectPhotoRefs(items);
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
    } catch (_) { }
  }
  if (downloaded > 0) window.dispatchEvent(new Event("wa-photo-ready"));
  return downloaded;
}

/* ── Hi-res upload with offline fallback ── */
/* Uploads original-quality file. Falls back to queue if offline or not signed in. */

async function uploadPhotoOriginal(photoKey, fileOrBlob, bucket) {
  if (!navigator.onLine) {
    await queuePhotoUpload(photoKey, fileOrBlob, bucket);
    return null;
  }
  var user;
  try {
    user = await getUser();
    if (!user) { await queuePhotoUpload(photoKey, fileOrBlob, bucket); return null; }
  } catch (_) {
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

export {
  uploadPhoto, downloadPhoto, listPhotos,
  pushPhotos, pullPhotos,
  uploadPhotoOriginal, queuePhotoUpload,
  processPhotoQueue
};
