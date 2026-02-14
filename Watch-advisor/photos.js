/* ══════ photos.js — IDB Photo Store + Perceptual Hashing + Color Sampling ══════ */

var _idb=null,_pc={};
function idbOpen(){if(_idb)return Promise.resolve(_idb);return new Promise(function(ok,no){var r=indexedDB.open("wa-photos",1);r.onupgradeneeded=function(){r.result.createObjectStore("imgs")};r.onsuccess=function(){_idb=r.result;ok(_idb)};r.onerror=function(){no(r.error)}})}
function idbPut(k,v){return idbOpen().then(function(db){return new Promise(function(ok,no){var t=db.transaction("imgs","readwrite");t.objectStore("imgs").put(v,k);t.oncomplete=function(){ok()};t.onerror=function(){no(t.error)}})})}
function idbGet(k){return idbOpen().then(function(db){return new Promise(function(ok){var t=db.transaction("imgs","readonly");var r=t.objectStore("imgs").get(k);r.onsuccess=function(){ok(r.result||null)};r.onerror=function(){ok(null)}})})}
function d2b(d){var p=d.split(","),m=p[0].match(/:(.*?);/)[1],r=atob(p[1]),a=new Uint8Array(r.length);for(var i=0;i<r.length;i++)a[i]=r.charCodeAt(i);return new Blob([a],{type:m})}
async function savePhoto(k,dataUrl){try{revokePhoto("idb:"+k);await idbPut(k,d2b(dataUrl));var b=await idbGet(k);if(b){_pc["idb:"+k]=URL.createObjectURL(b)}return "idb:"+k}catch(e){console.warn("[IDB]",e);return dataUrl}}
var _PLACEHOLDER="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
function ph(s){if(!s)return _PLACEHOLDER;if(s.startsWith("idb:")){var v=_pc[s];if(v)return v;/* Lazy resolve: trigger async fetch so next render picks it up */if(!_pc["_q"+s]){_pc["_q"+s]=1;idbOpen().then(function(db){var t=db.transaction("imgs","readonly");var r=t.objectStore("imgs").get(s.slice(4));r.onsuccess=function(){if(r.result){_pc[s]=URL.createObjectURL(r.result);/* Trigger React re-render via global event */window.dispatchEvent(new Event("wa-photo-ready"))}delete _pc["_q"+s]};r.onerror=function(){delete _pc["_q"+s]}}).catch(function(){delete _pc["_q"+s]})}return _PLACEHOLDER}return s}
function revokePhoto(ref){if(ref&&ref.startsWith("idb:")&&_pc[ref]){try{URL.revokeObjectURL(_pc[ref])}catch(e){}delete _pc[ref]}}
function revokeAllPhotos(){for(var k in _pc){try{URL.revokeObjectURL(_pc[k])}catch(e){}}; _pc={}}
async function preloadPhotos(items){var refs=[];for(var it of items){if(it.photoUrl&&it.photoUrl.startsWith("idb:"))refs.push(it.photoUrl);if(it.straps)for(var s of it.straps)if(s.photoUrl&&s.photoUrl.startsWith("idb:"))refs.push(s.photoUrl)}if(!refs.length)return;var loaded=0;try{var db=await idbOpen();var tx=db.transaction("imgs","readonly");var st=tx.objectStore("imgs");await Promise.all(refs.map(function(ref){if(_pc[ref])return;return new Promise(function(ok){var r=st.get(ref.slice(4));r.onsuccess=function(){if(r.result){_pc[ref]=URL.createObjectURL(r.result);loaded++}ok()};r.onerror=ok})}))}catch(e){console.warn("[IDB] preload:",e)}if(loaded>0){window.dispatchEvent(new Event("wa-photo-ready"))}}
async function migrateToIDB(items,pfx){var ch=false;for(var it of items){if(it.photoUrl&&it.photoUrl.startsWith("data:")){it.photoUrl=await savePhoto(pfx+"_"+it.id,it.photoUrl);ch=true}if(it.straps)for(var j=0;j<it.straps.length;j++){if(it.straps[j].photoUrl&&it.straps[j].photoUrl.startsWith("data:")){it.straps[j].photoUrl=await savePhoto(pfx+"_"+it.id+"_s"+j,it.straps[j].photoUrl);ch=true}}}return ch}
async function photoAsDataUrl(ref){if(!ref||!ref.startsWith("idb:"))return ref;try{var b=await idbGet(ref.slice(4));if(!b)return null;return new Promise(function(ok){var r=new FileReader();r.onload=function(){ok(r.result)};r.readAsDataURL(b)})}catch(e){return null}}

/* ══════ IMAGE COMPRESSION ══════ */
/* ══════ PERCEPTUAL HASH (dHash 8×8) ══════ */
function computeDHash(dataUrl){
  return new Promise(function(ok){
    var img=new Image();
    img.onload=function(){
      var c=document.createElement("canvas");c.width=9;c.height=8;
      var ctx=c.getContext("2d");ctx.drawImage(img,0,0,9,8);
      var d=ctx.getImageData(0,0,9,8).data;var hash="";
      for(var y=0;y<8;y++){for(var x=0;x<8;x++){
        var i=(y*9+x)*4,j=(y*9+x+1)*4;
        var gL=d[i]*0.299+d[i+1]*0.587+d[i+2]*0.114;
        var gR=d[j]*0.299+d[j+1]*0.587+d[j+2]*0.114;
        hash+=gL>gR?"1":"0";
      }}
      ok(hash);
    };
    img.onerror=function(){ok(null)};
    img.src=dataUrl;
  });
}
function hammingDist(a,b){if(!a||!b||a.length!==b.length)return 64;var d=0;for(var i=0;i<a.length;i++)if(a[i]!==b[i])d++;return d}

/* ══════ DOMINANT COLOR SAMPLING ══════ */
function sampleDominantColor(dataUrl,palette){
  return new Promise(function(ok){
    var img=new Image();
    img.onload=function(){
      var c=document.createElement("canvas");var sz=32;c.width=sz;c.height=sz;
      var ctx=c.getContext("2d");ctx.drawImage(img,0,0,sz,sz);
      /* Center crop: sample middle 60% to avoid background */
      var margin=Math.floor(sz*0.2);
      var d=ctx.getImageData(margin,margin,sz-margin*2,sz-margin*2).data;
      /* Collect pixels, filter top 10% brightest (glare) */
      var px=[];
      for(var i=0;i<d.length;i+=4){px.push([d[i],d[i+1],d[i+2]])}
      if(!px.length){ok(null);return}
      px.sort(function(a,b){return(b[0]+b[1]+b[2])-(a[0]+a[1]+a[2])});
      var cut=Math.max(1,Math.floor(px.length*0.9));px=px.slice(px.length-cut);
      var rSum=0,gSum=0,bSum=0,n=px.length;
      for(var i=0;i<n;i++){rSum+=px[i][0];gSum+=px[i][1];bSum+=px[i][2]}
      var avgR=rSum/n,avgG=gSum/n,avgB=bSum/n;
      /* Find nearest palette color by RGB distance */
      var best=null,bestDist=Infinity;
      for(var name in palette){
        var hex=palette[name].h;if(!hex)continue;
        var r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
        /* RGB distance with saturation boost for non-neutrals */
        var dist=Math.sqrt(Math.pow(avgR-r,2)+Math.pow(avgG-g,2)+Math.pow(avgB-b,2));
        var maxC=Math.max(avgR,avgG,avgB),minC=Math.min(avgR,avgG,avgB);
        var sat=(maxC>0)?(maxC-minC)/maxC:0;
        if(sat>0.15){/* Chromatic: penalize hue mismatch more */
          var maxP=Math.max(r,g,b),minP=Math.min(r,g,b),satP=(maxP>0)?(maxP-minP)/maxP:0;
          if(satP<0.1)dist*=1.5;/* Don't match saturated sample to neutral palette */
        }
        if(dist<bestDist){bestDist=dist;best=name}
      }
      ok({color:best,confidence:bestDist<50?0.9:bestDist<80?0.7:bestDist<120?0.5:0.3,rgb:[Math.round(avgR),Math.round(avgG),Math.round(avgB)]});
    };
    img.onerror=function(){ok(null)};
    img.src=dataUrl;
  });
}

function compressImage(dataUrl,maxDim,quality){
  maxDim=maxDim||800;quality=quality||0.7;
  return new Promise(function(resolve){
    var img=new Image();
    img.onload=function(){
      var w=img.width,h=img.height;
      if(w>maxDim||h>maxDim){if(w>h){h=Math.round(h*(maxDim/w));w=maxDim}else{w=Math.round(w*(maxDim/h));h=maxDim}}
      var c=document.createElement("canvas");c.width=w;c.height=h;
      c.getContext("2d").drawImage(img,0,0,w,h);
      resolve(c.toDataURL("image/jpeg",quality));
    };
    img.onerror=function(){resolve(dataUrl)};
    img.src=dataUrl;
  });
}


export {
  idbOpen, idbPut, idbGet, d2b, savePhoto, ph, revokePhoto, revokeAllPhotos,
  preloadPhotos, migrateToIDB, photoAsDataUrl,
  computeDHash, hammingDist, sampleDominantColor, compressImage
};
