/* ══════ supabase.js — Cloud sync facade ══════ */
/* Thin re-export layer: delegates to src/cloudSync.js, src/auth.js, src/photoQueue.js.
   All app.js imports resolve through this single entry point. */

import {
  SB_DEFAULT_URL, SB_DEFAULT_KEY,
  loadConfig, saveConfig, clearConfig,
  initClient, getClient,
  getSession, getUser,
  getSyncState, onSyncChange,
  pushSnapshot, pullSnapshot, mergePayloads,
  schedulePush, cancelPush,
  restoreAppState, scheduleCloudSave
} from './src/cloudSync.js';

import { signUp, signIn, signOut } from './src/auth.js';

import {
  uploadPhoto, downloadPhoto, listPhotos,
  pushPhotos, pullPhotos,
  uploadPhotoOriginal, queuePhotoUpload,
  processPhotoQueue
} from './src/photoQueue.js';

/* Legacy aliases */
var pushAllData = pushSnapshot;
var pullAllData = pullSnapshot;

export {
  SB_DEFAULT_URL, SB_DEFAULT_KEY,
  loadConfig, saveConfig, clearConfig,
  initClient, getClient,
  signUp, signIn, signOut, getSession, getUser,
  pushSnapshot, pullSnapshot, mergePayloads,
  schedulePush, cancelPush,
  getSyncState, onSyncChange,
  uploadPhoto, downloadPhoto, listPhotos,
  pushPhotos, pullPhotos,
  uploadPhotoOriginal, queuePhotoUpload,
  pushAllData, pullAllData,
  restoreAppState, scheduleCloudSave,
  processPhotoQueue
};
