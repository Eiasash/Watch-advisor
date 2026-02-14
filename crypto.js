/* ══════ crypto.js — API Key Encryption ══════ */

/* Encrypts the API key at rest using a random device secret.
   Not military-grade, but prevents plaintext key in localStorage/storage. */
function _getDeviceSecret(){
  try{var s=localStorage.getItem("wa_dsec");if(s&&s.length>=32)return s;
  var arr=new Uint8Array(32);crypto.getRandomValues(arr);
  s=Array.from(arr,function(b){return b.toString(16).padStart(2,"0")}).join("");
  localStorage.setItem("wa_dsec",s);return s}catch(e){return"wa_fallback_key_00000000000000000"}
}
function encryptApiKey(key){
  if(!key)return"";
  try{var secret=_getDeviceSecret();var out=[];
  for(var i=0;i<key.length;i++){out.push(key.charCodeAt(i)^secret.charCodeAt(i%secret.length))}
  return"ENC:"+btoa(String.fromCharCode.apply(null,out))}catch(e){return key}
}
function decryptApiKey(stored){
  if(!stored)return"";
  if(!stored.startsWith("ENC:"))return stored; /* legacy plaintext — will be re-encrypted on next save */
  try{var secret=_getDeviceSecret();var raw=atob(stored.slice(4));var out=[];
  for(var i=0;i<raw.length;i++){out.push(String.fromCharCode(raw.charCodeAt(i)^secret.charCodeAt(i%secret.length)))}
  return out.join("")}catch(e){return""}
}


export { encryptApiKey, decryptApiKey };
