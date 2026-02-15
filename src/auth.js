/* ══════ src/auth.js — Authentication: sign up, sign in, sign out ══════ */
/* Accepts username or email. Usernames without @ are converted to
   username@watchadvisor.local for Supabase email-based auth. */

import { getClient, notifySync } from './cloudSync.js';

var MAIL_DOMAIN = "watchadvisor.local";

function _toEmail(usernameOrEmail) {
  if (!usernameOrEmail) return "";
  var trimmed = usernameOrEmail.trim();
  return trimmed.includes("@") ? trimmed : trimmed + "@" + MAIL_DOMAIN;
}

async function signUp(username, password) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var email = _toEmail(username);
  var { data, error } = await sb.auth.signUp({ email: email, password: password });
  if (error) throw error;
  return data;
}

async function signIn(username, password) {
  var sb = getClient();
  if (!sb) throw new Error("Supabase not configured");
  var email = _toEmail(username);
  var { data, error } = await sb.auth.signInWithPassword({ email: email, password: password });
  if (error) throw error;
  return data;
}

async function signOut() {
  var sb = getClient();
  if (!sb) return;
  await sb.auth.signOut();
  notifySync({ status: "signed-out", lastSync: null, error: null });
}

export { signUp, signIn, signOut };
