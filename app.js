/* ══════ app.js — React UI Components + Application ══════ */
import {
  IS_SHARED, SK, getSeason,
  CM, AC, CG, PATTERNS, MATERIALS,
  DEFAULT_CX, SHARE_DEFAULT_CX, ALL_CX, CXI,
  CATS, ALL_T, LAYER_BASE, LAYER_MID, LAYER_OUTER, layerOf, catOf,
  EMOJIS, STRAP_TYPES, STRAP_COLORS, STRAP_HEX, strapHex,
  STRAP_CTX, STS, WT_TIERS, getWT, WMO, getWMO,
  WATCH_PRESETS, GARMENT_PRESETS,
  autoMatchColors, _OWNER_DEFAULTS, migrateStraps, DEFAULTS,
  _OWNER_WARDROBE, WD_DEFAULTS, CP, COLOR_FAMILIES, CXR
} from './data.js';

import {
  buildGarmentName, isAutoName, smartDefaults,
  parseWatchLog, slugify, fuzzyMatch,
  inferDial, inferContexts, inferSize, inferRef, parseStrapDesc
} from './utils.js';

import {
  getColorFamily, clearCompatCache, compat,
  scoreW, strapRec, getWarns, makeOutfit, genFits, getSwaps,
  genWeekRotation
} from './engine.js';

import {
  getLastAiError, aiID, aiVision, aiOccasion,
  aiWardrobeAudit, aiWatchID, aiSelfieCheck
} from './ai.js';

import {
  savePhoto, ph, revokePhoto, revokeAllPhotos,
  preloadPhotos, migrateToIDB, photoAsDataUrl,
  computeDHash, hammingDist, sampleDominantColor, compressImage,
  saveOriginalBlob, getOriginalBlob
} from './photos.js';

import { encryptApiKey, decryptApiKey } from './crypto.js';

import {
  loadConfig as sbLoadConfig, saveConfig as sbSaveConfig, clearConfig as sbClearConfig,
  initClient as sbInitClient, getClient as sbGetClient,
  signUp as sbSignUp, signIn as sbSignIn, signOut as sbSignOut,
  getSession as sbGetSession, getUser as sbGetUser,
  pushSnapshot as sbPushSnapshot, pullSnapshot as sbPullSnapshot,
  mergePayloads as sbMerge,
  schedulePush as sbSchedulePush, cancelPush as sbCancelPush,
  getSyncState as sbGetSyncState, onSyncChange as sbOnSyncChange,
  pushPhotos as sbPushPhotos, pullPhotos as sbPullPhotos,
  uploadPhotoOriginal as sbUploadOriginal, queuePhotoUpload as sbQueuePhoto,
  pushAllData as sbPushAll, pullAllData as sbPullAll
} from './supabase.js';

const{useState,useRef,useMemo,useEffect,useCallback,memo}=React;

/* ══════ WEATHER KEY HELPER ══════ */
/* Returns "rain"|"hot"|"cold"|"normal" from weather object (uses WMO rain flag + temp tiers) */
function getWeatherKey(wx){
  if(!wx)return"normal";
  if(wx.cond&&wx.cond.rain)return"rain";
  var t=wx.feels!==undefined?wx.feels:(wx.temp!==undefined?wx.temp:18);
  if(t>=30)return"hot";
  if(t<=12)return"cold";
  return"normal";
}
/* Stable strap signature for logging */
function strapSig(watchId,strap){
  if(strap.id)return strap.id;
  return watchId+"|"+strap.type+"|"+(strap.color||"")+"|"+(strap.material||"")+"|"+(strap.notes||"");
}

/* ══════ STRAP SWATCH COMPONENT ══════ */
function StrapSwatch(props){
  var st=props.strap;if(!st)return null;
  var hex=st.type==="bracelet"?strapHex(st.color||"silver"):strapHex(st.color);
  var stDef=STRAP_TYPES.find(function(t){return t.id===st.type})||STRAP_TYPES[0];
  var isBracelet=st.type==="bracelet";
  var label=isBracelet?"Bracelet"+(st.material?" ("+st.material+")":""):(st.color||"")+" "+st.type+(st.material&&!isBracelet?" ("+st.material+")":"");
  var sz=props.size||10;
  return React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:4}},
    /* Color swatch — gradient ring for bracelet, solid dot for leather/rubber/etc */
    isBracelet?React.createElement("span",{style:{width:sz,height:sz,borderRadius:"50%",background:"linear-gradient(135deg,#c0c0c0,#888,#c0c0c0)",border:"1px solid rgba(255,255,255,0.2)",flexShrink:0}})
    :React.createElement("span",{style:{width:sz,height:sz,borderRadius:"50%",background:hex,border:"1px solid rgba(255,255,255,0.15)",flexShrink:0}}),
    React.createElement("span",null,stDef.icon+" "+label));
}

/* ══════ COMPONENTS (OUTSIDE App) ══════ */
const Dot=memo(function DotC(props){
  var color=props.color,size=props.size||10;
  return React.createElement("span",{style:{width:size,height:size,borderRadius:"50%",flexShrink:0,display:"inline-block",background:(CM[color?color.toLowerCase():""]||{}).h||"#5a5a5a",border:color&&color.toLowerCase()==="black"?"1px solid #444":"none"}});
});

const Pill=memo(function PillC(props){
  return React.createElement("button",{onClick:props.onClick,style:{background:props.on?"var(--gold)":"var(--card)",border:"1px solid "+(props.on?"var(--gold)":"var(--border)"),borderRadius:20,padding:"8px 14px",cursor:"pointer",color:props.on?"var(--bg)":"#6a6474",fontFamily:"var(--f)",fontSize:11,fontWeight:props.on?600:400,whiteSpace:"nowrap",minHeight:36}},props.children);
});

const ColorGrid=memo(function ColorGridC(props){
  return React.createElement("div",null,CG.map(function(g){
    return React.createElement("div",{key:g.l,style:{marginBottom:10}},
      React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",letterSpacing:"0.1em",textTransform:"uppercase"}},g.l),
      React.createElement("div",{style:{display:"flex",gap:7,flexWrap:"wrap",marginTop:5}},
        g.c.map(function(c){return React.createElement("div",{key:c,onClick:function(){props.onChange(c)},className:"swatch "+(props.value===c?"on":""),style:{background:(CM[c]||{}).h||"#5a5a5a"},title:c})})));
  }));
});

const OutfitFigure=memo(function OutfitFigureC(props){
  var tc=(CM[props.topColor]||{}).h||"#5a5a5a";
  var bc=(CM[props.botColor]||{}).h||"#3a3a3a";
  var sc=(CM[props.shoeColor]||{}).h||"#2a2a2a";
  var wc=props.watchColor||"#c9a84c";
  var wi=props.watchIcon||"⌚";
  var skin="#c8a882";
  return React.createElement("div",{style:{width:props.size||120,margin:"0 auto",position:"relative"}},
    React.createElement("svg",{viewBox:"0 0 120 220",width:props.size||120,height:Math.round((props.size||120)*220/120),style:{filter:"drop-shadow(0 4px 12px rgba(0,0,0,0.4))"}},
      /* Head */
      React.createElement("ellipse",{cx:60,cy:22,rx:14,ry:16,fill:skin}),
      /* Neck */
      React.createElement("rect",{x:54,y:36,width:12,height:8,fill:skin,rx:2}),
      /* Torso / shirt */
      React.createElement("path",{d:"M 36 44 Q 34 44 32 48 L 18 52 L 20 62 L 36 58 L 36 110 Q 36 114 40 114 L 80 114 Q 84 114 84 110 L 84 58 L 100 62 L 102 52 L 88 48 Q 86 44 84 44 Z",fill:tc,stroke:"rgba(255,255,255,0.08)",strokeWidth:0.5}),
      /* Collar detail */
      React.createElement("path",{d:"M 50 44 L 60 56 L 70 44",fill:"none",stroke:"rgba(255,255,255,0.15)",strokeWidth:1.5}),
      /* Left arm */
      React.createElement("path",{d:"M 36 58 L 22 62 L 18 90 L 24 92 L 30 68 L 36 66",fill:tc,stroke:"rgba(255,255,255,0.05)",strokeWidth:0.5}),
      /* Right arm */
      React.createElement("path",{d:"M 84 58 L 98 62 L 102 90 L 96 92 L 90 68 L 84 66",fill:tc,stroke:"rgba(255,255,255,0.05)",strokeWidth:0.5}),
      /* Left hand */
      React.createElement("ellipse",{cx:21,cy:93,rx:5,ry:4,fill:skin}),
      /* Right hand */
      React.createElement("ellipse",{cx:99,cy:93,rx:5,ry:4,fill:skin}),
      /* Watch on left wrist */
      React.createElement("rect",{x:15,y:84,width:12,height:10,rx:2,fill:wc,stroke:"rgba(255,255,255,0.2)",strokeWidth:0.5}),
      React.createElement("circle",{cx:21,cy:89,r:3,fill:"rgba(255,255,255,0.15)"}),
      /* Belt */
      React.createElement("rect",{x:36,y:112,width:48,height:5,fill:"#1a1a1a",rx:1}),
      React.createElement("rect",{x:57,y:113,width:6,height:3,rx:1,fill:"#c9a84c"}),
      /* Left leg */
      React.createElement("path",{d:"M 38 117 L 36 185 L 32 186 L 32 190 Q 32 192 34 192 L 48 192 Q 50 192 50 190 L 50 186 L 48 185 L 50 117 Z",fill:bc,stroke:"rgba(255,255,255,0.05)",strokeWidth:0.5}),
      /* Right leg */
      React.createElement("path",{d:"M 70 117 L 72 185 L 70 186 L 70 190 Q 70 192 72 192 L 86 192 Q 88 192 88 190 L 88 186 L 84 185 L 82 117 Z",fill:bc,stroke:"rgba(255,255,255,0.05)",strokeWidth:0.5}),
      /* Left shoe */
      React.createElement("path",{d:"M 30 188 L 30 196 Q 30 200 34 200 L 50 200 Q 54 200 54 196 L 54 192 L 48 192 L 34 192 Z",fill:sc,stroke:"rgba(255,255,255,0.1)",strokeWidth:0.5}),
      /* Right shoe */
      React.createElement("path",{d:"M 68 188 L 68 196 Q 68 200 72 200 L 88 200 Q 92 200 92 196 L 92 192 L 86 192 L 72 192 Z",fill:sc,stroke:"rgba(255,255,255,0.1)",strokeWidth:0.5}),
      /* Subtle fabric texture lines on shirt */
      React.createElement("line",{x1:45,y1:60,x2:45,y2:110,stroke:"rgba(255,255,255,0.03)",strokeWidth:0.5}),
      React.createElement("line",{x1:55,y1:55,x2:55,y2:110,stroke:"rgba(255,255,255,0.03)",strokeWidth:0.5}),
      React.createElement("line",{x1:65,y1:55,x2:65,y2:110,stroke:"rgba(255,255,255,0.03)",strokeWidth:0.5}),
      React.createElement("line",{x1:75,y1:60,x2:75,y2:110,stroke:"rgba(255,255,255,0.03)",strokeWidth:0.5})),
    /* Watch label */
    React.createElement("div",{style:{position:"absolute",left:-2,top:"38%",background:"rgba(0,0,0,0.6)",borderRadius:4,padding:"2px 5px",border:"1px solid "+wc+"60",display:"flex",alignItems:"center",gap:2}},
      React.createElement("span",{style:{fontSize:10}},wi),
      React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:wc,fontWeight:600}},props.watchName||"")));
});

const WCard=memo(function WCardC(props){
  var w=props.w,rank=props.rank,detail=props.detail;
  var maxS=15;var pct=Math.max(0,Math.min(100,(w.score/maxS)*100));
  var barC=pct>60?"var(--good)":pct>30?"var(--gold)":"var(--warn)";
  return(
    React.createElement("div",{className:"card-lift",style:{background:rank===0?"var(--card2)":"var(--bg)",border:rank===0?"1px solid rgba(201,168,76,0.25)":"1px solid var(--border)",borderRadius:12,padding:"14px"}},
      React.createElement("div",{style:{display:"flex",gap:10,alignItems:"flex-start"}},
        React.createElement("div",{style:{width:42,height:42,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:w.c+"18",fontSize:20,flexShrink:0}},w.i),
        React.createElement("div",{style:{flex:1,minWidth:0}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:4}},
            React.createElement("span",{style:{fontSize:14,fontWeight:600}},w.n),
            !IS_SHARED&&w.t==="replica"&&React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"#6a5a50",border:"1px solid var(--rep-border)",borderRadius:3,padding:"1px 5px"}},"REP"),
            rank===0&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:700,background:"rgba(201,168,76,0.1)",padding:"2px 6px",borderRadius:4}},"BEST")),
          (w.ref||w.size)&&React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",marginBottom:3,display:"flex",gap:6,flexWrap:"wrap"}},
            w.ref&&React.createElement("span",null,"Ref "+w.ref),
            w.size&&React.createElement("span",null,w.size+"mm"),
            w.mvmt&&React.createElement("span",null,w.mvmt)),
          React.createElement("div",{className:"score-bar",style:{marginBottom:6,width:"100%"}},React.createElement("div",{className:"score-fill",style:{width:pct+"%",background:barC}})),
          React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginBottom:4}},
            React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:3,background:w.sr&&w.sr.type==="good"?"#1a2a1a":"var(--card)",borderRadius:6,padding:"4px 8px",border:"1px solid "+(w.sr&&w.sr.type==="good"?"#2a4a2a":"var(--border)")}},
              React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:w.sr&&w.sr.type==="good"?"var(--good)":"var(--sub)"}},w.sr?w.sr.text:(w.br?"⛓️ Bracelet":"🔗 Strap"))),
            w.sr&&w.sr.strap&&w.sr.strap.material&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",background:"var(--bg)",borderRadius:4,padding:"2px 6px",border:"1px solid var(--border)"}},w.sr.strap.material)),
          detail&&w.bd&&React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginTop:4}},
            w.bd.ctx>0&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",background:"var(--badge-good)",color:"var(--good)",borderRadius:4,padding:"2px 6px"}},"✓ ctx +"+w.bd.ctx),
            w.bd.color!==0&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",background:w.bd.color>0?"var(--badge-good)":"var(--badge-warn)",color:w.bd.color>0?"var(--good)":"var(--warn)",borderRadius:4,padding:"2px 6px"}},(w.bd.color>0?"✓":"✗")+" color "+(w.bd.color>0?"+":"")+w.bd.color),
            w.bd.strap!==0&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",background:w.bd.strap>0?"var(--badge-good)":"var(--badge-warn)",color:w.bd.strap>0?"var(--good)":"var(--warn)",borderRadius:4,padding:"2px 6px"}},(w.bd.strap>0?"✓":"✗")+" strap "+(w.bd.strap>0?"+":"")+w.bd.strap),
            w.bd.temp!==0&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",background:"var(--badge-neutral)",color:"var(--sub)",borderRadius:4,padding:"2px 6px"}},"🌡️"+(w.bd.temp>0?"+":"")+w.bd.temp),
            w.bd.fresh&&w.bd.fresh!==0&&React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",background:w.bd.fresh>0?"var(--badge-good)":"var(--badge-warn)",color:w.bd.fresh>0?"var(--good)":"var(--warn)",borderRadius:4,padding:"2px 6px"}},"🔄"+(w.bd.fresh>0?"+":"")+w.bd.fresh),
            w.bd.auth&&w.bd.auth>0&&React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",background:"var(--badge-good)",color:"var(--good)",borderRadius:4,padding:"2px 6px"}},"✦ genuine +"+w.bd.auth)),
          w.wn&&w.wn.map(function(x,i){return React.createElement("p",{key:i,style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",marginTop:3}},x)}))))
  );
});

/* ══════ MODAL WRAPPER ══════ */
/* ═══ OUTFIT SHARE CANVAS ═══ */
async function shareOutfitCanvas(fit,CM,ph,photoAsDataUrl){
  var W=720,H=1280,c=document.createElement("canvas");c.width=W;c.height=H;var x=c.getContext("2d");
  /* Background */
  var bg=x.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#0e0d0b");bg.addColorStop(0.4,"#151412");bg.addColorStop(1,"#0a0908");x.fillStyle=bg;x.fillRect(0,0,W,H);
  /* Gold accent */
  var gold=x.createLinearGradient(60,0,W-60,0);gold.addColorStop(0,"rgba(201,168,76,0)");gold.addColorStop(0.5,"rgba(201,168,76,0.6)");gold.addColorStop(1,"rgba(201,168,76,0)");x.fillStyle=gold;x.fillRect(60,50,W-120,2);
  function loadImg(src){return new Promise(function(ok){if(!src)return ok(null);var img=new Image();img.crossOrigin="anonymous";img.onload=function(){ok(img)};img.onerror=function(){ok(null)};img.src=src})}
  async function resolvePhoto(u){if(!u)return null;if(u.startsWith("idb:")){var d=await photoAsDataUrl(u);return d||null}return ph?(ph(u)||u):u}
  function rr(rx,ry,rw,rh,r){x.beginPath();x.moveTo(rx+r,ry);x.lineTo(rx+rw-r,ry);x.quadraticCurveTo(rx+rw,ry,rx+rw,ry+r);x.lineTo(rx+rw,ry+rh-r);x.quadraticCurveTo(rx+rw,ry+rh,rx+rw-r,ry+rh);x.lineTo(rx+r,ry+rh);x.quadraticCurveTo(rx,ry+rh,rx,ry+rh-r);x.lineTo(rx,ry+r);x.quadraticCurveTo(rx,ry,rx+r,ry);x.closePath()}
  function frr(rx,ry,rw,rh,r,f){rr(rx,ry,rw,rh,r);x.fillStyle=f;x.fill()}
  /* Title */
  var dw=fit.watches&&fit.watches[0];
  x.font="600 36px -apple-system,sans-serif";x.fillStyle="#c9a84c";x.textAlign="center";x.fillText("Today's Fit",W/2,100);
  x.font="400 18px -apple-system,sans-serif";x.fillStyle="#8a8070";
  x.fillText(new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"}),W/2,130);
  /* Score arc */
  var sc=fit.fs||0,sX=W/2,sY=200,sR=40;
  x.beginPath();x.arc(sX,sY,sR,0,Math.PI*2);x.fillStyle="rgba(201,168,76,0.08)";x.fill();
  x.beginPath();x.arc(sX,sY,sR,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.min(sc/10,1));
  x.strokeStyle=sc>=7?"#7ab87a":sc>=4?"#c9a84c":"#c85a3a";x.lineWidth=4;x.lineCap="round";x.stroke();
  x.font="700 28px -apple-system,sans-serif";x.fillStyle="#fff";x.textAlign="center";x.fillText(sc.toFixed(1),sX,sY+10);
  /* Watch */
  if(dw){
    frr(40,270,W-80,100,16,"rgba(201,168,76,0.06)");x.strokeStyle="rgba(201,168,76,0.2)";rr(40,270,W-80,100,16);x.lineWidth=1;x.stroke();
    x.beginPath();x.arc(100,320,28,0,Math.PI*2);x.fillStyle=(dw.c||"#c9a84c")+"30";x.fill();
    x.font="28px sans-serif";x.textAlign="center";x.fillText(dw.i||"⌚",100,330);
    x.textAlign="left";x.font="600 22px -apple-system,sans-serif";x.fillStyle="#c9a84c";x.fillText(dw.n||"Watch",150,310);
    x.font="400 14px -apple-system,sans-serif";x.fillStyle="#8a8070";x.fillText((dw.d||"")+(dw.ref?" · Ref "+dw.ref:"")+(dw.size?" · "+dw.size+"mm":""),150,335);
    if(dw.sr&&dw.sr.text){x.font="400 13px -apple-system,sans-serif";x.fillStyle="#6a6050";x.fillText(dw.sr.text,150,355)}
  }
  /* Garments */
  var its=[{l:"TOP",it:fit.top},{l:"BOTTOM",it:fit.bot},{l:"SHOES",it:fit.shoe}].filter(function(e){return e.it});
  var cY=400,cH=200,cG=16;
  for(var gi=0;gi<its.length;gi++){
    var e=its[gi],py=cY+gi*(cH+cG);
    frr(40,py,W-80,cH,16,"#1a1816");x.strokeStyle="rgba(255,255,255,0.06)";rr(40,py,W-80,cH,16);x.lineWidth=1;x.stroke();
    var imgSrc=await resolvePhoto(e.it.photoUrl),lImg=imgSrc?await loadImg(imgSrc):null;
    if(lImg){x.save();rr(48,py+8,cH-16,cH-16,12);x.clip();var asp=lImg.width/lImg.height,dW=cH-16,dH=cH-16;if(asp>1)dW=dH*asp;else dH=dW/asp;x.drawImage(lImg,48+(cH-16-dW)/2,py+8+(cH-16-dH)/2,dW,dH);x.restore()}
    else{frr(48,py+8,cH-16,cH-16,12,(CM[e.it.color]||{}).h||"#3a3a3a")}
    var tx=48+cH+10;x.textAlign="left";
    x.font="600 11px -apple-system,sans-serif";x.fillStyle="rgba(201,168,76,0.5)";x.fillText(e.l,tx,py+30);
    x.font="600 20px -apple-system,sans-serif";x.fillStyle="#fff";x.fillText(e.it.name||(e.it.color+" "+e.it.garmentType),tx,py+60);
    x.font="400 15px -apple-system,sans-serif";x.fillStyle="#8a8070";x.fillText((e.it.color||"").charAt(0).toUpperCase()+(e.it.color||"").slice(1),tx,py+85);
    if(e.it.pattern&&e.it.pattern!=="solid")x.fillText(e.it.pattern,tx,py+108);
    if(e.it.material){x.font="400 13px -apple-system,sans-serif";x.fillStyle="#6a6050";x.fillText(e.it.material,tx,py+130)}
    var dH2=(CM[e.it.color]||{}).h||"#5a5a5a";x.beginPath();x.arc(tx+6,py+160,8,0,Math.PI*2);x.fillStyle=dH2;x.fill();
  }
  /* Context + branding */
  var fY=cY+its.length*(cH+cG)+30;
  if(fit.context){x.font="500 14px -apple-system,sans-serif";x.textAlign="center";x.fillStyle="rgba(201,168,76,0.5)";x.fillText(Array.isArray(fit.context)?fit.context.join(" · "):fit.context,W/2,fY)}
  if(fit.warns&&fit.warns.length){x.font="400 13px -apple-system,sans-serif";x.fillStyle="#c85a3a";x.textAlign="center";fit.warns.slice(0,2).forEach(function(w,i){x.fillText("⚠️ "+w,W/2,fY+26+i*22)})}
  x.fillStyle=gold;x.fillRect(60,H-80,W-120,2);
  x.font="600 16px -apple-system,sans-serif";x.fillStyle="rgba(201,168,76,0.3)";x.textAlign="center";x.fillText("Watch Advisor",W/2,H-45);
  x.font="400 11px -apple-system,sans-serif";x.fillStyle="rgba(255,255,255,0.15)";x.fillText("eiasash.github.io/Watch-advisor",W/2,H-25);
  return new Promise(function(ok){c.toBlob(function(b){ok(b)},"image/png")})
}

function Modal(props){
  useEffect(function(){document.body.classList.add("modal-open");return function(){document.body.classList.remove("modal-open")}},[]);
  return React.createElement("div",{className:"modal-backdrop",role:"dialog","aria-modal":true,onClick:function(e){if(e.target===e.currentTarget)props.onClose()}},
    React.createElement("div",{className:"modal-body"},
      React.createElement("div",{className:"modal-handle"}),props.children));
}
/* ══════ LAZY IMAGE — native lazy + async decode ══════ */
var LazyImg=React.memo(function(props){
  return React.createElement("img",Object.assign({},props,{loading:"lazy",decoding:"async"}));
});

/* ══════ VIRTUAL GRID — hybrid windowing for CSS Grid ══════ */
/* Chunks items into pages. Only pages near the viewport are mounted in DOM.
   Pages that scroll far away are replaced with measured-height spacers.
   Each page is its own CSS Grid container, preserving auto-fill layout. */
function VirtualGrid(props){
  var items=props.items,renderItem=props.renderItem,gridStyle=props.gridStyle,pageSize=props.pageSize||24,deps=props.deps||0;
  var pages=useMemo(function(){var r=[];for(var i=0;i<items.length;i+=pageSize)r.push(items.slice(i,i+pageSize));return r},[items,pageSize]);
  var mountedRef=useRef(new Set([0,1]));
  var _=useState(0),tick=_[0],setTick=_[1];
  var heightsRef=useRef({});
  var pageEls=useRef({});
  var obsRef=useRef(null);
  /* Create observer once */
  useEffect(function(){
    obsRef.current=new IntersectionObserver(function(entries){
      var visible=[];
      entries.forEach(function(e){var pi=parseInt(e.target.dataset.vpage);if(!isNaN(pi)&&e.isIntersecting)visible.push(pi)});
      if(!visible.length)return;
      var minV=Math.min.apply(null,visible),maxV=Math.max.apply(null,visible);
      var prev=mountedRef.current,next=new Set(prev),changed=false;
      /* Mount visible + ±1 buffer */
      for(var p=Math.max(0,minV-1);p<=Math.min(maxV+1,999);p++){if(!next.has(p)){next.add(p);changed=true}}
      /* Unmount pages >2 away from any visible */
      next.forEach(function(p){if(p<minV-2||p>maxV+2){next.delete(p);changed=true}});
      if(changed){mountedRef.current=next;setTick(function(t){return t+1})}
    },{rootMargin:"400px 0px"});
    return function(){if(obsRef.current)obsRef.current.disconnect()};
  },[]);
  /* Reset mounted set when items change */
  useEffect(function(){mountedRef.current=new Set([0,1]);heightsRef.current={};setTick(function(t){return t+1})},[items.length,deps]);
  /* Ref callback: observe/unobserve page sentinel divs */
  var refCb=useCallback(function(pi,el){
    if(pageEls.current[pi]&&obsRef.current)try{obsRef.current.unobserve(pageEls.current[pi])}catch(e){}
    pageEls.current[pi]=el;
    if(el&&obsRef.current)obsRef.current.observe(el);
  },[]);
  var fallbackH=Math.ceil(pageSize/3)*140;
  return React.createElement(React.Fragment,null,pages.map(function(pg,pi){
    var isMounted=mountedRef.current.has(pi);
    var h=heightsRef.current[pi]||fallbackH;
    return React.createElement("div",{key:"vp-"+pi,"data-vpage":String(pi),ref:function(el){refCb(pi,el)},style:isMounted?{minHeight:40}:{height:h,minHeight:40}},
      isMounted?React.createElement("div",{style:gridStyle,ref:function(el){if(el){var oh=el.offsetHeight;if(oh>40)heightsRef.current[pi]=oh}}},pg.map(renderItem)):null
    );
  }));
}

/* ══════ APP ══════ */
/* ══════ GLOBAL ERROR HANDLERS ══════ */
window.addEventListener("unhandledrejection",function(e){console.error("Unhandled promise:",e.reason);e.preventDefault()});
window.addEventListener("error",function(e){console.error("Global error:",e.message)});
/* ══════ ERROR BOUNDARY ══════ */
class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={hasError:false,error:null}}
  static getDerivedStateFromError(error){return{hasError:true,error:error}}
  componentDidCatch(error,info){console.error("WatchAdvisor crashed:",error,info)}
  render(){
    if(this.state.hasError)return React.createElement("div",{style:{padding:40,textAlign:"center",fontFamily:"'JetBrains Mono',monospace",color:"#c9a84c",background:"#12101a",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}},
      React.createElement("div",{style:{fontSize:48,marginBottom:16}},"⚠️"),
      React.createElement("h2",{style:{margin:"0 0 12px",fontSize:18}},"Something went wrong"),
      React.createElement("p",{style:{color:"#999",fontSize:12,marginBottom:16,maxWidth:300}},String(this.state.error&&this.state.error.message||"Unknown error").slice(0,200)),
      React.createElement("button",{onClick:function(){window.location.reload()},style:{background:"linear-gradient(135deg,#c9a84c,#a8882a)",border:"none",borderRadius:10,padding:"12px 28px",cursor:"pointer",color:"#12101a",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700}},"🔄 Reload App"));
    return this.props.children;
  }
}

function App(){
  const[W,setW]=useState(DEFAULTS);
  const[wd,setWd]=useState([]);
  const[view,setView]=useState("today");
  /* ═══ NAVIGATION HISTORY (back/forward) ═══ */
  const navStack=useRef([]); /* back history */
  const navForward=useRef([]); /* forward history */
  const navPushingRef=useRef(false); /* flag to avoid re-entrant pushes from popstate */
  const viewRef=useRef("today");
  const selFitRef=useRef(null);
  /* Reactive counter — increments on every nav change so buttons re-render */
  const[navVer,setNavVer]=useState(0);
  const[photoVer,setPhotoVer]=useState(0);
  useEffect(function(){var h=function(){setPhotoVer(function(v){return v+1})};window.addEventListener("wa-photo-ready",h);return function(){window.removeEventListener("wa-photo-ready",h)}},[]);
  const canGoBack=navStack.current.length>0;
  const canGoFwd=navForward.current.length>0;
  const navTo=useCallback(function(newView,newSelFit){
    navStack.current.push({view:viewRef.current,selFit:selFitRef.current});
    navForward.current=[];
    if(!navPushingRef.current){try{window.history.pushState({idx:navStack.current.length},"","")}catch(e){console.warn("[WA]",e)}}
    viewRef.current=newView;selFitRef.current=newSelFit||null;
    setView(newView);setSelFit(newSelFit||null);setNavVer(function(v){return v+1});
  },[]);
  const navBack=useCallback(function(){
    if(!navStack.current.length)return;
    navForward.current.push({view:viewRef.current,selFit:selFitRef.current});
    var prev=navStack.current.pop();
    navPushingRef.current=true;
    viewRef.current=prev.view;selFitRef.current=prev.selFit||null;
    setView(prev.view);setSelFit(prev.selFit||null);setNavVer(function(v){return v+1});
    navPushingRef.current=false;
  },[]);
  const navFwd=useCallback(function(){
    if(!navForward.current.length)return;
    navStack.current.push({view:viewRef.current,selFit:selFitRef.current});
    var next=navForward.current.pop();
    navPushingRef.current=true;
    try{window.history.pushState({idx:navStack.current.length},"","")}catch(e){console.warn("[WA]",e)}
    viewRef.current=next.view;selFitRef.current=next.selFit||null;
    setView(next.view);setSelFit(next.selFit||null);setNavVer(function(v){return v+1});
    navPushingRef.current=false;
  },[]);
  /* Browser back button support */
  useEffect(function(){
    function onPop(e){
      if(navStack.current.length){
        navForward.current.push({view:viewRef.current,selFit:selFitRef.current});
        var prev=navStack.current.pop();
        navPushingRef.current=true;
        viewRef.current=prev.view;selFitRef.current=prev.selFit||null;
        setView(prev.view);setSelFit(prev.selFit||null);setNavVer(function(v){return v+1});
        navPushingRef.current=false;
      }
    }
    window.addEventListener("popstate",onPop);
    try{window.history.replaceState({idx:0},"","")}catch(e){console.warn("[WA]",e)}
    return function(){window.removeEventListener("popstate",onPop)};
  },[]);
  const[ctx,setCtx]=useState(["smart-casual"]);
  const[reps,setReps]=useState(true);
  const[proc,setProc]=useState([]);
  const[saved,setSaved]=useState([]);
  const[selFit,setSelFit]=useState(null);
  const[fitWatch,setFitWatch]=useState(null);
  const[wFilt,setWFilt]=useState("all");
  const[wMatFilt,setWMatFilt]=useState("all");
  const[weather,setWx]=useState(null);
  const[wxErr,setWxErr]=useState(false);
  const[loc,setLoc]=useState({lat:31.7683,lon:35.2137,name:"Jerusalem"});
  const[editG,setEditG]=useState(null);
  const[editW,setEditW]=useState(null);
  const[addG,setAddG]=useState(false);
  const[mode,setMode]=useState("auto");
  const[topType,setTopType]=useState("all");
  const[lockItem,setLockItem]=useState(null);
  const[shuffleKey,setShuffleKey]=useState(0);
  const[preferUnworn,setPreferUnworn]=useState(false);
  const[fitCount,setFitCount]=useState(12);
  const[buildSlot,setBuildSlot]=useState(null);
  /* Dynamic layers — unlimited, renameable upper-body slots */
  const[buildLayers,setBuildLayers]=useState([{id:1,label:"BASE",item:null}]);
  const nextLayerId=useRef(2);
  const[bBot,setBBot]=useState(null);
  const[bShoe,setBShoe]=useState(null);
  const[bAcc,setBAcc]=useState(null);
  const[wTab,setWTab]=useState("all");
  const[wSearch,setWSearch]=useState("");
  const[aiErr,setAiErr]=useState("");
  const[apiKey,setApiKey]=useState("");
  const[recUser,setRecUser]=useState(function(){try{return localStorage.getItem("wa_rec_user")||""}catch(e){return""}});
  const[recPass,setRecPass]=useState("");
  const[recStatus,setRecStatus]=useState("");
  /* ── Cloud Sync state ── */
  const[sbUrl,setSbUrl]=useState(function(){var c=sbLoadConfig();return c?c.url:""});
  const[sbKey,setSbKey]=useState(function(){var c=sbLoadConfig();return c?c.anonKey:""});
  const[sbBucket,setSbBucket]=useState(function(){var c=sbLoadConfig();return c&&c.bucket?c.bucket:"photos"});
  const[cloudUser,setCloudUser]=useState(null);
  const[cloudStatus,setCloudStatus]=useState("");
  const[syncStatus,setSyncStatus]=useState("");
  const[showAuthModal,setShowAuthModal]=useState(false);
  const[authMode,setAuthMode]=useState("login"); /* "login"|"signup" */
  const[authUser,setAuthUser]=useState("");
  const[authPass,setAuthPass]=useState("");
  const[authError,setAuthError]=useState("");
  const[authLoading,setAuthLoading]=useState(false);
  const[syncIndicator,setSyncIndicator]=useState(function(){return sbGetSyncState()});
  const TEXT_SIZES=[{label:"90%",value:0.9},{label:"100%",value:1},{label:"110%",value:1.1},{label:"125%",value:1.25},{label:"140%",value:1.4}];
  const[showSettings,setShowSettings]=useState(false);
  const[forecast,setForecast]=useState([]);
  const[planDay,setPlanDay]=useState(0);
  const[onboarded,setOnboarded]=useState(!IS_SHARED);
  const[onboardStep,setOnboardStep]=useState(1);
  const[obWatches,setObWatches]=useState([]);
  const[obGarments,setObGarments]=useState([]);
  const[weekCtx,setWeekCtx]=useState(IS_SHARED?["casual","smart-casual","smart-casual","smart-casual","smart-casual","smart-casual","weekend"]:["casual","clinic","clinic","clinic","clinic","smart-casual","weekend"]);
  const[editRotCtx,setEditRotCtx]=useState(false);
  const[wearLog,setWearLog]=useState([]);
  const[strapLog,setStrapLog]=useState([]);
  const[todayRefreshKey,setTodayRefreshKey]=useState(0);
  const[todaySwapWatch,setTodaySwapWatch]=useState(null);
  const[aiCritique,setAiCritique]=useState(null);
  const[aiLoading,setAiLoading]=useState(false);
  const[dailyPick,setDailyPick]=useState(null);
  const[rotLock,setRotLock]=useState([null,null,null,null,null,null,null]);
  const[editDayIdx,setEditDayIdx]=useState(null);
  const[editDayMode,setEditDayMode]=useState(null);
  const[expandDay,setExpandDay]=useState(null);
  const[altSwap,setAltSwap]=useState({});
  const[wearPicker,setWearPicker]=useState(null);
  const[pieceSwap,setPieceSwap]=useState({});
  const[piecePicker,setPiecePicker]=useState(null);
  const[pieceFilter,setPieceFilter]=useState(null);
  const[dayAi,setDayAi]=useState({});
  const[dayAiLoading,setDayAiLoading]=useState(null);
  const[userCx,setUserCx]=useState(null);
  const[theme,setTheme]=useState("dark");
  const[uiScale,setUiScale]=useState(1);
  const[buildName,setBuildName]=useState("");
  const[buildAiCritique,setBuildAiCritique]=useState(null);
  const[buildAiLoading,setBuildAiLoading]=useState(false);
  const[buildWatch,setBuildWatch]=useState(null);
  const[showDupes,setShowDupes]=useState(false);
  const[dupeGroups,setDupeGroups]=useState([]);
  const[wDupeGroups,setWDupeGroups]=useState([]);
  const[showWDupes,setShowWDupes]=useState(false);
  const[wColFilt,setWColFilt]=useState("all");
  const[showQuickWear,setShowQuickWear]=useState(false);
  const[savedView,setSavedView]=useState("list");
  const[showArchived,setShowArchived]=useState(false);
  /* gridLimit removed — VirtualGrid handles DOM windowing */
  const[selMode,setSelMode]=useState(false);
  const selIdsRef=useRef(new Set());
  const[selTick,setSelTick]=useState(0);
  const longPressTimer=useRef(null);
  var toggleSel=function(id){var s=selIdsRef.current;if(s.has(id))s.delete(id);else s.add(id);setSelTick(function(t){return t+1})};
  var clearSel=function(){selIdsRef.current=new Set();setSelMode(false);setSelTick(0)};
  var batchDelete=function(){var ids=Array.from(selIdsRef.current);if(!ids.length)return;setConfirmDlg({msg:"Delete "+ids.length+" item"+(ids.length>1?"s":"")+"?",danger:true,onOk:function(){ids.forEach(function(id){rmG(id)});clearSel();showToast("\u2705 Deleted "+ids.length+" item"+(ids.length>1?"s":""),"var(--good)");setConfirmDlg(null)}})};
  var batchArchive=function(){var ids=Array.from(selIdsRef.current);if(!ids.length)return;setWd(function(p){var n=p.map(function(i){return ids.includes(i.id)?Object.assign({},i,{archived:!i.archived}):i});ps("wd_"+SK,n);return n});var ct=ids.length;clearSel();showToast("\u2705 Toggled archive on "+ct+" item"+(ct>1?"s":""),"var(--good)")};
  var batchSetType=function(type){var ids=Array.from(selIdsRef.current);if(!ids.length)return;setWd(function(p){var n=p.map(function(i){if(!ids.includes(i.id))return i;var upd=Object.assign({},i,{garmentType:type,needsEdit:false});upd.name=buildGarmentName(upd.color,upd.material,type);return upd});ps("wd_"+SK,n);return n});var ct=ids.length;clearSel();showToast("\u2705 Set "+ct+" item"+(ct>1?"s":"")+" to "+type,"var(--good)")};
  const[batchTypeMenu,setBatchTypeMenu]=useState(false);  const reScanRef=useRef();
  const[importDupe,setImportDupe]=useState(null);/* {newItem, match, onKeep, onUseExisting} */
  const touchRef=useRef({sx:0,sy:0,swiping:false});
  const mainRef=useRef(null);
  var TABS=["today","wardrobe","fits","insights","watches","saved"];
  /* Passive swipe listeners — cannot block scroll */
  useEffect(function(){
    var el=mainRef.current;if(!el)return;
    function onStart(e){
      if(e.touches.length!==1)return;
      touchRef.current={sx:e.touches[0].clientX,sy:e.touches[0].clientY,scrollY:window.scrollY,swiping:true};
    }
    function onEnd(e){
      if(!touchRef.current.swiping)return;
      var t=e.changedTouches[0];var dx=t.clientX-touchRef.current.sx;var dy=t.clientY-touchRef.current.sy;
      touchRef.current.swiping=false;
      if(Math.abs(window.scrollY-(touchRef.current.scrollY||0))>15)return;
      if(Math.abs(dx)<120||Math.abs(dy)>Math.abs(dx)*0.25)return;
      var ci=TABS.indexOf(view);if(ci<0)return;
      if(dx<-100&&ci<TABS.length-1)navTo(TABS[ci+1],null);
      else if(dx>100&&ci>0)navTo(TABS[ci-1],null);
    }
    el.addEventListener("touchstart",onStart,{passive:true});
    el.addEventListener("touchend",onEnd,{passive:true});
    return function(){el.removeEventListener("touchstart",onStart);el.removeEventListener("touchend",onEnd)};
  });
  useEffect(function(){
    /* Safety: remove modal-open if no modal is actually showing */
    var anyModal=showSettings||editG||lightboxSrc||showQuickWear||confirmDlg;
    if(!anyModal&&document.body.classList.contains("modal-open")){document.body.classList.remove("modal-open");document.body.style.top=""}
  });
  /* Auto-migrate new base64 photos to IDB (guarded) */
  var _migRef=useRef(false);
  var _needsMig=useMemo(function(){return wd.some(function(i){return i.photoUrl&&i.photoUrl.startsWith("data:")})||W.some(function(w){return(w.photoUrl&&w.photoUrl.startsWith("data:"))||(w.straps&&w.straps.some(function(s){return s.photoUrl&&s.photoUrl.startsWith("data:")}))})},[wd,W]);
  useEffect(function(){
    if(!_needsMig||_migRef.current)return;
    _migRef.current=true;
    (async function(){var dirty=false;
      var wc=W.slice(),wdc=wd.slice();
      for(var it of wdc){if(it.photoUrl&&it.photoUrl.startsWith("data:")){it.photoUrl=await savePhoto("wd_"+it.id,it.photoUrl);dirty=true}}
      for(var w of wc){
        if(w.photoUrl&&w.photoUrl.startsWith("data:")){w.photoUrl=await savePhoto("w_"+w.id,w.photoUrl);dirty=true}
        if(w.straps)for(var j=0;j<w.straps.length;j++){if(w.straps[j].photoUrl&&w.straps[j].photoUrl.startsWith("data:")){w.straps[j].photoUrl=await savePhoto("w_"+w.id+"_s"+j,w.straps[j].photoUrl);dirty=true}}
      }
      if(dirty){setWd(wdc);ps("wd_"+SK,wdc);setW(wc);ps("w_"+SK,wc)}
      _migRef.current=false;
    })();
  },[_needsMig]);

  const[aiCoach,setAiCoach]=useState(null);
  const[aiCoachLoading,setAiCoachLoading]=useState(false);
  const[aiOccasion,setAiOccasion]=useState(null);
  const[aiOccasionLoading,setAiOccasionLoading]=useState(false);
  const[aiOccasionInput,setAiOccasionInput]=useState("");
  const[aiAudit,setAiAudit]=useState(null);
  const[aiAuditLoading,setAiAuditLoading]=useState(false);
  const[lightboxSrc,setLightboxSrc]=useState(null);
  const[lightboxItems,setLightboxItems]=useState([]);
  const[showSaveToast,setShowSaveToast]=useState(false);
  const[toast,setToast]=useState(null);
  const toastTmr=useRef(null);
  const[confirmDlg,setConfirmDlg]=useState(null);
  const showToast=useCallback(function(msg,color,dur,undoFn){if(toastTmr.current)clearTimeout(toastTmr.current);setToast({msg:msg,color:color||"var(--good)",undo:undoFn||null,ts:Date.now()});toastTmr.current=setTimeout(function(){setToast(null);toastTmr.current=null},undoFn?5000:(dur||2500))},[]);
  const haptic=useCallback(function(ms){try{if(navigator.vibrate)navigator.vibrate(ms||15)}catch(e){}},[]);
  const[undoDelete,setUndoDelete]=useState(null); /* {outfit, timer} — holds recently deleted outfit for undo */
  const undoTimerRef=useRef(null);
  const[watchScanLoading,setWatchScanLoading]=useState(false);
  const[watchScanResult,setWatchScanResult]=useState(null);
  const scanCancelRef=useRef(false);
  const[scanProg,setScanProg]=useState(null);
  const[selfieHistory,setSelfieHistory]=useState([]);
  const[selfieLoading,setSelfieLoading]=useState(false);
  const[selfieResult,setSelfieResult]=useState(null);
  const fRef=useRef();const cRef=useRef();const wPhotoRef=useRef();const wCamRef=useRef();
  const selfieRef=useRef();const selfieRearRef=useRef();const selfieGalRef=useRef();
  const apiKeyRef=useRef("");

  /* Storage: Claude.ai artifact has window.storage.set/get returning promises. Chrome's StorageManager is different. */
  const hasAS=(function(){try{return typeof window.storage==="object"&&typeof window.storage.set==="function"&&typeof window.storage.get==="function"&&window.storage!==navigator.storage}catch(e){return false}})();
  const ps=useCallback(async function(k,v){var j=JSON.stringify(v);try{if(hasAS){await window.storage.set(k,j)}else{localStorage.setItem(k,j)}}catch(e){try{localStorage.setItem(k,j)}catch(e2){if(e2.name==="QuotaExceededError"){console.warn("Storage quota exceeded for key:",k)}else{console.warn("Storage error for key:",k,e2)}}}},[]);
  const loadKey=function(k){if(hasAS){return window.storage.get(k).then(function(r){try{return r&&r.value?JSON.parse(r.value):null}catch(e){console.warn("[WA] corrupt key:",k,e);return null}}).catch(function(){try{var v=localStorage.getItem(k);return v?JSON.parse(v):null}catch(e){return null}})}try{var v=localStorage.getItem(k);return Promise.resolve(v?JSON.parse(v):null)}catch(e){return Promise.resolve(null)}};

  useEffect(function(){var sp=document.getElementById("splash");if(sp)sp.remove();(async function(){
    var wLoaded=false,wdLoaded=false,ofLoaded=false;
    // Load current version
    try{var p=await loadKey("w_"+SK);if(p&&p.length){setW(p.map(migrateStraps));wLoaded=true}}catch(e){console.warn("[WA]",e)}
    try{var p2=await loadKey("wd_"+SK);if(p2&&p2.length){setWd(p2);wdLoaded=true}}catch(e){console.warn("[WA]",e)}
    try{var p3=await loadKey("of_"+SK);if(p3&&p3.length){setSaved(p3);ofLoaded=true}}catch(e){console.warn("[WA]",e)}
    // Migrate from older versions (v12 first, then older)
    if(!wLoaded){for(var vk of["w_v12","w_v11","w_v9","watches_v8"]){try{var pm=await loadKey(vk);if(pm&&pm.length){var mw=pm.map(function(w){return migrateStraps(Object.assign({size:null,photoUrl:null},w))});setW(mw);ps("w_"+SK,mw);wLoaded=true;break}}catch(e){console.warn("[WA]",e)}}}
    if(!wdLoaded){for(var vk2 of["wd_v12","wd_v11","wd_v9","wd_v8"]){try{var pm2=await loadKey(vk2);if(pm2&&pm2.length){var mg=pm2.map(function(g){return Object.assign({material:null,seasons:[],positionHint:null,lastWorn:null},g)});setWd(mg);ps("wd_"+SK,mg);wdLoaded=true;break}}catch(e){console.warn("[WA]",e)}}}
    if(!wdLoaded&&WD_DEFAULTS.length){setWd(WD_DEFAULTS);ps("wd_"+SK,WD_DEFAULTS);wdLoaded=true}
    if(!ofLoaded){for(var vk3 of["of_v12","of_v11","of_v9","of_v8"]){try{var pm3=await loadKey(vk3);if(pm3&&pm3.length){setSaved(pm3);ps("of_"+SK,pm3);ofLoaded=true;break}}catch(e){console.warn("[WA]",e)}}}
    // Load API key
    try{var ak=await loadKey("wa_apikey");if(ak){var dk=decryptApiKey(ak);setApiKey(dk);apiKeyRef.current=dk;/* Auto-upgrade plaintext key to encrypted */if(!String(ak).startsWith("ENC:")){ps("wa_apikey",encryptApiKey(dk))}}}catch(e){console.warn("[WA]",e)}
    try{var wc=await loadKey("wa_weekctx");if(wc&&wc.length===7)setWeekCtx(wc)}catch(e){console.warn("[WA]",e)}
    try{var ucx=await loadKey("wa_usercx_"+SK);if(ucx&&ucx.length)setUserCx(ucx)}catch(e){console.warn("[WA]",e)}
    try{var wl=await loadKey("wa_wearlog_"+SK);if(wl&&wl.length)setWearLog(wl);else{for(var wlk of["wa_wearlog_v12","wa_wearlog_v11"]){try{var wlm=await loadKey(wlk);if(wlm&&wlm.length){setWearLog(wlm);ps("wa_wearlog_"+SK,wlm);break}}catch(e){console.warn("[WA]",e)}}}}catch(e){console.warn("[WA]",e)}
    try{var rl=await loadKey("wa_rotlock_"+SK);if(rl&&rl.length===7)setRotLock(rl);else{for(var rlk of["wa_rotlock_v12","wa_rotlock_v11"]){try{var rlm=await loadKey(rlk);if(rlm&&rlm.length===7){setRotLock(rlm);ps("wa_rotlock_"+SK,rlm);break}}catch(e){console.warn("[WA]",e)}}}}catch(e){console.warn("[WA]",e)}
    // Auto-onboard if existing data found
    if(wLoaded||wdLoaded)setOnboarded(true);
    /* ── AUTO-CLEANUP: purge traded watches and ghost entries from localStorage ── */
    /* Only runs once per version — sets a flag so it doesn't repeat on every load */
    var _cleanedFlag="wa_cleaned_v23";
    var _alreadyCleaned=false;try{_alreadyCleaned=!!localStorage.getItem(_cleanedFlag)}catch(e){console.warn("[WA]",e)}
    if(wLoaded&&!IS_SHARED&&!_alreadyCleaned){
      setW(function(prev){
        /* Known traded/sold watch names and IDs to purge */
        var TRADED_NAMES=["sinn 613","rolex date 15203","sugess chronograph","seiko srph","sugess","srph"];
        var cleaned=prev.filter(function(w){
          /* Remove blank "New Watch" ghosts: default name + no dial color set */
          if(w.n==="New Watch"&&(!w.d||w.d===""))return false;
          /* Remove known traded watches by name match */
          var ln=(w.n||"").toLowerCase();
          for(var tn of TRADED_NAMES){if(ln.includes(tn))return false}
          return true;
        });
        if(cleaned.length!==prev.length){
                    ps("w_"+SK,cleaned);
        }
        try{localStorage.setItem(_cleanedFlag,"1")}catch(e){console.warn("[WA]",e)}
        return cleaned;
      });
    }
    try{var ob=await loadKey("wa_onboarded");if(ob)setOnboarded(true)}catch(e){console.warn("[WA]",e)}
    try{var th=await loadKey("wa_theme");if(th)setTheme(th)}catch(e){console.warn("[WA]",e)}
    try{var zs=await loadKey("wa_uiscale");if(zs){var zf=parseFloat(zs);if(isFinite(zf)&&zf>0)setUiScale(Math.max(0.85,Math.min(1.6,zf)))} }catch(e){console.warn("[WA]",e)}
    try{var sh=await loadKey("wa_selfie_"+SK);if(sh&&sh.length)setSelfieHistory(sh)}catch(e){console.warn("[WA]",e)}
    try{var _sl=await loadKey("wa_strap_log");if(_sl&&_sl.length)setStrapLog(_sl)}catch(e){console.warn("[WA]",e)}
    try{var _pf=await loadKey("wa_prefer_fresh");if(_pf)setPreferUnworn(true)}catch(e){console.warn("[WA]",e)}
    /* ── IDB photo migration + preload ── */
    try{
      var _w2=W,_wd2=wd;
      if(!_w2||!_w2.length){try{_w2=await loadKey("w_"+SK)||[]}catch(e){_w2=[]}}
      if(!_wd2||!_wd2.length){try{_wd2=await loadKey("wd_"+SK)||[]}catch(e){_wd2=[]}}
      var wCh=await migrateToIDB(_w2,"w");var wdCh=await migrateToIDB(_wd2,"wd");
      if(wCh){setW(_w2);ps("w_"+SK,_w2)}
      if(wdCh){setWd(_wd2);ps("wd_"+SK,_wd2)}
      await preloadPhotos(_w2.concat(_wd2));
    }catch(e){console.warn("[IDB]",e)}
    // Cleanup old storage keys after successful migration
    var oldKeys=["w_v12","w_v11","w_v9","watches_v8","wd_v12","wd_v11","wd_v9","wd_v8","of_v12","of_v11","of_v9","of_v8","wa_wearlog_v12","wa_wearlog_v11","wa_rotlock_v12","wa_rotlock_v11","w_v13","wd_v13","of_v13","wa_wearlog_v13","wa_rotlock_v13"];
    setTimeout(function(){oldKeys.forEach(function(k){try{localStorage.removeItem(k)}catch(e){console.warn("[WA]",e)}})},3000);
  })()},[]);

  useEffect(function(){if(theme==="light")document.body.classList.add("light");else document.body.classList.remove("light");return function(){document.body.classList.remove("light")}},[theme]);

  /* ── Accessibility: UI scale via CSS variable (Android-friendly). Stored in wa_uiscale ── */
  useEffect(function(){
    try{ps("wa_uiscale",uiScale)}catch(e){}
    try{
      document.documentElement.style.setProperty("--uiScale",String(uiScale));
      /* Also set zoom as fallback for browsers that support it */
      var z=(uiScale&&uiScale!==1)?String(uiScale):"";
      document.documentElement.style.zoom=z;
    }catch(e){}
  },[uiScale]);

  /* SW lifecycle: auto-reload when new SW takes over */
  useEffect(function(){if(!("serviceWorker" in navigator))return;var reloading=false;navigator.serviceWorker.addEventListener("controllerchange",function(){if(!reloading){reloading=true;window.location.reload()}});navigator.serviceWorker.addEventListener("message",function(e){if(e.data&&e.data.type==="SW_ACTIVATED"){console.log("[WA] New SW active:",e.data.cache)}if(e.data&&e.data.type==="CACHES_CLEARED"){window.location.reload()}})},[]);
  /* Cloud Sync: check for existing session on mount + subscribe to sync state */
  useEffect(function(){
    var unsub=sbOnSyncChange(function(state){setSyncIndicator(Object.assign({},state))});
    (async function(){try{var cfg=sbLoadConfig();if(!cfg||!cfg.url||!cfg.anonKey)return;sbInitClient(cfg.url,cfg.anonKey);var session=await sbGetSession();if(session&&session.user){setCloudUser(session.user);setCloudStatus("signed in as "+session.user.email);
      /* Auto-pull on login if session exists */
      try{var cloud=await sbPullSnapshot();if(cloud){var localPayload=_buildPayload();var merged=sbMerge(localPayload,cloud);_applyPayload(merged)}}catch(pe){console.warn("[CloudSync] auto-pull:",pe)}
    }}catch(e){console.warn("[CloudSync] session check:",e)}}
    )();
    return unsub;
  },[]);
  /* Cloud Sync: upload original-quality photo in background when signed in.
     Also saves original blob to IDB for offline cache. */
  const cloudUploadPhoto=useCallback(function(photoKey,fileOrBlob){
    /* Always save original blob locally for offline use */
    saveOriginalBlob(photoKey,fileOrBlob).catch(function(e){console.warn("[IDB] orig save:",e)});
    /* Upload to cloud (queues if offline) */
    var cfg=sbLoadConfig();var bucket=cfg&&cfg.bucket?cfg.bucket:"photos";
    sbUploadOriginal(photoKey,fileOrBlob,bucket).catch(function(e){console.warn("[CloudSync] upload:",e)});
  },[]);
  useEffect(function(){if(navigator.geolocation)try{navigator.geolocation.getCurrentPosition(function(p){setLoc({lat:p.coords.latitude,lon:p.coords.longitude,name:"Your Location"})},function(err){setLoc({lat:31.7683,lon:35.2137,name:"Jerusalem (default)"})},{timeout:8000,maximumAge:300000})}catch(e){console.warn("[WA]",e)}},[]);
  useEffect(function(){(async function(){try{var r=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+loc.lat+"&longitude="+loc.lon+"&current=temperature_2m,apparent_temperature,wind_speed_10m,relative_humidity_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,weather_code,precipitation_probability_max,uv_index_max,wind_speed_10m_max&timezone=auto&forecast_days=7");var d=await r.json();if(d.current){var cwmo=getWMO(d.current.weather_code);setWx({temp:Math.round(d.current.temperature_2m),feels:Math.round(d.current.apparent_temperature),wind:Math.round(d.current.wind_speed_10m),hum:d.current.relative_humidity_2m,code:d.current.weather_code,cond:cwmo})}if(d.daily&&d.daily.time)setForecast(d.daily.time.map(function(dt,i){var wmo=getWMO(d.daily.weather_code?d.daily.weather_code[i]:0);return{date:dt,high:Math.round(d.daily.temperature_2m_max[i]),low:Math.round(d.daily.temperature_2m_min[i]),feelsHigh:Math.round(d.daily.apparent_temperature_max[i]),feelsLow:Math.round(d.daily.apparent_temperature_min[i]),feelsAvg:Math.round((d.daily.apparent_temperature_max[i]+d.daily.apparent_temperature_min[i])/2),code:d.daily.weather_code?d.daily.weather_code[i]:0,cond:wmo,rainPct:d.daily.precipitation_probability_max?d.daily.precipitation_probability_max[i]:0,uv:d.daily.uv_index_max?Math.round(d.daily.uv_index_max[i]):0,wind:d.daily.wind_speed_10m_max?Math.round(d.daily.wind_speed_10m_max[i]):0}}))}catch(e){console.error("Weather fetch failed:",e);setWxErr(true)}})()},[loc]);

  const tier=useMemo(function(){if(planDay===0&&weather)return getWT(weather.feels);if(planDay>0&&forecast[planDay])return getWT(forecast[planDay].feelsAvg);return weather?getWT(weather.feels):null},[weather,forecast,planDay]);
  const ww=tier?tier.weight:"mid";
  const planTemp=useMemo(function(){if(planDay===0&&weather)return{temp:weather.temp,feels:weather.feels};if(forecast[planDay])return{temp:Math.round((forecast[planDay].high+forecast[planDay].low)/2),feels:forecast[planDay].feelsAvg};return weather?{temp:weather.temp,feels:weather.feels}:null},[weather,forecast,planDay]);
  const planWx=useMemo(function(){
    if(planDay===0&&weather)return{rain:weather.cond&&weather.cond.rain,wind:weather.wind,uv:0,cond:weather.cond||null,rainPct:0,lat:loc.lat};
    var fc=forecast[planDay];if(fc)return{rain:fc.cond&&fc.cond.rain,wind:fc.wind,uv:fc.uv,cond:fc.cond||null,rainPct:fc.rainPct||0,lat:loc.lat};
    return null;
  },[weather,forecast,planDay,loc]);
  const effectiveCtx=useMemo(function(){
    if(planDay>0){var dayIdx=(new Date().getDay()+planDay)%7;var wc=weekCtx[dayIdx];return wc?[wc]:ctx}
    return ctx;
  },[planDay,weekCtx,ctx]);
  const primaryCtx=useMemo(function(){return Array.isArray(effectiveCtx)?effectiveCtx[0]||"smart-casual":effectiveCtx},[effectiveCtx]);
  const ctxSet=useMemo(function(){return new Set(Array.isArray(effectiveCtx)?effectiveCtx:[effectiveCtx])},[effectiveCtx]);
  const activeCx=useMemo(function(){return userCx||(IS_SHARED?SHARE_DEFAULT_CX:DEFAULT_CX)},[userCx]);
  const activeCxIds=useMemo(function(){return activeCx.map(function(c){return c.id})},[activeCx]);
  const activeCxIcons=useMemo(function(){var m={};activeCx.forEach(function(c){m[c.id]=c.icon});return m},[activeCx]);
  const actW=useMemo(function(){return W.filter(function(w){return w.active&&w.status!=="sold"&&w.status!=="service"&&w.status!=="pending-trade"&&w.status!=="incoming"})},[W]);
  const byCat=useMemo(function(){return{tops:wd.filter(function(i){return catOf(i.garmentType)==="tops"}),bottoms:wd.filter(function(i){return catOf(i.garmentType)==="bottoms"}),shoes:wd.filter(function(i){return catOf(i.garmentType)==="shoes"}),accessories:wd.filter(function(i){return catOf(i.garmentType)==="accessories"||catOf(i.garmentType)==="other"})}},[wd]);
  /* Memoized filtered+sorted wardrobe for grid — avoids recomputing on every unrelated state change */
  const filteredWd=useMemo(function(){var arr=wFilt==="all"?wd:wd.filter(function(i){return catOf(i.garmentType)===wFilt});if(wMatFilt!=="all")arr=arr.filter(function(i){return i.material===wMatFilt});if(wColFilt!=="all")arr=arr.filter(function(i){return i.color===wColFilt});if(!showArchived)arr=arr.filter(function(i){return!i.archived});return arr.slice().sort(function(a,b){return(b.ts||0)-(a.ts||0)})},[wd,wFilt,wMatFilt,wColFilt,showArchived]);
  const wdStats=useMemo(function(){var at=byCat.tops.filter(function(i){return!i.archived}).length;var ab=byCat.bottoms.filter(function(i){return!i.archived}).length;var as=byCat.shoes.filter(function(i){return!i.archived}).length;var arch=wd.filter(function(i){return i.archived}).length;var mc={};wd.forEach(function(i){if(i.material)mc[i.material]=(mc[i.material]||0)+1});var ms=Object.entries(mc).sort(function(a,b){return b[1]-a[1]}).slice(0,3);var matStr=ms.length?" · "+ms.map(function(e){return e[0]+" ×"+e[1]}).join(", "):"";var nfIds=new Set();saved.forEach(function(o){(o.items||[]).forEach(function(it){nfIds.add(it.id)})});var unused=wd.filter(function(i){return i.color&&!i.needsEdit&&!nfIds.has(i.id)}).length;var worn=wd.filter(function(i){return i.lastWorn});var fresh=0,mid=0,stale=0;var now=Date.now();worn.forEach(function(i){var d=Math.floor((now-new Date(i.lastWorn).getTime())/864e5);if(d<=3)fresh++;else if(d<=14)mid++;else stale++});return{summary:at+" tops · "+ab+" bottoms · "+as+" shoes"+(arch?" · "+arch+" archived":"")+matStr,unused:unused,fresh:fresh,mid:mid,stale:stale,hasWorn:worn.length>0}},[byCat,wd,saved]);
  const fits=useMemo(function(){return wd.length<2?[]:genFits(wd,actW,effectiveCtx,reps,ww,fitCount,{topType:topType,lockItem:lockItem,shuffle:shuffleKey>0,wx:planWx,temp:planTemp?planTemp.feels:18,wearLog:wearLog,lat:loc.lat,preferUnworn:preferUnworn,strapLogs:strapLog,weatherKey:getWeatherKey(weather)})},[wd,actW,effectiveCtx,reps,ww,topType,lockItem,shuffleKey,fitCount,planWx,planTemp,loc,preferUnworn,strapLog,weather]);
  /* ══ TODAY DASHBOARD: context + fits ══ */
  const todayCtx=useMemo(function(){var dayIdx=new Date().getDay();var wc=weekCtx[dayIdx];return wc?[wc]:ctx},[weekCtx,ctx]);
  const todayWk=useMemo(function(){return getWeatherKey(weather)},[weather]);
  const todayFits=useMemo(function(){
    if(wd.length<2||!actW.length)return[];
    var wxOpts=weather?{rain:weather.cond&&weather.cond.rain,wind:weather.wind,uv:0,lat:loc.lat}:null;
    var temp=weather?weather.feels:18;
    var wt=weather?getWT(weather.feels):{weight:"mid"};
    return genFits(wd,actW,todayCtx,reps,wt.weight,3,{wx:wxOpts,temp:temp,wearLog:wearLog,lat:loc.lat,preferUnworn:preferUnworn,strapLogs:strapLog,weatherKey:todayWk,shuffle:todayRefreshKey>0});
  },[wd,actW,todayCtx,reps,weather,wearLog,preferUnworn,strapLog,todayWk,todayRefreshKey,loc]);
  const buildFit=useMemo(function(){var layerItems=buildLayers.map(function(l){return l.item}).filter(Boolean);var items=layerItems.concat([bBot,bShoe,bAcc]).filter(Boolean);return items.length>=2?makeOutfit(items,actW,effectiveCtx,reps,planWx,planTemp?planTemp.feels:18):null},[buildLayers,bBot,bShoe,bAcc,actW,effectiveCtx,reps,planWx,planTemp]);
  const needsFix=useMemo(function(){return wd.filter(function(i){return i.needsEdit||!i.color}).length},[wd]);

  const findDuplicates=useCallback(function(){
    var groups=[];var seen=new Set();
    /* Pass 1: exact type+color match (existing) */
    for(var i=0;i<wd.length;i++){
      if(seen.has(wd[i].id))continue;
      var group=[wd[i]];
      for(var j=i+1;j<wd.length;j++){
        if(seen.has(wd[j].id))continue;
        var sameTypeColor=wd[i].garmentType===wd[j].garmentType&&wd[i].color===wd[j].color&&wd[i].color;
        var visualMatch=wd[i].dHash&&wd[j].dHash&&hammingDist(wd[i].dHash,wd[j].dHash)<=10;
        if(sameTypeColor||visualMatch){group.push(wd[j]);seen.add(wd[j].id)}
      }
      if(group.length>=2){group.forEach(function(g){seen.add(g.id)});groups.push(group)}
    }
    return groups;
  },[wd]);

  /* Watch duplicate detection */
  const findWatchDupes=useCallback(function(){
    var groups={};
    /* Group by normalized name */
    W.forEach(function(w){
      var normName=w.n.toLowerCase().replace(/[^a-z0-9]/g,"");
      var key="name_"+normName;
      if(!groups[key])groups[key]=[];
      groups[key].push(w);
    });
    /* Group by dial color + type */
    W.forEach(function(w){
      var key2="dial_"+w.t+"_"+(w.d||"").toLowerCase().replace(/[^a-z0-9]/g,"");
      if(!groups[key2])groups[key2]=[];
      var already=groups[key2].some(function(g){return g.id===w.id});
      if(!already)groups[key2].push(w);
    });
    /* Group by fuzzy name similarity (contains check) */
    for(var i=0;i<W.length;i++){
      for(var j=i+1;j<W.length;j++){
        var a=W[i].n.toLowerCase(),b=W[j].n.toLowerCase();
        if(a.length>7&&b.length>7&&(a.includes(b.substring(0,8))||b.includes(a.substring(0,8)))){
          var fk="fuzzy_"+[W[i].id,W[j].id].sort().join("_");
          if(!groups[fk])groups[fk]=[W[i],W[j]];
        }
      }
    }
    /* Filter to groups with 2+ items, dedup */
    var allGroups=Object.values(groups).filter(function(g){return g.length>=2});
    var seen={};var unique=[];
    allGroups.forEach(function(g){
      var ids=g.map(function(w){return w.id}).sort().join(",");
      if(!seen[ids]){seen[ids]=true;unique.push(g)}
    });
    return unique;
  },[W]);

  /* ═══ PAYLOAD HELPERS for cloud sync ═══ */
  const _buildPayload=useCallback(function(){
    return{watches:W,wardrobe:wd,outfits:saved,wearLog:wearLog,weekCtx:weekCtx,userCx:userCx,rotLock:rotLock,selfieHistory:selfieHistory,theme:theme,strapLog:strapLog,_weekCtxUpdated:Date.now(),_userCxUpdated:Date.now(),_rotLockUpdated:Date.now(),_themeUpdated:Date.now(),_version:(Date.now())}
  },[W,wd,saved,wearLog,weekCtx,userCx,rotLock,selfieHistory,theme,strapLog]);

  const _applyPayload=useCallback(function(payload){
    if(!payload)return;
    try{
      if(payload.watches&&Array.isArray(payload.watches)){var mw=payload.watches.filter(function(w){return w&&w.id&&w.n}).map(migrateStraps);if(mw.length){setW(mw);ps("w_"+SK,mw)}}
      if(payload.wardrobe&&Array.isArray(payload.wardrobe)){var vwd=payload.wardrobe.filter(function(i){return i&&i.id});if(vwd.length){setWd(vwd);ps("wd_"+SK,vwd)}}
      if(payload.outfits&&Array.isArray(payload.outfits)){setSaved(payload.outfits);ps("of_"+SK,payload.outfits)}
      if(payload.wearLog&&Array.isArray(payload.wearLog)){var vwl=payload.wearLog.filter(function(e2){return e2&&e2.date&&e2.watchId});setWearLog(vwl);ps("wa_wearlog_"+SK,vwl)}
      if(payload.weekCtx&&Array.isArray(payload.weekCtx)&&payload.weekCtx.length===7){setWeekCtx(payload.weekCtx);ps("wa_weekctx",payload.weekCtx)}
      if(payload.userCx&&Array.isArray(payload.userCx)){setUserCx(payload.userCx);ps("wa_usercx_"+SK,payload.userCx)}
      if(payload.rotLock&&Array.isArray(payload.rotLock)){setRotLock(payload.rotLock);ps("wa_rotlock_"+SK,payload.rotLock)}
      if(payload.selfieHistory&&Array.isArray(payload.selfieHistory)){setSelfieHistory(payload.selfieHistory);ps("wa_selfie_"+SK,payload.selfieHistory)}
      if(payload.strapLog&&Array.isArray(payload.strapLog)){setStrapLog(payload.strapLog);ps("wa_strap_log",payload.strapLog)}
      if(payload.theme){setTheme(payload.theme);ps("wa_theme",payload.theme)}
    }catch(e){console.warn("[CloudSync] apply payload error:",e)}
  },[ps]);

  /* ═══ AUTO-SYNC: schedule push on every local state change ═══ */
  useEffect(function(){
    if(!cloudUser)return;
    sbSchedulePush(function(){return{watches:W,wardrobe:wd,outfits:saved,wearLog:wearLog,weekCtx:weekCtx,userCx:userCx,rotLock:rotLock,selfieHistory:selfieHistory,theme:theme,strapLog:strapLog,_weekCtxUpdated:Date.now(),_userCxUpdated:Date.now(),_rotLockUpdated:Date.now(),_themeUpdated:Date.now(),_version:Date.now()}});
  },[W,wd,saved,wearLog,weekCtx,userCx,rotLock,selfieHistory,theme,strapLog,cloudUser]);

  const saveAll=useCallback(async function(){
    try{
      await ps("w_"+SK,W);await ps("wd_"+SK,wd);await ps("of_"+SK,saved);
      await ps("wa_wearlog_"+SK,wearLog);await ps("wa_weekctx",weekCtx);
      if(userCx)await ps("wa_usercx_"+SK,userCx);
      await ps("wa_theme",theme);
      await ps("wa_selfie_"+SK,selfieHistory);
      await ps("wa_rotlock_"+SK,rotLock);
      await ps("wa_strap_log",strapLog);
      setShowSaveToast(true);
      setTimeout(function(){setShowSaveToast(false)},2000);
    }catch(e){console.error("Save failed:",e);showToast("Save failed: "+String(e.message||e),"var(--warn)",4000)}
  },[W,wd,saved,wearLog,weekCtx,userCx,theme,selfieHistory,rotLock,strapLog,ps]);

  const openLightbox=useCallback(function(src,itemId){
    if(!src)return;
    setLightboxSrc(src);
    var items=wd.filter(function(i){return ph(i.photoUrl)===src||i.photoUrl===src});
    setLightboxItems(items.length>1?items:itemId?wd.filter(function(i){return i.id===itemId}):[]);
  },[wd]);

  const updateW=useCallback(function(id,u){clearCompatCache();setW(function(p){var n=p.map(function(w){return w.id===id?Object.assign({},w,u):w});ps("w_"+SK,n);return n})},[ps]);
  const toggleW=useCallback(function(id){setW(function(p){var n=p.map(function(w){return w.id===id?Object.assign({},w,{active:!w.active}):w});ps("w_"+SK,n);return n})},[ps]);
  const removeW=useCallback(function(id){setW(function(p){var del=p.find(function(w){return w.id===id});if(del){revokePhoto(del.photoUrl);if(del.straps)del.straps.forEach(function(s){revokePhoto(s.photoUrl)})}var n=p.filter(function(w){return w.id!==id});ps("w_"+SK,n);return n})},[ps]);

  const saveWd=useCallback(function(n){clearCompatCache();setWd(n);ps("wd_"+SK,n)},[ps]);
  const rmG=useCallback(function(id){clearCompatCache();setWd(function(p){var del=p.find(function(i){return i.id===id});if(del){revokePhoto(del.photoUrl);if(del.straps)del.straps.forEach(function(s){revokePhoto(s.photoUrl)})}var n=p.filter(function(i){return i.id!==id});ps("wd_"+SK,n);return n})},[ps]);
  const updG=useCallback(function(id,u){clearCompatCache();setWd(function(p){var n=p.map(function(i){return i.id===id?Object.assign({},i,u,{needsEdit:false}):i});ps("wd_"+SK,n);return n})},[ps]);
  const addGarment=useCallback(function(item){clearCompatCache();setWd(function(p){var n=p.concat([item]);ps("wd_"+SK,n);return n})},[ps]);

  const logWear=useCallback(function(watchId,dateStr){
    setWearLog(function(p){
      /* Remove existing entry for same date, then add new */
      var n=p.filter(function(e){return e.date!==dateStr}).concat([{date:dateStr,watchId:watchId,ts:Date.now()}]);
      /* Keep last 365 days for seasonal analysis */
      var cutoff=Date.now()-365*24*60*60*1000;
      n=n.filter(function(e){return e.ts>cutoff});
      ps("wa_wearlog_"+SK,n);return n;
    });
  },[ps]);
  const logStrapWear=useCallback(function(watchId,strap,ctxStr,weatherKey){
    if(!strap)return;
    var sig=strapSig(watchId,strap);
    setStrapLog(function(p){
      var entry={ts:Date.now(),watchId:watchId,strapIdOrSig:sig,ctx:ctxStr||"smart-casual",weatherKey:weatherKey||"normal"};
      var n=p.concat([entry]);
      if(n.length>200)n=n.slice(n.length-200);
      ps("wa_strap_log",n);return n;
    });
  },[ps]);
  const undoWear=useCallback(function(dateStr){
    setWearLog(function(p){var n=p.filter(function(e){return e.date!==dateStr});ps("wa_wearlog_"+SK,n);return n});
  },[ps]);
  const daysSince=useCallback(function(watchId){
    var now=Date.now();var last=null;
    for(var e of wearLog){if(e.watchId===watchId&&(!last||e.ts>last))last=e.ts}
    if(!last)return 999;
    return Math.floor((now-last)/(24*60*60*1000));
  },[wearLog]);
  const todayStr=new Date().toISOString().slice(0,10);
  const todayWorn=wearLog.find(function(e){return e.date===todayStr});

  const _processingRef=useRef(false);
  const processFiles=useCallback(async function(files){
    if(_processingRef.current){setAiErr("Already processing files, please wait...");return}
    _processingRef.current=true;
    var arr=Array.from(files);var pids=arr.map(function(_,i){return Date.now()+i});
    setProc(function(p){return p.concat(pids)});
    try{
    for(var i=0;i<arr.length;i++){
      var f=arr[i],pid=pids[i];
      try{
        var rawUrl=await new Promise(function(r,j){var x=new FileReader();x.onload=function(){r(x.result)};x.onerror=j;x.readAsDataURL(f)});
        /* High-res for storage display, moderate for AI API submission */
        var compressed=await compressImage(rawUrl,800,0.7);
        var thumb=await compressImage(rawUrl,1200,0.82);
        /* Cloud: upload original quality in background */
        cloudUploadPhoto("wd_"+pid,f);
        var parts=compressed.split(",");var b64=parts.length>1?parts[1]:compressed;
        var aiResult=await aiID(b64,"image/jpeg",apiKeyRef.current);
        if(aiResult&&Array.isArray(aiResult)&&aiResult.length>0){
          var _dh=await computeDHash(thumb);var newItems=aiResult.map(function(ai,idx){var sd=smartDefaults(ai);return Object.assign({},sd,ai,{photoUrl:thumb,dHash:_dh,id:pid+idx,ts:Date.now(),positionHint:aiResult.length>1?(ai.position||null):null,material:ai.material||null})});
          setWd(function(p){var n=p.concat(newItems);ps("wd_"+SK,n);return n});
          /* Color sampling fallback for low-confidence AI colors */
          try{var _cs=await sampleDominantColor(thumb,CM);
          if(_cs){newItems.forEach(function(ni){
            var aiConf=ni.colorConfidence||0.5;
            if(aiConf<0.6&&_cs.confidence>0.5){ni.color=_cs.color;ni.colorSource="sampled"}
            else if(aiConf<0.4){ni.color=_cs.color;ni.colorSource="sampled"}
            if(ni.colorAlternatives)delete ni.colorAlternatives;
          })}}catch(e){console.warn("[ColorSample]",e)}
          /* Check for visual duplicates via dHash */
          if(_dh){if(typeof console!=="undefined"){var _dists=wd.filter(function(e){return e.dHash}).map(function(e){return{name:e.name||e.color,dist:hammingDist(e.dHash,_dh)}}).sort(function(a,b){return a.dist-b.dist}).slice(0,5);console.log("[dHash] Nearest:",JSON.stringify(_dists))}var _dupeMatch=wd.find(function(existing){return existing.dHash&&hammingDist(existing.dHash,_dh)<=10});if(_dupeMatch){setAiErr("⚠️ Possible duplicate of \""+(_dupeMatch.name||_dupeMatch.color)+"\". Items added — review in Duplicates.")}}
          if(aiResult.length>1)setAiErr("📸 Found "+aiResult.length+" items in photo");
        }else{
          var item={garmentType:"Shirt",name:"",color:"",pattern:"solid",photoUrl:thumb,id:pid,needsEdit:true,ts:Date.now(),aiError:getLastAiError()};
          setWd(function(p){var n=p.concat([item]);ps("wd_"+SK,n);return n});
          setAiErr(getLastAiError());
        }
      }catch(e){
        try{var thumb2=await compressImage(await new Promise(function(r){var x=new FileReader();x.onload=function(){r(x.result)};x.readAsDataURL(f)}),1200,0.82);
        setWd(function(p){var n=p.concat([{garmentType:"Shirt",name:"",color:"",pattern:"solid",photoUrl:thumb2,id:pid,needsEdit:true,ts:Date.now(),aiError:"FileReader: "+String(e)}]);ps("wd_"+SK,n);return n})}catch(e2){console.warn("[WA]",e2)}
        setAiErr("File error: "+String(e));
      }
      setProc(function(p){return p.filter(function(x){return x!==pid})});
      // Delay between items to avoid rate limit
      if(i<arr.length-1)await new Promise(function(r){setTimeout(r,600)});
    }
    }finally{_processingRef.current=false}
  },[ps]);

  const scanWatch=useCallback(async function(files){
    var arr=Array.isArray(files)?files:files instanceof FileList?Array.from(files):files?[files]:[];
    if(!arr.length)return;
    if(arr.length>10){showToast("Max 10 images at once (selected "+arr.length+")","var(--warn)",3000);arr=arr.slice(0,10)}
    scanCancelRef.current=false;
    setWatchScanLoading(true);setWatchScanResult(null);setScanProg(arr.length>1?{c:0,t:arr.length}:null);
    var scannedWatches=[];var errs=[];
    try{
      for(var fi=0;fi<arr.length;fi++){
        try{
          var rawUrl=await new Promise(function(r,j){var x=new FileReader();x.onload=function(){r(x.result)};x.onerror=function(){j(x.error||new Error("Read failed"))};x.readAsDataURL(arr[fi])});
          var compressed=await compressImage(rawUrl,600,0.6);
          var thumb=await compressImage(rawUrl,400,0.5);
          /* Cloud: upload original quality in background */
          cloudUploadPhoto("w_scan_"+Date.now()+"_"+fi,arr[fi]);
          var _cp=compressed.split(",");var b64=_cp.length>1?_cp[1]:compressed;
          var result=await aiWatchID(b64,"image/jpeg",apiKeyRef.current);
          if(result&&result.brand){
            var id=(crypto&&crypto.randomUUID)?crypto.randomUUID():("scan-"+Date.now()+"-"+fi);
            var dialInfo=inferDial(result.brand+" "+result.model,result.dial_color||"");
            var mc=autoMatchColors(result.dial_color||dialInfo.color);
            var straps=[];
            if(result.has_bracelet||result.strap_type==="bracelet"){straps.push({type:"bracelet",color:"silver",material:result.case_material||"steel"})}
            if(result.strap_type&&result.strap_type!=="bracelet"){straps.push({type:result.strap_type==="nato"?"nato":result.strap_type==="rubber"?"rubber":result.strap_type==="canvas"?"canvas":"leather",color:result.strap_color||"black",material:result.strap_type||"calf leather"})}
            if(!straps.length)straps.push({type:"bracelet",color:"silver",material:"steel"});
            var nw={id:id,n:(result.brand||"")+" "+(result.model||""),t:"genuine",d:result.dial_color||dialInfo.color||"",c:result.dial_hex||dialInfo.hex||"#5a5a5a",straps:straps,br:straps.some(function(s){return s.type==="bracelet"}),sc:straps.filter(function(s){return s.type!=="bracelet"}).map(function(s){return s.color}),mt:result.temperature||"neutral",i:result.emoji||dialInfo.emoji||"⌚",mc:mc,ac:[],cx:result.suggested_contexts||inferContexts(result.brand+" "+result.model,""),wt:["light","mid","heavy"],sg:result.notes||"",active:true,status:"active",photoUrl:thumb,size:result.case_size?result.case_size+"mm":null,ref:result.reference||null,scanData:result};
            scannedWatches.push({watch:nw,ai:result});
          }else{errs.push({fi:fi,error:getLastAiError()||"Could not identify watch"})}
        }catch(e){errs.push({fi:fi,error:"Error: "+String((e&&e.message)||e)})}
        if(arr.length>1)setScanProg({c:fi+1,t:arr.length});
        if(fi<arr.length-1){if(scanCancelRef.current)break;await new Promise(function(r){setTimeout(r,600)})}
      }
      if(arr.length===1){
        if(scannedWatches.length){setWatchScanResult(scannedWatches[0])}
        else{var msg=(errs[0]&&errs[0].error)||getLastAiError()||"Could not identify watch";setWatchScanResult({error:msg});setAiErr(msg)}
      }else{
        if(scannedWatches.length){
          var newW=scannedWatches.map(function(s){return s.watch});
          setW(function(p){var u=p.concat(newW);ps("w_"+SK,u);return u});
          setWatchScanResult({batch:true,count:scannedWatches.length,watches:scannedWatches,failed:errs});
          showToast("✅ Added "+scannedWatches.length+" watches","var(--good)",3000);haptic(30);
        }else{
          var msg2=getLastAiError()||"No watches identified in "+arr.length+" images";
          setWatchScanResult({batch:true,error:msg2,failed:errs});setAiErr(msg2);
        }
      }
    }finally{setWatchScanLoading(false);setScanProg(null)}
  },[ps]);

  const checkSelfie=useCallback(async function(file){
    setSelfieLoading(true);setSelfieResult(null);
    try{
      var rawUrl=await new Promise(function(r,j){var x=new FileReader();x.onload=function(){r(x.result)};x.onerror=j;x.readAsDataURL(file)});
      var compressed=await compressImage(rawUrl,800,0.7);
      var thumb=await compressImage(rawUrl,600,0.7);
      var _sp=compressed.split(",");var b64=_sp.length>1?_sp[1]:compressed;
      var result=await aiSelfieCheck(b64,"image/jpeg",apiKeyRef.current,W,null,effectiveCtx);
      if(result&&result.impact){
        var entry={id:Date.now(),ts:Date.now(),thumb:thumb,result:result,impact:result.impact};
        setSelfieResult(entry);
        setSelfieHistory(function(p){var n=[entry].concat(p).slice(0,20);ps("wa_selfie_"+SK,n);return n});
      }else{
        setSelfieResult({error:getLastAiError()||"Could not analyze photo"});
        setAiErr(getLastAiError()||"Selfie analysis failed");
      }
    }catch(e){
      setSelfieResult({error:"Error: "+String(e.message||e)});
      setAiErr("Selfie error: "+String(e));
    }
    setSelfieLoading(false);
  },[ps,W,effectiveCtx]);

  const delSelfie=useCallback(function(id){
    setSelfieHistory(function(p){var n=p.filter(function(e){return e.id!==id});ps("wa_selfie_"+SK,n);return n});
  },[ps]);

  const saveFit=useCallback(function(fit){var wxSnap=planTemp&&planWx?{temp:planTemp.temp,cond:planWx.cond,rain:planWx.rain}:null;var o={id:Date.now(),name:(function(){var _ly=fit.layers&&fit.layers.length>1?fit.layers:[fit.top].filter(Boolean);var _tn=_ly.map(function(t){return t.name||t.color}).join(" → ");return(_tn||"?")+" + "+(fit.bot?fit.bot.name||fit.bot.color:"?")}()),items:fit.items,context:Array.isArray(effectiveCtx)?effectiveCtx.slice():effectiveCtx,watches:fit.watches,fs:fit.fs,ts:Date.now(),weather:wxSnap};setSaved(function(p){var n=p.concat([o]);ps("of_"+SK,n);return n});/* Auto-update lastWorn on garments */var todayISO=new Date().toISOString().slice(0,10);var itemIds=new Set((fit.items||[]).map(function(it){return it.id}));setWd(function(prev){var changed=false;var nw=prev.map(function(g){if(itemIds.has(g.id)){changed=true;return Object.assign({},g,{lastWorn:todayISO})}return g});if(changed)ps("wd_"+SK,nw);return changed?nw:prev})},[effectiveCtx,ps,planTemp,planWx]);
  const delSaved=useCallback(function(id){
    /* Soft delete: remove from UI immediately, but hold the outfit for 5s undo window */
    var deleted=null;
    setSaved(function(p){deleted=p.find(function(o){return o.id===id});var n=p.filter(function(o){return o.id!==id});ps("of_"+SK,n);return n});
    /* Cancel any existing undo timer */
    if(undoTimerRef.current){clearTimeout(undoTimerRef.current);undoTimerRef.current=null}
    /* Show undo toast with the deleted outfit */
    setUndoDelete({outfit:deleted,id:id});
    undoTimerRef.current=setTimeout(function(){setUndoDelete(null);undoTimerRef.current=null},5000);
  },[ps]);
  const undoDeleteFn=useCallback(function(){
    if(!undoDelete||!undoDelete.outfit)return;
    if(undoTimerRef.current){clearTimeout(undoTimerRef.current);undoTimerRef.current=null}
    var restored=undoDelete.outfit;
    setSaved(function(p){var n=p.concat([restored]);ps("of_"+SK,n);return n});
    setUndoDelete(null);
  },[undoDelete,ps]);

  const setOutfitWear=useCallback(function(id,dateStr){
    setSaved(function(p){
      var n=p.map(function(o){
        if(o.id!==id)return o;
        var u=Object.assign({},o);
        if(dateStr){u.wearDate=dateStr}else{delete u.wearDate}
        return u;
      });
      ps("of_"+SK,n);
      /* If wearing today, also log watch to wearLog */
      var todayISO=new Date().toISOString().slice(0,10);
      if(dateStr===todayISO){
        var outfit=p.find(function(o){return o.id===id});
        if(outfit&&outfit.watches&&outfit.watches.length){
          var wId=outfit.watches[0].id;
          var _ow=outfit.watches[0];
          if(wId){setWearLog(function(prev){
            var already=prev.find(function(e){return e.date===todayISO&&e.watchId===wId});
            if(already)return prev;
            var entry={watchId:wId,date:todayISO,ts:Date.now(),outfitId:id};
            var next=prev.concat([entry]);
            ps("wa_wearlog_"+SK,next);
            return next;
          })}
          /* Log strap wear */
          if(_ow&&_ow.sr&&_ow.sr.strap)logStrapWear(wId,_ow.sr.strap,primaryCtx,getWeatherKey(weather));
          else{var _fw=W.find(function(x){return x.id===wId});if(_fw&&_fw.straps&&_fw.straps.length===1)logStrapWear(wId,_fw.straps[0],primaryCtx,getWeatherKey(weather))}
        }
      }
      return n;
    });
    setWearPicker(null);
  },[ps,logStrapWear,primaryCtx,weather,W]);

  /* ═══ Per-piece swap helpers ═══ */
  const getEP=useCallback(function(di,slot,orig){if(!orig&&!pieceSwap[di+"-"+slot])return null;var k=di+"-"+slot;return pieceSwap[k]||orig},[pieceSwap]);
  const slotAlts=useCallback(function(slot){
    var cat=slot==="top"?"tops":slot==="bot"?"bottoms":"shoes";
    return wd.filter(function(it){return catOf(it.garmentType)===cat});
  },[wd]);
  const slotColors=useCallback(function(slot){
    var items=slotAlts(slot);
    var seen={};items.forEach(function(it){if(it.color)seen[it.color]=1});
    return Object.keys(seen).sort();
  },[slotAlts]);
  const slotPatterns=useCallback(function(slot){
    var items=slotAlts(slot);
    var seen={};items.forEach(function(it){if(it.pattern&&it.pattern!=="solid")seen[it.pattern]=1});
    return Object.keys(seen).sort();
  },[slotAlts]);
  const filteredAlts=useCallback(function(slot,curId){
    var items=slotAlts(slot).filter(function(a){return a.id!==curId});
    if(!pieceFilter)return items;
    if(pieceFilter.startsWith("p:"))return items.filter(function(a){return a.pattern===pieceFilter.slice(2)});
    return items.filter(function(a){return a.color===pieceFilter});
  },[slotAlts,pieceFilter]);

  const CTXS=useMemo(function(){return activeCx.slice(0,8).map(function(c){return{id:c.id,l:c.icon+" "+c.l}})},[activeCx]);
  const filtW=useMemo(function(){var base=wTab==="all"?W:wTab==="genuine"?W.filter(function(w){return w.t==="genuine"}):wTab==="replica"?W.filter(function(w){return w.t==="replica"}):W.filter(function(w){return w.status===wTab});if(!wSearch.trim())return base;var q=wSearch.trim().toLowerCase();return base.filter(function(w){return(w.n||"").toLowerCase().includes(q)||(w.d||"").toLowerCase().includes(q)||(w.ref||"").toLowerCase().includes(q)||(w.movement||"").toLowerCase().includes(q)})},[W,wTab,wSearch]);

  /* ═══ GARMENT EDIT (rendered in modal) ═══ */
  function renderGarmentEdit(item){
    var GE=function(){
      const[f,setF]=useState(Object.assign({},item));
      const[retrying,setRetrying]=useState(false);
      /* Track whether user has manually edited the name */
      const userEditedName=useRef(false);
      var set=function(k,v){setF(function(p){
        var o={};o[k]=v;var next=Object.assign({},p,o);
        /* Auto-rename when color, material, or garmentType changes — only if name looks auto-generated */
        if((k==="color"||k==="material"||k==="garmentType")&&!userEditedName.current){
          if(isAutoName(p.name,p.color,p.material,p.garmentType)){
            next.name=buildGarmentName(next.color,next.material,next.garmentType);
          }
        }
        if(k==="name")userEditedName.current=true;
        return next;
      })};
      var retry=async function(){
        if(!item.photoUrl)return;setRetrying(true);
        try{var _raw=item.photoUrl.startsWith("idb:")?await photoAsDataUrl(item.photoUrl):item.photoUrl;if(!_raw){setRetrying(false);return}var compressed=await compressImage(_raw,800,0.7);var b64=compressed.split(",")[1];
          var aiResult=await aiID(b64,"image/jpeg",apiKeyRef.current);
          if(aiResult&&aiResult.length){var first=aiResult[0];setF(function(p){return Object.assign({},p,first)})}
          else showToast(getLastAiError()||"AI couldn't identify. Classify manually.","var(--warn)",3500)}catch(e){showToast("Retry error: "+e,"var(--warn)",3000)}
        setRetrying(false);
      };
      return React.createElement(Modal,{onClose:function(){setEditG(null)}},
        React.createElement("div",{style:{display:"flex",gap:14,marginBottom:16}},
          f.photoUrl&&React.createElement("img",{src:ph(f.photoUrl),alt:"",decoding:"async",onClick:function(){openLightbox(f.photoUrl,item.id)},style:{width:80,height:80,objectFit:"cover",borderRadius:12,flexShrink:0,cursor:"zoom-in"}}),
          React.createElement("div",{style:{flex:1}},
            React.createElement("label",{className:"lbl"},"Name"),
            React.createElement("input",{className:"inp",value:f.name||"",onChange:function(e){set("name",e.target.value)},placeholder:"e.g. Navy plaid flannel"}))),
        React.createElement("label",{className:"lbl"},"Garment Type"),
        React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}},
          ALL_T.map(function(t){return React.createElement("span",{key:t,className:"chip "+(f.garmentType===t?"on":""),onClick:function(){set("garmentType",t)}},t)}),
          f.garmentType&&!ALL_T.includes(f.garmentType)&&React.createElement("span",{className:"chip on",style:{borderColor:"var(--gold)"}},f.garmentType)),
        React.createElement("div",{style:{display:"flex",gap:6,alignItems:"center",marginBottom:14}},
          React.createElement("input",{className:"inp",value:ALL_T.includes(f.garmentType)?"":(f.garmentType||""),onChange:function(e){set("garmentType",e.target.value)},placeholder:"Custom type (e.g. Henley, Bomber...)",style:{fontSize:10,padding:"6px 8px",marginBottom:0,flex:1}})),
        React.createElement("label",{className:"lbl"},"Color"),
        React.createElement("div",{style:{marginBottom:14}},
          f.color&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:8}},React.createElement(Dot,{color:f.color,size:14}),React.createElement("span",{style:{fontSize:14,fontFamily:"var(--f)",fontWeight:500}},f.color)),
          React.createElement(ColorGrid,{value:f.color,onChange:function(v){set("color",v)}})),
        React.createElement("label",{className:"lbl"},"Pattern"),
        React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}},
          PATTERNS.map(function(p){return React.createElement("span",{key:p,className:"chip "+(f.pattern===p?"on":""),onClick:function(){set("pattern",p)}},p)})),
        React.createElement("label",{className:"lbl"},"Material"),
        React.createElement("div",{style:{display:"flex",gap:5,flexWrap:"wrap",marginBottom:14}},
          MATERIALS.map(function(m){return React.createElement("span",{key:m,className:"chip "+(f.material===m?"on":""),onClick:function(){set("material",f.material===m?null:m)},style:{padding:"4px 10px",fontSize:10}},m)})),
        React.createElement("label",{className:"lbl"},"Seasons"),
        React.createElement("div",{style:{display:"flex",gap:6,marginBottom:16}},
          ["spring","summer","fall","winter"].map(function(s){var icons={spring:"🌸",summer:"☀️",fall:"🍂",winter:"❄️"};var arr=f.seasons||[];var on=arr.includes(s);return React.createElement("span",{key:s,className:"chip "+(on?"on":""),onClick:function(){set("seasons",on?arr.filter(function(x){return x!==s}):arr.concat([s]))},style:{flex:1,justifyContent:"center",padding:"6px 4px",fontSize:10}},icons[s]+" "+s)})),
        /* Archive toggle */
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"8px 12px",background:f.archived?"rgba(200,90,58,0.08)":"var(--bg)",borderRadius:8,border:"1px solid "+(f.archived?"rgba(200,90,58,0.2)":"var(--border)")}},
          React.createElement("span",{style:{fontSize:14}},f.archived?"❄️":"👁️"),
          React.createElement("span",{style:{flex:1,fontSize:11,fontFamily:"var(--f)",color:f.archived?"var(--warn)":"var(--sub)"}},f.archived?"Archived — hidden from scoring & grid":"Active in rotation"),
          React.createElement("button",{onClick:function(){set("archived",!f.archived)},style:{background:f.archived?"rgba(122,184,122,0.12)":"rgba(200,90,58,0.08)",border:"1px solid "+(f.archived?"rgba(122,184,122,0.25)":"rgba(200,90,58,0.2)"),borderRadius:6,padding:"5px 12px",cursor:"pointer",color:f.archived?"var(--good)":"var(--warn)",fontFamily:"var(--f)",fontSize:9,fontWeight:600,minHeight:26}},f.archived?"Activate":"Archive")),
        React.createElement("label",{className:"lbl"},"Last Worn"),
        React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center",marginBottom:14}},
          React.createElement("input",{className:"inp",type:"date",value:f.lastWorn||"",onChange:function(e){set("lastWorn",e.target.value)},style:{marginBottom:0,maxWidth:180,fontSize:11,flex:1}}),
          React.createElement("button",{onClick:function(){set("lastWorn",new Date().toISOString().slice(0,10))},style:{background:"none",border:"1px solid rgba(122,184,122,0.3)",borderRadius:6,padding:"6px 10px",cursor:"pointer",color:"var(--good)",fontFamily:"var(--f)",fontSize:9,minHeight:28,whiteSpace:"nowrap"}},"👕 Today"),
          f.lastWorn&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:(function(){var d=Math.floor((Date.now()-new Date(f.lastWorn).getTime())/864e5);return d<=2?"var(--warn)":d<=7?"var(--gold)":"var(--good)"})()}},(function(){var d=Math.floor((Date.now()-new Date(f.lastWorn).getTime())/864e5);return d===0?"today":d===1?"yesterday":d+"d ago"})())),
        item.ts&&React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",marginBottom:8,display:"flex",gap:12,flexWrap:"wrap"}},
          React.createElement("span",null,"Added: "+new Date(item.ts).toLocaleDateString()),
          f.lastWorn&&React.createElement("span",null,"Last worn: "+new Date(f.lastWorn).toLocaleDateString()),
          saved.some(function(o){return(o.items||[]).some(function(it){return it.id===item.id})})&&React.createElement("span",{style:{color:"var(--good)"}},"✓ Used in "+saved.filter(function(o){return(o.items||[]).some(function(it){return it.id===item.id})}).length+" saved outfit(s)")),
        React.createElement("div",{style:{display:"flex",gap:8}},
          React.createElement("button",{className:"btn btn-gold",style:{flex:1},onClick:function(){if(!f.color){showToast("Pick a color first","var(--warn)");return}updG(item.id,f);setEditG(null);haptic(15)}},"✓ Save"),
          f.color&&React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"14px 16px"},onClick:function(){if(!f.color){showToast("Pick a color first","var(--warn)");return}updG(item.id,f);setLockItem(Object.assign({},item,f));setEditG(null);navTo("fits",null);setMode("auto")},title:"Lock for fits"},"🔒"),
          item.photoUrl&&React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"14px 16px"},onClick:retry,disabled:retrying},retrying?"⏳":"🔄"),
          React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"14px 16px"},onClick:function(){var dup=Object.assign({},f,{id:Date.now(),ts:Date.now(),name:(f.name||"")+" copy"});addGarment(dup);setEditG(null)},title:"Duplicate"},"📋"),
          React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"14px 16px"},onClick:function(){var deleted=wd.find(function(x){return x.id===item.id});rmG(item.id);setEditG(null);haptic(15);showToast("🗑️ Deleted "+(deleted?deleted.name||deleted.color:"item"),"var(--warn)",5000,function(){if(deleted){setWd(function(p){var n=[deleted].concat(p);ps("wd_"+SK,n);return n})}})}},"🗑️")));
    };
    return React.createElement(GE,{key:item.id});
  }

  /* ═══ QUICK ADD ═══ */
  function renderQuickAdd(){
    var QA=function(){
      const[f,setF]=useState({garmentType:"Shirt",name:"",color:"",pattern:"solid"});
      var set=function(k,v){setF(function(p){var o={};o[k]=v;return Object.assign({},p,o)})};
      return React.createElement(Modal,{onClose:function(){setAddG(false)}},
        React.createElement("h2",{style:{fontSize:18,fontWeight:600,marginBottom:14}},"Quick Add"),
        React.createElement("label",{className:"lbl"},"Name"),
        React.createElement("input",{className:"inp",value:f.name,onChange:function(e){set("name",e.target.value)},placeholder:"e.g. Navy chinos",style:{marginBottom:12}}),
        React.createElement("label",{className:"lbl"},"Type"),
        React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}},
          ALL_T.map(function(t){return React.createElement("span",{key:t,className:"chip "+(f.garmentType===t?"on":""),onClick:function(){set("garmentType",t)}},t)}),
          f.garmentType&&!ALL_T.includes(f.garmentType)&&React.createElement("span",{className:"chip on",style:{borderColor:"var(--gold)"}},f.garmentType)),
        React.createElement("div",{style:{display:"flex",gap:6,alignItems:"center",marginBottom:14}},
          React.createElement("input",{className:"inp",value:ALL_T.includes(f.garmentType)?"":(f.garmentType||""),onChange:function(e){set("garmentType",e.target.value)},placeholder:"Custom type (e.g. Bomber, Parka...)",style:{fontSize:10,padding:"6px 8px",marginBottom:0,flex:1}})),
        React.createElement("label",{className:"lbl"},"Color"),
        React.createElement("div",{style:{marginBottom:14}},React.createElement(ColorGrid,{value:f.color,onChange:function(v){set("color",v)}})),
        React.createElement("label",{className:"lbl"},"Pattern"),
        React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}},
          PATTERNS.map(function(p){return React.createElement("span",{key:p,className:"chip "+(f.pattern===p?"on":""),onClick:function(){set("pattern",p)}},p)})),
        React.createElement("label",{className:"lbl"},"Material"),
        React.createElement("div",{style:{display:"flex",gap:5,flexWrap:"wrap",marginBottom:16}},
          MATERIALS.map(function(m){return React.createElement("span",{key:m,className:"chip "+(f.material===m?"on":""),onClick:function(){setF(function(p){return Object.assign({},p,{material:p.material===m?null:m})})},style:{padding:"4px 10px",fontSize:10}},m)})),
        React.createElement("button",{className:"btn btn-gold",onClick:function(){if(!f.color||!f.name){showToast("Need name + color","var(--warn)");return}var sd=smartDefaults(f);addGarment(Object.assign({},sd,f,{id:Date.now(),ts:Date.now()}));setAddG(false)}},
          "+ Add to Wardrobe"));
    };
    return React.createElement(QA,null);
  }

  /* ═══ WATCH EDIT ═══ */
  function renderWatchEdit(w){
    var WE=function(){
      const[f,setF]=useState(Object.assign({},migrateStraps(w)));
      var set=function(k,v){setF(function(p){var o={};o[k]=v;return Object.assign({},p,o)})};
      var togArr=function(k,v){setF(function(p){var arr=p[k]||[];var o={};o[k]=arr.includes(v)?arr.filter(function(x){return x!==v}):arr.concat([v]);return Object.assign({},p,o)})};
      const[addSt,setAddSt]=useState(false);
      const[nSt,setNSt]=useState({type:"leather",color:"",material:"calf leather",photoUrl:null});
      var setNStF=function(k,v){setNSt(function(p){var o=Object.assign({},p);o[k]=v;if(k==="type"){var td=STRAP_TYPES.find(function(t){return t.id===v});o.material=td&&td.mats[0]?td.mats[0]:"";o.color=v==="bracelet"?"silver":""}return o})};
      var addStrap=function(){if(!nSt.type)return;var s={type:nSt.type,color:nSt.color||"",material:nSt.material||""};if(nSt.photoUrl)s.photoUrl=nSt.photoUrl;setF(function(p){var ns=(p.straps||[]).concat([s]);return Object.assign({},p,{straps:ns,br:ns.some(function(x){return x.type==="bracelet"}),sc:ns.filter(function(x){return x.type!=="bracelet"}).map(function(x){return x.color})})});setAddSt(false);setNSt({type:"leather",color:"",material:"calf leather",photoUrl:null})};
      var rmStrap=function(si){setF(function(p){var ns=(p.straps||[]).filter(function(_,i){return i!==si});return Object.assign({},p,{straps:ns,br:ns.some(function(x){return x.type==="bracelet"}),sc:ns.filter(function(x){return x.type!=="bracelet"}).map(function(x){return x.color})})})};
      var handleWPhoto=async function(){var inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=async function(e){var fl=e.target.files[0];if(!fl)return;var raw=await new Promise(function(r){var x=new FileReader();x.onload=function(){r(x.result)};x.readAsDataURL(fl)});var compressed=await compressImage(raw,800,0.8);set("photoUrl",compressed);cloudUploadPhoto("w_"+w.id,fl)};inp.click()};
      return React.createElement(Modal,{onClose:function(){setEditW(null)}},
        React.createElement("div",{style:{display:"flex",gap:12,alignItems:"center",marginBottom:14}},
          React.createElement("div",{onClick:handleWPhoto,style:{width:52,height:52,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",flexShrink:0,border:"2px solid "+(f.photoUrl?"var(--gold)":"var(--border)"),background:f.photoUrl?"none":f.c+"20"}},
            ph(f.photoUrl)?React.createElement("img",{src:ph(f.photoUrl),alt:"",decoding:"async",style:{width:"100%",height:"100%",objectFit:"cover"}}):React.createElement("span",{style:{fontSize:28}},f.i)),
          React.createElement("div",{style:{flex:1}},React.createElement("input",{className:"inp",value:f.n,onChange:function(e){set("n",e.target.value)},style:{fontWeight:600,border:"none",padding:0,background:"transparent"}})),
          f.photoUrl&&React.createElement("button",{onClick:function(){revokePhoto(f.photoUrl);set("photoUrl",null)},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:"var(--dim)",fontSize:9,fontFamily:"var(--f)"}},"\u2715")),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}},
          React.createElement("div",null,React.createElement("label",{className:"lbl"},"Dial Color"),React.createElement("input",{className:"inp",value:f.d,onChange:function(e){set("d",e.target.value);if(IS_SHARED){setF(function(p){return Object.assign({},p,{d:e.target.value,mc:autoMatchColors(e.target.value)})})}},style:{marginBottom:4}}),
            React.createElement("div",{style:{display:"flex",gap:3,flexWrap:"wrap"}},["Black","White","Blue","Green","Silver","Grey","Champagne","Ivory"].map(function(dc){return React.createElement("span",{key:dc,onClick:function(){set("d",dc);set("c",(CM[dc.toLowerCase()]||{}).h||"#5a5a5a");if(IS_SHARED){setF(function(p){return Object.assign({},p,{d:dc,c:(CM[dc.toLowerCase()]||{}).h||"#5a5a5a",mc:autoMatchColors(dc)})})}},style:{fontSize:8,fontFamily:"var(--f)",padding:"2px 6px",borderRadius:4,cursor:"pointer",background:f.d===dc?"rgba(201,168,76,0.2)":"var(--bg)",border:"1px solid "+(f.d===dc?"rgba(201,168,76,0.3)":"var(--border)"),color:f.d===dc?"var(--gold)":"var(--dim)"}},dc)}))),
          !IS_SHARED&&React.createElement("div",null,React.createElement("label",{className:"lbl"},"Type"),React.createElement("select",{className:"sel",value:f.t,onChange:function(e){set("t",e.target.value)}},React.createElement("option",{value:"genuine"},"Genuine"),React.createElement("option",{value:"replica"},"Replica"))),
          React.createElement("div",null,React.createElement("label",{className:"lbl"},"Status"),React.createElement("select",{className:"sel",value:f.status,onChange:function(e){set("status",e.target.value)}},STS.map(function(s){return React.createElement("option",{key:s.id,value:s.id},s.l)}))),
          React.createElement("div",null,React.createElement("label",{className:"lbl"},"Case Size"),React.createElement("input",{className:"inp",value:f.size||"",onChange:function(e){set("size",e.target.value)},placeholder:"e.g. 40mm"})),
          !IS_SHARED&&React.createElement("div",null,React.createElement("label",{className:"lbl"},"Temp"),React.createElement("select",{className:"sel",value:f.mt,onChange:function(e){set("mt",e.target.value)}},React.createElement("option",{value:"cool"},"Cool"),React.createElement("option",{value:"warm"},"Warm"),React.createElement("option",{value:"mixed"},"Mixed")))),
        React.createElement("div",{style:{marginBottom:12}},
          React.createElement("label",{className:"lbl"},"Straps & Bracelets"),
          (f.straps||[]).map(function(st,si){
            var stDef=STRAP_TYPES.find(function(t){return t.id===st.type})||STRAP_TYPES[0];
            return React.createElement("div",{key:si,style:{display:"flex",gap:6,alignItems:"center",background:"var(--bg)",borderRadius:8,padding:"8px 10px",marginBottom:4,border:"1px solid var(--border)"}},
              /* Strap photo: thumbnail + camera/gallery */
              React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}},
                React.createElement("div",{onClick:function(){if(st.photoUrl)setLightboxSrc(st.photoUrl)},style:{width:36,height:36,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",cursor:st.photoUrl?"pointer":"default",overflow:"hidden",border:"1px solid "+(st.photoUrl?"var(--gold)":"var(--border)"),background:st.photoUrl?"none":"var(--card2)"}},
                  ph(st.photoUrl)?React.createElement("img",{src:ph(st.photoUrl),alt:"",decoding:"async",style:{width:"100%",height:"100%",objectFit:"cover"}}):React.createElement("span",{style:{fontSize:14,opacity:0.3}},stDef.icon)),
                React.createElement("div",{style:{display:"flex",gap:2}},
                  React.createElement("button",{onClick:function(){var inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.setAttribute("capture","environment");inp.onchange=async function(ev){var fl=ev.target.files[0];if(!fl)return;var raw=await new Promise(function(r){var x=new FileReader();x.onload=function(){r(x.result)};x.readAsDataURL(fl)});var compressed=await compressImage(raw,400,0.7);var ns=(f.straps||[]).slice();ns[si]=Object.assign({},ns[si],{photoUrl:compressed});set("straps",ns)};inp.click()},style:{background:"none",border:"1px solid var(--border)",borderRadius:4,padding:"1px 4px",cursor:"pointer",fontSize:9,color:"var(--dim)",lineHeight:1,minHeight:18}},"\uD83D\uDCF7"),
                  React.createElement("button",{onClick:function(){var inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=async function(ev){var fl=ev.target.files[0];if(!fl)return;var raw=await new Promise(function(r){var x=new FileReader();x.onload=function(){r(x.result)};x.readAsDataURL(fl)});var compressed=await compressImage(raw,400,0.7);var ns=(f.straps||[]).slice();ns[si]=Object.assign({},ns[si],{photoUrl:compressed});set("straps",ns)};inp.click()},style:{background:"none",border:"1px solid var(--border)",borderRadius:4,padding:"1px 4px",cursor:"pointer",fontSize:9,color:"var(--dim)",lineHeight:1,minHeight:18}},"\uD83D\uDDBC\uFE0F"))),
              React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--gold)",minWidth:55,fontWeight:600}},stDef.l),
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},st.material),
              st.type!=="bracelet"&&st.color&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:3}},React.createElement(Dot,{color:st.color,size:6}),React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--text)"}},st.color)),
              st.photoUrl&&React.createElement("button",{onClick:function(e){e.stopPropagation();var ns=(f.straps||[]).slice();ns[si]=Object.assign({},ns[si],{photoUrl:null});set("straps",ns)},style:{background:"none",border:"none",color:"var(--dim)",cursor:"pointer",fontSize:8,padding:"2px"}},"✕"),
              React.createElement("button",{onClick:function(){rmStrap(si)},style:{marginLeft:"auto",background:"none",border:"1px solid var(--del-border)",borderRadius:6,padding:"3px 8px",cursor:"pointer",color:"var(--del-text)",fontSize:9,fontFamily:"var(--f)",minHeight:24}},"✕"))}),
          !addSt&&React.createElement("button",{onClick:function(){setAddSt(true)},style:{width:"100%",background:"var(--bg)",border:"1px dashed var(--border)",borderRadius:8,padding:"10px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:11,marginTop:4,minHeight:36}},"+ Add Strap / Bracelet"),
          addSt&&React.createElement("div",{style:{background:"var(--bg)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:8,padding:10,marginTop:4}},
            React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}},
              STRAP_TYPES.map(function(st){return React.createElement("span",{key:st.id,className:"chip "+(nSt.type===st.id?"on":""),onClick:function(){setNStF("type",st.id)},style:{fontSize:10,padding:"4px 8px"}},st.icon+" "+st.l)})),
            React.createElement("div",{style:{display:"flex",gap:8,marginBottom:8}},
              nSt.type!=="bracelet"&&React.createElement("div",{style:{flex:1}},
                React.createElement("label",{className:"lbl",style:{fontSize:8,marginBottom:2}},"Color"),
                React.createElement("input",{className:"inp",value:nSt.color,onChange:function(e){setNSt(function(p){return Object.assign({},p,{color:e.target.value})})},placeholder:"brown, black...",style:{fontSize:10,padding:"6px 8px",marginBottom:4}}),
                React.createElement("div",{style:{display:"flex",gap:3,flexWrap:"wrap"}},
                  STRAP_COLORS.map(function(c){return React.createElement("span",{key:c,onClick:function(){setNSt(function(p){return Object.assign({},p,{color:c})})},style:{display:"inline-flex",alignItems:"center",gap:3,fontSize:7,fontFamily:"var(--f)",padding:"2px 5px",borderRadius:3,cursor:"pointer",background:nSt.color===c?"rgba(201,168,76,0.2)":"transparent",border:"1px solid "+(nSt.color===c?"rgba(201,168,76,0.3)":"var(--border)"),color:nSt.color===c?"var(--gold)":"var(--dim)"}},React.createElement("span",{style:{width:6,height:6,borderRadius:"50%",background:strapHex(c),flexShrink:0,border:"1px solid rgba(255,255,255,0.1)"}}),c)}))),
              React.createElement("div",{style:{flex:1}},
                React.createElement("label",{className:"lbl",style:{fontSize:8,marginBottom:2}},"Material"),
                React.createElement("select",{className:"sel",value:nSt.material,onChange:function(e){setNSt(function(p){return Object.assign({},p,{material:e.target.value})})},style:{fontSize:10,padding:"6px 8px"}},
                  (STRAP_TYPES.find(function(t){return t.id===nSt.type})||{mats:[]}).mats.map(function(m){return React.createElement("option",{key:m,value:m},m)})))),
            React.createElement("div",{style:{display:"flex",gap:6,alignItems:"center",marginBottom:8,padding:"6px 8px",background:"var(--card2)",borderRadius:6,border:"1px solid var(--border)"}},
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},"Photo:"),
              nSt.photoUrl?React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,flex:1}},
                React.createElement("img",{src:ph(nSt.photoUrl),alt:"",style:{width:32,height:32,borderRadius:6,objectFit:"cover",border:"1px solid var(--gold)"}}),
                React.createElement("button",{onClick:function(){setNSt(function(p){return Object.assign({},p,{photoUrl:null})})},style:{background:"none",border:"none",color:"var(--dim)",cursor:"pointer",fontSize:9}},"✕ Remove"))
              :React.createElement("div",{style:{display:"flex",gap:4,flex:1}},
                React.createElement("button",{onClick:function(){var inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.setAttribute("capture","environment");inp.onchange=async function(ev){var fl=ev.target.files[0];if(!fl)return;var raw=await new Promise(function(r){var x=new FileReader();x.onload=function(){r(x.result)};x.readAsDataURL(fl)});var compressed=await compressImage(raw,400,0.7);setNSt(function(p){return Object.assign({},p,{photoUrl:compressed})})};inp.click()},style:{background:"none",border:"1px solid rgba(201,168,76,0.3)",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"var(--gold)",fontFamily:"var(--f)",fontSize:9,fontWeight:600,minHeight:26}},"\uD83D\uDCF7 Camera"),
                React.createElement("button",{onClick:function(){var inp=document.createElement("input");inp.type="file";inp.accept="image/*";inp.onchange=async function(ev){var fl=ev.target.files[0];if(!fl)return;var raw=await new Promise(function(r){var x=new FileReader();x.onload=function(){r(x.result)};x.readAsDataURL(fl)});var compressed=await compressImage(raw,400,0.7);setNSt(function(p){return Object.assign({},p,{photoUrl:compressed})})};inp.click()},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:9,fontWeight:600,minHeight:26}},"\uD83D\uDDBC\uFE0F Gallery"))),
            React.createElement("div",{style:{display:"flex",gap:6}},
              React.createElement("button",{onClick:addStrap,style:{flex:1,background:"linear-gradient(135deg,var(--gold),#a8882a)",border:"none",borderRadius:6,padding:"8px",cursor:"pointer",color:"var(--bg)",fontFamily:"var(--f)",fontSize:10,fontWeight:600,minHeight:32}},"+  Add"),
              React.createElement("button",{onClick:function(){setAddSt(false)},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"8px 14px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:10,minHeight:32}},"Cancel")))),
        !IS_SHARED&&React.createElement("label",{className:"lbl"},"Match Colors"),
        !IS_SHARED&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:4,maxHeight:100,overflowY:"auto",marginBottom:12}},AC.map(function(c){return React.createElement("span",{key:c,className:"chip "+((f.mc||[]).includes(c)?"on":""),onClick:function(){togArr("mc",c)}},React.createElement(Dot,{color:c,size:6}),c)})),
        React.createElement("label",{className:"lbl"},"Contexts"),
        React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:4,marginBottom:12}},activeCxIds.map(function(c){return React.createElement("span",{key:c,className:"chip "+((f.cx||[]).includes(c)?"on":""),onClick:function(){togArr("cx",c)}},(activeCxIcons[c]||"")+" "+c)})),
        !IS_SHARED&&React.createElement("label",{className:"lbl"},"Weather"),
        !IS_SHARED&&React.createElement("div",{style:{display:"flex",gap:6,marginBottom:12}},"light,mid,heavy".split(",").map(function(x){return React.createElement("span",{key:x,className:"chip "+((f.wt||[]).includes(x)?"on":""),onClick:function(){togArr("wt",x)},style:{flex:1,justifyContent:"center"}},(x==="light"?"☀️":x==="mid"?"🌤️":"🧥")+" "+x)})),
        React.createElement("label",{className:"lbl"},"Emoji"),
        React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginBottom:14}},EMOJIS.map(function(e){return React.createElement("span",{key:e,onClick:function(){set("i",e)},style:{fontSize:22,cursor:"pointer",opacity:f.i===e?1:0.25,padding:3,minWidth:30,textAlign:"center"}},e)})),
        React.createElement("div",{style:{display:"flex",gap:8}},
          React.createElement("button",{className:"btn btn-gold",style:{flex:1},onClick:function(){var sv=Object.assign({},f);if(sv.straps&&sv.straps.length){sv.br=sv.straps.some(function(s){return s.type==="bracelet"});sv.sc=sv.straps.filter(function(s){return s.type!=="bracelet"}).map(function(s){return s.color})}if(IS_SHARED&&(!sv.mc||!sv.mc.length))sv.mc=autoMatchColors(sv.d);updateW(w.id,sv);setEditW(null)}},"Save"),
          React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"14px 20px"},onClick:function(){var deleted=W.find(function(x){return x.id===w.id});removeW(w.id);setEditW(null);haptic(15);showToast("🗑️ Deleted "+(deleted?deleted.n:"watch"),"var(--warn)",5000,function(){if(deleted){setW(function(p){var n=[deleted].concat(p);ps("w_"+SK,n);return n})}})}},"🗑️")));
    };
    return React.createElement(WE,{key:w.id});
  }

  /* ═══ ONBOARDING (shared version only) ═══ */
  if(!onboarded){
    var obDotStyle=function(s){return{width:8,height:8,borderRadius:"50%",background:onboardStep>=s?"var(--gold)":"var(--border)"}};
    var obFinish=function(){
      var nw=obWatches.map(function(pw){return migrateStraps(Object.assign({},pw,{id:pw.id+"-"+Date.now()+Math.random().toString(36).slice(2,5),active:true,status:"active",t:"genuine"}))});
      var ng=obGarments.map(function(pg){var sd=smartDefaults(pg);return Object.assign({},sd,pg,{id:"g-"+Date.now()+Math.random().toString(36).slice(2,5),ts:Date.now()})});
      if(nw.length){setW(nw);ps("w_"+SK,nw)}
      if(ng.length){setWd(ng);ps("wd_"+SK,ng)}
      setOnboarded(true);ps("wa_onboarded",true);
    };
    /* Step 1: Watches */
    if(onboardStep===1){
      return React.createElement("div",{className:"onboard",style:{paddingBottom:32}},
        React.createElement("div",{style:{display:"flex",gap:6,marginBottom:20}},React.createElement("div",{style:obDotStyle(1)}),React.createElement("div",{style:obDotStyle(2)}),React.createElement("div",{style:obDotStyle(3)})),
        React.createElement("div",{style:{fontSize:36,marginBottom:8}},"⌚"),
        React.createElement("h2",{style:{fontSize:16,fontWeight:600,marginBottom:4}},"Your Watches"),
        React.createElement("p",{style:{fontFamily:"var(--f)",color:"var(--sub)",fontSize:11,maxWidth:300,lineHeight:1.5,marginBottom:16}},"Tap to add watches you own. You can customize later."),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,width:"100%",maxWidth:340,marginBottom:16}},
          WATCH_PRESETS.map(function(wp){
            var sel=obWatches.some(function(o){return o.id===wp.id});
            return React.createElement("button",{key:wp.id,onClick:function(){setObWatches(function(prev){return sel?prev.filter(function(o){return o.id!==wp.id}):prev.concat([wp])})},
              style:{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:10,border:sel?"2px solid var(--gold)":"1px solid var(--border)",background:sel?"rgba(183,139,67,0.08)":"var(--card)",cursor:"pointer",textAlign:"left"}},
              React.createElement("span",{style:{fontSize:20}},wp.i),
              React.createElement("div",null,
                React.createElement("div",{style:{fontSize:12,fontWeight:600,color:"var(--tx)"}},wp.n),
                React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},wp.d+" dial")))
          })),
        React.createElement("div",{style:{display:"flex",gap:8,width:"100%",maxWidth:340}},
          React.createElement("button",{className:"btn btn-gold",style:{flex:1},onClick:function(){setOnboardStep(2)}},obWatches.length?"Next ("+obWatches.length+" selected)":"Skip"),
          React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"12px 14px",fontSize:11},onClick:function(){
            var inp=document.createElement("input");inp.type="file";inp.accept=".json";inp.onchange=function(e){
              var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){
                try{var d=JSON.parse(r.result);if(d.watches){var mw=d.watches.map(migrateStraps);setW(mw);ps("w_"+SK,mw)}if(d.wardrobe){setWd(d.wardrobe);ps("wd_"+SK,d.wardrobe)}if(d.outfits){setSaved(d.outfits);ps("of_"+SK,d.outfits)}if(d.wearLog){setWearLog(d.wearLog);ps("wa_wearlog_"+SK,d.wearLog)}if(d.weekCtx&&d.weekCtx.length===7){setWeekCtx(d.weekCtx);ps("wa_weekctx",d.weekCtx)}if(d.userCx&&d.userCx.length){setUserCx(d.userCx);ps("wa_usercx_"+SK,d.userCx)}if(d.rotLock&&Array.isArray(d.rotLock)){setRotLock(d.rotLock);ps("wa_rotlock_"+SK,d.rotLock)}setOnboarded(true);ps("wa_onboarded",true)}catch(ex){showToast("Invalid backup file","var(--warn)",3000)}};r.readAsText(f)};inp.click()
          }},"📥 Import")));
    }
    /* Step 2: Closet */
    if(onboardStep===2){
      var gTypes=["Tops","Bottoms","Shoes"];
      var gGroups={Tops:GARMENT_PRESETS.filter(function(g){return["Shirt","T-Shirt","Polo","Sweater/Knit"].includes(g.garmentType)}),Bottoms:GARMENT_PRESETS.filter(function(g){return["Chinos","Jeans","Shorts","Pants/Trousers"].includes(g.garmentType)}),Shoes:GARMENT_PRESETS.filter(function(g){return g.garmentType==="Shoes"})};
      return React.createElement("div",{className:"onboard",style:{paddingBottom:32}},
        React.createElement("div",{style:{display:"flex",gap:6,marginBottom:20}},React.createElement("div",{style:obDotStyle(1)}),React.createElement("div",{style:obDotStyle(2)}),React.createElement("div",{style:obDotStyle(3)})),
        React.createElement("div",{style:{fontSize:36,marginBottom:8}},"👔"),
        React.createElement("h2",{style:{fontSize:16,fontWeight:600,marginBottom:4}},"Your Closet"),
        React.createElement("p",{style:{fontFamily:"var(--f)",color:"var(--sub)",fontSize:11,maxWidth:300,lineHeight:1.5,marginBottom:16}},"Tap garments you own. You can add photos and more items later."),
        gTypes.map(function(gt){return React.createElement("div",{key:gt,style:{width:"100%",maxWidth:340,marginBottom:12}},
          React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",fontWeight:600,color:"var(--sub)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.08em"}},gt),
          React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:6}},
            gGroups[gt].map(function(gp){
              var gKey=gp.garmentType+"-"+gp.color;
              var sel=obGarments.some(function(o){return o.garmentType===gp.garmentType&&o.color===gp.color});
              return React.createElement("button",{key:gKey,onClick:function(){setObGarments(function(prev){return sel?prev.filter(function(o){return!(o.garmentType===gp.garmentType&&o.color===gp.color)}):prev.concat([gp])})},
                style:{padding:"6px 12px",borderRadius:20,border:sel?"2px solid var(--gold)":"1px solid var(--border)",background:sel?"rgba(183,139,67,0.08)":"var(--card)",cursor:"pointer",fontSize:11,fontFamily:"var(--f)",color:sel?"var(--gold)":"var(--tx)"}},gp.name)
            })))}),
        React.createElement("div",{style:{display:"flex",gap:8,width:"100%",maxWidth:340,marginTop:8}},
          React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"12px 14px"},onClick:function(){setOnboardStep(1)}},"← Back"),
          React.createElement("button",{className:"btn btn-gold",style:{flex:1},onClick:function(){setOnboardStep(3)}},obGarments.length?"Next ("+obGarments.length+" items)":"Skip")));
    }
    /* Step 3: Week context */
    if(onboardStep===3){
      var ctxNames=activeCxIds.length?activeCxIds:["casual","clinic","smart-casual","formal","weekend","travel","date","riviera"];
      var dayNames=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
      return React.createElement("div",{className:"onboard",style:{paddingBottom:32}},
        React.createElement("div",{style:{display:"flex",gap:6,marginBottom:20}},React.createElement("div",{style:obDotStyle(1)}),React.createElement("div",{style:obDotStyle(2)}),React.createElement("div",{style:obDotStyle(3)})),
        React.createElement("div",{style:{fontSize:36,marginBottom:8}},"📅"),
        React.createElement("h2",{style:{fontSize:16,fontWeight:600,marginBottom:4}},"Your Week"),
        React.createElement("p",{style:{fontFamily:"var(--f)",color:"var(--sub)",fontSize:11,maxWidth:300,lineHeight:1.5,marginBottom:16}},"Set the vibe for each day. This helps match outfits to your schedule."),
        React.createElement("div",{style:{width:"100%",maxWidth:340}},
          dayNames.map(function(dn,di){
            return React.createElement("div",{key:di,style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
              React.createElement("span",{style:{width:32,fontSize:11,fontFamily:"var(--f)",fontWeight:600,color:"var(--sub)"}},dn),
              React.createElement("select",{value:weekCtx[di],onChange:function(e){setWeekCtx(function(p){var n=p.slice();n[di]=e.target.value;return n})},
                style:{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--card)",color:"var(--tx)",fontFamily:"var(--f)",fontSize:12}},
                ctxNames.map(function(cx){return React.createElement("option",{key:cx,value:cx},(activeCxIcons[cx]||CXI[cx]||"")+" "+cx)})))
          })),
        React.createElement("div",{style:{display:"flex",gap:8,width:"100%",maxWidth:340,marginTop:12}},
          React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"12px 14px"},onClick:function(){setOnboardStep(2)}},"← Back"),
          React.createElement("button",{className:"btn btn-gold",style:{flex:1},onClick:function(){ps("wa_weekctx",weekCtx);obFinish()}},"✨ Start Pairing")));
    }
  }

  /* ═══ RENDER ═══ */
  return React.createElement("div",{style:{minHeight:"100vh"}},
    editG&&renderGarmentEdit(editG),
    editW&&renderWatchEdit(editW),
    addG&&renderQuickAdd(),
    /* Duplicate Detection Modal */
    showDupes&&React.createElement(Modal,{onClose:function(){setShowDupes(false)}},
      React.createElement("h2",{style:{fontSize:18,fontWeight:600,marginBottom:6}},"🔍 Duplicate Detection"),
      React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:14}},"Items with matching type + color that might be duplicates. Review each group and delete extras."),
      dupeGroups.length===0?React.createElement("div",{style:{textAlign:"center",padding:30}},
        React.createElement("span",{style:{fontSize:28}},"✅"),
        React.createElement("p",{style:{fontSize:13,fontFamily:"var(--f)",color:"var(--good)",marginTop:8}},"No duplicates found!"),
        React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)"}},"All "+wd.length+" items are unique."))
      :React.createElement("div",null,
        React.createElement("div",{style:{background:"rgba(200,90,58,0.08)",borderRadius:8,padding:"8px 12px",marginBottom:14,border:"1px solid rgba(200,90,58,0.2)"}},
          React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600}},dupeGroups.length+" potential duplicate group"+(dupeGroups.length>1?"s":"")+" found")),
        dupeGroups.map(function(group,gi){
          return React.createElement("div",{key:gi,style:{background:"var(--bg)",borderRadius:12,padding:"14px",marginBottom:12,border:"1px solid var(--border)"}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:10}},
              React.createElement(Dot,{color:group[0].color,size:12}),
              React.createElement("span",{style:{fontSize:12,fontFamily:"var(--f)",fontWeight:600,color:"var(--text)"}},group[0].garmentType+" — "+group[0].color),
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",background:"rgba(200,90,58,0.1)",borderRadius:4,padding:"2px 6px"}},group.length+" items")),
            React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}},
              group.map(function(item){
                return React.createElement("div",{key:item.id,style:{background:"var(--card)",borderRadius:10,overflow:"hidden",border:"1px solid var(--border)"}},
                  ph(item.photoUrl)?React.createElement("img",{src:ph(item.photoUrl),alt:"",onClick:function(e){e.stopPropagation();openLightbox(item.photoUrl,item.id)},style:{width:"100%",height:140,objectFit:"cover",display:"block",cursor:"zoom-in"}}):React.createElement("div",{style:{width:"100%",height:100,background:(CM[item.color]||{}).h||"#3a3a3a",display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement(Dot,{color:item.color,size:30})),
                  React.createElement("div",{style:{padding:"8px 10px"}},
                    React.createElement("div",{style:{fontSize:11,fontFamily:"var(--f)",fontWeight:500,marginBottom:2}},item.name||item.color),
                    React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",marginBottom:2}},item.garmentType+(item.pattern&&item.pattern!=="solid"?" · "+item.pattern:"")+(item.material?" · "+item.material:"")),
                    item.lastWorn&&React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:4}},"Last worn: "+new Date(item.lastWorn).toLocaleDateString()),
                    React.createElement("button",{onClick:function(){setConfirmDlg({msg:"Delete \""+(item.name||item.color)+"\"?",danger:true,onOk:function(){rmG(item.id);setDupeGroups(function(prev){return prev.map(function(g){return g.filter(function(x){return x.id!==item.id})}).filter(function(g){return g.length>=2})});setConfirmDlg(null)}})},style:{width:"100%",background:"rgba(200,90,58,0.1)",border:"1px solid rgba(200,90,58,0.3)",borderRadius:6,padding:"6px",cursor:"pointer",color:"var(--warn)",fontFamily:"var(--f)",fontSize:10,fontWeight:600,minHeight:28}},"🗑️ Delete")))})));
        }))),
    /* Lightbox Modal */
    lightboxSrc&&React.createElement("div",{onClick:function(){setLightboxSrc(null);setLightboxItems([])},style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:200,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",animation:"fadeIn .15s ease",cursor:"pointer",padding:16}},
      React.createElement("button",{onClick:function(){setLightboxSrc(null);setLightboxItems([])},style:{position:"absolute",top:16,right:16,background:"none",border:"1px solid rgba(255,255,255,0.2)",borderRadius:"50%",width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:"#fff",fontSize:18,zIndex:201}},"✕"),
      React.createElement("img",{src:ph(lightboxSrc)||lightboxSrc,alt:"",style:{maxWidth:"92vw",maxHeight:lightboxItems.length>1?"60vh":"85vh",objectFit:"contain",borderRadius:8,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"},onClick:function(e){e.stopPropagation()}}),
      lightboxItems.length>0&&React.createElement("div",{onClick:function(e){e.stopPropagation()},style:{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginTop:12,maxWidth:"92vw"}},
        lightboxItems.map(function(item){
          return React.createElement("div",{key:item.id,onClick:function(){setLightboxSrc(null);setLightboxItems([]);setEditG(item)},style:{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 14px",border:"1px solid rgba(255,255,255,0.12)",cursor:"pointer",transition:"background .15s"}},
            React.createElement("div",{style:{width:14,height:14,borderRadius:"50%",background:(CM[item.color]||{}).h||"#5a5a5a",border:"1px solid rgba(255,255,255,0.2)",flexShrink:0}}),
            React.createElement("div",{style:{flex:1}},
              React.createElement("div",{style:{fontSize:12,fontFamily:"var(--f)",color:"#fff",fontWeight:600}},item.name||item.color),
              React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"rgba(255,255,255,0.5)"}},item.garmentType+(item.pattern&&item.pattern!=="solid"?" · "+item.pattern:"")+(item.material?" · "+item.material:""))),
            React.createElement("span",{style:{fontSize:11,color:"rgba(255,255,255,0.4)",marginLeft:4}},"✏️"),
            item.positionHint&&React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"rgba(255,255,255,0.35)",marginLeft:4}},"📸 "+item.positionHint))}))),

    showWDupes&&React.createElement(Modal,{onClose:function(){setShowWDupes(false)}},
      React.createElement("h2",{style:{fontSize:18,fontWeight:600,marginBottom:6}},"🔍 Watch Duplicates"),
      React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:14}},"Watches with matching names, dials, or similar identifiers. Review and delete extras."),
      wDupeGroups.length===0?React.createElement("div",{style:{textAlign:"center",padding:30}},
        React.createElement("span",{style:{fontSize:28}},"✅"),
        React.createElement("p",{style:{fontSize:13,fontFamily:"var(--f)",color:"var(--good)",marginTop:8}},"No duplicate watches found!"),
        React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)"}},W.length+" watches are all unique."))
      :React.createElement("div",null,
        React.createElement("div",{style:{background:"rgba(200,90,58,0.08)",borderRadius:8,padding:"8px 12px",marginBottom:14,border:"1px solid rgba(200,90,58,0.2)"}},
          React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600}},wDupeGroups.length+" potential duplicate group"+(wDupeGroups.length>1?"s":"")+" found")),
        wDupeGroups.map(function(group,gi){
          return React.createElement("div",{key:gi,style:{background:"var(--bg)",borderRadius:12,padding:"14px",marginBottom:12,border:"1px solid var(--border)"}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:10}},
              React.createElement("span",{style:{fontSize:16}},group[0].i||"⌚"),
              React.createElement("span",{style:{fontSize:12,fontFamily:"var(--f)",fontWeight:600,color:"var(--text)"}},group[0].t.toUpperCase()+" — "+group[0].d+" dial"),
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",background:"rgba(200,90,58,0.1)",borderRadius:4,padding:"2px 6px"}},group.length+" watches")),
            React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat("+Math.min(group.length,2)+",1fr)",gap:10}},
              group.map(function(w){
                return React.createElement("div",{key:w.id,style:{background:"var(--card)",borderRadius:10,padding:"12px",border:"1px solid var(--border)"}},
                  React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
                    React.createElement("div",{style:{width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:w.c+"20",fontSize:18,border:"2px solid "+w.c+"60"}},ph(w.photoUrl)?React.createElement("img",{src:ph(w.photoUrl),alt:"",style:{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}):w.i||"⌚"),
                    React.createElement("div",{style:{flex:1}},
                      React.createElement("div",{style:{fontSize:12,fontWeight:600}},w.n),
                      React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},w.d+" · "+(w.ref||"no ref")+" · "+(w.size?w.size+"mm":"")+" · "+w.t),
                      w.status&&w.status!=="active"&&React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:w.status==="incoming"?"#7ab8d8":"var(--warn)",marginTop:2}},w.status))),
                  React.createElement("div",{style:{display:"flex",gap:6}},
                    React.createElement("button",{onClick:function(){setEditW(w);setShowWDupes(false)},style:{flex:1,background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:6,padding:"6px",cursor:"pointer",color:"var(--gold)",fontFamily:"var(--f)",fontSize:9,fontWeight:600,minHeight:28}},"✏️ Edit"),
                    React.createElement("button",{onClick:function(){setConfirmDlg({msg:"Delete watch \""+w.n+"\"?",danger:true,onOk:function(){removeW(w.id);setWDupeGroups(function(prev){return prev.map(function(g){return g.filter(function(x){return x.id!==w.id})}).filter(function(g){return g.length>=2})});setConfirmDlg(null)}})},style:{flex:1,background:"rgba(200,90,58,0.1)",border:"1px solid rgba(200,90,58,0.3)",borderRadius:6,padding:"6px",cursor:"pointer",color:"var(--warn)",fontFamily:"var(--f)",fontSize:9,fontWeight:600,minHeight:28}},"🗑️ Delete")))}))),
          /* Bulk remove all non-first items */
          React.createElement("div",{style:{borderTop:"1px solid var(--border)",paddingTop:12,marginTop:8}},
            React.createElement("button",{onClick:function(){
              var toRemove=[];
              wDupeGroups.forEach(function(g){g.slice(1).forEach(function(w){toRemove.push(w.id)})});
              if(!toRemove.length)return;
              setConfirmDlg({msg:"Delete "+toRemove.length+" duplicate watch"+(toRemove.length>1?"es":"")+"? Keeps first from each group.",danger:true,onOk:function(){
                setW(function(p){var n=p.filter(function(w){return!toRemove.includes(w.id)});ps("w_"+SK,n);return n});
                setWDupeGroups([]);setConfirmDlg(null)}})},style:{width:"100%",background:"rgba(200,90,58,0.12)",border:"1px solid rgba(200,90,58,0.3)",borderRadius:8,padding:"10px",cursor:"pointer",color:"var(--warn)",fontFamily:"var(--f)",fontSize:11,fontWeight:600,minHeight:36}},"🗑️ Remove All Duplicates (keep first of each group)"))}))),
        showSettings&&React.createElement(Modal,{onClose:function(){setShowSettings(false)}},
      React.createElement("h2",{style:{fontSize:18,fontWeight:600,marginBottom:6}},"⚙️ Settings"),
      React.createElement("p",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:16}},"AI photo classification works automatically inside Claude.ai. To use it in a standalone browser, add your Anthropic API key below."),
      React.createElement("label",{className:"lbl"},"Anthropic API Key"),
      React.createElement("input",{className:"inp",type:"password",value:apiKey,onChange:function(e){setApiKey(e.target.value);apiKeyRef.current=e.target.value},placeholder:"sk-ant-...",style:{marginBottom:12,fontFamily:"monospace"}}),
      React.createElement("div",{style:{display:"flex",gap:8,marginBottom:16}},
        React.createElement("button",{className:"btn btn-gold",style:{flex:1},onClick:function(){ps("wa_apikey",encryptApiKey(apiKey));apiKeyRef.current=apiKey;setShowSettings(false)}},"💾 Save Key"),
        apiKey&&React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"14px 16px"},onClick:function(){setApiKey("");apiKeyRef.current="";ps("wa_apikey","")}},"Clear")),
      React.createElement("div",{style:{background:"var(--bg)",borderRadius:10,padding:"12px",border:"1px solid var(--border)"}},
        React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--dim)",margin:"0 0 6px"}},"ℹ️ Get your key at console.anthropic.com → API Keys"),
        React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--dim)",margin:"0 0 6px"}},"Cost: ~$0.01 per photo (Sonnet vision)"),
        React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:apiKey?"var(--good)":"var(--warn)",margin:0,fontWeight:500}},apiKey?"✓ Key configured — AI classification active":"✗ No key — manual classification only outside Claude.ai")),
            React.createElement("div",{style:{marginTop:16,paddingTop:12,borderTop:"1px solid var(--border)"}},
        React.createElement("label",{className:"lbl"},"Text Size"),
        React.createElement("div",{style:{fontSize:11,color:"var(--sub)",margin:"6px 0 10px"}},"Scale text and spacing for readability. Pinch-zoom is also enabled."),
        React.createElement("div",{style:{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}},
          TEXT_SIZES.map(function(ts){return React.createElement("button",{key:ts.value,className:"text-size-btn"+(uiScale===ts.value?" active":""),onClick:function(){setUiScale(ts.value)}},ts.label)})),
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
          React.createElement("span",{style:{fontSize:11,color:"var(--sub)",minWidth:50}},"Custom"),
          React.createElement("input",{type:"range",min:0.85,max:1.6,step:0.05,value:uiScale,onChange:function(e){setUiScale(parseFloat(e.target.value)||1)},style:{flex:1}}),
          React.createElement("span",{style:{fontSize:11,fontFamily:"var(--mono)",minWidth:52,textAlign:"right"}},Math.round(uiScale*100)+"%"))
      ),

React.createElement("div",{style:{marginTop:16,paddingTop:12,borderTop:"1px solid var(--border)"}},
        React.createElement("label",{className:"lbl"},"Context Categories"),
        React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginTop:6,marginBottom:8}},
          activeCx.map(function(c){return React.createElement("span",{key:c.id,className:"chip on",style:{gap:6}},c.icon+" "+c.l,
            React.createElement("span",{onClick:function(e){e.stopPropagation();var n=activeCx.filter(function(x){return x.id!==c.id});if(n.length<2)return;setUserCx(n);ps("wa_usercx_"+SK,n)},style:{cursor:"pointer",color:"var(--warn)",fontSize:10,marginLeft:2}},"✕"))})),
        React.createElement("div",{style:{display:"flex",gap:4,marginBottom:8}},
          React.createElement("input",{id:"newCxName",className:"inp",placeholder:"New context name",style:{flex:1,fontSize:11,padding:"6px 10px"}}),
          React.createElement("input",{id:"newCxIcon",className:"inp",placeholder:"Emoji",style:{width:50,fontSize:14,textAlign:"center",padding:"6px"}}),
          React.createElement("button",{onClick:function(){var nameEl=document.getElementById("newCxName");var iconEl=document.getElementById("newCxIcon");var nm=(nameEl?nameEl.value:"").trim();var ic=(iconEl?iconEl.value:"").trim()||"📌";if(!nm)return;var nid=nm.toLowerCase().replace(/\s+/g,"-");var n=(userCx||activeCx).concat([{id:nid,l:nm,icon:ic}]);setUserCx(n);ps("wa_usercx_"+SK,n);if(nameEl)nameEl.value="";if(iconEl)iconEl.value=""},style:{background:"var(--gold)",color:"var(--bg)",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontFamily:"var(--f)",fontSize:11,fontWeight:600}},"+Add")),
        React.createElement("button",{onClick:function(){setUserCx(null);ps("wa_usercx_"+SK,null)},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"6px 12px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:9,marginBottom:8}},"Reset to Defaults")),
      React.createElement("div",{style:{marginTop:16,paddingTop:12,borderTop:"1px solid var(--border)"}},
        React.createElement("label",{className:"lbl"},"🔐 Recovery Credentials"),
        React.createElement("p",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",marginBottom:8}},"Set a username + password to encrypt your backups. You'll need these to restore on a new device."),
        React.createElement("div",{style:{display:"flex",gap:8,marginBottom:6}},
          React.createElement("input",{className:"inp",type:"text",value:recUser,onChange:function(e){setRecUser(e.target.value)},placeholder:"Username",style:{flex:1,fontSize:11,padding:"8px 12px"}}),
          React.createElement("input",{className:"inp",type:"password",value:recPass,onChange:function(e){setRecPass(e.target.value)},placeholder:"Password",style:{flex:1,fontSize:11,padding:"8px 12px"}})),
        React.createElement("div",{style:{display:"flex",gap:8,marginBottom:8}},
          React.createElement("button",{onClick:function(){if(!recUser.trim()||!recPass.trim()){showToast("Enter both username and password","var(--warn)");return}localStorage.setItem("wa_rec_user",recUser);/* password never stored */setRecStatus("saved");setTimeout(function(){setRecStatus("")},2500)},style:{flex:1,background:"linear-gradient(135deg,var(--gold),#a8882a)",border:"none",borderRadius:8,padding:"8px",cursor:"pointer",color:"var(--bg)",fontFamily:"var(--f)",fontSize:10,fontWeight:600,minHeight:32}},"💾 Save Credentials"),
          React.createElement("button",{onClick:async function(){
            if(!recUser.trim()||!recPass.trim()){showToast("Enter username and password first","var(--warn)");return}
            setRecStatus("encrypting...");
            try{
              var data=JSON.stringify({version:"v26.0",user:recUser.trim(),ts:Date.now(),watches:W,wardrobe:wd,outfits:saved,wearLog:wearLog,weekCtx:weekCtx,userCx:userCx,rotLock:rotLock,selfieHistory:selfieHistory,theme:theme});
              var encrypted=await encryptData(data,recUser.trim()+"::"+recPass.trim());
              var blob=new Blob([encrypted],{type:"application/octet-stream"});
              var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="watch-advisor-"+recUser.trim()+".wabackup";a.click();
              setRecStatus("exported \u2713");setTimeout(function(){setRecStatus("")},3000);
            }catch(e){setRecStatus("error: "+e.message);setTimeout(function(){setRecStatus("")},4000)}
          },style:{flex:1,background:"rgba(122,184,216,0.08)",border:"1px solid rgba(122,184,216,0.25)",borderRadius:8,padding:"8px",cursor:"pointer",color:"var(--info)",fontFamily:"var(--f)",fontSize:10,fontWeight:600,minHeight:32}},"📤 Encrypted Export"),
          React.createElement("button",{onClick:function(){
            if(!recPass.trim()){showToast("Enter password to decrypt","var(--warn)");return}
            var inp=document.createElement("input");inp.type="file";inp.accept=".wabackup";inp.onchange=async function(e){
              var f=e.target.files[0];if(!f)return;
              setRecStatus("decrypting...");
              try{
                var buf=await f.arrayBuffer();
                var packed=new Uint8Array(buf);
                var json=await decryptData(packed,((recUser||"").trim()||f.name.replace("watch-advisor-","").replace(".wabackup",""))+"::"+recPass.trim());
                var d;try{d=JSON.parse(json)}catch(pe){showToast("Invalid backup file format","var(--warn)",3000);setRecStatus("");return}
                var imported=[];
                if(d.watches&&Array.isArray(d.watches)){var valid=d.watches.filter(function(w){return w&&w.id&&w.n});if(valid.length){var mw=valid.map(migrateStraps);setW(mw);ps("w_"+SK,mw);imported.push(valid.length+" watches")}}
                if(d.wardrobe&&Array.isArray(d.wardrobe)){var vwd=d.wardrobe.filter(function(i){return i&&i.id});if(vwd.length){setWd(vwd);ps("wd_"+SK,vwd);imported.push(vwd.length+" wardrobe items")}}
                if(d.outfits&&Array.isArray(d.outfits)){setSaved(d.outfits);ps("of_"+SK,d.outfits);imported.push(d.outfits.length+" outfits")}
                if(d.wearLog&&Array.isArray(d.wearLog)){var vwl=d.wearLog.filter(function(e2){return e2&&e2.date&&e2.watchId});setWearLog(vwl);ps("wa_wearlog_"+SK,vwl);imported.push(vwl.length+" wear logs")}
                if(d.weekCtx&&Array.isArray(d.weekCtx)&&d.weekCtx.length===7){setWeekCtx(d.weekCtx);ps("wa_weekctx",d.weekCtx)}
                if(d.userCx&&Array.isArray(d.userCx)){setUserCx(d.userCx);ps("wa_usercx_"+SK,d.userCx)}
                if(d.rotLock&&Array.isArray(d.rotLock)){setRotLock(d.rotLock);ps("wa_rotlock_"+SK,d.rotLock)}
                if(d.selfieHistory&&Array.isArray(d.selfieHistory)){setSelfieHistory(d.selfieHistory);ps("wa_selfie_"+SK,d.selfieHistory);imported.push(d.selfieHistory.length+" selfies")}
                if(d.theme){setTheme(d.theme);ps("wa_theme",d.theme)}
                setRecStatus("restored \u2713");showToast("✅ Restored: "+imported.join(", "),"var(--good)",4000);setTimeout(function(){setRecStatus("")},4000);
              }catch(err){
                setRecStatus("");
                if(err.name==="OperationError")showToast("❌ Wrong password or username","var(--warn)",4000);
                else showToast("Error: "+err.message,"var(--warn)",3000);
              }
            };inp.click();
          },style:{flex:1,background:"rgba(122,184,122,0.08)",border:"1px solid rgba(122,184,122,0.25)",borderRadius:8,padding:"8px",cursor:"pointer",color:"var(--good)",fontFamily:"var(--f)",fontSize:10,fontWeight:600,minHeight:32}},"📥 Restore .wabackup")),
        recStatus&&React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:recStatus.includes("error")?"var(--warn)":recStatus.includes("\u2713")?"var(--good)":"var(--info)",marginBottom:6,fontWeight:500}},recStatus),
        React.createElement("div",{style:{background:"var(--bg)",borderRadius:8,padding:"8px 10px",marginBottom:16,border:"1px solid var(--border)"}},
          React.createElement("p",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",margin:0}},"AES-256-GCM encryption · PBKDF2 310K iterations · Your password never leaves this device · .wabackup files are unreadable without your credentials"))),

      /* ══ Cloud Sync Section ══ */
      React.createElement("div",{style:{marginTop:0,paddingTop:12,borderTop:"1px solid var(--border)"}},
        React.createElement("label",{className:"lbl"},"☁️ Cloud Sync (Supabase)"),
        React.createElement("p",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",marginBottom:8}},"Sync your data across devices via your own Supabase project. Photos upload in original quality."),

        /* Config inputs */
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:6,marginBottom:8}},
          React.createElement("input",{className:"inp",type:"text",value:sbUrl,onChange:function(e){setSbUrl(e.target.value)},placeholder:"Supabase URL (https://xxx.supabase.co)",style:{fontSize:11,padding:"8px 12px"}}),
          React.createElement("input",{className:"inp",type:"password",value:sbKey,onChange:function(e){setSbKey(e.target.value)},placeholder:"Supabase anon key",style:{fontSize:11,padding:"8px 12px",fontFamily:"monospace"}}),
          React.createElement("input",{className:"inp",type:"text",value:sbBucket,onChange:function(e){setSbBucket(e.target.value)},placeholder:"Storage bucket (default: photos)",style:{fontSize:11,padding:"8px 12px"}})),

        /* Save config */
        React.createElement("div",{style:{display:"flex",gap:8,marginBottom:8}},
          React.createElement("button",{onClick:function(){
            if(!sbUrl.trim()||!sbKey.trim()){showToast("Enter Supabase URL and anon key","var(--warn)");return}
            sbSaveConfig({url:sbUrl.trim(),anonKey:sbKey.trim(),bucket:sbBucket.trim()||"photos"});
            sbInitClient(sbUrl.trim(),sbKey.trim());
            showToast("Supabase config saved","var(--good)");
          },style:{flex:1,background:"linear-gradient(135deg,var(--gold),#a8882a)",border:"none",borderRadius:8,padding:"8px",cursor:"pointer",color:"var(--bg)",fontFamily:"var(--f)",fontSize:10,fontWeight:600,minHeight:32}},"💾 Save Config"),
          sbUrl&&React.createElement("button",{onClick:function(){
            sbClearConfig();setSbUrl("");setSbKey("");setSbBucket("photos");setCloudUser(null);setCloudStatus("");
            showToast("Cloud config cleared","var(--good)");
          },style:{background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"8px 12px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:10}},"Clear")),

        /* Auth: Login / Sign Up / Logout */
        cloudUser?React.createElement("div",{style:{background:"rgba(122,184,122,0.08)",border:"1px solid rgba(122,184,122,0.2)",borderRadius:8,padding:"10px",marginBottom:8}},
          React.createElement("div",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--good)",fontWeight:500,marginBottom:6}},"✓ Signed in as "+cloudUser.email),
          React.createElement("button",{onClick:async function(){
            try{await sbSignOut();setCloudUser(null);setCloudStatus("");showToast("Signed out","var(--good)")}catch(e){showToast("Sign out error: "+e.message,"var(--warn)")}
          },style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"6px 12px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:9}},"Sign Out"))
        :React.createElement("div",{style:{marginBottom:8}},
          React.createElement("p",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",marginBottom:6}},"Use your Recovery Credentials (above) as username + password to login or sign up:"),
          React.createElement("div",{style:{display:"flex",gap:8}},
            React.createElement("button",{onClick:async function(){
              if(!sbUrl.trim()||!sbKey.trim()){showToast("Save Supabase config first","var(--warn)");return}
              if(!recUser.trim()||!recPass.trim()){showToast("Enter Recovery Credentials above first","var(--warn)");return}
              setCloudStatus("signing in...");
              try{
                sbInitClient(sbUrl.trim(),sbKey.trim());
                var d=await sbSignIn(recUser.trim(),recPass.trim());
                if(d.user){setCloudUser(d.user);setCloudStatus("signed in");showToast("Signed in as "+d.user.email,"var(--good)")}
              }catch(e){
                setCloudStatus("error: "+e.message);showToast("Login failed: "+e.message,"var(--warn)",4000);
              }
            },style:{flex:1,background:"rgba(122,184,216,0.08)",border:"1px solid rgba(122,184,216,0.25)",borderRadius:8,padding:"8px",cursor:"pointer",color:"#7ab8d8",fontFamily:"var(--f)",fontSize:10,fontWeight:600,minHeight:32}},"🔑 Login"),
            React.createElement("button",{onClick:async function(){
              if(!sbUrl.trim()||!sbKey.trim()){showToast("Save Supabase config first","var(--warn)");return}
              if(!recUser.trim()||!recPass.trim()){showToast("Enter Recovery Credentials above first","var(--warn)");return}
              setCloudStatus("creating account...");
              try{
                sbInitClient(sbUrl.trim(),sbKey.trim());
                var d=await sbSignUp(recUser.trim(),recPass.trim());
                if(d.user){setCloudUser(d.user);setCloudStatus("account created");showToast("Account created for "+d.user.email,"var(--good)")}
              }catch(e){
                setCloudStatus("error: "+e.message);showToast("Sign up failed: "+e.message,"var(--warn)",4000);
              }
            },style:{flex:1,background:"rgba(122,184,122,0.08)",border:"1px solid rgba(122,184,122,0.25)",borderRadius:8,padding:"8px",cursor:"pointer",color:"var(--good)",fontFamily:"var(--f)",fontSize:10,fontWeight:600,minHeight:32}},"📝 Sign Up"))),

        /* Sync buttons — only show when signed in */
        cloudUser&&React.createElement("div",{style:{display:"flex",gap:8,marginBottom:8}},
          React.createElement("button",{onClick:async function(){
            setSyncStatus("pushing data...");
            try{
              var payload={watches:W,wardrobe:wd,outfits:saved,wearLog:wearLog,weekCtx:weekCtx,userCx:userCx,rotLock:rotLock,selfieHistory:selfieHistory,theme:theme,strapLog:strapLog};
              await sbPushAll(payload);
              setSyncStatus("pushing photos...");
              var allItems=[].concat(W,wd);
              var bucket=sbBucket.trim()||"photos";
              var photoCount=await sbPushPhotos(allItems,bucket,function(done,total){setSyncStatus("photos "+done+"/"+total+"...")});
              setSyncStatus("");showToast("Pushed to cloud ("+photoCount+" photos)","var(--good)",3000);
            }catch(e){setSyncStatus("push error: "+e.message);showToast("Push failed: "+e.message,"var(--warn)",4000)}
          },style:{flex:1,background:"rgba(122,184,216,0.08)",border:"1px solid rgba(122,184,216,0.25)",borderRadius:8,padding:"10px",cursor:"pointer",color:"#7ab8d8",fontFamily:"var(--f)",fontSize:11,fontWeight:600,minHeight:36}},"⬆️ Push to Cloud"),
          React.createElement("button",{onClick:async function(){
            setSyncStatus("pulling data...");
            try{
              var cloud=await sbPullAll();
              var imported=[];
              if(cloud.watches&&Array.isArray(cloud.watches)){var mw=cloud.watches.filter(function(w){return w&&w.id&&w.n}).map(migrateStraps);if(mw.length){setW(mw);ps("w_"+SK,mw);imported.push(mw.length+" watches")}}
              if(cloud.wardrobe&&Array.isArray(cloud.wardrobe)){var vwd=cloud.wardrobe.filter(function(i){return i&&i.id});if(vwd.length){setWd(vwd);ps("wd_"+SK,vwd);imported.push(vwd.length+" wardrobe items")}}
              if(cloud.outfits&&Array.isArray(cloud.outfits)){setSaved(cloud.outfits);ps("of_"+SK,cloud.outfits);imported.push(cloud.outfits.length+" outfits")}
              if(cloud.wearLog&&Array.isArray(cloud.wearLog)){var vwl=cloud.wearLog.filter(function(e2){return e2&&e2.date&&e2.watchId});setWearLog(vwl);ps("wa_wearlog_"+SK,vwl);imported.push(vwl.length+" wear logs")}
              if(cloud.weekCtx&&Array.isArray(cloud.weekCtx)&&cloud.weekCtx.length===7){setWeekCtx(cloud.weekCtx);ps("wa_weekctx",cloud.weekCtx)}
              if(cloud.userCx&&Array.isArray(cloud.userCx)){setUserCx(cloud.userCx);ps("wa_usercx_"+SK,cloud.userCx)}
              if(cloud.rotLock&&Array.isArray(cloud.rotLock)){setRotLock(cloud.rotLock);ps("wa_rotlock_"+SK,cloud.rotLock)}
              if(cloud.selfieHistory&&Array.isArray(cloud.selfieHistory)){setSelfieHistory(cloud.selfieHistory);ps("wa_selfie_"+SK,cloud.selfieHistory);imported.push(cloud.selfieHistory.length+" selfies")}
              if(cloud.strapLog&&Array.isArray(cloud.strapLog)){setStrapLog(cloud.strapLog);ps("wa_strap_log",cloud.strapLog)}
              if(cloud.theme){setTheme(cloud.theme);ps("wa_theme",cloud.theme)}
              /* Pull photos */
              setSyncStatus("pulling photos...");
              var allItems=[].concat(cloud.watches||[],cloud.wardrobe||[]);
              var bucket=sbBucket.trim()||"photos";
              var photoCount=await sbPullPhotos(allItems,bucket,function(done,total){setSyncStatus("photos "+done+"/"+total+"...")});
              setSyncStatus("");showToast("Pulled from cloud: "+imported.join(", ")+(photoCount?" + "+photoCount+" photos":""),"var(--good)",4000);
            }catch(e){setSyncStatus("pull error: "+e.message);showToast("Pull failed: "+e.message,"var(--warn)",4000)}
          },style:{flex:1,background:"rgba(122,184,122,0.08)",border:"1px solid rgba(122,184,122,0.25)",borderRadius:8,padding:"10px",cursor:"pointer",color:"var(--good)",fontFamily:"var(--f)",fontSize:11,fontWeight:600,minHeight:36}},"⬇️ Pull from Cloud")),

        /* Status indicators */
        (cloudStatus||syncStatus)&&React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:(cloudStatus+syncStatus).includes("error")?"var(--warn)":"var(--sub)",marginBottom:6,fontWeight:500}},syncStatus||cloudStatus),

        React.createElement("div",{style:{background:"var(--bg)",borderRadius:8,padding:"8px 10px",marginBottom:0,border:"1px solid var(--border)"}},
          React.createElement("p",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",margin:0}},"Requires your own Supabase project (free tier works). See README.md for instructions. Data is stored per-user with Row Level Security."))),

      React.createElement("div",{style:{marginTop:0,paddingTop:12,borderTop:"1px solid var(--border)"}},
        React.createElement("label",{className:"lbl"},"Data Management"),
        React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}},
          React.createElement("button",{className:"btn btn-ghost",style:{flex:1,fontSize:11,padding:"10px 14px",minHeight:40},onClick:async function(){try{var ew=JSON.parse(JSON.stringify(W)),ewd=JSON.parse(JSON.stringify(wd));for(var it of ewd){if(it.photoUrl&&it.photoUrl.startsWith("idb:"))it.photoUrl=await photoAsDataUrl(it.photoUrl)||null}for(var w of ew){if(w.photoUrl&&w.photoUrl.startsWith("idb:"))w.photoUrl=await photoAsDataUrl(w.photoUrl)||null;if(w.straps)for(var s of w.straps){if(s.photoUrl&&s.photoUrl.startsWith("idb:"))s.photoUrl=await photoAsDataUrl(s.photoUrl)||null}}var data=JSON.stringify({version:"v26.0",watches:ew,wardrobe:ewd,outfits:saved,wearLog:wearLog,weekCtx:weekCtx,userCx:userCx,rotLock:rotLock,selfieHistory:selfieHistory,theme:theme});var blob=new Blob([data],{type:"application/json"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="watch-advisor-backup.json";a.click()}catch(e){console.error("[Export]",e)}}},"‍📤 Export"),
          React.createElement("button",{className:"btn btn-ghost",style:{flex:1,fontSize:11,padding:"10px 14px",minHeight:40},onClick:function(){var inp=document.createElement("input");inp.type="file";inp.accept=".json";inp.onchange=function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{var d=JSON.parse(r.result);if(typeof d!=="object"||d===null||Array.isArray(d)){showToast("Invalid backup file: expected JSON object","var(--warn)",3000);return}var imported=[];if(d.watches&&Array.isArray(d.watches)){var valid=d.watches.filter(function(w){return w&&typeof w==="object"&&w.id&&w.n});if(valid.length){var mw=valid.map(migrateStraps);setW(mw);ps("w_"+SK,mw);imported.push(valid.length+" watches")}}if(d.wardrobe&&Array.isArray(d.wardrobe)){var vwd=d.wardrobe.filter(function(i){return i&&typeof i==="object"&&i.id});if(vwd.length){setWd(vwd);ps("wd_"+SK,vwd);imported.push(vwd.length+" wardrobe items")}}if(d.outfits&&Array.isArray(d.outfits)){setSaved(d.outfits);ps("of_"+SK,d.outfits);imported.push(d.outfits.length+" outfits")}if(d.wearLog&&Array.isArray(d.wearLog)){var vwl=d.wearLog.filter(function(e){return e&&e.date&&e.watchId});setWearLog(vwl);ps("wa_wearlog_"+SK,vwl);imported.push(vwl.length+" wear logs")}if(d.weekCtx&&Array.isArray(d.weekCtx)&&d.weekCtx.length===7){setWeekCtx(d.weekCtx);ps("wa_weekctx",d.weekCtx)}if(d.userCx&&Array.isArray(d.userCx)&&d.userCx.length){setUserCx(d.userCx);ps("wa_usercx_"+SK,d.userCx)}if(d.rotLock&&Array.isArray(d.rotLock)){setRotLock(d.rotLock);ps("wa_rotlock_"+SK,d.rotLock)}if(d.selfieHistory&&Array.isArray(d.selfieHistory)){setSelfieHistory(d.selfieHistory);ps("wa_selfie_"+SK,d.selfieHistory);imported.push(d.selfieHistory.length+" selfie checks")}if(d.theme&&(d.theme==="dark"||d.theme==="light")){setTheme(d.theme);ps("wa_theme",d.theme)}showToast(imported.length?"✅ Imported: "+imported.join(", "):"No valid data found in file",imported.length?"var(--good)":"var(--warn)",3500)}catch(e){showToast("Invalid file: "+String(e.message||e).slice(0,100),"var(--warn)",3500)}};r.readAsText(f)};inp.click()}},"📥 Import"),
          React.createElement("button",{className:"btn btn-ghost",style:{flex:1,fontSize:11,padding:"10px 14px",minHeight:40},onClick:function(){var inp=document.createElement("input");inp.type="file";inp.accept=".md,.txt";inp.onchange=function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(){try{var parsed=parseWatchLog(r.result,W);if(parsed&&parsed.length){setW(parsed);ps("w_"+SK,parsed);showToast("✅ Imported "+parsed.length+" watches from markdown!","var(--good)",3000)}else{showToast("No watches found in file","var(--warn)",3000)}}catch(ex){console.error(ex);showToast("Parse error: "+ex.message,"var(--warn)",3000)}};r.readAsText(f)};inp.click()}},"📄 Import .md")))),

    /* Floating Save Button */
    /* Quick Backup Button */
    React.createElement("div",{style:{position:"fixed",bottom:20,right:16,zIndex:89,pointerEvents:"none",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}},
    React.createElement("button",{onClick:function(){setShowQuickWear(!showQuickWear)},style:{pointerEvents:"auto",width:44,height:44,borderRadius:"50%",background:todayWorn?"linear-gradient(135deg,var(--good),#5a9e5a)":"linear-gradient(135deg,#7ab8d8,#5a8eae)",border:"none",boxShadow:"0 4px 12px rgba(0,0,0,0.25)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#fff",transition:"transform .15s"},title:todayWorn?"Change today's watch":"Log today's watch"},todayWorn?"✓":"⌚"),
    React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center",pointerEvents:"auto"}},
      React.createElement("button",{onClick:async function(){try{var ew=JSON.parse(JSON.stringify(W)),ewd=JSON.parse(JSON.stringify(wd));for(var it of ewd){if(it.photoUrl&&it.photoUrl.startsWith("idb:"))it.photoUrl=await photoAsDataUrl(it.photoUrl)||null}for(var w of ew){if(w.photoUrl&&w.photoUrl.startsWith("idb:"))w.photoUrl=await photoAsDataUrl(w.photoUrl)||null;if(w.straps)for(var s of w.straps){if(s.photoUrl&&s.photoUrl.startsWith("idb:"))s.photoUrl=await photoAsDataUrl(s.photoUrl)||null}}var data=JSON.stringify({version:"v26.0",ts:Date.now(),watches:ew,wardrobe:ewd,outfits:saved,wearLog:wearLog,weekCtx:weekCtx,userCx:userCx,rotLock:rotLock,selfieHistory:selfieHistory,theme:theme});var blob=new Blob([data],{type:"application/json"});var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="wa-backup-"+new Date().toISOString().slice(0,10)+".json";a.click()}catch(e){console.error("[Export]",e)}},style:{width:36,height:36,borderRadius:"50%",background:"var(--card)",border:"1px solid var(--border)",boxShadow:"0 2px 8px rgba(0,0,0,0.15)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"var(--dim)",transition:"transform .15s",},title:"Quick backup (JSON)"},"📤"),
    React.createElement("button",{onClick:saveAll,"aria-label":"Save all changes",style:{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,var(--gold),#a8882a)",border:"none",boxShadow:"0 4px 16px rgba(201,168,76,0.35)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:"var(--bg)",transition:"transform .15s"}},"💾"))),
    /* Quick Wear FAB */
    
    /* Quick Wear Picker */
    showQuickWear&&React.createElement("div",{onClick:function(){setShowQuickWear(false)},style:{position:"fixed",inset:0,zIndex:95,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",}},
      React.createElement("div",{onClick:function(e){e.stopPropagation()},style:{background:"var(--card)",borderRadius:"16px 16px 0 0",padding:"16px",maxWidth:420,width:"100%",maxHeight:"60vh",overflowY:"auto"}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
          React.createElement("span",{style:{fontSize:18}},"⌚"),
          React.createElement("span",{style:{fontSize:14,fontFamily:"var(--f)",fontWeight:600,color:"var(--gold)"}},"What are you wearing today?"),
          todayWorn&&React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--good)",background:"rgba(122,184,122,0.1)",borderRadius:6,padding:"2px 8px"}},"Currently: "+(function(){var w=W.find(function(x){return x.id===todayWorn.watchId});return w?w.n:"?"})())),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}},
          W.filter(function(w){return w.active&&w.status!=="pending-trade"&&w.status!=="incoming"&&w.status!=="service"}).map(function(w){
            var isToday=todayWorn&&todayWorn.watchId===w.id;
            return React.createElement("button",{key:w.id,onClick:function(){logWear(w.id,todayStr);/* Auto-log strap */var _sr=w.straps&&w.straps.length===1?w.straps[0]:w.straps&&w.straps.length>1?strapRec(w,[],effectiveCtx,{rain:weather&&weather.cond&&weather.cond.rain}).strap:null;if(_sr)logStrapWear(w.id,_sr,primaryCtx,getWeatherKey(weather));setShowQuickWear(false)},style:{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:isToday?"rgba(122,184,122,0.1)":"var(--bg)",border:"1px solid "+(isToday?"rgba(122,184,122,0.3)":"var(--border)"),borderRadius:10,cursor:"pointer",textAlign:"left"}},
              React.createElement("div",{style:{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:w.c+"20",fontSize:16,border:"1px solid "+w.c+"40",overflow:"hidden",flexShrink:0}},ph(w.photoUrl)?React.createElement("img",{src:ph(w.photoUrl),alt:"",decoding:"async",style:{width:"100%",height:"100%",objectFit:"cover"}}):w.i),
              React.createElement("div",{style:{flex:1,minWidth:0}},
                React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",fontWeight:600,color:isToday?"var(--good)":"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},w.n),
                React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},w.d+(isToday?" ✓ today":""))),
              !IS_SHARED&&w.t==="replica"&&React.createElement("span",{style:{fontSize:6,fontFamily:"var(--f)",color:"#6a5a50",border:"1px solid var(--rep-border)",borderRadius:2,padding:"0 3px"}},"R"))
          })),
        todayWorn&&React.createElement("button",{onClick:function(){undoWear(todayStr);setShowQuickWear(false)},style:{width:"100%",marginTop:8,background:"none",border:"1px solid var(--del-border)",borderRadius:8,padding:"10px",cursor:"pointer",color:"var(--del-text)",fontFamily:"var(--f)",fontSize:10,minHeight:36}},"✕ Clear today's wear log"))),
    /* Universal Toast */
    toast&&React.createElement("div",{className:"toast-undo",onClick:function(){if(!toast.undo)setToast(null)},style:{background:toast.color==="var(--warn)"?"rgba(200,90,58,0.95)":"rgba(122,184,122,0.95)",color:"#fff",cursor:toast.undo?"default":"pointer"}},React.createElement("span",null,toast.msg),toast.undo&&React.createElement("button",{className:"undo-btn",onClick:function(e){e.stopPropagation();toast.undo();setToast(null);if(toastTmr.current){clearTimeout(toastTmr.current);toastTmr.current=null}}},"UNDO"),React.createElement("div",{className:"toast-bar",style:{animation:"toastCountdown "+(toast.undo?"5":"2.5")+"s linear forwards"}})),
    /* Confirm Dialog */
    confirmDlg&&React.createElement("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:24,animation:"fadeIn .15s ease-out"}},
      React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:16,padding:24,maxWidth:320,width:"100%",animation:"fadeUp .2s ease-out"}},
        React.createElement("p",{style:{fontSize:14,fontFamily:"var(--f)",color:"var(--text)",marginBottom:20,lineHeight:1.5,textAlign:"center"}},confirmDlg.msg),
        React.createElement("div",{style:{display:"flex",gap:10}},
          React.createElement("button",{onClick:function(){setConfirmDlg(null)},className:"btn btn-ghost",style:{flex:1}},"Cancel"),
          React.createElement("button",{onClick:function(){if(confirmDlg.onOk)confirmDlg.onOk()},style:{flex:1,background:confirmDlg.danger?"rgba(200,90,58,0.9)":"var(--gold)",border:"none",borderRadius:10,padding:14,cursor:"pointer",fontFamily:"var(--f)",fontSize:14,fontWeight:600,color:"#fff",minHeight:48}},"Confirm")))),
    /* Save Toast */
    showSaveToast&&React.createElement("div",{className:"fu",style:{position:"fixed",bottom:84,right:16,zIndex:91,background:"rgba(122,184,122,0.95)",color:"#fff",borderRadius:10,padding:"10px 18px",fontFamily:"var(--f)",fontSize:12,fontWeight:600,boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}},"✓ All changes saved!"),
    /* ═══ UNDO DELETE TOAST ═══ */
    undoDelete&&React.createElement("div",{className:"fu",style:{position:"fixed",bottom:84,left:16,right:16,zIndex:92,background:"rgba(200,90,58,0.95)",color:"#fff",borderRadius:12,padding:"12px 16px",fontFamily:"var(--f)",fontSize:12,fontWeight:500,boxShadow:"0 4px 20px rgba(0,0,0,0.4)",display:"flex",alignItems:"center",gap:10}},
      React.createElement("span",{style:{flex:1}},"🗑️ Outfit deleted"),
      React.createElement("button",{onClick:undoDeleteFn,style:{background:"rgba(255,255,255,0.2)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:8,padding:"6px 16px",cursor:"pointer",color:"#fff",fontFamily:"var(--f)",fontSize:12,fontWeight:700,minHeight:30}},"↩ Undo"),
      React.createElement("button",{onClick:function(){if(undoTimerRef.current){clearTimeout(undoTimerRef.current);undoTimerRef.current=null}setUndoDelete(null)},style:{background:"none",border:"none",color:"rgba(255,255,255,0.6)",fontSize:14,cursor:"pointer",padding:"4px"}},"✕")),

    /* ═══ AUTH MODAL ═══ */
    showAuthModal&&React.createElement("div",{className:"auth-modal",onClick:function(e){if(e.target===e.currentTarget)setShowAuthModal(false)}},
      React.createElement("div",{className:"auth-card"},
        React.createElement("div",{style:{fontSize:36,textAlign:"center",marginBottom:8}},"⌚"),
        React.createElement("h2",null,authMode==="login"?"Sign In":"Create Account"),
        React.createElement("div",{className:"auth-sub"},authMode==="login"?"Sign in to sync across devices":"Create an account to enable cloud sync"),
        authError&&React.createElement("div",{style:{background:"rgba(200,90,58,0.1)",border:"1px solid rgba(200,90,58,0.3)",borderRadius:8,padding:"8px 12px",marginBottom:10,fontSize:10,fontFamily:"var(--f)",color:"var(--warn)"}},authError),
        React.createElement("input",{className:"inp",type:"text",value:authUser,onChange:function(e){setAuthUser(e.target.value)},placeholder:"Username or email",autoComplete:"username"}),
        React.createElement("input",{className:"inp",type:"password",value:authPass,onChange:function(e){setAuthPass(e.target.value)},placeholder:"Password",autoComplete:authMode==="login"?"current-password":"new-password",onKeyDown:function(e){if(e.key==="Enter"){
          setAuthLoading(true);setAuthError("");
          var cfg=sbLoadConfig();if(cfg)sbInitClient(cfg.url,cfg.anonKey);
          var fn=authMode==="login"?sbSignIn:sbSignUp;
          fn(authUser.trim(),authPass).then(function(d){if(d.user){setCloudUser(d.user);setCloudStatus("signed in as "+d.user.email);setShowAuthModal(false);setAuthError("");showToast(authMode==="login"?"Signed in as "+d.user.email:"Account created!","var(--good)");
            /* Auto-pull on login */
            sbPullSnapshot().then(function(cloud){if(cloud){var lp=_buildPayload();var merged=sbMerge(lp,cloud);_applyPayload(merged)}}).catch(function(e){console.warn("[CloudSync]",e)})
          }}).catch(function(e){setAuthError(e.message)}).finally(function(){setAuthLoading(false)})
        }}}),
        React.createElement("div",{className:"auth-actions"},
          React.createElement("button",{className:"btn "+(authMode==="login"?"btn-gold":"btn-ghost"),disabled:authLoading,style:{flex:1},onClick:function(){
            if(!authUser.trim()||!authPass.trim()){setAuthError("Enter username and password");return}
            setAuthLoading(true);setAuthError("");
            var cfg=sbLoadConfig();if(cfg)sbInitClient(cfg.url,cfg.anonKey);
            var fn=authMode==="login"?sbSignIn:sbSignUp;
            fn(authUser.trim(),authPass).then(function(d){if(d.user){setCloudUser(d.user);setCloudStatus("signed in as "+d.user.email);setShowAuthModal(false);setAuthError("");showToast(authMode==="login"?"Signed in as "+d.user.email:"Account created!","var(--good)");
              sbPullSnapshot().then(function(cloud){if(cloud){var lp=_buildPayload();var merged=sbMerge(lp,cloud);_applyPayload(merged)}}).catch(function(e){console.warn("[CloudSync]",e)})
            }}).catch(function(e){setAuthError(e.message)}).finally(function(){setAuthLoading(false)})
          }},authLoading?"...":authMode==="login"?"Sign In":"Sign Up"),
          React.createElement("button",{className:"btn btn-ghost",style:{flex:1},onClick:function(){setAuthMode(authMode==="login"?"signup":"login");setAuthError("")}},authMode==="login"?"Create Account":"Back to Login")),
        React.createElement("button",{onClick:function(){setShowAuthModal(false)},style:{width:"100%",marginTop:10,background:"none",border:"none",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:11,padding:"8px"}},"Cancel"))),

    /* ═══ SYNC STATUS BAR ═══ */
    (cloudUser||sbLoadConfig())&&React.createElement("div",{className:"sync-bar"},
      React.createElement("div",{className:"sync-dot "+(syncIndicator.online?"online":"offline")}),
      React.createElement("span",{style:{color:syncIndicator.online?"var(--sync-good)":"var(--sync-err)"}},syncIndicator.online?"Online":"Offline"),
      cloudUser?React.createElement("span",{style:{color:"var(--sub)"}}," · "+cloudUser.email.split("@")[0]):React.createElement("span",{style:{color:"var(--dim)"}}," · Signed out"),
      syncIndicator.status==="pushing"&&React.createElement("span",{style:{color:"var(--sync-warn)"}}," · Syncing..."),
      syncIndicator.status==="pulling"&&React.createElement("span",{style:{color:"var(--sync-warn)"}}," · Pulling..."),
      syncIndicator.status==="error"&&React.createElement("span",{style:{color:"var(--sync-err)"}}," · Error"),
      syncIndicator.lastSync&&React.createElement("span",{style:{color:"var(--dim)",marginLeft:"auto"}},"Last sync: "+new Date(syncIndicator.lastSync).toLocaleTimeString()),
      !cloudUser&&React.createElement("button",{onClick:function(){setShowAuthModal(true)},style:{marginLeft:"auto",background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"2px 10px",cursor:"pointer",color:"var(--gold)",fontFamily:"var(--f)",fontSize:9,minHeight:24}},"Sign In")),

    /* HEADER */
    React.createElement("div",{style:{background:theme==="light"?"linear-gradient(180deg,#f0efe8,var(--bg))":"linear-gradient(180deg,var(--card),var(--bg))",borderBottom:"1px solid var(--border)",padding:"max(env(safe-area-inset-top,12px),12px) 16px 0",marginTop:(cloudUser||sbLoadConfig())?28:0}},
      React.createElement("div",{style:{maxWidth:860,margin:"0 auto"}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
            React.createElement("h1",{style:{fontSize:20,fontWeight:300,letterSpacing:"0.14em",color:"var(--gold)"}},"WATCH ADVISOR"),
            /* Back / Forward nav buttons */
            canGoBack&&React.createElement("button",{onClick:function(){try{window.history.back()}catch(e){navBack()}},style:{background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:"var(--gold)",fontSize:14,minHeight:32,transition:"all .2s cubic-bezier(.22,.68,0,1)",opacity:1},title:"Back"},"‹"),
            canGoFwd&&React.createElement("button",{onClick:navFwd,style:{background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"4px 10px",cursor:"pointer",color:"var(--gold)",fontSize:14,minHeight:32,transition:"all .2s cubic-bezier(.22,.68,0,1)",opacity:1},title:"Forward"},"›")),
          React.createElement("div",{style:{display:"flex",gap:6,alignItems:"center"}},
            React.createElement("button",{className:"theme-toggle",onClick:function(){var nt=theme==="dark"?"light":"dark";setTheme(nt);ps("wa_theme",nt)},title:theme==="dark"?"Switch to Day mode":"Switch to Night mode"},theme==="dark"?"☀️":"🌙"),
            cloudUser?React.createElement("button",{onClick:async function(){try{await sbSignOut();setCloudUser(null);setCloudStatus("");showToast("Signed out","var(--good)")}catch(e){showToast("Sign out error: "+e.message,"var(--warn)")}},style:{background:"none",border:"1px solid rgba(122,184,122,0.3)",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"var(--good)",fontSize:11,fontFamily:"var(--f)",minHeight:32},title:"Sign out"},"👤"):sbLoadConfig()&&React.createElement("button",{onClick:function(){setShowAuthModal(true)},style:{background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"var(--dim)",fontSize:11,fontFamily:"var(--f)",minHeight:32},title:"Sign in"},"👤"),
            React.createElement("button",{onClick:function(){setShowSettings(true)},style:{background:"none",border:"1px solid "+(apiKey?"rgba(122,184,122,0.3)":"var(--border)"),borderRadius:8,padding:"6px 10px",cursor:"pointer",color:apiKey?"var(--good)":"var(--dim)",fontSize:14,minHeight:32}},apiKey?"🔑":"⚙️"))),
        React.createElement("div",{role:"tablist",style:{display:"flex",gap:0,marginTop:6},className:"hscroll"},
          [{id:"today",l:"📅 TODAY",c:0},{id:"wardrobe",l:"👕 CLOSET",c:wd.length},{id:"fits",l:"✨ FITS",c:0},{id:"insights",l:"🔮 INSIGHTS",c:0},{id:"watches",l:"⌚ WATCHES",c:actW.length},{id:"saved",l:"💾 SAVED",c:saved.length}].map(function(t){
            return React.createElement("button",{key:t.id,role:"tab","aria-selected":view===t.id&&!selFit,onClick:function(){if(view!==t.id||selFit)navTo(t.id,null)},style:{background:"none",border:"none",borderBottom:view===t.id&&!selFit?"2px solid var(--gold)":"2px solid transparent",color:view===t.id&&!selFit?"var(--gold)":"var(--dim)",padding:"10px 14px",fontFamily:"var(--f)",fontSize:10,fontWeight:500,letterSpacing:"0.1em",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,minHeight:40}},
              t.l+(t.c>0?" "+t.c:""))})),
        React.createElement("div",{style:{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8,marginTop:2,paddingBottom:2}},React.createElement("button",{onClick:function(){if("serviceWorker" in navigator){navigator.serviceWorker.getRegistration().then(function(reg){if(reg){reg.update().then(function(){if(reg.waiting){reg.waiting.postMessage({type:"SKIP_WAITING"});window.location.reload()}else{window.location.reload()}}).catch(function(){window.location.reload()})}else{window.location.reload()}})}else{window.location.reload()}},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"2px 8px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:8}},"🔄 Update"),React.createElement("button",{onClick:function(){if("serviceWorker" in navigator&&navigator.serviceWorker.controller){navigator.serviceWorker.controller.postMessage({type:"CLEAR_ALL_CACHES"})}else{window.location.href="./?v="+Date.now()}},style:{background:"none",border:"1px solid rgba(200,90,58,0.3)",borderRadius:6,padding:"2px 8px",cursor:"pointer",color:"var(--warn)",fontFamily:"var(--f)",fontSize:8}},"💣 Force"),React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},"v26.0")))),

    React.createElement("div",{ref:mainRef,style:{maxWidth:860,margin:"0 auto",padding:"0 16px"}},

      /* ═══ TODAY DASHBOARD ═══ */
      view==="today"&&React.createElement("div",{key:"tab-today",className:"tab-content",style:{paddingTop:16,paddingBottom:40}},
        /* Weather bar */
        weather&&React.createElement("div",{style:{background:"linear-gradient(135deg,var(--card),var(--card2))",border:"1px solid "+(weather.cond&&weather.cond.rain?"rgba(100,150,220,0.4)":"var(--border)"),borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}},
          React.createElement("span",{style:{fontSize:22}},weather.cond?weather.cond.i:""),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:18,fontWeight:600,fontFamily:"var(--f)"}},weather.temp+"°C"),
            React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},"Feels "+weather.feels+"°C · "+loc.name)),
          React.createElement("div",{style:{flex:1,minWidth:100}},
            React.createElement("div",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},(function(){var wt=getWT(weather.feels);return wt?wt.label:""}()),
              " · ",todayWk==="rain"?"Rain":""),
            React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)"}},(function(){var wt=getWT(weather.feels);return wt?wt.advice:""}())))),
        /* Context + Controls */
        React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center",marginBottom:14,flexWrap:"wrap"}},
          React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--dim)"}},"Context:"),
          React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,background:"rgba(201,168,76,0.1)",borderRadius:6,padding:"4px 10px",border:"1px solid rgba(201,168,76,0.2)"}},(activeCxIcons[todayCtx[0]]||"")+" "+(todayCtx[0]||"smart-casual")),
          todayWorn&&React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--good)",background:"rgba(122,184,122,0.1)",borderRadius:6,padding:"4px 8px",border:"1px solid rgba(122,184,122,0.2)"}},"✓ Wearing: "+(function(){var w=W.find(function(x){return x.id===todayWorn.watchId});return w?w.n:"?"})()),
          React.createElement("div",{style:{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}},
            React.createElement("button",{onClick:function(){var nv=!preferUnworn;setPreferUnworn(nv);ps("wa_prefer_fresh",nv?1:0)},style:{background:preferUnworn?"rgba(122,184,122,0.12)":"var(--bg)",border:"1px solid "+(preferUnworn?"rgba(122,184,122,0.3)":"var(--border)"),borderRadius:8,padding:"5px 10px",cursor:"pointer",color:preferUnworn?"var(--good)":"var(--dim)",fontFamily:"var(--f)",fontSize:9,fontWeight:preferUnworn?600:400,minHeight:28}},preferUnworn?"🔄 Fresh ON":"🔄 Fresh"),
            React.createElement("button",{onClick:function(){setTodayRefreshKey(function(k){return k+1});setTodaySwapWatch(null)},style:{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:8,padding:"5px 10px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:9,minHeight:28}},"🔄 Refresh"))),
        /* Empty state */
        !todayFits.length&&React.createElement("div",{style:{textAlign:"center",padding:"50px 16px"}},
          React.createElement("p",{style:{fontSize:28,margin:"0 0 8px"}},"📅"),
          React.createElement("p",{style:{fontSize:13,fontFamily:"var(--f)",color:"var(--dim)"}},"Need at least 2 wardrobe items and 1 watch to generate fits."),
          React.createElement("button",{onClick:function(){navTo("wardrobe",null)},className:"btn btn-gold",style:{marginTop:12}},"Go to Closet")),
        /* Top 3 Fits */
        todayFits.map(function(fit,fi){
          var w0=todaySwapWatch&&fi===0?(function(){var sw=fit.allW&&fit.allW.find(function(x){return x.id===todaySwapWatch});return sw||fit.watches[0]})():fit.watches&&fit.watches[0];
          var sr0=w0?w0.sr:null;
          var isBest=fi===0;
          /* "Why" bullets */
          var whys=[];
          if(w0){var _ds=daysSince(w0.id);if(_ds>=14)whys.push("Unworn "+_ds+"d+")}
          fit.items.forEach(function(it){if(it.lastWorn){var d=Math.floor((Date.now()-new Date(it.lastWorn).getTime())/864e5);if(d>=14)whys.push((it.name||it.color)+" unworn "+d+"d+")}});
          if(todayWk==="rain"&&sr0&&sr0.strap&&(sr0.strap.type==="bracelet"||sr0.strap.type==="rubber"))whys.push("Rain-safe strap");
          if(preferUnworn)whys.push("Freshness boost");
          return React.createElement("div",{key:fit.id||fi,style:{background:isBest?"linear-gradient(135deg,var(--card),var(--card2))":"var(--card)",border:"1px solid "+(isBest?"rgba(201,168,76,0.3)":"var(--border)"),borderRadius:14,padding:"16px",marginBottom:12}},
            /* Header */
            React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
                isBest&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:700,background:"rgba(201,168,76,0.1)",padding:"3px 8px",borderRadius:4}},"BEST FIT"),
                !isBest&&React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},"Fit #"+(fi+1))),
              React.createElement("div",{style:{width:40,height:40,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid "+(fit.fs>=7?"var(--good)":fit.fs>=4?"var(--gold)":"var(--warn)"),fontSize:14,fontFamily:"var(--f)",fontWeight:700,color:fit.fs>=7?"var(--good)":fit.fs>=4?"var(--gold)":"var(--warn)"}},fit.fs.toFixed(1))),
            /* Outfit figure + components */
            React.createElement("div",{style:{display:"flex",gap:14,marginBottom:10}},
              React.createElement(OutfitFigure,{topColor:fit.top?fit.top.color:"grey",botColor:fit.bot?fit.bot.color:"charcoal",shoeColor:fit.shoe?fit.shoe.color:"black",watchColor:w0?w0.c:"#c9a84c",watchIcon:w0?w0.i:"⌚",watchName:w0?w0.n:"",size:80}),
              React.createElement("div",{style:{flex:1,minWidth:0}},
                /* Layers */
                (fit.layers||[fit.top].filter(Boolean)).map(function(t,ti){return React.createElement("div",{key:t.id||ti,style:{display:"flex",alignItems:"center",gap:6,marginBottom:3}},
                  t.photoUrl&&React.createElement("img",{src:ph(t.photoUrl),alt:"",decoding:"async",style:{width:20,height:20,objectFit:"cover",borderRadius:3}}),
                  React.createElement(Dot,{color:t.color,size:6}),
                  React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)"}},t.name||(t.color+" "+t.garmentType)))}),
                /* Bottom */
                fit.bot&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:3}},
                  fit.bot.photoUrl&&React.createElement("img",{src:ph(fit.bot.photoUrl),alt:"",decoding:"async",style:{width:20,height:20,objectFit:"cover",borderRadius:3}}),
                  React.createElement(Dot,{color:fit.bot.color,size:6}),
                  React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)"}},fit.bot.name||(fit.bot.color+" "+fit.bot.garmentType))),
                /* Shoes */
                fit.shoe&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:3}},
                  fit.shoe.photoUrl&&React.createElement("img",{src:ph(fit.shoe.photoUrl),alt:"",decoding:"async",style:{width:20,height:20,objectFit:"cover",borderRadius:3}}),
                  React.createElement(Dot,{color:fit.shoe.color,size:6}),
                  React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)"}},fit.shoe.name||(fit.shoe.color+" "+fit.shoe.garmentType))))),
            /* Watch + Strap recommendation */
            w0&&React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center",background:"var(--bg)",borderRadius:8,padding:"8px 10px",marginBottom:8,border:"1px solid "+(isBest?"rgba(201,168,76,0.2)":"var(--border)")}},
              React.createElement("div",{style:{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:(w0.c||"#c9a84c")+"20",fontSize:16,flexShrink:0}},w0.i||"⌚"),
              React.createElement("div",{style:{flex:1,minWidth:0}},
                React.createElement("div",{style:{fontSize:11,fontFamily:"var(--f)",fontWeight:600,color:"var(--gold)"}},w0.n),
                sr0&&React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:sr0.type==="good"?"var(--good)":"var(--sub)"}},sr0.text)),
              sr0&&sr0.strap&&React.createElement(StrapSwatch,{strap:sr0.strap,size:8})),
            /* Why bullets */
            whys.length>0&&React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}},
              whys.slice(0,4).map(function(w,i){return React.createElement("span",{key:i,style:{fontSize:8,fontFamily:"var(--f)",color:"var(--sub)",background:"var(--bg)",borderRadius:4,padding:"2px 8px",border:"1px solid var(--border)"}},"• "+w)})),
            /* Weather warnings */
            fit.wxWarns&&fit.wxWarns.length>0&&React.createElement("div",{style:{marginBottom:8}},fit.wxWarns.map(function(w,i){return React.createElement("div",{key:i,style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)"}},w)})),
            /* Actions (top fit only) */
            isBest&&React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
              React.createElement("button",{onClick:function(){
                /* Wear this: log watch wear + strap wear + update garment lastWorn */
                if(w0){
                  logWear(w0.id,todayStr);
                  if(sr0&&sr0.strap)logStrapWear(w0.id,sr0.strap,todayCtx[0]||"smart-casual",todayWk);
                  else if(w0.straps&&w0.straps.length===1)logStrapWear(w0.id,w0.straps[0],todayCtx[0]||"smart-casual",todayWk);
                }
                /* Update lastWorn on garments */
                var itemIds=new Set((fit.items||[]).map(function(it){return it.id}));
                setWd(function(prev){var changed=false;var nw=prev.map(function(g){if(itemIds.has(g.id)){changed=true;return Object.assign({},g,{lastWorn:todayStr})}return g});if(changed)ps("wd_"+SK,nw);return changed?nw:prev});
                showToast("✓ Logged today's fit!","var(--good)");haptic(20);
              },className:"btn btn-gold",style:{flex:1,fontSize:11,padding:"10px 14px"}},"👔 Wear this"),
              React.createElement("button",{onClick:function(){saveFit(fit);showToast("💾 Outfit saved!","var(--good)");haptic(15)},style:{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 14px",cursor:"pointer",color:"var(--sub)",fontFamily:"var(--f)",fontSize:11,fontWeight:500,minHeight:40}},"💾 Save"),
              React.createElement("button",{onClick:function(){setTodaySwapWatch(todaySwapWatch?null:"__open__")},style:{background:todaySwapWatch?"rgba(201,168,76,0.12)":"var(--bg)",border:"1px solid "+(todaySwapWatch?"rgba(201,168,76,0.3)":"var(--border)"),borderRadius:10,padding:"10px 14px",cursor:"pointer",color:"var(--sub)",fontFamily:"var(--f)",fontSize:11,fontWeight:500,minHeight:40}},"⌚ Swap")),
            /* Swap watch picker (inline, first fit only) */
            isBest&&todaySwapWatch&&fit.allW&&React.createElement("div",{style:{marginTop:8,background:"var(--bg)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,padding:"10px",maxHeight:200,overflowY:"auto"}},
              React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",marginBottom:6}},"Pick a different watch:"),
              React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}},
                fit.allW.slice(0,8).map(function(aw){
                  var isActive=todaySwapWatch===aw.id;
                  return React.createElement("button",{key:aw.id,onClick:function(){setTodaySwapWatch(isActive?null:aw.id)},style:{display:"flex",alignItems:"center",gap:6,padding:"6px 8px",background:isActive?"rgba(201,168,76,0.12)":"var(--card)",border:"1px solid "+(isActive?"rgba(201,168,76,0.3)":"var(--border)"),borderRadius:8,cursor:"pointer",textAlign:"left"}},
                    React.createElement("span",{style:{fontSize:14}},aw.i||"⌚"),
                    React.createElement("div",{style:{flex:1,minWidth:0}},
                      React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",fontWeight:600,color:isActive?"var(--gold)":"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},aw.n),
                      React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)"}},aw.score>0?"+"+aw.score.toFixed(1):""+aw.score.toFixed(1))))}))))
        })),

      /* ═══ WARDROBE ═══ */
      view==="wardrobe"&&React.createElement("div",{key:"tab-wardrobe",className:"tab-content",style:{paddingTop:16,paddingBottom:40}},
        wxErr&&!weather&&React.createElement("div",{style:{background:"rgba(200,90,58,0.08)",border:"1px solid rgba(200,90,58,0.25)",borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:10}},
          React.createElement("span",{style:{fontSize:18}},"⚠️"),
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600}},"Weather unavailable"),
            React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},"Scoring defaults to mid-weight. Enable location or check connection.")),
          React.createElement("button",{onClick:function(){setWxErr(false);if(navigator.geolocation)navigator.geolocation.getCurrentPosition(function(p){setLoc({lat:p.coords.latitude,lon:p.coords.longitude,name:"Your Location"})},function(){},{timeout:5000})},style:{background:"none",border:"1px solid rgba(200,90,58,0.3)",borderRadius:8,padding:"6px 12px",color:"var(--warn)",fontFamily:"var(--f)",fontSize:10,cursor:"pointer",whiteSpace:"nowrap"}},"Retry")),
        weather&&React.createElement("div",{style:{background:"linear-gradient(135deg,var(--card),var(--card2))",border:"1px solid "+(planWx&&planWx.rain?"rgba(100,150,220,0.4)":"var(--border)"),borderRadius:12,padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}},
          React.createElement("span",{style:{fontSize:22}},planWx&&planWx.cond?planWx.cond.i:tier?tier.icon:""),
          React.createElement("div",null,React.createElement("div",{style:{fontSize:18,fontWeight:600,fontFamily:"var(--f)"}},planTemp?planTemp.temp+"°C":weather.temp+"°C"),React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},"Feels "+(planTemp?planTemp.feels:weather.feels)+"°C · "+loc.name+(planDay>0&&forecast[planDay]?" · "+forecast[planDay].date:""))),
          React.createElement("div",{style:{flex:1,minWidth:100}},
            React.createElement("div",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},planWx&&planWx.cond?planWx.cond.l:tier?tier.label:""),
            React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)"}},tier?tier.advice:"")),
          planWx&&React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
            planWx.rainPct>0&&React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:planWx.rainPct>=50?"#7ab8d8":"var(--sub)",background:planWx.rainPct>=50?"rgba(100,150,220,0.1)":"var(--bg)",borderRadius:6,padding:"3px 8px",border:"1px solid "+(planWx.rainPct>=50?"rgba(100,150,220,0.25)":"var(--border)")}},"🌧️ "+planWx.rainPct+"%"),
            planWx.uv>=4&&React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:planWx.uv>=8?"var(--warn)":"var(--sub)",background:"var(--bg)",borderRadius:6,padding:"3px 8px",border:"1px solid var(--border)"}},"☀️ UV "+planWx.uv),
            planWx.wind>=20&&React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:planWx.wind>=40?"var(--warn)":"var(--sub)",background:"var(--bg)",borderRadius:6,padding:"3px 8px",border:"1px solid var(--border)"}},"💨 "+planWx.wind+"km/h"))),

        React.createElement("input",{ref:fRef,type:"file",accept:"image/*",multiple:true,style:{display:"none"},onChange:function(e){if(e.target.files&&e.target.files.length){processFiles(e.target.files);e.target.value=""}}}),
        React.createElement("input",{ref:cRef,type:"file",accept:"image/*",capture:"environment",style:{display:"none"},onChange:function(e){if(e.target.files&&e.target.files.length){processFiles(e.target.files);e.target.value=""}}}),
        React.createElement("div",{style:{border:"2px dashed var(--border)",borderRadius:14,padding:"18px 16px",textAlign:"center",background:"var(--card)",marginBottom:14}},
          React.createElement("p",{style:{fontSize:18,margin:"0 0 4px"}},"📸"),
          React.createElement("p",{style:{fontSize:12,fontFamily:"var(--f)",fontWeight:500,margin:"0 0 10px"}},"Upload photos or add manually"),
          React.createElement("div",{style:{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}},
            React.createElement("button",{onClick:function(){if(fRef.current)fRef.current.click()},style:{background:"linear-gradient(135deg,var(--gold),#a8882a)",borderRadius:8,padding:"12px 18px",color:"var(--bg)",fontFamily:"var(--f)",fontSize:12,fontWeight:600,cursor:"pointer",minHeight:44,display:"flex",alignItems:"center",border:"none"}},"📁 Upload"),
            React.createElement("button",{onClick:function(){if(cRef.current)cRef.current.click()},style:{background:"var(--card2)",border:"1px solid var(--border)",borderRadius:8,padding:"12px 18px",color:"var(--sub)",fontFamily:"var(--f)",fontSize:12,cursor:"pointer",minHeight:44,display:"flex",alignItems:"center"}},"📷 Camera"),
            React.createElement("button",{onClick:function(){setAddG(true)},style:{background:"var(--card2)",border:"1px solid var(--border)",borderRadius:8,padding:"12px 18px",color:"var(--sub)",fontFamily:"var(--f)",fontSize:12,cursor:"pointer",minHeight:44}},"✏️ Manual"))),

        proc.length>0&&React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}},proc.map(function(p){return React.createElement("div",{key:p,style:{background:"var(--card)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:8}},React.createElement("div",{className:"sp",style:{width:14,height:14,border:"2px solid var(--gold)",borderTopColor:"transparent",borderRadius:"50%"}}),React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)"}},"Identifying..."))})),

        wd.length>0&&React.createElement(React.Fragment,null,
          needsFix>0&&React.createElement("div",{style:{background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:10,padding:"10px 14px",marginBottom:10}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
              React.createElement("p",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)",margin:0,fontWeight:500,flex:1}},"⚠️ "+needsFix+" items need classification — tap to set type & color"),
              React.createElement("button",{onClick:async function(){
                var broken=wd.filter(function(i){return(i.needsEdit||!i.color)&&i.photoUrl});
                if(!broken.length)return;
                for(var k=0;k<broken.length;k++){
                  var it=broken[k];
                  try{var compressed=await compressImage(it.photoUrl,600,0.6);var b64=compressed.split(",")[1];
                    var aiResult=await aiID(b64,"image/jpeg",apiKeyRef.current);
                    if(aiResult&&aiResult.length)updG(it.id,aiResult[0]);else setAiErr(getLastAiError());
                  }catch(e){console.warn("[WA]",e)}
                  if(k<broken.length-1)await new Promise(function(r){setTimeout(r,800)});
                }
              },style:{background:"var(--gold)",color:"var(--bg)",border:"none",borderRadius:8,padding:"8px 14px",fontFamily:"var(--f)",fontSize:11,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",minHeight:36}},"🔄 Retry AI"))),
          aiErr&&React.createElement("div",{style:{background:"rgba(200,90,58,0.08)",border:"1px solid rgba(200,90,58,0.3)",borderRadius:10,padding:"10px 14px",marginBottom:10}},
            React.createElement("div",{style:{display:"flex",alignItems:"flex-start",gap:8}},
              React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--warn)",margin:0,flex:1,wordBreak:"break-all"}},"🚨 AI Error: "+aiErr),
              React.createElement("button",{onClick:function(){setAiErr("")},style:{background:"none",border:"none",color:"var(--warn)",cursor:"pointer",fontSize:14}},"✕"))),

          React.createElement("div",{style:{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}},
            [{id:"all",l:"All "+wd.length},{id:"tops",l:"Tops "+byCat.tops.length},{id:"bottoms",l:"Btms "+byCat.bottoms.length},{id:"shoes",l:"Shoes "+byCat.shoes.length}].map(function(f){return React.createElement(Pill,{key:f.id,on:wFilt===f.id,onClick:function(){setWFilt(f.id);setWMatFilt("all");setWColFilt("all")}},f.l)}),
            React.createElement("button",{onClick:function(){if(selMode){clearSel()}else{selIdsRef.current=new Set();setSelMode(true);setSelTick(0)}},style:{background:selMode?"rgba(201,168,76,0.15)":"none",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,padding:"8px 14px",color:"var(--gold)",fontFamily:"var(--f)",fontSize:10,cursor:"pointer",minHeight:36,marginLeft:"auto"}},selMode?"✕ Cancel":"☑️ Select"),
            React.createElement("button",{onClick:function(){var dupes=findDuplicates();setDupeGroups(dupes);setShowDupes(true)},style:{background:"none",border:"1px solid rgba(201,168,76,0.3)",borderRadius:20,padding:"8px 14px",color:"var(--gold)",fontFamily:"var(--f)",fontSize:10,cursor:"pointer",minHeight:36}},"🔍 Dupes"),
            React.createElement("button",{onClick:function(){setConfirmDlg({msg:"Clear entire wardrobe?",danger:true,onOk:function(){saveWd([]);setWFilt("all");setConfirmDlg(null)}})},style:{background:"none",border:"1px solid var(--del-border)",borderRadius:20,padding:"8px 14px",color:"var(--del-text)",fontFamily:"var(--f)",fontSize:10,cursor:"pointer",minHeight:36}},"Clear"),
            (function(){var archCount=wd.filter(function(i){return i.archived}).length;return archCount>0?React.createElement(Pill,{on:showArchived,onClick:function(){setShowArchived(!showArchived)}},(showArchived?"👁️ Hide":"❄️ Show")+" "+archCount+" archived"):null})()), 
          /* Material quick-filter */
          (function(){var filteredForMats=wFilt==="all"?wd:wd.filter(function(i){return catOf(i.garmentType)===wFilt});var mc={};filteredForMats.forEach(function(i){if(i.material)mc[i.material]=(mc[i.material]||0)+1});var mats=Object.entries(mc).sort(function(a,b){return b[1]-a[1]}).slice(0,8);return mats.length>=2?React.createElement("div",{className:"hscroll",style:{display:"flex",gap:4,marginBottom:8,paddingBottom:2}},React.createElement(Pill,{on:wMatFilt==="all",onClick:function(){setWMatFilt("all")}},"All Materials"),mats.map(function(m){return React.createElement(Pill,{key:m[0],on:wMatFilt===m[0],onClick:function(){setWMatFilt(wMatFilt===m[0]?"all":m[0])}},m[0]+" ×"+m[1])})):null})(),

          /* Color quick-filter dots */
          (function(){var filteredForCols=wFilt==="all"?wd:wd.filter(function(i){return catOf(i.garmentType)===wFilt});var cc={};filteredForCols.forEach(function(i){if(i.color)cc[i.color]=(cc[i.color]||0)+1});var cols=Object.entries(cc).sort(function(a,b){return b[1]-a[1]}).slice(0,16);return cols.length>=3?React.createElement("div",{className:"hscroll",style:{display:"flex",gap:5,marginBottom:8,paddingBottom:2}},React.createElement("span",{onClick:function(){setWColFilt("all")},style:{display:"inline-flex",alignItems:"center",gap:3,fontSize:8,fontFamily:"var(--f)",padding:"3px 8px",borderRadius:12,cursor:"pointer",background:wColFilt==="all"?"rgba(201,168,76,0.15)":"transparent",border:"1px solid "+(wColFilt==="all"?"rgba(201,168,76,0.3)":"var(--border)"),color:wColFilt==="all"?"var(--gold)":"var(--dim)",whiteSpace:"nowrap"}},"All"),cols.map(function(c){return React.createElement("span",{key:c[0],onClick:function(){setWColFilt(wColFilt===c[0]?"all":c[0])},style:{display:"inline-flex",alignItems:"center",gap:3,fontSize:8,fontFamily:"var(--f)",padding:"3px 8px",borderRadius:12,cursor:"pointer",background:wColFilt===c[0]?"rgba(201,168,76,0.15)":"transparent",border:"1px solid "+(wColFilt===c[0]?"rgba(201,168,76,0.3)":"var(--border)"),color:wColFilt===c[0]?"var(--gold)":"var(--dim)",whiteSpace:"nowrap"}},React.createElement(Dot,{color:c[0],size:6}),c[0]+" ×"+c[1])})):null})(),
          /* Hidden re-scan input */
          React.createElement("input",{ref:reScanRef,type:"file",accept:"image/*",capture:"environment",style:{display:"none"}}),
          React.createElement(VirtualGrid,{items:filteredWd,pageSize:24,deps:selTick,gridStyle:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(115px,1fr))",gap:8},renderItem:function(item){
              var _isSel=selMode&&selIdsRef.current.has(item.id);return React.createElement("div",{key:item.id,className:"gcard",onClick:function(){if(selMode){toggleSel(item.id)}else{setEditG(item)}},onPointerDown:function(){if(!selMode){longPressTimer.current=setTimeout(function(){selIdsRef.current=new Set([item.id]);setSelMode(true);setSelTick(1)},500)}},onPointerUp:function(){clearTimeout(longPressTimer.current)},onPointerLeave:function(){clearTimeout(longPressTimer.current)},style:{background:_isSel?"rgba(201,168,76,0.12)":item.needsEdit||!item.color?"var(--card2)":"var(--card)",border:"1px solid "+(_isSel?"var(--gold)":item.needsEdit||!item.color?"rgba(201,168,76,0.3)":"var(--border)")}},
                (function(){var _phUrl=item.photoUrl?ph(item.photoUrl):null;return _phUrl?React.createElement(React.Fragment,null,React.createElement(LazyImg,{src:_phUrl,alt:"",onClick:function(e){e.stopPropagation();openLightbox(item.photoUrl,item.id)},style:{width:"100%",height:100,objectFit:"cover",display:"block",cursor:"zoom-in"}}),React.createElement("div",{className:"gcard-overlay"})):React.createElement("div",{style:{width:"100%",height:item.photoUrl?100:70,background:(CM[item.color]||{}).h||"#2a2a2a",display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement("span",{style:{fontSize:12,fontFamily:"var(--f)",color:"#fff8",textShadow:"0 1px 3px #000"}},item.photoUrl?"⏳":item.color))})(),
                React.createElement("div",{style:{padding:"8px 10px"}},
                  React.createElement("div",{style:{display:"flex",alignItems:"center",gap:4}},
                    item.color&&React.createElement(Dot,{color:item.color,size:8}),
                    React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}},item.name||item.color||"Tap to classify")),
                  React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},item.garmentType+(item.pattern&&item.pattern!=="solid"?" · "+item.pattern:""))),
                (item.needsEdit||!item.color)&&React.createElement("div",{style:{position:"absolute",top:4,right:4,background:"rgba(201,168,76,0.9)",borderRadius:4,padding:"2px 6px"}},React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--bg)",fontWeight:700}},"FIX")),selMode&&React.createElement("div",{style:{position:"absolute",top:4,left:4,width:22,height:22,borderRadius:"50%",background:_isSel?"var(--gold)":"rgba(0,0,0,0.5)",border:"2px solid "+(_isSel?"var(--gold)":"rgba(255,255,255,0.4)"),display:"flex",alignItems:"center",justifyContent:"center",zIndex:3}},_isSel&&React.createElement("span",{style:{color:"var(--bg)",fontSize:13,fontWeight:700}},"\u2713")),
                item.positionHint&&React.createElement("div",{style:{position:"absolute",top:4,left:4,background:"rgba(0,0,0,0.7)",borderRadius:4,padding:"2px 6px"}},React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},"📸 "+item.positionHint)),
                item.photoUrl&&React.createElement("button",{onClick:function(e){e.stopPropagation();var inp=reScanRef.current;if(!inp)return;inp.onchange=async function(ev){var fl=ev.target.files[0];if(!fl)return;try{var raw=await new Promise(function(r){var x=new FileReader();x.onload=function(){r(x.result)};x.readAsDataURL(fl)});var compressed=await compressImage(raw,1200,0.82);updG(item.id,{photoUrl:compressed});inp.value=""}catch(err){console.error(err)}};inp.click()},style:{position:"absolute",bottom:32,right:24,background:"rgba(0,0,0,0.65)",border:"none",borderRadius:4,padding:"3px 6px",cursor:"pointer",color:"#fff",fontSize:10,zIndex:2,lineHeight:1},title:"Re-photograph"},"📸"),
                item.material&&React.createElement("div",{style:{position:"absolute",bottom:32,right:4,background:"rgba(0,0,0,0.6)",borderRadius:4,padding:"2px 5px"}},React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"#aaa"}},item.material)),
                item.lastWorn&&React.createElement("div",{style:{position:"absolute",bottom:32,left:4,background:"rgba(0,0,0,0.6)",borderRadius:4,padding:"2px 5px"}},React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:(function(){var d=Math.floor((Date.now()-new Date(item.lastWorn).getTime())/864e5);return d<=2?"#e8a87c":d<=7?"#aaa":"#7a7"})()}},(function(){var d=Math.floor((Date.now()-new Date(item.lastWorn).getTime())/864e5);return d===0?"worn today":d===1?"1d ago":d+"d ago"})())),
                (function(){if(!item.lastWorn)return null;var d=Math.floor((Date.now()-new Date(item.lastWorn).getTime())/864e5);if(d<14)return null;return React.createElement("div",{className:"unworn-badge"},d+"d")}()),
                item.seasons&&item.seasons.length>0&&item.seasons.length<4&&React.createElement("div",{style:{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",borderRadius:4,padding:"2px 4px"}},React.createElement("span",{style:{fontSize:8}},item.seasons.map(function(s){return{spring:"🌸",summer:"☀️",fall:"🍂",winter:"❄️"}[s]||""}).join(""))))}}),

          /* Batch action bar */
          selMode&&selIdsRef.current.size>0&&React.createElement("div",{style:{display:"flex",gap:6,marginTop:10,padding:"10px 14px",background:"var(--card)",border:"1px solid var(--gold)",borderRadius:10,alignItems:"center",flexWrap:"wrap"}},
            React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,flex:1,minWidth:80}},selIdsRef.current.size+" selected"),
            React.createElement("button",{onClick:function(){selIdsRef.current=new Set(filteredWd.map(function(i){return i.id}));setSelTick(function(t){return t+1})},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"6px 12px",color:"var(--dim)",fontFamily:"var(--f)",fontSize:10,cursor:"pointer",minHeight:32}},"Select All"),
            React.createElement("button",{onClick:batchArchive,style:{background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:6,padding:"6px 12px",color:"var(--gold)",fontFamily:"var(--f)",fontSize:10,cursor:"pointer",minHeight:32}},"📦 Archive"),
            React.createElement("button",{onClick:function(){setBatchTypeMenu(!batchTypeMenu)},style:{background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:6,padding:"6px 12px",color:"var(--gold)",fontFamily:"var(--f)",fontSize:10,cursor:"pointer",minHeight:32}},"🏷️ Reclassify"),
            React.createElement("button",{onClick:batchDelete,style:{background:"rgba(200,90,58,0.15)",border:"1px solid rgba(200,90,58,0.4)",borderRadius:6,padding:"6px 14px",color:"var(--warn)",fontFamily:"var(--f)",fontSize:10,fontWeight:600,cursor:"pointer",minHeight:32}},"\uD83D\uDDD1\uFE0F Delete "+selIdsRef.current.size)),
          selMode&&batchTypeMenu&&React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginTop:6,padding:"8px 12px",background:"var(--card2)",borderRadius:8,border:"1px solid var(--border)"}},
            ALL_T.map(function(t){return React.createElement("span",{key:t,className:"chip",onClick:function(){batchSetType(t);setBatchTypeMenu(false)},style:{cursor:"pointer"}},t)})),
          React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 14px",marginTop:12}},
            React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",margin:0}},wdStats.summary),
            wdStats.unused>0&&React.createElement("p",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",margin:"4px 0 0"}},"💤 "+wdStats.unused+" item"+(wdStats.unused!==1?"s":"")+" never saved in an outfit"),
            /* Freshness bar */
            (function(){if(!wdStats.hasWorn)return null;var fresh=wdStats.fresh,mid=wdStats.mid,stale=wdStats.stale,total=fresh+mid+stale;if(!total)return null;return React.createElement("div",{style:{marginTop:6}},React.createElement("div",{style:{display:"flex",gap:8,fontSize:8,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:3}},React.createElement("span",null,"Rotation freshness:"),fresh>0&&React.createElement("span",{style:{color:"var(--good)"}},"🟢 "+fresh+" fresh"),mid>0&&React.createElement("span",{style:{color:"var(--gold)"}},"🟡 "+mid+" ok"),stale>0&&React.createElement("span",{style:{color:"var(--warn)"}},"🔴 "+stale+" stale")),React.createElement("div",{style:{height:3,borderRadius:2,background:"var(--bg)",overflow:"hidden",display:"flex"}},fresh>0&&React.createElement("div",{style:{width:fresh/total*100+"%",background:"var(--good)"}}),mid>0&&React.createElement("div",{style:{width:mid/total*100+"%",background:"var(--gold)"}}),stale>0&&React.createElement("div",{style:{width:stale/total*100+"%",background:"var(--warn)"}})))})()))),

      /* ═══ FITS ═══ */
      view==="fits"&&!selFit&&React.createElement("div",{key:"tab-fits",className:"tab-content",style:{paddingTop:16,paddingBottom:40}},
        /* MODE CARDS */
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12}},
          [{id:"auto",icon:"✨",l:"Smart",d:"AI-scored"},{id:"build",icon:"🧩",l:"Create",d:"Build & save"},{id:"selfie",icon:"📸",l:"Selfie",d:"Check look"},{id:"rotation",icon:"📅",l:"Week",d:"7-day plan"}].map(function(m){
            var on=mode===m.id;
            return React.createElement("button",{key:m.id,onClick:function(){setMode(m.id);if(m.id!=="auto"){setLockItem(null);setTopType("all")}},style:{background:on?"rgba(201,168,76,0.1)":"var(--card)",border:"1px solid "+(on?"rgba(201,168,76,0.4)":"var(--border)"),borderRadius:12,padding:"12px 8px",cursor:"pointer",textAlign:"center",transition:"all .15s"}},
              React.createElement("div",{style:{fontSize:20,marginBottom:2}},m.icon),
              React.createElement("div",{style:{fontSize:12,fontFamily:"var(--f)",fontWeight:on?700:500,color:on?"var(--gold)":"var(--text)"}},m.l),
              React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:on?"var(--gold)":"var(--dim)",opacity:0.7}},m.d))})),

        /* DAY SELECTOR for Auto/Build */
        mode!=="rotation"&&mode!=="selfie"&&forecast.length>0&&React.createElement("div",{style:{marginBottom:10}},
          React.createElement("div",{style:{display:"flex",gap:4,overflowX:"auto",paddingBottom:4},className:"hscroll"},
            forecast.map(function(fc,i){
              var d=new Date(fc.date+"T12:00:00");var dn=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
              var t=getWT(fc.feelsAvg);var hasRain=fc.cond&&fc.cond.rain;
              return React.createElement("button",{key:i,onClick:function(){setPlanDay(i)},style:{flex:"0 0 auto",background:planDay===i?"rgba(201,168,76,0.15)":hasRain?"rgba(100,150,220,0.06)":"var(--card)",border:"1px solid "+(planDay===i?"rgba(201,168,76,0.4)":hasRain?"rgba(100,150,220,0.2)":"var(--border)"),borderRadius:10,padding:"8px 10px",cursor:"pointer",minWidth:68,textAlign:"center"}},
                React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:planDay===i?"var(--gold)":"var(--sub)",fontWeight:planDay===i?700:400}},i===0?"Today":i===1?"Tmrw":dn),
                React.createElement("div",{style:{fontSize:16,margin:"2px 0"}},fc.cond?fc.cond.i:t?t.icon:""),
                React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:planDay===i?"var(--text)":"var(--dim)",fontWeight:600}},fc.high+"°/"+fc.low+"°"),
                fc.rainPct>0&&React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:fc.rainPct>=50?"#7ab8d8":"var(--dim)",fontWeight:fc.rainPct>=50?600:400}},"💧"+fc.rainPct+"%"),
                fc.wind>=25&&React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)"}},"💨"+fc.wind))}))),

        /* CONTEXT + CONTROLS ROW */
        mode!=="rotation"&&mode!=="selfie"&&React.createElement("div",{style:{marginBottom:10}},
          React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}},
            planDay>0&&JSON.stringify(effectiveCtx)!==JSON.stringify(ctx)&&React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",alignSelf:"center",marginRight:4}},"📅 "+(activeCxIcons[primaryCtx]||CXI[primaryCtx]||"")+primaryCtx),
            CTXS.map(function(c){return React.createElement(Pill,{key:c.id,on:Array.isArray(ctx)?ctx.includes(c.id):ctx===c.id,onClick:function(){setCtx(function(prev){var arr=Array.isArray(prev)?prev:[prev];if(arr.includes(c.id)){var f=arr.filter(function(x){return x!==c.id});return f.length?f:["smart-casual"]}return arr.concat([c.id])});if(planDay>0)setPlanDay(0)}},c.l)}),
            !IS_SHARED&&React.createElement("button",{onClick:function(){setReps(!reps)},style:{background:reps?"rgba(201,168,76,0.08)":"var(--card)",border:"1px solid "+(reps?"rgba(201,168,76,0.25)":"var(--border)"),borderRadius:20,padding:"8px 14px",cursor:"pointer",marginLeft:"auto",color:reps?"var(--gold)":"var(--dim)",fontFamily:"var(--f)",fontSize:11,minHeight:36}},reps?"Rep ON":"Rep OFF"))),

        /* AUTO-SPECIFIC FILTERS */
        mode==="auto"&&React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:10}},
          /* Top type filter */
          [{id:"all",l:"All Tops"},{id:"Shirt",l:"👔 Shirts"},{id:"Polo",l:"🏇 Polos"},{id:"T-Shirt",l:"👕 Tees"},{id:"Sweater/Knit",l:"🧶 Knits"},{id:"Jacket/Blazer",l:"🧥 Jackets"}].map(function(tf){
            return React.createElement("span",{key:tf.id,className:"chip "+(topType===tf.id?"on":""),onClick:function(){setTopType(topType===tf.id&&tf.id!=="all"?"all":tf.id)}},tf.l)}),
          /* Shuffle */
          React.createElement("span",{className:"chip"+(preferUnworn?" on":""),onClick:function(){setPreferUnworn(!preferUnworn)},style:{fontSize:9,padding:"4px 10px",minHeight:28}},"🔄 Fresh"),
          React.createElement("button",{onClick:function(){setShuffleKey(shuffleKey+1);setPieceSwap({});setPiecePicker(null);setPieceFilter(null)},style:{background:"none",border:"1px solid var(--border)",borderRadius:20,padding:"6px 12px",cursor:"pointer",color:"var(--gold)",fontFamily:"var(--f)",fontSize:11,marginLeft:"auto",minHeight:32}},"🎲 Shuffle"),
          /* Count */
          React.createElement("select",{className:"sel",value:fitCount,onChange:function(e){setFitCount(parseInt(e.target.value))},style:{width:52,padding:"6px 4px",fontSize:10,textAlign:"center",borderRadius:8}},
            [6,10,15,20].map(function(n){return React.createElement("option",{key:n,value:n},n)}))),

        /* Lock item banner */
        mode==="auto"&&lockItem&&React.createElement("div",{className:"fu",style:{display:"flex",alignItems:"center",gap:8,background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:10,padding:"8px 12px",marginBottom:10}},
          lockItem.photoUrl&&React.createElement("img",{src:ph(lockItem.photoUrl),alt:"",style:{width:32,height:32,objectFit:"cover",borderRadius:6}}),
          React.createElement(Dot,{color:lockItem.color,size:8}),
          React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,flex:1}},"🔒 Locked: "+( lockItem.name||lockItem.color)+" — showing fits around this piece"),
          React.createElement("button",{onClick:function(){setLockItem(null)},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"var(--warn)",fontFamily:"var(--f)",fontSize:9,minHeight:28}},"✕ Unlock")),

        /* BUILD */
        mode==="build"&&React.createElement("div",null,
          /* ═══ DYNAMIC UPPER LAYERS — unlimited, renameable ═══ */
          React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8,marginBottom:8}},
            /* Section label */
            React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center"}},
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,letterSpacing:"0.15em"}},"LAYERS"),
              React.createElement("div",{style:{display:"flex",gap:6}},
                buildLayers.length>1&&React.createElement("button",{onClick:function(){setBuildLayers([{id:1,label:"BASE",item:null}]);nextLayerId.current=2;setBuildSlot(null);setBuildAiCritique(null)},style:{background:"none",border:"1px solid var(--del-border)",borderRadius:6,padding:"3px 8px",cursor:"pointer",color:"var(--del-text)",fontFamily:"var(--f)",fontSize:8,minHeight:22}},"✕ Clear all"),
                React.createElement("button",{onClick:function(){var nid=nextLayerId.current++;var defaultLabels=["BASE","MID","OUTER","SHELL","LAYER "+nid];var lbl=defaultLabels[buildLayers.length]||"LAYER "+nid;setBuildLayers(function(p){return p.concat([{id:nid,label:lbl,item:null}])})},style:{background:"rgba(201,168,76,0.08)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:6,padding:"3px 10px",cursor:"pointer",color:"var(--gold)",fontFamily:"var(--f)",fontSize:8,fontWeight:600,minHeight:22}},"+ Add Layer"))),
            /* Layer slots grid — responsive: 3 cols if ≤3, else wrapping */
            React.createElement("div",{style:{display:"grid",gridTemplateColumns:buildLayers.length<=3?"repeat("+buildLayers.length+",1fr)":"repeat(auto-fill,minmax(90px,1fr))",gap:8}},
              buildLayers.map(function(layer,li){
                var slotId="layer-"+layer.id;
                return React.createElement("div",{key:layer.id,className:"outfit-slot "+(layer.item?"filled":"")+" "+(buildSlot===slotId?"active":""),onClick:function(){setBuildSlot(buildSlot===slotId?null:slotId)},style:{position:"relative"}},
                  layer.item?React.createElement(React.Fragment,null,
                    ph(layer.item.photoUrl)?React.createElement("img",{src:ph(layer.item.photoUrl),alt:"",style:{width:"100%",height:70,objectFit:"cover",borderRadius:8}}):React.createElement("div",{style:{width:"100%",height:70,display:"flex",alignItems:"center",justifyContent:"center",background:(CM[layer.item.color]||{}).h||"#3a3a3a",borderRadius:8}},React.createElement(Dot,{color:layer.item.color,size:20})),
                    React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--text)",fontWeight:500,textAlign:"center"}},layer.item.name||layer.item.color),
                    React.createElement("div",{style:{display:"flex",gap:2,justifyContent:"center"}},
                      React.createElement("button",{onClick:function(e){e.stopPropagation();setBuildLayers(function(p){return p.map(function(l){return l.id===layer.id?Object.assign({},l,{item:null}):l})});setBuildAiCritique(null)},style:{background:"none",border:"none",color:"var(--warn)",fontSize:8,fontFamily:"var(--f)",cursor:"pointer",minHeight:20}},"✕"),
                      buildLayers.length>1&&React.createElement("button",{onClick:function(e){e.stopPropagation();setBuildLayers(function(p){return p.filter(function(l){return l.id!==layer.id})});if(buildSlot===slotId)setBuildSlot(null);setBuildAiCritique(null)},style:{background:"none",border:"none",color:"var(--del-text)",fontSize:8,fontFamily:"var(--f)",cursor:"pointer",minHeight:20}},"🗑️")))
                  :React.createElement(React.Fragment,null,
                    /* Editable label — tap to rename */
                    React.createElement("input",{value:layer.label,onClick:function(e){e.stopPropagation()},onChange:function(e){var newLabel=e.target.value.toUpperCase().slice(0,12);setBuildLayers(function(p){return p.map(function(l){return l.id===layer.id?Object.assign({},l,{label:newLabel}):l})})},style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)",letterSpacing:"0.1em",background:"transparent",border:"none",textAlign:"center",width:"100%",cursor:"text",outline:"none",padding:0},maxLength:12}),
                    React.createElement("span",{style:{fontSize:18,color:"var(--dim)"}},"+"),
                    React.createElement("div",{style:{fontSize:6,fontFamily:"var(--f)",color:"var(--dim)",opacity:0.6,marginTop:1}},li===0?"T-Shirt / Shirt":"Any top layer"),
                    buildLayers.length>1&&React.createElement("button",{onClick:function(e){e.stopPropagation();setBuildLayers(function(p){return p.filter(function(l){return l.id!==layer.id})});if(buildSlot===slotId)setBuildSlot(null)},style:{background:"none",border:"none",color:"var(--del-text)",fontSize:7,fontFamily:"var(--f)",cursor:"pointer",minHeight:16,marginTop:2}},"remove")))}))),
          /* Bottom row: bottoms + shoes */
          React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}},
            [{slot:"bot",l:"BOTTOM",sub:"Pants / Jeans",val:bBot,set:setBBot},{slot:"shoe",l:"SHOES",sub:"Footwear",val:bShoe,set:setBShoe}].map(function(o){
              return React.createElement("div",{key:o.slot,className:"outfit-slot "+(o.val?"filled":"")+" "+(buildSlot===o.slot?"active":""),onClick:function(){setBuildSlot(buildSlot===o.slot?null:o.slot)}},
                o.val?React.createElement(React.Fragment,null,
                  ph(o.val.photoUrl)?React.createElement("img",{src:ph(o.val.photoUrl),alt:"",style:{width:"100%",height:70,objectFit:"cover",borderRadius:8}}):React.createElement("div",{style:{width:"100%",height:70,display:"flex",alignItems:"center",justifyContent:"center",background:(CM[o.val.color]||{}).h||"#3a3a3a",borderRadius:8}},React.createElement(Dot,{color:o.val.color,size:20})),
                  React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--text)",fontWeight:500,textAlign:"center"}},o.val.name||o.val.color),
                  React.createElement("button",{onClick:function(e){e.stopPropagation();o.set(null);setBuildAiCritique(null)},style:{background:"none",border:"none",color:"var(--warn)",fontSize:9,fontFamily:"var(--f)",cursor:"pointer",minHeight:24}},"✕ clear"))
                :React.createElement(React.Fragment,null,
                  React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)",letterSpacing:"0.1em"}},o.l),
                  React.createElement("span",{style:{fontSize:18,color:"var(--dim)"}},"+"),
                  React.createElement("div",{style:{fontSize:6,fontFamily:"var(--f)",color:"var(--dim)",opacity:0.6,marginTop:1}},o.sub)))})),
          /* Accessory row */
          React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr",gap:8,marginBottom:16}},
            [{slot:"acc",l:"ACCESSORY",sub:"Hat / Scarf / Belt / Bag",val:bAcc,set:setBAcc}].map(function(o){
              return React.createElement("div",{key:o.slot,className:"outfit-slot "+(o.val?"filled":"")+" "+(buildSlot===o.slot?"active":""),onClick:function(){setBuildSlot(buildSlot===o.slot?null:o.slot)},style:{minHeight:48}},
                o.val?React.createElement(React.Fragment,null,
                  ph(o.val.photoUrl)?React.createElement("img",{src:ph(o.val.photoUrl),alt:"",style:{width:"100%",height:60,objectFit:"cover",borderRadius:8}}):React.createElement("div",{style:{width:"100%",height:60,display:"flex",alignItems:"center",justifyContent:"center",background:(CM[o.val.color]||{}).h||"#3a3a3a",borderRadius:8}},React.createElement(Dot,{color:o.val.color,size:18})),
                  React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--text)",fontWeight:500,textAlign:"center"}},o.val.name||o.val.color),
                  React.createElement("button",{onClick:function(e){e.stopPropagation();o.set(null);setBuildAiCritique(null)},style:{background:"none",border:"none",color:"var(--warn)",fontSize:9,fontFamily:"var(--f)",cursor:"pointer",minHeight:24}},"✕ clear"))
                :React.createElement(React.Fragment,null,
                  React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)",letterSpacing:"0.1em"}},o.l),
                  React.createElement("span",{style:{fontSize:16,color:"var(--dim)"}},"+"),
                  React.createElement("div",{style:{fontSize:6,fontFamily:"var(--f)",color:"var(--dim)",opacity:0.6,marginTop:1}},o.sub)))})),

          buildSlot&&(function(){
            /* Determine category and setter based on slot type */
            var isLayer=buildSlot.startsWith("layer-");
            var cat=isLayer?"tops":buildSlot==="bot"?"bottoms":buildSlot==="acc"?"accessories":"shoes";
            var items=byCat[cat].filter(function(i){return i.color&&!i.needsEdit});
            /* For layers: show all tops, no restrictive filtering — full flexibility */
            var setter;var pickLabel;
            if(isLayer){
              var layerId=parseInt(buildSlot.split("-")[1]);
              setter=function(item){setBuildLayers(function(p){return p.map(function(l){return l.id===layerId?Object.assign({},l,{item:item}):l})})};
              var layerObj=buildLayers.find(function(l){return l.id===layerId});
              pickLabel=(layerObj?layerObj.label.toLowerCase():"a")+" layer piece";
            }else{
              setter=buildSlot==="bot"?setBBot:buildSlot==="acc"?setBAcc:setBShoe;
              pickLabel=buildSlot==="bot"?"bottoms":buildSlot==="acc"?"an accessory":"shoes";
            }
            return React.createElement("div",{className:"fu",style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"12px",marginBottom:16}},
              React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,marginBottom:8}},"Pick "+pickLabel),
              React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(80px,1fr))",gap:8}},
                items.map(function(item){return React.createElement("div",{key:item.id,className:"gcard",onClick:function(){setter(item);setBuildSlot(null);setBuildAiCritique(null)},style:{background:"var(--bg)",border:"2px solid transparent",textAlign:"center"}},
                  ph(item.photoUrl)?React.createElement("img",{src:ph(item.photoUrl),alt:"",style:{width:"100%",height:72,objectFit:"cover",display:"block",borderRadius:"8px 8px 0 0"}}):React.createElement("div",{style:{height:72,display:"flex",alignItems:"center",justifyContent:"center",background:(CM[item.color]||{}).h||"#3a3a3a",borderRadius:"8px 8px 0 0"}},React.createElement(Dot,{color:item.color,size:16})),
                  React.createElement("div",{style:{padding:"4px 4px 6px"}},React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",fontWeight:500}},item.name||item.color)))}),
                !items.length&&React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--dim)",gridColumn:"1/-1",padding:10}},"No classified items")));
          })(),

          buildFit?React.createElement("div",{className:"fu",style:{background:"var(--card2)",border:"1px solid rgba(201,168,76,0.2)",borderRadius:14,padding:"16px"}},
            React.createElement("div",{style:{marginBottom:12}},
              React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}},
                React.createElement("span",{style:{fontSize:15,fontFamily:"var(--f)",fontWeight:600,color:"var(--gold)"}},"Score: "+buildFit.fs),
                React.createElement("div",{style:{display:"flex",gap:6}},
                  React.createElement("button",{className:"btn btn-gold",style:{width:"auto",padding:"10px 18px",fontSize:11},onClick:function(){saveFit(buildFit);if(buildName.trim()){setSaved(function(p){var n=p.slice();if(n.length>0){n[n.length-1]=Object.assign({},n[n.length-1],{name:buildName.trim()});ps("of_"+SK,n);}return n;});}setBuildName("");setBuildAiCritique(null);}},"💾 Save"),
                  React.createElement("button",{className:"btn btn-ghost",style:{width:"auto",padding:"10px 14px",fontSize:11},onClick:async function(){var critW=buildWatch||(buildFit.watches&&buildFit.watches[0]);if(!critW)return;setBuildAiLoading(true);var result=await aiVision({top:buildFit.outerTop||buildFit.top,bot:buildFit.bot,shoe:buildFit.shoe,layers:buildFit.tops},critW,effectiveCtx,apiKeyRef.current);setBuildAiCritique(result||{vision:"AI unavailable. Check your API key in settings.",impact:0});setBuildAiLoading(false)},disabled:buildAiLoading},buildAiLoading?"⏳ Analyzing...":"✨ AI Critique"))),
              React.createElement("input",{className:"inp",value:buildName,onChange:function(e){setBuildName(e.target.value)},placeholder:"Name this outfit (optional)",style:{fontSize:12}})),
            buildFit.wxWarns&&buildFit.wxWarns.length>0&&React.createElement("div",{style:{marginBottom:10,display:"flex",gap:4,flexWrap:"wrap"}},
              buildFit.wxWarns.map(function(warn,wi){return React.createElement("span",{key:wi,style:{fontSize:8,fontFamily:"var(--f)",color:"#7ab8d8",background:"rgba(100,150,220,0.08)",borderRadius:4,padding:"2px 6px",border:"1px solid rgba(100,150,220,0.15)"}},warn)})),
            /* Watch selection */
            React.createElement("div",{style:{marginBottom:8}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}},
                React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,letterSpacing:"0.1em"}},"⌚ WATCH PAIRING"),
                React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},buildWatch?"Tap again to deselect":"Tap to choose")),
              buildWatch&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:10,padding:"8px 12px",marginBottom:8}},
                React.createElement("span",{style:{fontSize:18}},buildWatch.i),
                React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,flex:1}},"🔒 "+buildWatch.n),
                React.createElement("button",{onClick:function(){setBuildWatch(null)},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"var(--warn)",fontFamily:"var(--f)",fontSize:9,minHeight:28}},"✕ Clear")),
              React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8}},
                buildFit.allW.slice(0,6).map(function(w,i){return React.createElement("div",{key:w.id,onClick:function(){setBuildWatch(buildWatch&&buildWatch.id===w.id?null:w);setBuildAiCritique(null)},style:{cursor:"pointer",border:buildWatch&&buildWatch.id===w.id?"2px solid var(--gold)":"2px solid transparent",borderRadius:14,transition:"all .15s"}},React.createElement(WCard,{w:w,rank:buildWatch?buildWatch.id===w.id?0:null:i,detail:true}))}))),
            /* Outfit mannequin preview */
            (function(){var selW=buildWatch||((buildFit.watches&&buildFit.watches[0])?buildFit.watches[0]:null);return React.createElement("div",{style:{display:"flex",justifyContent:"center",marginTop:14,marginBottom:8}},
              React.createElement(OutfitFigure,{topColor:buildFit.outerTop?buildFit.outerTop.color:buildFit.top?buildFit.top.color:"grey",botColor:buildFit.bot?buildFit.bot.color:"charcoal",shoeColor:buildFit.shoe?buildFit.shoe.color:"black",watchColor:selW?selW.c:"#c9a84c",watchIcon:selW?selW.i:"⌚",watchName:selW?selW.n:"",size:120}))})(),
            /* Layers summary */
            buildFit.tops&&buildFit.tops.length>1&&React.createElement("div",{style:{display:"flex",justifyContent:"center",gap:6,marginBottom:8,flexWrap:"wrap"}},
              buildFit.tops.map(function(t,ti){var layerLabel=buildLayers[ti]?buildLayers[ti].label:(ti===0?"Base":"L"+(ti+1));return React.createElement("div",{key:ti,style:{display:"flex",alignItems:"center",gap:3,background:"var(--bg)",borderRadius:6,padding:"3px 8px",border:"1px solid var(--border)"}},
                ph(t.photoUrl)?React.createElement("img",{src:ph(t.photoUrl),alt:"",style:{width:16,height:16,objectFit:"cover",borderRadius:3}}):React.createElement(Dot,{color:t.color,size:6}),
                React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--sub)"}},layerLabel),
                React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--text)"}},t.name||t.color))})),
            /* AI Critique for custom build */
            buildAiCritique&&React.createElement("div",{className:"fu",style:{background:"rgba(201,168,76,0.04)",borderRadius:12,padding:"14px",marginTop:10,border:"1px solid rgba(201,168,76,0.2)"}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
                React.createElement("span",{style:{fontSize:16}},"✨"),
                React.createElement("span",{style:{fontSize:13,fontFamily:"var(--f)",fontWeight:600,color:"var(--gold)"}},"AI Analysis")),
              buildAiCritique.vision&&React.createElement("div",{style:{background:"var(--bg)",borderRadius:10,padding:"12px",marginBottom:10,borderLeft:"3px solid var(--gold)"}},
                React.createElement("p",{style:{fontSize:12,fontFamily:"var(--sf)",fontStyle:"italic",lineHeight:1.6,color:"var(--text)"}},buildAiCritique.vision)),
              buildAiCritique.impact>0&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:8}},
                React.createElement("div",{style:{width:42,height:42,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:buildAiCritique.impact>=7?"rgba(122,184,122,0.15)":buildAiCritique.impact>=4?"rgba(201,168,76,0.15)":"rgba(200,90,58,0.15)",border:"2px solid "+(buildAiCritique.impact>=7?"var(--good)":buildAiCritique.impact>=4?"var(--gold)":"var(--warn)"),fontSize:16,fontFamily:"var(--f)",fontWeight:700,color:buildAiCritique.impact>=7?"var(--good)":buildAiCritique.impact>=4?"var(--gold)":"var(--warn)"}},buildAiCritique.impact),
                React.createElement("div",{style:{flex:1}},
                  React.createElement("div",{style:{fontSize:11,fontFamily:"var(--f)",fontWeight:600,color:buildAiCritique.impact>=7?"var(--good)":buildAiCritique.impact>=4?"var(--gold)":"var(--warn)"}},buildAiCritique.impact>=8?"Commanding":buildAiCritique.impact>=6?"Solid":buildAiCritique.impact>=4?"Acceptable":"Needs Work"),
                  buildAiCritique.impact_why&&React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginTop:2}},buildAiCritique.impact_why))),
              [buildAiCritique.color_story&&{l:"🎨 Colors",t:buildAiCritique.color_story,c:"#9a8abc"},buildAiCritique.works&&{l:"✓ What Works",t:buildAiCritique.works,c:"var(--good)"},buildAiCritique.risk&&{l:"⚠ Risk",t:buildAiCritique.risk,c:"var(--warn)"},buildAiCritique.upgrade&&{l:"⬆ Upgrade",t:buildAiCritique.upgrade,c:"var(--gold)"},buildAiCritique.strap_call&&{l:"🔗 Strap",t:buildAiCritique.strap_call,c:"var(--sub)"}].filter(Boolean).map(function(item,i){
                return React.createElement("div",{key:i,style:{display:"flex",gap:8,marginBottom:4}},
                  React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:item.c,fontWeight:600,minWidth:70}},item.l),
                  React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)"}},item.t))}),
              React.createElement("button",{className:"btn btn-ghost",style:{marginTop:8,fontSize:10},onClick:function(){setBuildAiCritique(null)}},"↻ Re-analyze")))
          :!buildSlot&&React.createElement("p",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--dim)",textAlign:"center",padding:20}},"Tap the slots above to build your outfit — use \"+Add Layer\" for sweater + jacket combos")),

        /* SELFIE CHECK */
        mode==="selfie"&&React.createElement("div",null,
          React.createElement("div",{style:{background:"linear-gradient(135deg,var(--card),var(--card2))",border:"1px solid rgba(201,168,76,0.2)",borderRadius:14,padding:"20px",marginBottom:16,textAlign:"center"}},
            React.createElement("div",{style:{fontSize:32,marginBottom:8}},"📸"),
            React.createElement("div",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600,marginBottom:4}},"Selfie Check"),
            React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:16}},"Take a selfie or upload a photo to get an AI style analysis with impact score"),
            React.createElement("div",{style:{display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}},
              React.createElement("button",{onClick:function(){selfieRef.current&&selfieRef.current.click()},className:"btn btn-gold",style:{padding:"12px 20px",fontSize:12}},"🤳 Selfie"),
              React.createElement("button",{onClick:function(){selfieRearRef.current&&selfieRearRef.current.click()},className:"btn btn-ghost",style:{padding:"12px 20px",fontSize:12}},"📷 Camera"),
              React.createElement("button",{onClick:function(){selfieGalRef.current&&selfieGalRef.current.click()},className:"btn btn-ghost",style:{padding:"12px 20px",fontSize:12}},"🖼️ Gallery")),
            React.createElement("input",{ref:selfieRef,type:"file",accept:"image/*",capture:"user",style:{display:"none"},onChange:function(e){if(e.target.files&&e.target.files[0]){checkSelfie(e.target.files[0]);e.target.value=""}}}),
            React.createElement("input",{ref:selfieRearRef,type:"file",accept:"image/*",capture:"environment",style:{display:"none"},onChange:function(e){if(e.target.files&&e.target.files[0]){checkSelfie(e.target.files[0]);e.target.value=""}}}),
            React.createElement("input",{ref:selfieGalRef,type:"file",accept:"image/*",style:{display:"none"},onChange:function(e){if(e.target.files&&e.target.files[0]){checkSelfie(e.target.files[0]);e.target.value=""}}})),
          /* Loading */
          selfieLoading&&React.createElement("div",{style:{background:"var(--card)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:12,padding:"20px",marginBottom:12,textAlign:"center"}},
            React.createElement("div",{className:"sp",style:{width:28,height:28,border:"2px solid var(--gold)",borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 10px"}}),
            React.createElement("span",{style:{fontSize:13,fontFamily:"var(--f)",color:"var(--gold)"}},"Analyzing your look...")),
          /* Result */
          selfieResult&&!selfieLoading&&React.createElement("div",{style:{background:"linear-gradient(135deg,var(--card),var(--card2))",border:"1px solid rgba(201,168,76,0.3)",borderRadius:14,padding:"16px",marginBottom:16}},
            selfieResult.error?React.createElement("div",null,
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
                React.createElement("span",{style:{fontSize:18}},"⚠️"),
                React.createElement("span",{style:{fontSize:13,fontFamily:"var(--f)",color:"var(--warn)"}},selfieResult.error)),
              React.createElement("button",{onClick:function(){setSelfieResult(null)},className:"btn btn-ghost",style:{marginTop:8,fontSize:10}},"Dismiss"))
            :React.createElement("div",null,
              /* Impact score */
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:14,marginBottom:14}},
                selfieResult.thumb&&React.createElement("img",{src:selfieResult.thumb,alt:"",style:{width:70,height:70,objectFit:"cover",borderRadius:12,border:"2px solid var(--gold)"}}),
                React.createElement("div",{style:{flex:1}},
                  React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:4}},
                    React.createElement("div",{style:{width:44,height:44,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"3px solid "+(selfieResult.result.impact>=8?"var(--good)":selfieResult.result.impact>=5?"var(--gold)":"var(--warn)"),fontSize:18,fontFamily:"var(--f)",fontWeight:700,color:selfieResult.result.impact>=8?"var(--good)":selfieResult.result.impact>=5?"var(--gold)":"var(--warn)"}},selfieResult.result.impact+"/10"),
                    React.createElement("div",null,
                      React.createElement("div",{style:{fontSize:14,fontWeight:600,color:"var(--gold)"}},"Impact Score"),
                      selfieResult.result.impact_why&&React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},selfieResult.result.impact_why))))),
              /* Vision */
              selfieResult.result.vision&&React.createElement("div",{style:{background:"var(--bg)",borderRadius:10,padding:"12px",marginBottom:10,border:"1px solid var(--border)"}},
                React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,letterSpacing:"0.1em",marginBottom:4}},"EDITORIAL"),
                React.createElement("p",{style:{fontSize:11,fontFamily:"var(--sf)",fontStyle:"italic",lineHeight:1.6,color:"var(--text)"}},selfieResult.result.vision)),
              /* Color story */
              selfieResult.result.color_story&&React.createElement("div",{style:{background:"var(--bg)",borderRadius:10,padding:"10px 12px",marginBottom:8,border:"1px solid var(--border)"}},
                React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},"🎨 COLORS "),
                React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)"}},selfieResult.result.color_story)),
              /* Works / Risk / Upgrade */
              React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}},
                selfieResult.result.works&&React.createElement("div",{style:{flex:1,minWidth:140,background:"rgba(122,184,122,0.06)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(122,184,122,0.15)"}},
                  React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--good)",fontWeight:600,marginBottom:2}},"✓ WORKS"),
                  React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},selfieResult.result.works)),
                selfieResult.result.risk&&React.createElement("div",{style:{flex:1,minWidth:140,background:"rgba(200,90,58,0.06)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(200,90,58,0.15)"}},
                  React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600,marginBottom:2}},"⚠️ RISK"),
                  React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},selfieResult.result.risk))),
              selfieResult.result.upgrade&&React.createElement("div",{style:{background:"rgba(201,168,76,0.06)",borderRadius:8,padding:"8px 10px",marginBottom:10,border:"1px solid rgba(201,168,76,0.15)"}},
                React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},"⬆ UPGRADE "),
                React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},selfieResult.result.upgrade)),
              selfieResult.result.strap_call&&React.createElement("div",{style:{background:"rgba(122,184,122,0.06)",borderRadius:8,padding:"8px 10px",marginBottom:10,border:"1px solid rgba(122,184,122,0.15)"}},
                React.createElement("span",{style:{fontSize:10,fontWeight:600,color:"var(--sub)",marginRight:6}},"🔗 Strap"),
                React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},selfieResult.result.strap_call)),
              selfieResult.result.better_watch&&React.createElement("div",{style:{background:"rgba(154,138,188,0.06)",borderRadius:8,padding:"8px 10px",marginBottom:10,border:"1px solid rgba(154,138,188,0.15)"}},
                React.createElement("span",{style:{fontSize:10,fontWeight:600,color:"var(--sub)",marginRight:6}},"⌚ Better Pick"),
                React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},selfieResult.result.better_watch)),
              /* Watch detection */
              selfieResult.result.watch_details&&React.createElement("div",{style:{background:"var(--bg)",borderRadius:8,padding:"8px 10px",marginBottom:10,border:"1px solid var(--border)"}},
                React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
                  React.createElement("span",{style:{fontSize:14}},"⌚"),
                  React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},selfieResult.result.watch_details),
                  selfieResult.result.watch_confidence&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:selfieResult.result.watch_confidence>=7?"var(--good)":selfieResult.result.watch_confidence>=4?"var(--gold)":"var(--dim)",background:"var(--card)",borderRadius:4,padding:"1px 5px",border:"1px solid var(--border)"}},selfieResult.result.watch_confidence+"/10"))),
              /* Fit assessment */
              selfieResult.result.fit_assessment&&React.createElement("div",{style:{background:"var(--bg)",borderRadius:8,padding:"8px 10px",marginBottom:10,border:"1px solid var(--border)"}},
                React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},"📐 FIT "),
                React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},selfieResult.result.fit_assessment)),
              React.createElement("button",{onClick:function(){setSelfieResult(null)},className:"btn btn-ghost",style:{width:"100%",fontSize:10,marginTop:4}},"✕ Close"))),
          /* History */
          selfieHistory.length>0&&React.createElement("div",{style:{marginTop:8}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:10}},
              React.createElement("span",{style:{fontSize:14}},"📋"),
              React.createElement("span",{style:{fontSize:13,fontFamily:"var(--f)",fontWeight:600}},"History"),
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},selfieHistory.length+" check"+(selfieHistory.length>1?"s":""))),
            selfieHistory.map(function(entry){
              return React.createElement("div",{key:entry.id,style:{display:"flex",gap:10,alignItems:"center",background:"var(--card)",border:"1px solid var(--border)",borderRadius:10,padding:"10px 12px",marginBottom:6}},
                entry.thumb&&React.createElement("img",{src:entry.thumb,alt:"",style:{width:44,height:44,objectFit:"cover",borderRadius:8,flexShrink:0}}),
                React.createElement("div",{style:{flex:1,minWidth:0}},
                  React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6}},
                    React.createElement("div",{style:{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid "+(entry.impact>=8?"var(--good)":entry.impact>=5?"var(--gold)":"var(--warn)"),fontSize:11,fontFamily:"var(--f)",fontWeight:700,color:entry.impact>=8?"var(--good)":entry.impact>=5?"var(--gold)":"var(--warn)"}},entry.impact),
                    React.createElement("div",{style:{flex:1}},
                      React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},entry.result&&entry.result.impact_why?entry.result.impact_why.slice(0,60):"Style check"),
                      React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},new Date(entry.ts).toLocaleDateString()+" "+new Date(entry.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}))))),
                React.createElement("button",{onClick:function(){setSelfieResult(entry)},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:"var(--sub)",fontFamily:"var(--f)",fontSize:9,minHeight:24}},"View"),
                React.createElement("button",{onClick:function(){delSelfie(entry.id)},style:{background:"none",border:"1px solid var(--del-border)",borderRadius:6,padding:"4px 8px",cursor:"pointer",color:"var(--del-text)",fontFamily:"var(--f)",fontSize:9,minHeight:24}},"✕"))}))),

        /* ROTATION */
        mode==="rotation"&&(function(){
          var rotation=genWeekRotation(actW,forecast,weekCtx,wd,reps,wearLog,rotLock,loc.lat);
          /* Apply alt swaps */
          Object.keys(altSwap).forEach(function(k){
            var di=parseInt(k),ai=altSwap[k];
            if(rotation[di]&&rotation[di].altOutfits&&rotation[di].altOutfits[ai]){
              var orig=rotation[di].outfit;
              var origFs=rotation[di].fs||rotation[di].altOutfits[ai].fs;
              rotation[di].outfit=rotation[di].altOutfits[ai];
              rotation[di].fs=rotation[di].altOutfits[ai].fs;
              var newAlts=rotation[di].altOutfits.slice();
              newAlts[ai]={top:orig.top,bot:orig.bot,shoe:orig.shoe,fs:origFs};
              rotation[di].altOutfits=newAlts;
            }
          });
          var DAYS7=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
          var genC=rotation.filter(function(d){return d.watch&&d.watch.t==="genuine"}).length;
          var repC=rotation.filter(function(d){return d.watch&&d.watch.t==="replica"}).length;
          var uniqueW={};rotation.forEach(function(d){if(d.watch)uniqueW[d.watch.id]=true});
          return React.createElement("div",null,
            /* Header + stats */
            React.createElement("div",{style:{background:"linear-gradient(135deg,var(--card),var(--card2))",border:"1px solid rgba(201,168,76,0.2)",borderRadius:14,padding:"14px 16px",marginBottom:10}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:6}},
                React.createElement("span",{style:{fontSize:18}},"📅"),
                React.createElement("span",{style:{fontSize:15,fontFamily:"var(--sf)",fontWeight:600,color:"var(--gold)"}},"7-Day Rotation"),
                React.createElement("button",{onClick:function(){setEditRotCtx(!editRotCtx)},style:{marginLeft:"auto",background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"var(--sub)",fontFamily:"var(--f)",fontSize:9,minHeight:28}},editRotCtx?"Done":"⚙️ Edit Days"),
                React.createElement("button",{onClick:function(){
                  var nl=rotation.map(function(d){return d.watch?d.watch.id:null});
                  setRotLock(nl);ps("wa_rotlock_"+SK,nl);
                },style:{background:"none",border:"1px solid rgba(122,184,122,0.3)",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"var(--good)",fontFamily:"var(--f)",fontSize:9,minHeight:28}},"💾 Save"),
                rotLock.some(function(x){return x!==null})&&React.createElement("button",{onClick:function(){
                  setRotLock([null,null,null,null,null,null,null]);ps("wa_rotlock_"+SK,[null,null,null,null,null,null,null]);
                },style:{background:"none",border:"1px solid rgba(200,90,58,0.3)",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"var(--warn)",fontFamily:"var(--f)",fontSize:9,minHeight:28}},"🔓 Clear")),
              React.createElement("div",{style:{display:"flex",gap:12,fontSize:10,fontFamily:"var(--f)",color:"var(--sub)"}},
                React.createElement("span",null,"🔢 "+Object.keys(uniqueW).length+" unique"),
                !IS_SHARED&&React.createElement("span",null,"✓ "+genC+" genuine"),
                !IS_SHARED&&React.createElement("span",null,"◇ "+repC+" replica"),
                rotLock.filter(function(x){return x}).length>0&&React.createElement("span",{style:{color:"var(--good)"}},"🔒 "+rotLock.filter(function(x){return x}).length+" locked"))),

            /* Rotation weather summary */
            (function(){
              var clearD=0,rainD=0,windyD=0,snowD=0;
              rotation.forEach(function(d){if(!d.forecast)return;var c=d.forecast.cond;if(c&&c.rain)rainD++;else if(d.forecast.code>=71&&d.forecast.code<=86)snowD++;else clearD++;if(d.forecast.wind>=30)windyD++});
              var parts=[];if(clearD)parts.push("☀️ "+clearD+" clear");if(rainD)parts.push("🌧️ "+rainD+" rain");if(snowD)parts.push("❄️ "+snowD+" snow");if(windyD)parts.push("💨 "+windyD+" windy");
              return parts.length?React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",background:"var(--bg)",borderRadius:8,padding:"6px 12px",marginBottom:8,border:"1px solid var(--border)",textAlign:"center"}},parts.join(" · ")):null;
            })(),

            /* Smart rotation alerts */
            (function(){
              var alerts=[];
              /* Rep-heavy week */
              if(!IS_SHARED&&repC>=5)alerts.push({icon:"⚠",text:"Rep-heavy week: "+repC+"/7 days are replicas. Consider swapping 1-2 for genuine.",c:"var(--warn)"});
              /* Back-to-back same watch */
              for(var ai=0;ai<rotation.length-1;ai++){if(rotation[ai].watch&&rotation[ai+1].watch&&rotation[ai].watch.id===rotation[ai+1].watch.id)alerts.push({icon:"🔁",text:rotation[ai].watch.n+" repeats "+rotation[ai].dayName+"→"+rotation[ai+1].dayName+". Variety matters.",c:"var(--warn)"})}
              /* Neglected watches — active watches not in rotation and not worn in 14+ days */
              var rotIds={};rotation.forEach(function(d){if(d.watch)rotIds[d.watch.id]=true});
              var neglected=actW.filter(function(w){return !rotIds[w.id]&&daysSince(w.id)>=14&&w.status==="active"});
              if(neglected.length>=3)alerts.push({icon:"💤",text:neglected.length+" watches haven't been worn in 14+ days: "+neglected.slice(0,3).map(function(w){return w.i+" "+w.n}).join(", "),c:"#7ab8d8"});
              /* Strap mismatch warnings */
              rotation.forEach(function(d){if(d.watch&&d.outfit&&d.outfit.shoe&&!d.watch.br){var sc=d.outfit.shoe.color?d.outfit.shoe.color.toLowerCase():"";var wsc=(d.watch.sc||[]).join(" ").toLowerCase();if(sc.includes("brown")&&wsc.includes("black")&&!wsc.includes("brown"))alerts.push({icon:"🚫",text:d.dayName+": "+d.watch.n+" has black strap but brown shoes. Mismatch.",c:"var(--warn)"});if(sc.includes("black")&&!wsc.includes("black")&&!wsc.includes("navy")&&wsc.length>0)alerts.push({icon:"🚫",text:d.dayName+": "+d.watch.n+" has warm strap but black shoes.",c:"var(--warn)"})}});
              /* Rain + leather strap warnings */
              rotation.forEach(function(d){if(d.forecast&&d.forecast.cond&&d.forecast.cond.rain&&d.watch&&!d.watch.br){alerts.push({icon:"☂️",text:d.dayName+": Rain forecast ("+d.forecast.rainPct+"%) but "+d.watch.n+" has leather strap. Consider bracelet watch or waterproof precautions.",c:"#7ab8d8"})}});
              /* Rainy days count */
              var rainyDays=rotation.filter(function(d){return d.forecast&&d.forecast.cond&&d.forecast.cond.rain}).length;
              if(rainyDays>=3)alerts.push({icon:"🌧️",text:"Rain-heavy week: "+rainyDays+" of 7 days have precipitation. Bracelet watches prioritized.",c:"#7ab8d8"});
              if(!alerts.length)return null;
              return React.createElement("div",{style:{marginBottom:10}},alerts.map(function(a,idx){
                var isRainAlert=a.c==="#7ab8d8";
                return React.createElement("div",{key:idx,style:{display:"flex",alignItems:"flex-start",gap:8,background:isRainAlert?"rgba(100,150,220,0.04)":"rgba(200,90,58,0.04)",border:"1px solid "+(isRainAlert?"rgba(100,150,220,0.15)":"rgba(200,90,58,0.15)"),borderRadius:8,padding:"8px 12px",marginBottom:4}},
                  React.createElement("span",{style:{fontSize:14,flexShrink:0}},a.icon),
                  React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:a.c,lineHeight:1.4}},a.text))}));
            })(),

            /* Context editor */
            editRotCtx&&React.createElement("div",{className:"fu",style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"12px",marginBottom:10}},
              React.createElement("p",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,marginBottom:8,letterSpacing:"0.1em"}},"SET CONTEXT PER DAY"),
              DAYS7.map(function(dn,di){
                return React.createElement("div",{key:di,style:{display:"flex",alignItems:"center",gap:8,marginBottom:6}},
                  React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",minWidth:32,fontWeight:600}},dn),
                  React.createElement("div",{style:{display:"flex",gap:3,flexWrap:"wrap",flex:1},className:"hscroll"},
                    activeCxIds.slice(0,8).map(function(cx){
                      return React.createElement("span",{key:cx,className:"chip "+(weekCtx[di]===cx?"on":""),onClick:function(){
                        var nwc=weekCtx.slice();nwc[di]=cx;setWeekCtx(nwc);ps("wa_weekctx",nwc);
                      },style:{padding:"3px 8px",fontSize:9,minHeight:24}},(activeCxIcons[cx]||CXI[cx]||"")+" "+cx)})));
              })),

            /* Day cards */
            rotation.map(function(day,i){
              if(!day.watch)return null;
              var w=day.watch;var isToday=i===0;
              var of=day.outfit;var sp=day.strapPick;
              var ds=daysSince(w.id);
              var dayDate=day.date||todayStr;
              var worn=wearLog.find(function(e){return e.date===dayDate&&e.watchId===w.id});
              var isEditing=editDayIdx===i;
              return React.createElement("div",{key:i,className:"card-lift",style:{background:isToday?"var(--card2)":"var(--card)",border:"1px solid "+(isToday?"rgba(201,168,76,0.3)":day.locked?"rgba(122,184,122,0.2)":"var(--border)"),borderRadius:12,padding:"12px 14px",marginBottom:8}},
                React.createElement("div",{style:{display:"flex",gap:10,alignItems:"center"}},
                  /* Day + weather */
                  React.createElement("div",{style:{minWidth:48,textAlign:"center"}},
                    React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:isToday?"var(--gold)":"var(--sub)",fontWeight:700}},(function(){var sc=[pieceSwap[i+"-top"],pieceSwap[i+"-bot"],pieceSwap[i+"-shoe"]].filter(Boolean).length;return(isToday?"TODAY":day.dayName.toUpperCase())+(sc?" ✎"+sc:"")})()),
                    day.forecast&&React.createElement("div",{style:{fontSize:16,margin:"2px 0"}},day.forecast.cond?day.forecast.cond.i:day.tier?day.tier.icon:""),
                    day.forecast&&React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},day.forecast.high+"°/"+day.forecast.low+"°"),
                    day.forecast&&day.forecast.rainPct>0&&React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:day.forecast.rainPct>=50?"#7ab8d8":"var(--dim)"}},day.forecast.rainPct>=50?"💧"+day.forecast.rainPct+"%":day.forecast.rainPct+"%")),
                  /* Watch — tap to swap */
                  React.createElement("div",{onClick:function(){setEditDayIdx(isEditing?null:i);setEditDayMode(isEditing?null:"watch")},style:{width:40,height:40,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:w.c+"20",fontSize:18,flexShrink:0,border:"2px solid "+(isEditing?"var(--gold)":w.c+"40"),cursor:"pointer"}},w.i),
                  React.createElement("div",{style:{flex:1,minWidth:0}},
                    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",marginBottom:2}},
                      React.createElement("span",{style:{fontSize:13,fontWeight:600}},w.n),
                      !IS_SHARED&&w.t==="replica"&&React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"#6a5a50",border:"1px solid var(--rep-border)",borderRadius:3,padding:"1px 4px"}},"REP"),
                      /* Context badge — tap to cycle */
                      React.createElement("span",{onClick:function(e){e.stopPropagation();setEditDayIdx(isEditing&&editDayMode==="ctx"?null:i);setEditDayMode("ctx")},style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",background:"var(--bg)",borderRadius:4,padding:"1px 6px",cursor:"pointer",border:"1px solid "+(isEditing&&editDayMode==="ctx"?"var(--gold)":"transparent")}},(CXI[day.context]||"")+" "+day.context),
                      day.locked&&React.createElement("span",{style:{fontSize:7,color:"var(--good)"}},"🔒"),
                      ds<999&&React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:ds<=2?"var(--warn)":ds>=7?"var(--good)":"var(--sub)",background:"var(--bg)",borderRadius:4,padding:"1px 5px"}},ds===0?"today":ds+"d ago"),
                      of&&React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:of.fs>=8?"var(--good)":of.fs>=5?"var(--gold)":"var(--warn)",background:of.fs>=8?"rgba(122,184,122,0.1)":of.fs>=5?"rgba(201,168,76,0.1)":"rgba(200,90,58,0.1)",borderRadius:4,padding:"1px 5px",border:"1px solid "+(of.fs>=8?"rgba(122,184,122,0.2)":of.fs>=5?"rgba(201,168,76,0.2)":"rgba(200,90,58,0.2)")}},of.fs>=8?"🔥":"👔"," "+(pieceSwap[i+"-top"]||pieceSwap[i+"-bot"]||pieceSwap[i+"-shoe"]?"~":"")+of.fs)),
                    /* Strap + bracelet line with visual color swatch */
                    React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},
                      (function(){
                        var isRain=day.forecast&&day.forecast.cond&&day.forecast.cond.rain;
                        if(sp&&sp.strap){
                          var isWR=sp.strap.type==="bracelet"||sp.strap.type==="rubber"||sp.strap.type==="mesh";
                          var rainSuffix=isRain&&!isWR?" — rain risk":isRain&&isWR?" ✓":"";
                          var rainPrefix=isRain&&!isWR?"⚠️ ":"";
                          return React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:4,color:isRain?(isWR?"var(--good)":"var(--warn)"):sp.type==="good"?"var(--good)":"var(--sub)"}},
                            rainPrefix?React.createElement("span",null,rainPrefix):null,
                            React.createElement(StrapSwatch,{strap:sp.strap,size:8}),
                            sp.strap.notes?React.createElement("span",{style:{fontSize:7,color:"var(--dim)",fontStyle:"italic",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}," · "+sp.strap.notes):"",
                            rainSuffix?React.createElement("span",null,rainSuffix):null);
                        }
                        if(w.br)return React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:4,color:isRain?"var(--good)":"var(--sub)"}},React.createElement("span",{style:{width:8,height:8,borderRadius:"50%",background:"linear-gradient(135deg,#c0c0c0,#888,#c0c0c0)",flexShrink:0}}),"⛓️ Bracelet"+(isRain?" ✓":""));
                        return React.createElement("span",null,"🔗 "+(w.sc||[]).join(" / "));
                      })())),
                  /* Lock/unlock button */
                  React.createElement("button",{onClick:function(){var nl=rotLock.slice();nl[i]=nl[i]?null:w.id;setRotLock(nl);ps("wa_rotlock_"+SK,nl)},style:{background:"none",border:"1px solid "+(day.locked?"rgba(122,184,122,0.3)":"var(--border)"),borderRadius:6,padding:"4px 8px",cursor:"pointer",color:day.locked?"var(--good)":"var(--dim)",fontSize:12,flexShrink:0,minWidth:32,minHeight:32,display:"flex",alignItems:"center",justifyContent:"center"}},day.locked?"🔒":"🔓")),

                /* Inline context picker */
                isEditing&&editDayMode==="ctx"&&React.createElement("div",{className:"fu",style:{display:"flex",gap:3,flexWrap:"wrap",marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)"}},
                  activeCxIds.slice(0,8).map(function(cx){
                    return React.createElement("span",{key:cx,className:"chip "+(weekCtx[day.dayIdx]===cx?"on":""),onClick:function(){
                      var nwc=weekCtx.slice();nwc[day.dayIdx]=cx;setWeekCtx(nwc);ps("wa_weekctx",nwc);
                      /* Also unlock this day so rotation recalculates */
                      var nl=rotLock.slice();nl[i]=null;setRotLock(nl);ps("wa_rotlock_"+SK,nl);
                      setEditDayIdx(null);setEditDayMode(null);
                    },style:{padding:"4px 10px",fontSize:9,minHeight:28}},(activeCxIcons[cx]||CXI[cx]||"")+" "+cx)})),

                /* Inline watch picker */
                isEditing&&editDayMode==="watch"&&React.createElement("div",{className:"fu",style:{marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)"}},
                  React.createElement("p",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,marginBottom:6}},"SWAP WATCH FOR "+day.dayName.toUpperCase()),
                  React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:6,maxHeight:200,overflowY:"auto"}},
                    actW.filter(function(aw){return reps||aw.t!=="replica"}).map(function(aw){
                      var isActive=aw.id===w.id;
                      return React.createElement("div",{key:aw.id,onClick:function(){
                        var nl=rotLock.slice();nl[i]=aw.id;setRotLock(nl);ps("wa_rotlock_"+SK,nl);
                        setEditDayIdx(null);setEditDayMode(null);
                      },style:{display:"flex",alignItems:"center",gap:6,background:isActive?"rgba(201,168,76,0.1)":"var(--bg)",border:"1px solid "+(isActive?"rgba(201,168,76,0.3)":"var(--border)"),borderRadius:8,padding:"6px 8px",cursor:"pointer"}},
                        React.createElement("span",{style:{fontSize:16}},aw.i),
                        React.createElement("div",{style:{flex:1,minWidth:0}},
                          React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},aw.n),
                          React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)"}},aw.d+(!IS_SHARED&&aw.t==="replica"?" · rep":""))))}))),

                /* Confirm wear / undo for today */
                isToday&&React.createElement("div",{style:{display:"flex",gap:6,marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)",alignItems:"center"}},
                  !worn?React.createElement("button",{onClick:function(){logWear(w.id,todayStr)},style:{background:"linear-gradient(135deg,var(--gold),#a8882a)",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",color:"var(--bg)",fontFamily:"var(--f)",fontSize:11,fontWeight:600,flex:1,minHeight:36}},"✓ Wearing this today")
                  :React.createElement(React.Fragment,null,
                    React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--good)",flex:1}},"✓ Logged for today"),
                    React.createElement("button",{onClick:function(){undoWear(todayStr)},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:9,minHeight:28}},"Undo"))),
                /* Outfit pairing row — tappable for alternatives */
                of&&React.createElement("div",{style:{marginTop:isToday?6:8,paddingTop:isToday?0:8,borderTop:isToday?"none":"1px solid var(--border)"}},
                  React.createElement("div",{onClick:function(){setExpandDay(expandDay===i?null:i);setPiecePicker(null);setPieceFilter(null)},style:{display:"flex",gap:6,cursor:"pointer"}},
                    [{l:"TOP",slot:"top",item:of.top},{l:"BTM",slot:"bot",item:of.bot},{l:"SHOE",slot:"shoe",item:of.shoe}].map(function(o){
                      var ep=getEP(i,o.slot,o.item);if(!ep)return null;
                      var swapped=pieceSwap[i+"-"+o.slot];
                      return React.createElement("div",{key:o.l,style:{flex:1,background:swapped?"rgba(201,168,76,0.06)":"var(--bg)",borderRadius:8,overflow:"hidden",border:"1px solid "+(swapped?"rgba(201,168,76,0.25)":"var(--border)"),minWidth:0}},
                        ph(ep.photoUrl)?React.createElement("img",{src:ph(ep.photoUrl),alt:"",style:{width:"100%",height:72,objectFit:"cover",display:"block"}}):React.createElement("div",{style:{width:"100%",height:72,background:(CM[ep.color]||{}).h||"#3a3a3a",display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement(Dot,{color:ep.color,size:14})),
                        React.createElement("div",{style:{padding:"4px 6px",display:"flex",alignItems:"center",gap:3}},
                          React.createElement(Dot,{color:ep.color,size:5}),
                          React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:swapped?"var(--gold)":"var(--sub)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},swapped?"✎ ":"",ep.name||ep.color)))}),
                    React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,flexShrink:0,minWidth:28}},
                      React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},expandDay===i?"▲":"▼"),
                      /* Per-day AI critique button */
                      React.createElement("button",{onClick:function(e){e.stopPropagation();
                        if(dayAi[i]){setDayAi(function(p){var n=Object.assign({},p);delete n[i];return n});return}
                        setDayAiLoading(i);
                        aiVision({top:getEP(i,"top",of.top),bot:getEP(i,"bot",of.bot),shoe:getEP(i,"shoe",of.shoe)},w,day.context,apiKeyRef.current).then(function(result){
                          setDayAi(function(p){var n=Object.assign({},p);n[i]=result||{vision:"AI unavailable",impact:0};return n});
                          setDayAiLoading(null);
                        });
                      },style:{background:"none",border:"1px solid "+(dayAi[i]?"rgba(201,168,76,0.4)":"var(--border)"),borderRadius:6,padding:"3px 8px",cursor:"pointer",color:dayAiLoading===i?"var(--gold)":dayAi[i]?"var(--gold)":"var(--dim)",fontSize:10,minHeight:24}},dayAiLoading===i?"⏳":dayAi[i]?"✨ "+dayAi[i].impact:"✨"))),

                  /* Expanded: AI critique result */
                  dayAi[i]&&React.createElement("div",{className:"fu",style:{marginTop:6,background:"rgba(201,168,76,0.04)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(201,168,76,0.15)"}},
                    dayAi[i].vision&&React.createElement("p",{style:{fontSize:10,fontFamily:"var(--sf)",fontStyle:"italic",lineHeight:1.5,color:"var(--text)",marginBottom:4}},dayAi[i].vision),
                    React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",fontSize:8,fontFamily:"var(--f)"}},
                      dayAi[i].impact>0&&React.createElement("span",{style:{color:dayAi[i].impact>=7?"var(--good)":dayAi[i].impact>=4?"var(--gold)":"var(--warn)",fontWeight:700}},"Impact: "+dayAi[i].impact+"/10"),
                      dayAi[i].color_story&&React.createElement("span",{style:{color:"#9a8abc"}},"🎨 "+dayAi[i].color_story),
                      dayAi[i].works&&React.createElement("span",{style:{color:"var(--good)"}},"✓ "+dayAi[i].works),
                      dayAi[i].risk&&React.createElement("span",{style:{color:"var(--warn)"}},"⚠ "+dayAi[i].risk))),

                  /* Expanded: outfit mannequin */
                  expandDay===i&&(pieceSwap[i+"-top"]||pieceSwap[i+"-bot"]||pieceSwap[i+"-shoe"])&&React.createElement("div",{style:{display:"flex",justifyContent:"flex-end",gap:6,marginTop:6,padding:"0 4px"},onClick:function(ev){ev.stopPropagation()}},
                    React.createElement("button",{onClick:function(){var ps2=Object.assign({},pieceSwap);delete ps2[i+"-top"];delete ps2[i+"-bot"];delete ps2[i+"-shoe"];setPieceSwap(ps2)},style:{background:"none",border:"1px solid var(--del-border)",borderRadius:6,padding:"2px 8px",fontSize:8,fontFamily:"var(--f)",color:"var(--del-text)",cursor:"pointer"}},"↩ Reset swaps"),
                    React.createElement("button",{onClick:function(){var newFit={watches:[w],top:getEP(i,"top",of.top),bot:getEP(i,"bot",of.bot),shoe:getEP(i,"shoe",of.shoe),context:day.context,name:day.dayName+" custom"};saveFit(newFit)},style:{background:"none",border:"1px solid var(--gold)",borderRadius:6,padding:"2px 8px",fontSize:8,fontFamily:"var(--f)",color:"var(--gold)",cursor:"pointer"}},"💾 Save custom")),
                  expandDay===i&&React.createElement("div",{className:"fu",style:{marginTop:8,display:"flex",gap:12,alignItems:"flex-start",justifyContent:"center"}},
                    React.createElement(OutfitFigure,{topColor:getEP(i,"top",of.top)?getEP(i,"top",of.top).color:"grey",botColor:getEP(i,"bot",of.bot)?getEP(i,"bot",of.bot).color:"charcoal",shoeColor:getEP(i,"shoe",of.shoe)?getEP(i,"shoe",of.shoe).color:"black",watchColor:w.c,watchIcon:w.i,watchName:w.n,size:100}),
                    sp&&sp.strap&&React.createElement("div",{style:{textAlign:"center",padding:"6px 0 2px",fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},
                      (function(){var stT=STRAP_TYPES.find(function(t){return t.id===sp.strap.type})||{icon:"🔗"};return stT.icon+" "+(sp.strap.type==="bracelet"?"Bracelet":sp.strap.color+" "+sp.strap.type)+(sp.strap.brand?" · "+sp.strap.brand:"")})()),
                    React.createElement("div",{style:{flex:1,minWidth:0}},
                      [{l:"TOP",slot:"top",item:getEP(i,"top",of.top)},{l:"BOTTOM",slot:"bot",item:getEP(i,"bot",of.bot)},{l:"SHOES",slot:"shoe",item:getEP(i,"shoe",of.shoe)}].map(function(o){
                        if(!o.item)return null;
                        var pk=i+"-"+o.slot;var isOpen=piecePicker===pk;var isSwapped=!!pieceSwap[pk];
                        return React.createElement("div",{key:o.l},
                          React.createElement("div",{style:{display:"flex",gap:8,alignItems:"center",marginBottom:isOpen?4:8,background:isSwapped?"rgba(201,168,76,0.06)":"var(--bg)",borderRadius:8,padding:"6px 8px",border:isSwapped?"1px solid rgba(201,168,76,0.25)":"1px solid var(--border)",cursor:"pointer"},onClick:function(ev){ev.stopPropagation();setPiecePicker(isOpen?null:pk);setPieceFilter(null)}},
                            ph(o.item.photoUrl)?React.createElement("img",{src:ph(o.item.photoUrl),alt:"",style:{width:56,height:56,objectFit:"cover",borderRadius:6,flexShrink:0}}):React.createElement("div",{style:{width:56,height:56,borderRadius:6,background:(CM[o.item.color]||{}).h||"#3a3a3a",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement(Dot,{color:o.item.color,size:16})),
                            React.createElement("div",{style:{flex:1,minWidth:0}},
                              React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)",letterSpacing:"0.08em"}},o.l+(isSwapped?" ✎":"")),
                              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:3}},
                                React.createElement(Dot,{color:o.item.color,size:6}),
                                React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:isSwapped?"var(--gold)":"var(--text)",fontWeight:500}},o.item.name||o.item.color)),
                              React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},o.item.garmentType+(o.item.pattern&&o.item.pattern!=="solid"?" · "+o.item.pattern:""))),
                            React.createElement("span",{style:{fontSize:10,color:"var(--dim)"}},isOpen?"▲":"🔄")),
                          /* ═ Piece picker ═ */
                          isOpen&&React.createElement(React.Fragment,null,
                          React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",padding:"4px 0 2px",marginBottom:2},onClick:function(ev){ev.stopPropagation()}},
                        [null].concat(slotAlts(o.slot).reduce(function(acc,it){if(acc.indexOf(it.color)===-1)acc.push(it.color);return acc},[])).map(function(fc){
                          var label=fc?fc.charAt(0).toUpperCase()+fc.slice(1):"All";var cnt=slotAlts(o.slot).filter(function(a){return !a.id||(fc===null||a.color===fc)}).length;
                          var isActive=pieceFilter===fc;
                          return React.createElement("button",{key:label,onClick:function(){setPieceFilter(isActive?null:fc)},style:{display:"flex",alignItems:"center",gap:3,background:isActive?"var(--gold)":"var(--bg)",color:isActive?"var(--bg)":"var(--sub)",border:"1px solid "+(isActive?"var(--gold)":"var(--border)"),borderRadius:12,padding:"2px 8px",fontSize:8,fontFamily:"var(--f)",cursor:"pointer",fontWeight:isActive?600:400}},fc&&React.createElement(Dot,{color:fc,size:6}),label,fc?" ("+slotAlts(o.slot).filter(function(x){return x.color===fc}).length+")":"")})),
                        slotPatterns(o.slot).length>0&&React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",padding:"2px 0 4px"},onClick:function(ev){ev.stopPropagation()}},
                          slotPatterns(o.slot).map(function(pt){
                            var isActive=pieceFilter==="p:"+pt;
                            return React.createElement("button",{key:pt,onClick:function(){setPieceFilter(isActive?null:"p:"+pt)},style:{background:isActive?"var(--gold)":"var(--bg)",color:isActive?"var(--bg)":"var(--sub)",border:"1px solid "+(isActive?"var(--gold)":"var(--border)"),borderRadius:12,padding:"2px 8px",fontSize:8,fontFamily:"var(--f)",cursor:"pointer",fontWeight:isActive?600:400,fontStyle:"italic"}},pt," (",slotAlts(o.slot).filter(function(x){return x.pattern===pt}).length,")")})),
                          React.createElement("div",{style:{display:"flex",gap:6,overflowX:"auto",padding:"6px 0 8px",marginBottom:8,WebkitOverflowScrolling:"touch"},onClick:function(ev){ev.stopPropagation()}},
                            isSwapped&&React.createElement("div",{onClick:function(){setPieceSwap(function(p){var n=Object.assign({},p);delete n[pk];return n});setPiecePicker(null)},style:{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 8px",borderRadius:8,border:"1px solid var(--del-border)",cursor:"pointer",minWidth:52}},
                              React.createElement("span",{style:{fontSize:14}},"↩️"),
                              React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--del-text)"}},"Reset")),
                            (function(){var _fa=filteredAlts(o.slot,o.item&&o.item.id);return _fa.length===0?[React.createElement("div",{key:"_empty",style:{flexShrink:0,padding:"8px 12px",color:"var(--dim)",fontSize:8,fontFamily:"var(--f)",fontStyle:"italic",whiteSpace:"nowrap"}},"No matches")]:_fa})().map(function(alt){
                              return React.createElement("div",{key:alt.id,onClick:function(){setPieceSwap(function(p){var n=Object.assign({},p);n[pk]=alt;return n});setPiecePicker(null)},style:{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 6px",borderRadius:8,border:"1px solid var(--border)",cursor:"pointer",minWidth:52,maxWidth:64}},
                                ph(alt.photoUrl)?React.createElement("img",{src:ph(alt.photoUrl),alt:"",style:{width:48,height:48,objectFit:"cover",borderRadius:6}}):React.createElement("div",{style:{width:48,height:48,borderRadius:6,background:(CM[alt.color]||{}).h||"#3a3a3a",display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement(Dot,{color:alt.color,size:14})),
                                React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--sub)",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:56}},alt.name||alt.color))}))))}),
                      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,background:"rgba(201,168,76,0.06)",borderRadius:8,padding:"6px 8px"}},
                        React.createElement("span",{style:{fontSize:16}},w.i),
                        React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},w.n),
                        React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--sub)"}},w.d+" · "+(w.straps&&w.straps.length?w.straps.map(function(s){return s.type}).join("+"):w.br?"Bracelet":(w.sc||[]).join("/")))))),

                  /* Expanded: alternative outfits */
                  expandDay===i&&day.altOutfits&&day.altOutfits.length>0&&React.createElement("div",{className:"fu",style:{marginTop:6}},
                    React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,marginBottom:4,letterSpacing:"0.08em"}},"ALTERNATIVES"),
                    day.altOutfits.map(function(alt,ai2){
                      return React.createElement("div",{key:ai2,onClick:function(){var sw=Object.assign({},altSwap);if(sw[i]===ai2){delete sw[i]}else{sw[i]=ai2}setAltSwap(sw);var ps2=Object.assign({},pieceSwap);delete ps2[i+"-top"];delete ps2[i+"-bot"];delete ps2[i+"-shoe"];setPieceSwap(ps2)},style:{display:"flex",gap:6,marginBottom:4,padding:"4px 0",borderBottom:ai2<day.altOutfits.length-1?"1px solid var(--border)":"none",cursor:"pointer",opacity:altSwap[i]===ai2?1:0.7,background:altSwap[i]===ai2?"rgba(184,150,42,0.08)":"none",borderRadius:4}},
                        [{item:alt.top},{item:alt.bot},{item:alt.shoe}].map(function(o,oi){
                          if(!o.item)return null;
                          return React.createElement("div",{key:oi,style:{display:"flex",alignItems:"center",gap:3,flex:"1 1 0",minWidth:0}},
                            ph(o.item.photoUrl)?React.createElement("img",{src:ph(o.item.photoUrl),alt:"",style:{width:28,height:28,objectFit:"cover",borderRadius:4,flexShrink:0}}):React.createElement(Dot,{color:o.item.color,size:8}),
                            React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--sub)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},o.item.name||o.item.color))}),
                        React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",flexShrink:0}},alt.fs))})),
                  expandDay===i&&(!day.altOutfits||!day.altOutfits.length)&&React.createElement("div",{style:{marginTop:6,fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",textAlign:"center",padding:6}},"No alternative combos for this context")));
            }),
            React.createElement("button",{onClick:function(){setRotLock([null,null,null,null,null,null,null]);ps("wa_rotlock_"+SK,[null,null,null,null,null,null,null]);setMode("auto");setTimeout(function(){setMode("rotation")},50)},style:{display:"block",margin:"12px auto 0",background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"10px 16px",cursor:"pointer",color:"var(--gold)",fontFamily:"var(--f)",fontSize:11,minHeight:40}},"🔄 Shuffle Rotation"));
        })(),

        /* AUTO */
        mode==="auto"&&React.createElement(React.Fragment,null,
          tier&&React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--dim)",margin:"0 0 8px"}},"🌡️ ",React.createElement("strong",{style:{color:"var(--gold)"}},tier.label+(planDay>0?" ("+forecast[planDay].date+")":"")),
            " · "+ww+" · "+actW.length+" watches · "+fits.length+" fits",
            planWx&&planWx.cond?React.createElement("span",{style:{color:planWx.rain?"#7ab8d8":"var(--sub)",marginLeft:6}},planWx.cond.i+" "+planWx.cond.l):null),
          /* Weather-specific advice banner */
          planWx&&(planWx.rain||planWx.uv>=8||(planWx.wind&&planWx.wind>=35))&&React.createElement("div",{style:{background:planWx.rain?"rgba(100,150,220,0.06)":"rgba(200,90,58,0.06)",border:"1px solid "+(planWx.rain?"rgba(100,150,220,0.2)":"rgba(200,90,58,0.2)"),borderRadius:10,padding:"8px 12px",marginBottom:10,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}},
            React.createElement("span",{style:{fontSize:14}},planWx.rain?"☂️":planWx.uv>=8?"🕶️":"💨"),
            React.createElement("div",{style:{flex:1,minWidth:120}},
              React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",fontWeight:600,color:planWx.rain?"#7ab8d8":"var(--warn)"}},planWx.rain?"Rain Day — Bracelet Watches Boosted":planWx.uv>=8?"High UV — Light Fabrics":"High Wind — Secure Layers"),
              React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},planWx.rain?"Leather straps penalized. White/cream shoes downranked."+(planWx.rainPct?" "+planWx.rainPct+"% chance.":""):planWx.uv>=8?"UV "+planWx.uv+" — light colors preferred":"Wind "+planWx.wind+"km/h"))),
          !fits.length?React.createElement("div",{style:{textAlign:"center",padding:"40px 16px"}},React.createElement("p",{style:{fontSize:28,margin:"0 0 8px"}},"👕"),React.createElement("p",{style:{fontSize:13,fontFamily:"var(--f)",color:"var(--dim)"}},wd.length<2?"Add wardrobe items":needsFix>0?"Classify items first":"No valid combos"))
          :fits.map(function(fit,idx){
            return React.createElement("div",{key:fit.id,className:"card-lift",onClick:function(){navTo("fits",fit);setFitWatch(null)},style:{background:idx===0?"var(--card2)":"var(--card)",border:idx===0?"1px solid rgba(201,168,76,0.25)":"1px solid var(--border)",borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",position:"relative"}},
              idx===0&&React.createElement("div",{style:{position:"absolute",top:8,right:12,fontSize:8,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:700}},"TOP"),
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:8}},
                React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:fit.fs>=8?"var(--good)":fit.fs>=5?"var(--gold)":"var(--warn)",fontWeight:600}},(fit.fs>=8?"🔥 ":fit.fs>=5?"":"⚠ ")+fit.fs),
                fit.layers&&fit.layers.length>1&&React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},fit.layers.length+"L"),
                fit.topType&&fit.topType!=="Shirt"&&React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)"}},fit.topType==="Sweater/Knit"?"🧶":fit.topType==="Jacket/Blazer"?"🧥":fit.topType==="Polo"?"🏇":fit.topType==="T-Shirt"?"👕":""),
                fit.explain&&fit.explain.length>0&&React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)",fontStyle:"italic"}},fit.explain[0])),
              React.createElement("div",{style:{display:"flex",gap:6,marginBottom:10}},
                [{l:"TOP",item:fit.top},{l:"BTM",item:fit.bot},{l:"SHOE",item:fit.shoe}].map(function(o){
                  if(!o.item)return null;
                  return React.createElement("div",{key:o.l,style:{flex:1,background:"var(--bg)",borderRadius:8,overflow:"hidden",border:"1px solid var(--border)",minWidth:0}},
                    ph(o.item.photoUrl)?React.createElement("img",{src:ph(o.item.photoUrl),alt:"",style:{width:"100%",height:80,objectFit:"cover",display:"block"}}):React.createElement("div",{style:{width:"100%",height:80,background:(CM[o.item.color]||{}).h||"#3a3a3a",display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement(Dot,{color:o.item.color,size:16})),
                    React.createElement("div",{style:{padding:"4px 6px"}},React.createElement("div",{style:{display:"flex",alignItems:"center",gap:3}},React.createElement(Dot,{color:o.item.color,size:5}),React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--sub)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},o.item.name||o.item.color))))})),
              React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                fit.watches.map(function(w,i){return React.createElement("div",{key:w.id,style:{display:"flex",alignItems:"center",gap:3}},React.createElement("span",{style:{fontSize:12}},w.i),React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:i===0?"var(--gold)":"var(--sub)",fontWeight:i===0?600:400}},w.n))})),
              fit.wxWarns&&fit.wxWarns.length>0&&React.createElement("div",{style:{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}},
                fit.wxWarns.map(function(warn,wi){return React.createElement("span",{key:wi,style:{fontSize:8,fontFamily:"var(--f)",color:"#7ab8d8",background:"rgba(100,150,220,0.08)",borderRadius:4,padding:"2px 6px",border:"1px solid rgba(100,150,220,0.15)"}},warn)})),
              /* Recently worn warning */
              (function(){var rw=fit.items.filter(function(it){if(!it.lastWorn)return false;return Math.floor((Date.now()-new Date(it.lastWorn).getTime())/864e5)<=2});return rw.length?React.createElement("div",{style:{marginTop:4,fontSize:8,fontFamily:"var(--f)",color:"var(--warn)"}},
                "🔄 "+(rw.length===1?(rw[0].name||rw[0].color)+" worn recently":rw.length+" items worn recently")):null})())}))),

      /* ═══ FIT DETAIL ═══ */
      view==="fits"&&selFit&&React.createElement("div",{key:"tab-fits-detail",className:"tab-content",style:{paddingTop:16,paddingBottom:40}},
        React.createElement("button",{onClick:function(){navBack()},style:{background:"none",border:"none",color:"var(--gold)",fontFamily:"var(--f)",fontSize:12,cursor:"pointer",padding:0,marginBottom:12,minHeight:44}},"← Back"),
        /* Outfit photo strip + mannequin fallback */
        React.createElement("div",{style:{display:"flex",gap:6,marginBottom:16,borderRadius:14,overflow:"hidden",border:"1px solid rgba(201,168,76,0.15)",background:"linear-gradient(145deg,var(--card),var(--card2))"}},
          (function(){var hasAnyPhoto=[selFit.top,selFit.bot,selFit.shoe].filter(Boolean).some(function(it){return ph(it.photoUrl)});
            if(hasAnyPhoto)return [selFit.top,selFit.bot,selFit.shoe].filter(Boolean).map(function(item,i){
              return React.createElement("div",{key:i,style:{flex:1,position:"relative",height:140}},
                ph(item.photoUrl)?React.createElement("img",{src:ph(item.photoUrl),alt:"",onClick:function(e){e.stopPropagation();openLightbox(item.photoUrl,item.id)},style:{width:"100%",height:"100%",objectFit:"cover",cursor:"zoom-in"}}):React.createElement("div",{style:{width:"100%",height:"100%",background:(CM[item.color]||{}).h||"#3a3a3a",display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement(Dot,{color:item.color,size:24})),
                React.createElement("div",{style:{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.7))",padding:"6px 8px"}},
                  React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"#fff",fontWeight:500}},["TOP","BTM","SHOE"][i])))});
            var dw=fitWatch||(selFit.watches&&selFit.watches[0])||null;
            return React.createElement("div",{style:{flex:1,display:"flex",justifyContent:"center",padding:"16px"}},React.createElement(OutfitFigure,{topColor:selFit.top?selFit.top.color:"grey",botColor:selFit.bot?selFit.bot.color:"charcoal",shoeColor:selFit.shoe?selFit.shoe.color:"black",watchColor:dw?dw.c:"#c9a84c",watchIcon:dw?dw.i:"⌚",watchName:dw?dw.n:"",size:130}))})()),
        (function(){var _ls=selFit.layers&&selFit.layers.length>1?selFit.layers:[selFit.top].filter(Boolean);var _sl=_ls.map(function(item,idx){var _lb=_ls.length===1?"TOP":layerOf(item.garmentType)==="outer"?"OUTER":layerOf(item.garmentType)==="mid"?"MID":"BASE";return{slot:"top",l:_lb,item:item}});_sl.push({slot:"bot",l:"BOTTOM",item:selFit.bot});_sl.push({slot:"shoes",l:"SHOES",item:selFit.shoe});return _sl}()).map(function(o){
          if(!o.item)return null;
          var swaps=getSwaps(wd,selFit,o.slot);
          return React.createElement("div",{key:o.slot,style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"12px 14px",marginBottom:8}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10}},
              ph(o.item.photoUrl)?React.createElement("img",{src:ph(o.item.photoUrl),alt:"",onClick:function(e){e.stopPropagation();openLightbox(o.item.photoUrl,o.item.id)},style:{width:80,height:80,objectFit:"cover",borderRadius:10,cursor:"zoom-in",flexShrink:0}}):React.createElement("div",{style:{width:80,height:80,borderRadius:10,background:(CM[o.item.color]||{}).h||"#3a3a3a",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}},React.createElement(Dot,{color:o.item.color,size:20})),
              React.createElement("div",{onClick:function(){setEditG(o.item)},style:{flex:1,cursor:"pointer"}},React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},o.l),React.createElement("div",{style:{display:"flex",alignItems:"center",gap:4}},React.createElement(Dot,{color:o.item.color}),React.createElement("span",{style:{fontSize:14,fontWeight:500}},o.item.name||(o.item.color+" "+o.item.garmentType))),React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},o.item.garmentType+(o.item.pattern&&o.item.pattern!=="solid"?" · "+o.item.pattern:""))),
              React.createElement("button",{onClick:function(e){e.stopPropagation();setEditG(o.item)},style:{background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"var(--sub)",fontFamily:"var(--f)",fontSize:9,flexShrink:0,minHeight:32}},"✏️ Edit"),
              React.createElement("button",{onClick:function(e){e.stopPropagation();setLockItem(o.item);navBack();setMode("auto")},style:{background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"6px 10px",cursor:"pointer",color:"var(--gold)",fontFamily:"var(--f)",fontSize:9,flexShrink:0,minHeight:32}},"🔒 Lock")),
            swaps.length>0&&React.createElement("div",{style:{marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)"}},
              React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",letterSpacing:"0.08em",textTransform:"uppercase"}},"SWAP WITH"),
              React.createElement("div",{style:{display:"flex",gap:6,marginTop:4},className:"hscroll"},
                swaps.map(function(s){return React.createElement("div",{key:s.id,onClick:function(){
                  var newItems=(selFit.items||[]).map(function(it){return it.id===(o.slot==="top"?selFit.top:o.slot==="bot"?selFit.bot:selFit.shoe).id?s:it});
                  var newFit=makeOutfit(newItems,actW,effectiveCtx,reps,planWx,planTemp?planTemp.feels:18);
                  setSelFit(newFit);
                },style:{display:"flex",alignItems:"center",gap:4,background:"var(--bg)",borderRadius:8,padding:"6px 10px",border:"1px solid var(--border)",flexShrink:0,cursor:"pointer",transition:"all .15s"},className:"card-lift"},
                  ph(s.photoUrl)?React.createElement("img",{src:ph(s.photoUrl),alt:"",style:{width:36,height:36,objectFit:"cover",borderRadius:6}}):React.createElement(Dot,{color:s.color,size:10}),
                  React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},s.name||s.color),
                  React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--gold)"}},s.ss))}))))}),
        React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"16px 0 10px"}},
          React.createElement("h2",{style:{fontSize:11,fontFamily:"var(--f)",fontWeight:600,letterSpacing:"0.14em",color:"var(--gold)",textTransform:"uppercase",margin:0}},"Watch Pairings"),
          React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},fitWatch?"Tap again to deselect":"Tap to choose")),
        fitWatch&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,background:"rgba(201,168,76,0.06)",border:"1px solid rgba(201,168,76,0.25)",borderRadius:10,padding:"8px 12px",marginBottom:8}},
          React.createElement("span",{style:{fontSize:18}},fitWatch.i),
          React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,flex:1}},"🔒 "+fitWatch.n),
          React.createElement("button",{onClick:function(){setFitWatch(null)},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"var(--warn)",fontFamily:"var(--f)",fontSize:9,minHeight:28}},"✕ Clear")),
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:8,marginBottom:16}},(selFit.allW||selFit.watches).slice(0,6).map(function(w,i){
          return React.createElement("div",{key:w.id,onClick:function(){setFitWatch(fitWatch&&fitWatch.id===w.id?null:w)},style:{cursor:"pointer",border:fitWatch&&fitWatch.id===w.id?"2px solid var(--gold)":"2px solid transparent",borderRadius:14,transition:"all .15s"}},
            React.createElement(WCard,{w:w,rank:fitWatch?fitWatch.id===w.id?0:null:i,detail:true}))})),
        React.createElement("button",{className:"btn btn-gold",onClick:function(){
          /* If user selected a watch, reorder watches so selected is first */
          if(fitWatch){var reordered=[fitWatch].concat((selFit.allW||selFit.watches).filter(function(w){return w.id!==fitWatch.id}));var updFit=Object.assign({},selFit,{watches:reordered.slice(0,3)});saveFit(updFit)}else{saveFit(selFit)}
        }},"💾 Save Outfit"),
        React.createElement("button",{className:"btn",style:{marginTop:8,background:"rgba(122,184,216,0.1)",border:"1px solid rgba(122,184,216,0.3)",color:"#7ab8d8"},onClick:async function(){
          try{showToast("Generating image…","var(--gold)",2000);var dw=fitWatch||(selFit.watches&&selFit.watches[0])||null;var shareFit=Object.assign({},selFit,{watches:dw?[dw]:selFit.watches||[],context:Array.isArray(effectiveCtx)?effectiveCtx.join(" · "):effectiveCtx});var blob=await shareOutfitCanvas(shareFit,CM,ph,photoAsDataUrl);
          if(navigator.canShare&&navigator.canShare({files:[new File([blob],"outfit.png",{type:"image/png"})]})){await navigator.share({files:[new File([blob],"outfit.png",{type:"image/png"})],title:"Today's Fit",text:"Check out my outfit!"}).catch(function(){})}
          else{var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="outfit-"+Date.now()+".png";a.click();URL.revokeObjectURL(url);showToast("Image saved!","var(--good)",2000)}
          }catch(e){console.warn("[WA] Share error",e);showToast("Share failed: "+e.message,"var(--warn)",3000)}
        }},"📸 Share as Image")),

      /* ═══ INSIGHTS ═══ */
      view==="insights"&&React.createElement("div",{key:"tab-insights",className:"tab-content",style:{paddingTop:16,paddingBottom:40}},

        /* 7-day weather strip */
        forecast.length>0&&React.createElement("div",{style:{marginBottom:14}},
          React.createElement("div",{style:{display:"flex",gap:4,overflowX:"auto",paddingBottom:4},className:"hscroll"},
            forecast.map(function(fc,i){
              var d=new Date(fc.date+"T12:00:00");var dn=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d.getDay()];
              return React.createElement("div",{key:i,style:{flex:"0 0 auto",background:fc.cond&&fc.cond.rain?"rgba(100,150,220,0.06)":"var(--card)",border:"1px solid "+(fc.cond&&fc.cond.rain?"rgba(100,150,220,0.2)":"var(--border)"),borderRadius:10,padding:"6px 10px",minWidth:62,textAlign:"center"}},
                React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)",fontWeight:500}},i===0?"Today":dn),
                React.createElement("div",{style:{fontSize:16,margin:"2px 0"}},fc.cond?fc.cond.i:""),
                React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",fontWeight:600}},fc.high+"°/"+fc.low+"°"),
                fc.rainPct>0&&React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:fc.rainPct>=50?"#7ab8d8":"var(--dim)"}},"💧"+fc.rainPct+"%"))}))),

        /* ── ONE-TAP DAILY PICK ── */
        React.createElement("div",{style:{background:"linear-gradient(135deg,var(--card),var(--card2))",border:"1px solid rgba(201,168,76,0.3)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
            React.createElement("span",{style:{fontSize:20}},"⚡"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600,color:"var(--gold)"}},"Today's Pick")),
          !dailyPick?React.createElement("button",{className:"btn btn-gold",onClick:function(){
            var cx0=weekCtx[new Date().getDay()]||"smart-casual";
            var rotation=genWeekRotation(actW,forecast,weekCtx,wd,reps,wearLog,rotLock,loc.lat);
            /* Apply alt swaps for today */
            if(altSwap[0]!=null&&rotation[0]&&rotation[0].altOutfits&&rotation[0].altOutfits[altSwap[0]]){
              var orig0=rotation[0].outfit;var origFs0=rotation[0].fs||rotation[0].altOutfits[altSwap[0]].fs;
              rotation[0].outfit=rotation[0].altOutfits[altSwap[0]];rotation[0].fs=rotation[0].altOutfits[altSwap[0]].fs;
              var na0=rotation[0].altOutfits.slice();na0[altSwap[0]]={top:orig0.top,bot:orig0.bot,shoe:orig0.shoe,fs:origFs0};rotation[0].altOutfits=na0;
            }
            var today=rotation[0];
            if(today&&today.watch){
              var sp=today.strapPick;
              setDailyPick({watch:today.watch,outfit:today.outfit,strap:sp,context:cx0,tier:tier});setPieceSwap(function(p){var n=Object.assign({},p);delete n["t-top"];delete n["t-bot"];delete n["t-shoe"];return n});setPiecePicker(null);
            }
          }},"⚡ What Should I Wear?")
          :React.createElement("div",{className:"fu"},
            /* Watch */
            React.createElement("div",{style:{display:"flex",gap:12,alignItems:"center",marginBottom:12}},
              React.createElement("div",{style:{width:52,height:52,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:dailyPick.watch.c+"25",fontSize:26,border:"3px solid "+dailyPick.watch.c+"50"}},dailyPick.watch.i),
              React.createElement("div",{style:{flex:1}},
                React.createElement("div",{style:{fontSize:18,fontWeight:600,color:"var(--gold)"}},dailyPick.watch.n),
                React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",display:"flex",alignItems:"center",gap:4}},
                  React.createElement("span",null,dailyPick.watch.d+" · "),
                  dailyPick.strap&&dailyPick.strap.strap?React.createElement(StrapSwatch,{strap:dailyPick.strap.strap,size:8}):dailyPick.watch.br?React.createElement("span",{style:{display:"inline-flex",alignItems:"center",gap:3}},React.createElement("span",{style:{width:8,height:8,borderRadius:"50%",background:"linear-gradient(135deg,#c0c0c0,#888)",flexShrink:0}}),"⛓️ Bracelet"):React.createElement("span",null,dailyPick.strap?dailyPick.strap.text:"Strap"),
                  React.createElement("span",null," · "+(CXI[dailyPick.context]||"")+dailyPick.context)),
                !IS_SHARED&&dailyPick.watch.t==="replica"&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"#6a5a50",border:"1px solid var(--rep-border)",borderRadius:3,padding:"1px 5px",marginTop:2,display:"inline-block"}},"REP"))),
            /* Outfit with mannequin */
            dailyPick.outfit&&React.createElement("div",{style:{display:"flex",gap:12,marginBottom:12,alignItems:"flex-start"}},
              React.createElement(OutfitFigure,{topColor:getEP("t","top",dailyPick.outfit.top)?getEP("t","top",dailyPick.outfit.top).color:"grey",botColor:getEP("t","bot",dailyPick.outfit.bot)?getEP("t","bot",dailyPick.outfit.bot).color:"charcoal",shoeColor:getEP("t","shoe",dailyPick.outfit.shoe)?getEP("t","shoe",dailyPick.outfit.shoe).color:"black",watchColor:dailyPick.watch.c,watchIcon:dailyPick.watch.i,watchName:dailyPick.watch.n,size:110}),
              React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",gap:6}},
                [{l:"TOP",slot:"top",item:getEP("t","top",dailyPick.outfit.top)},{l:"BTM",slot:"bot",item:getEP("t","bot",dailyPick.outfit.bot)},{l:"SHOE",slot:"shoe",item:getEP("t","shoe",dailyPick.outfit.shoe)}].map(function(o){
                  if(!o.item)return null;
                  var pk="t-"+o.slot;var isOpen=piecePicker===pk;var isSwapped=!!pieceSwap[pk];
                  return React.createElement("div",{key:o.l},
                    React.createElement("div",{style:{background:isSwapped?"rgba(201,168,76,0.06)":"var(--bg)",borderRadius:10,overflow:"hidden",border:isSwapped?"1px solid rgba(201,168,76,0.25)":"1px solid var(--border)",cursor:"pointer"},onClick:function(ev){ev.stopPropagation();setPiecePicker(isOpen?null:pk);setPieceFilter(null)}},
                      ph(o.item.photoUrl)?React.createElement("img",{src:ph(o.item.photoUrl),alt:"",style:{width:"100%",height:80,objectFit:"cover",display:"block"}}):React.createElement("div",{style:{width:"100%",height:80,background:(CM[o.item.color]||{}).h||"#3a3a3a",display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement(Dot,{color:o.item.color,size:18})),
                      React.createElement("div",{style:{padding:"5px 8px",display:"flex",alignItems:"center",gap:4}},
                        React.createElement(Dot,{color:o.item.color,size:6}),
                        React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:isSwapped?"var(--gold)":"var(--text)",fontWeight:500}},o.item.name||o.item.color),
                        React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)",marginLeft:"auto"}},o.l+(isSwapped?" ✎":"")),
                        React.createElement("span",{style:{fontSize:10,color:"var(--dim)",marginLeft:4}},isOpen?"▲":"🔄"))),
                    isOpen&&React.createElement(React.Fragment,null,
                    React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",padding:"4px 0 6px",marginBottom:2},onClick:function(ev){ev.stopPropagation()}},
                      [null].concat(slotAlts(o.slot).reduce(function(acc,it){if(acc.indexOf(it.color)===-1)acc.push(it.color);return acc},[])).map(function(fc){
                        var label=fc?fc.charAt(0).toUpperCase()+fc.slice(1):"All";var cnt=slotAlts(o.slot).filter(function(a){return !a.id||(fc===null||a.color===fc)}).length;
                        var isActive=pieceFilter===fc;
                        return React.createElement("button",{key:label,onClick:function(){setPieceFilter(isActive?null:fc)},style:{background:isActive?"var(--gold)":"var(--bg)",color:isActive?"var(--bg)":"var(--sub)",border:"1px solid "+(isActive?"var(--gold)":"var(--border)"),borderRadius:12,padding:"2px 8px",fontSize:8,fontFamily:"var(--f)",cursor:"pointer",fontWeight:isActive?600:400}},fc?React.createElement(React.Fragment,null,React.createElement(Dot,{color:fc,size:5})," ",label," (",slotAlts(o.slot).filter(function(x){return x.color===fc}).length,")"):label)})),
                    slotPatterns(o.slot).length>0&&React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",padding:"2px 0 4px"},onClick:function(ev){ev.stopPropagation()}},
                      slotPatterns(o.slot).map(function(pt){
                        var isActive=pieceFilter==="p:"+pt;
                        return React.createElement("button",{key:pt,onClick:function(){setPieceFilter(isActive?null:"p:"+pt)},style:{background:isActive?"var(--gold)":"var(--bg)",color:isActive?"var(--bg)":"var(--sub)",border:"1px solid "+(isActive?"var(--gold)":"var(--border)"),borderRadius:12,padding:"2px 8px",fontSize:8,fontFamily:"var(--f)",cursor:"pointer",fontWeight:isActive?600:400,fontStyle:"italic"}},pt," (",slotAlts(o.slot).filter(function(x){return x.pattern===pt}).length,")")})),
                    React.createElement("div",{style:{display:"flex",gap:6,overflowX:"auto",padding:"6px 0",WebkitOverflowScrolling:"touch"},onClick:function(ev){ev.stopPropagation()}},
                      isSwapped&&React.createElement("div",{onClick:function(){setPieceSwap(function(p){var n=Object.assign({},p);delete n[pk];return n});setPiecePicker(null)},style:{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 8px",borderRadius:8,border:"1px solid var(--del-border)",cursor:"pointer",minWidth:52}},
                        React.createElement("span",{style:{fontSize:14}},"↩️"),
                        React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--del-text)"}},"Reset")),
                      (function(){var _fa=filteredAlts(o.slot,o.item&&o.item.id);return _fa.length===0?[React.createElement("div",{key:"_empty",style:{flexShrink:0,padding:"8px 12px",color:"var(--dim)",fontSize:8,fontFamily:"var(--f)",fontStyle:"italic",whiteSpace:"nowrap"}},"No matches")]:_fa})().map(function(alt){
                        return React.createElement("div",{key:alt.id,onClick:function(){setPieceSwap(function(p){var n=Object.assign({},p);n[pk]=alt;return n});setPiecePicker(null)},style:{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"4px 6px",borderRadius:8,border:"1px solid var(--border)",cursor:"pointer",minWidth:52,maxWidth:64}},
                          ph(alt.photoUrl)?React.createElement("img",{src:ph(alt.photoUrl),alt:"",style:{width:48,height:48,objectFit:"cover",borderRadius:6}}):React.createElement("div",{style:{width:48,height:48,borderRadius:6,background:(CM[alt.color]||{}).h||"#3a3a3a",display:"flex",alignItems:"center",justifyContent:"center"}},React.createElement(Dot,{color:alt.color,size:14})),
                          React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--sub)",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:56}},alt.name||alt.color))}))))}))),
            /* Actions */
            React.createElement("div",{style:{display:"flex",gap:8}},
              !todayWorn&&React.createElement("button",{className:"btn btn-gold",style:{flex:1},onClick:function(){logWear(dailyPick.watch.id,todayStr)}},"✓ Wearing This"),
              todayWorn&&React.createElement("span",{style:{flex:1,textAlign:"center",fontSize:12,fontFamily:"var(--f)",color:"var(--good)",padding:14}},"✓ Logged"),
              React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"14px 16px"},onClick:function(){setDailyPick(null);setAiCritique(null);setPieceSwap(function(p){var n=Object.assign({},p);delete n["t-top"];delete n["t-bot"];delete n["t-shoe"];return n});setPiecePicker(null)}},"↻"),
              React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"14px 16px",color:"#7ab8d8"},onClick:async function(){
                try{showToast("Generating…","var(--gold)",2000);var topItem=getEP("t","top",dailyPick.outfit.top),botItem=getEP("t","bot",dailyPick.outfit.bot),shoeItem=getEP("t","shoe",dailyPick.outfit.shoe);
                var shareFit={top:topItem,bot:botItem,shoe:shoeItem,watches:[dailyPick.watch],context:dailyPick.context,fs:dailyPick.outfit.fs||0};
                var blob=await shareOutfitCanvas(shareFit,CM,ph,photoAsDataUrl);
                if(navigator.canShare&&navigator.canShare({files:[new File([blob],"outfit.png",{type:"image/png"})]})){await navigator.share({files:[new File([blob],"outfit.png",{type:"image/png"})],title:"Today's Fit"}).catch(function(){})}
                else{var url=URL.createObjectURL(blob);var a=document.createElement("a");a.href=url;a.download="fit-"+Date.now()+".png";a.click();URL.revokeObjectURL(url);showToast("Image saved!","var(--good)",2000)}
                }catch(e){console.warn("[WA]",e);showToast("Share error","var(--warn)",3000)}
              }},"📸")))),

        /* ── AI OUTFIT CRITIQUE ── */
        React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
            React.createElement("span",{style:{fontSize:20}},"🧠"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"AI Critique")),
          dailyPick&&dailyPick.outfit&&dailyPick.watch?React.createElement("div",null,
            !aiCritique&&!aiLoading&&React.createElement("button",{className:"btn btn-gold",onClick:async function(){
              setAiLoading(true);
              var result=await aiVision(dailyPick.outfit,dailyPick.watch,dailyPick.context,apiKeyRef.current);
              if(result)setAiCritique(result);else setAiCritique({vision:"AI unavailable. Check your API key in settings.",impact:0,impact_why:"",works:"",risk:"",strap_call:""});
              setAiLoading(false);
            }},"🧠 Critique Today's Pick"),
            aiLoading&&React.createElement("div",{style:{textAlign:"center",padding:20}},React.createElement("div",{className:"sp",style:{width:20,height:20,border:"2px solid var(--gold)",borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 8px"}}),React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)"}},"Analyzing...")),
            aiCritique&&React.createElement("div",{className:"fu"},
              /* Vision */
              aiCritique.vision&&React.createElement("div",{style:{background:"var(--bg)",borderRadius:10,padding:"12px",marginBottom:10,borderLeft:"3px solid var(--gold)"}},
                React.createElement("p",{style:{fontSize:12,fontFamily:"var(--sf)",fontStyle:"italic",lineHeight:1.6,color:"var(--text)"}},aiCritique.vision)),
              /* Impact score */
              aiCritique.impact>0&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:10}},
                React.createElement("div",{style:{width:48,height:48,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:aiCritique.impact>=7?"rgba(122,184,122,0.15)":aiCritique.impact>=4?"rgba(201,168,76,0.15)":"rgba(200,90,58,0.15)",border:"2px solid "+(aiCritique.impact>=7?"var(--good)":aiCritique.impact>=4?"var(--gold)":"var(--warn)"),fontSize:18,fontFamily:"var(--f)",fontWeight:700,color:aiCritique.impact>=7?"var(--good)":aiCritique.impact>=4?"var(--gold)":"var(--warn)"}},aiCritique.impact),
                React.createElement("div",{style:{flex:1}},
                  React.createElement("div",{style:{fontSize:11,fontFamily:"var(--f)",fontWeight:600,color:aiCritique.impact>=7?"var(--good)":aiCritique.impact>=4?"var(--gold)":"var(--warn)"}},aiCritique.impact>=8?"Commanding":aiCritique.impact>=6?"Solid":aiCritique.impact>=4?"Acceptable":"Needs Work"),
                  aiCritique.impact_why&&React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginTop:2}},aiCritique.impact_why))),
              /* Details */
              [aiCritique.color_story&&{l:"🎨 Colors",t:aiCritique.color_story,c:"#9a8abc"},aiCritique.works&&{l:"✓ What Works",t:aiCritique.works,c:"var(--good)"},aiCritique.risk&&{l:"⚠ Risk",t:aiCritique.risk,c:"var(--warn)"},aiCritique.upgrade&&{l:"⬆ Upgrade",t:aiCritique.upgrade,c:"var(--gold)"},aiCritique.strap_call&&{l:"🔗 Strap Call",t:aiCritique.strap_call,c:"var(--sub)"}].filter(Boolean).map(function(item,i){
                return React.createElement("div",{key:i,style:{display:"flex",gap:8,marginBottom:6}},
                  React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:item.c,fontWeight:600,minWidth:70}},item.l),
                  React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)"}},item.t))}),
              React.createElement("button",{className:"btn btn-ghost",style:{marginTop:8,fontSize:11},onClick:function(){setAiCritique(null)}},"↻ Re-critique")))
          :React.createElement("p",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--dim)",textAlign:"center",padding:10}},"Generate Today's Pick first ↑")),

        /* ── VISUAL OUTFIT CARD ── */
        dailyPick&&dailyPick.outfit&&React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
            React.createElement("span",{style:{fontSize:20}},"🎴"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Outfit Card")),
          /* The card itself */
          React.createElement("div",{id:"outfit-card",style:{background:"linear-gradient(145deg,var(--card),var(--card2))",borderRadius:16,padding:"20px",border:"1px solid rgba(201,168,76,0.2)",maxWidth:340,margin:"0 auto"}},
            /* Date + context header */
            React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:16}},
              React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,letterSpacing:"0.12em"}},new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}).toUpperCase()),
              React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--dim)"}},(CXI[dailyPick.context]||"")+" "+dailyPick.context)),
            /* Mannequin + Color blocks */
            React.createElement("div",{style:{display:"flex",gap:12,marginBottom:16,alignItems:"center"}},
              React.createElement(OutfitFigure,{topColor:getEP("t","top",dailyPick.outfit.top)?getEP("t","top",dailyPick.outfit.top).color:"grey",botColor:getEP("t","bot",dailyPick.outfit.bot)?getEP("t","bot",dailyPick.outfit.bot).color:"charcoal",shoeColor:getEP("t","shoe",dailyPick.outfit.shoe)?getEP("t","shoe",dailyPick.outfit.shoe).color:"black",watchColor:dailyPick.watch.c,watchIcon:dailyPick.watch.i,watchName:"",size:90}),
              React.createElement("div",{style:{flex:1,display:"flex",gap:4,height:120}},
                [dailyPick.outfit.top,dailyPick.outfit.bot,dailyPick.outfit.shoe].filter(Boolean).map(function(item,i){
                  return React.createElement("div",{key:i,style:{flex:1,borderRadius:10,overflow:"hidden",position:"relative"}},
                    ph(item.photoUrl)?React.createElement("img",{src:ph(item.photoUrl),alt:"",style:{width:"100%",height:"100%",objectFit:"cover"}}):React.createElement("div",{style:{width:"100%",height:"100%",background:(CM[item.color]||{}).h||"#3a3a3a"}}),
                    React.createElement("div",{style:{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(0,0,0,0.7))",padding:"4px 6px"}},
                      React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"#fff"}},["TOP","BTM","SHOE"][i])))}))),
            /* Watch row */
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,background:"rgba(201,168,76,0.06)",borderRadius:10,padding:"10px 12px"}},
              React.createElement("span",{style:{fontSize:24}},dailyPick.watch.i),
              React.createElement("div",{style:{flex:1}},
                React.createElement("div",{style:{fontSize:14,fontWeight:600,color:"var(--gold)"}},dailyPick.watch.n),
                React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},dailyPick.watch.d+" · "+(dailyPick.strap&&dailyPick.strap.strap?((STRAP_TYPES.find(function(t){return t.id===dailyPick.strap.strap.type})||{icon:"🔗"}).icon+" "+(dailyPick.strap.strap.type==="bracelet"?"Bracelet":dailyPick.strap.strap.color+" "+dailyPick.strap.strap.type)):dailyPick.watch.br?"⛓️ Bracelet":dailyPick.strap?dailyPick.strap.text:"Strap"))),
              aiCritique&&aiCritique.impact>0&&React.createElement("div",{style:{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid "+(aiCritique.impact>=7?"var(--good)":aiCritique.impact>=4?"var(--gold)":"var(--warn)"),fontSize:14,fontFamily:"var(--f)",fontWeight:700,color:aiCritique.impact>=7?"var(--good)":aiCritique.impact>=4?"var(--gold)":"var(--warn)"}},aiCritique.impact)),
            React.createElement("div",{style:{textAlign:"center",marginTop:12}},
              React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--border)",letterSpacing:"0.2em"}},"WATCH ADVISOR")))),

        /* ── WATCH WEAR STATS ── */
        (function(){
          if(!wearLog.length&&!actW.length)return null;
          var now=Date.now();var d30=now-30*864e5;var d7=now-7*864e5;
          /* Only count wears for watches that still exist in the collection */
          var activeIds=new Set(actW.map(function(w){return w.id}));
          var validLog=wearLog.filter(function(e){return activeIds.has(e.watchId)&&(e.ts||0)>0});
          var last30=validLog.filter(function(e){return e.ts>d30});
          var last7=validLog.filter(function(e){return e.ts>d7});
          /* Frequency map: watchId → count in last 30 days */
          var freq={};last30.forEach(function(e){freq[e.watchId]=(freq[e.watchId]||0)+1});
          /* Last worn map: watchId → most recent timestamp */
          var lastW={};validLog.forEach(function(e){if(!lastW[e.watchId]||e.ts>lastW[e.watchId])lastW[e.watchId]=e.ts});
          /* Build sorted watch stats */
          var stats=actW.filter(function(w){return w.status==="active"}).map(function(w){
            var cnt=freq[w.id]||0;var lw=lastW[w.id]||0;var ago=lw?Math.floor((now-lw)/864e5):999;
            return{id:w.id,n:w.n,i:w.i,c:w.c,t:w.t,d:w.d,cnt:cnt,ago:ago,lw:lw}});
          stats.sort(function(a,b){return b.cnt-a.cnt});
          var maxCnt=Math.max.apply(null,stats.map(function(s){return s.cnt}).concat([1]));
          /* Neglected: active genuine watches not worn in 7+ days */
          var neglected=stats.filter(function(s){return s.ago>=7&&s.t!=="replica"});
          /* Current streak: consecutive days with a logged wear */
          var streak=0;var sd=new Date();sd.setHours(0,0,0,0);
          for(var si=0;si<60;si++){var ds=new Date(sd.getTime()-si*864e5).toISOString().slice(0,10);if(validLog.some(function(e){return e.date===ds}))streak++;else break}
          /* Empty state: watches exist but no wear data yet */
          if(!validLog.length)return React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
              React.createElement("span",{style:{fontSize:20}},"📊"),
              React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Wear Stats")),
            React.createElement("div",{style:{textAlign:"center",padding:"12px 0",color:"var(--dim)",fontSize:10,fontFamily:"var(--f)"}},"No wear data yet. Tap \"✓ Wearing this today\" on a watch to start tracking."));
          return React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
              React.createElement("span",{style:{fontSize:20}},"📊"),
              React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Wear Stats")),
            /* Summary row */
            React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}},
              [{v:last30.length,l:"This Month",i:"📅"},{v:last7.length,l:"This Week",i:"🗓️"},{v:streak,l:"Day Streak",i:"🔥"}].map(function(st){
                return React.createElement("div",{key:st.l,style:{background:"var(--bg)",borderRadius:10,padding:"10px 8px",textAlign:"center",border:"1px solid var(--border)"}},
                  React.createElement("div",{style:{fontSize:22,fontFamily:"var(--f)",fontWeight:700,color:"var(--gold)"}},st.v),
                  React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",marginTop:2}},st.i+" "+st.l))})),
            /* Frequency bars */
            React.createElement("div",{style:{marginBottom:neglected.length?12:0}},
              stats.slice(0,12).map(function(s){
                var pct=maxCnt>0?Math.round(s.cnt/maxCnt*100):0;
                var agoLabel=s.ago===0?"today":s.ago===1?"yesterday":s.ago<999?s.ago+"d ago":"never";
                var barColor=s.cnt>=6?"var(--good)":s.cnt>=3?"var(--gold)":"var(--warn)";
                return React.createElement("div",{key:s.id,style:{display:"flex",alignItems:"center",gap:8,marginBottom:5}},
                  React.createElement("span",{style:{fontSize:14,width:20,textAlign:"center",flexShrink:0}},s.i),
                  React.createElement("div",{style:{width:70,fontSize:9,fontFamily:"var(--f)",color:"var(--text)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}},s.n),
                  React.createElement("div",{style:{flex:1,height:12,background:"var(--bg)",borderRadius:6,overflow:"hidden",border:"1px solid var(--border)"}},
                    React.createElement("div",{style:{width:Math.max(pct,2)+"%",height:"100%",background:barColor,borderRadius:6,transition:"width 0.3s"}})),
                  React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,minWidth:16,textAlign:"right",flexShrink:0}},s.cnt),
                  React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:s.ago>=7?"var(--warn)":"var(--dim)",minWidth:42,textAlign:"right",flexShrink:0}},agoLabel))})),
            /* Neglected watches alert */
            neglected.length>0&&React.createElement("div",{style:{background:"rgba(200,90,58,0.06)",border:"1px solid rgba(200,90,58,0.15)",borderRadius:10,padding:"10px 12px"}},
              React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600,marginBottom:6}},"⏰ Neglected — "+neglected.length+" watch"+(neglected.length>1?"es":"")+" not worn in 7+ days"),
              React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                neglected.slice(0,6).map(function(s){
                  return React.createElement("span",{key:s.id,style:{display:"inline-flex",alignItems:"center",gap:4,fontSize:9,fontFamily:"var(--f)",color:"var(--text)",background:"var(--bg)",borderRadius:6,padding:"4px 8px",border:"1px solid var(--border)"}},
                    React.createElement("span",{style:{fontSize:12}},s.i),s.n+" ("+s.ago+"d)")}))))})(),

        /* ── NEGLECTED WARDROBE ── */
        (function(){var now=Date.now();var stale=wd.filter(function(i){if(!i.lastWorn||i.archived)return false;var d=Math.floor((now-new Date(i.lastWorn).getTime())/864e5);return d>=14});stale.sort(function(a,b){return new Date(a.lastWorn).getTime()-new Date(b.lastWorn).getTime()});return stale.length>0?React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
            React.createElement("span",{style:{fontSize:20}},"🧊"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Neglected Wardrobe"),
            React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",background:"rgba(200,90,58,0.1)",borderRadius:8,padding:"2px 8px",fontWeight:600}},stale.length+" item"+(stale.length>1?"s":""))),
          React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:6}},
            stale.slice(0,12).map(function(item){var d=Math.floor((now-new Date(item.lastWorn).getTime())/864e5);return React.createElement("div",{key:item.id,className:"gcard",onClick:function(){setEditG(item)},style:{background:"var(--bg)",border:"1px solid rgba(200,90,58,0.2)"}},
              ph(item.photoUrl)?React.createElement("img",{src:ph(item.photoUrl),alt:"",decoding:"async",style:{width:"100%",height:60,objectFit:"cover",display:"block",opacity:0.7}}):React.createElement("div",{style:{width:"100%",height:40,background:(CM[item.color]||{}).h||"#2a2a2a",opacity:0.7}}),
              React.createElement("div",{style:{padding:"4px 6px"}},
                React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},item.name||item.color),
                React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--warn)"}},d+"d ago")))})),
          stale.length>12&&React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",textAlign:"center",marginTop:8}},"+"+(stale.length-12)+" more")):null})(),

        /* ── AI STYLE COACH ── */
        React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
            React.createElement("span",{style:{fontSize:20}},"🎓"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"AI Style Coach")),
          !aiCoach&&!aiCoachLoading&&React.createElement("div",null,
            React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:10}},"Get personalized style advice based on your entire wardrobe and watch collection."),
            React.createElement("button",{className:"btn btn-gold",onClick:async function(){
              setAiCoachLoading(true);
              var result=await aiStyleCoach(wd,actW,ctx,apiKeyRef.current);
              setAiCoach(result||{summary:"AI unavailable. Check your API key in settings.",strengths:[],gaps:[],next_buys:[],style_tip:"",versatility:0});
              setAiCoachLoading(false);
            }},"🎓 Get Style Advice")),
          aiCoachLoading&&React.createElement("div",{style:{textAlign:"center",padding:20}},React.createElement("div",{className:"sp",style:{width:20,height:20,border:"2px solid var(--gold)",borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 8px"}}),React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)"}},"Analyzing your wardrobe...")),
          aiCoach&&React.createElement("div",{className:"fu"},
            aiCoach.versatility>0&&React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:12}},
              React.createElement("div",{style:{width:48,height:48,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:aiCoach.versatility>=7?"rgba(122,184,122,0.15)":aiCoach.versatility>=4?"rgba(201,168,76,0.15)":"rgba(200,90,58,0.15)",border:"2px solid "+(aiCoach.versatility>=7?"var(--good)":aiCoach.versatility>=4?"var(--gold)":"var(--warn)"),fontSize:18,fontFamily:"var(--f)",fontWeight:700,color:aiCoach.versatility>=7?"var(--good)":aiCoach.versatility>=4?"var(--gold)":"var(--warn)"}},aiCoach.versatility+"/10"),
              React.createElement("div",{style:{flex:1}},
                React.createElement("div",{style:{fontSize:12,fontFamily:"var(--f)",fontWeight:600,color:"var(--gold)"}},"Versatility Score"),
                React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)"}},aiCoach.versatility>=8?"Exceptional range":"Room to grow"))),
            aiCoach.summary&&React.createElement("div",{style:{background:"var(--bg)",borderRadius:10,padding:"12px",marginBottom:12,borderLeft:"3px solid var(--gold)"}},
              React.createElement("p",{style:{fontSize:12,fontFamily:"var(--sf)",fontStyle:"italic",lineHeight:1.6,color:"var(--text)"}},aiCoach.summary)),
            aiCoach.strengths&&aiCoach.strengths.length>0&&React.createElement("div",{style:{marginBottom:10}},
              React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--good)",fontWeight:600,marginBottom:6}},"✓ STRENGTHS"),
              aiCoach.strengths.map(function(s,i){return React.createElement("div",{key:i,style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)",padding:"4px 0",borderBottom:"1px solid var(--border)"}},"• "+s)})),
            aiCoach.gaps&&aiCoach.gaps.length>0&&React.createElement("div",{style:{marginBottom:10}},
              React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600,marginBottom:6}},"⚠ GAPS"),
              aiCoach.gaps.map(function(g,i){return React.createElement("div",{key:i,style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)",padding:"4px 0",borderBottom:"1px solid var(--border)"}},"• "+g)})),
            aiCoach.next_buys&&aiCoach.next_buys.length>0&&React.createElement("div",{style:{marginBottom:10}},
              React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,marginBottom:6}},"🛍️ NEXT BUYS"),
              aiCoach.next_buys.map(function(b,i){return React.createElement("div",{key:i,style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)",padding:"4px 0",borderBottom:"1px solid var(--border)"}},(i+1)+". "+b)})),
            aiCoach.signature_combos&&aiCoach.signature_combos.length>0&&React.createElement("div",{style:{marginBottom:10}},
              React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,marginBottom:6}},"🔥 SIGNATURE COMBINATIONS"),
              aiCoach.signature_combos.map(function(c,i){return React.createElement("div",{key:i,style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)",padding:"6px 8px",marginBottom:4,background:"rgba(201,168,76,0.04)",borderRadius:6,border:"1px solid rgba(201,168,76,0.1)",borderLeft:"3px solid var(--gold)"}},(i+1)+". "+c)})),
            aiCoach.seasonal_weak&&React.createElement("div",{style:{background:"rgba(200,90,58,0.06)",borderRadius:8,padding:"8px 12px",marginBottom:8,border:"1px solid rgba(200,90,58,0.15)"}},
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600}},"📅 Seasonal Gap: "),
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--text)"}},aiCoach.seasonal_weak)),
            aiCoach.style_tip&&React.createElement("div",{style:{background:"rgba(201,168,76,0.06)",borderRadius:8,padding:"10px 12px",marginTop:8,border:"1px solid rgba(201,168,76,0.2)"}},
              React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},"💡 Pro Tip: "),
              React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)"}},aiCoach.style_tip)),
            React.createElement("button",{className:"btn btn-ghost",style:{marginTop:10,fontSize:10},onClick:function(){setAiCoach(null)}},"↻ Re-analyze"))),

        /* ── AI OCCASION PLANNER ── */
        React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
            React.createElement("span",{style:{fontSize:20}},"🎯"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"AI Occasion Planner")),
          React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:10}},"Describe an event or occasion and get outfit recommendations from your wardrobe."),
          React.createElement("input",{className:"inp",value:aiOccasionInput,onChange:function(e){setAiOccasionInput(e.target.value)},placeholder:"e.g. Business dinner, Beach wedding, First date at rooftop bar...",style:{marginBottom:10,fontSize:12}}),
          React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}},
            ["Business Dinner","Date Night","Wedding Guest","Casual Friday","Cocktail Party","Weekend Brunch"].map(function(sug){
              return React.createElement("span",{key:sug,className:"chip",onClick:function(){setAiOccasionInput(sug)},style:{fontSize:9}},sug)})),
          !aiOccasion&&!aiOccasionLoading&&React.createElement("button",{className:"btn btn-gold",onClick:async function(){
            if(!aiOccasionInput.trim()){showToast("Describe an occasion first","var(--warn)");return}
            setAiOccasionLoading(true);
            var result=await aiOccasionPlan(aiOccasionInput.trim(),wd,actW,apiKeyRef.current);
            setAiOccasion(result||{occasion_tips:"AI unavailable. Check your API key in settings.",outfits:[],avoid:""});
            setAiOccasionLoading(false);
          }},"🎯 Plan My Outfit"),
          aiOccasionLoading&&React.createElement("div",{style:{textAlign:"center",padding:20}},React.createElement("div",{className:"sp",style:{width:20,height:20,border:"2px solid var(--gold)",borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 8px"}}),React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)"}},"Planning outfit...")),
          aiOccasion&&React.createElement("div",{className:"fu"},
            aiOccasion.occasion_tips&&React.createElement("div",{style:{background:"var(--bg)",borderRadius:10,padding:"12px",marginBottom:12,borderLeft:"3px solid var(--gold)"}},
              React.createElement("p",{style:{fontSize:12,fontFamily:"var(--sf)",fontStyle:"italic",lineHeight:1.6,color:"var(--text)"}},aiOccasion.occasion_tips)),
            aiOccasion.outfits&&aiOccasion.outfits.map(function(outfit,oi){
              return React.createElement("div",{key:oi,style:{background:"var(--bg)",borderRadius:10,padding:"12px",marginBottom:10,border:"1px solid "+(oi===0?"rgba(201,168,76,0.3)":"var(--border)")}},
                React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}},
                  React.createElement("span",{style:{fontSize:13,fontFamily:"var(--f)",fontWeight:600,color:oi===0?"var(--gold)":"var(--text)"}},outfit.name),
                  outfit.confidence&&React.createElement("div",{style:{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid "+(outfit.confidence>=7?"var(--good)":"var(--gold)"),fontSize:11,fontFamily:"var(--f)",fontWeight:700,color:outfit.confidence>=7?"var(--good)":"var(--gold)"}},outfit.confidence)),
                React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:4,marginBottom:6}},
                  [{l:"👕 Top",v:outfit.top},{l:"👖 Bottom",v:outfit.bottom},{l:"👞 Shoes",v:outfit.shoes},{l:"⌚ Watch",v:outfit.watch},outfit.layers&&{l:"🧥 Layers",v:outfit.layers}].filter(Boolean).map(function(p,pi){
                    return React.createElement("div",{key:pi,style:{display:"flex",gap:8,fontSize:10,fontFamily:"var(--f)"}},
                      React.createElement("span",{style:{color:"var(--dim)",minWidth:55}},p.l),
                      React.createElement("span",{style:{color:"var(--text)",fontWeight:500}},p.v))})),
                outfit.why&&React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",fontStyle:"italic",marginTop:4}},outfit.why))}),
            aiOccasion.avoid&&React.createElement("div",{style:{background:"rgba(200,90,58,0.06)",borderRadius:8,padding:"8px 12px",border:"1px solid rgba(200,90,58,0.15)",marginBottom:8}},
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600}},"❌ Avoid: "),
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--text)"}},aiOccasion.avoid)),
            aiOccasion.power_move&&React.createElement("div",{style:{background:"rgba(201,168,76,0.06)",borderRadius:8,padding:"8px 12px",border:"1px solid rgba(201,168,76,0.2)",marginBottom:8}},
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},"⚡ Power Move: "),
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--text)"}},aiOccasion.power_move)),
            React.createElement("button",{className:"btn btn-ghost",style:{fontSize:10},onClick:function(){setAiOccasion(null)}},"↻ Try Again"))),

        /* ── AI WARDROBE AUDIT ── */
        React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:10}},
            React.createElement("span",{style:{fontSize:20}},"📋"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"AI Wardrobe Audit")),
          !aiAudit&&!aiAuditLoading&&React.createElement("div",null,
            React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:10}},"Comprehensive AI analysis of your entire wardrobe — grading, seasonal readiness, and investment recommendations."),
            React.createElement("button",{className:"btn btn-gold",onClick:async function(){
              setAiAuditLoading(true);
              var result=await aiWardrobeAudit(wd,actW,saved,wearLog,apiKeyRef.current);
              setAiAudit(result||{grade:"?",grade_why:"AI unavailable. Check your API key in settings."});
              setAiAuditLoading(false);
            }},"📋 Run Full Audit")),
          aiAuditLoading&&React.createElement("div",{style:{textAlign:"center",padding:20}},React.createElement("div",{className:"sp",style:{width:20,height:20,border:"2px solid var(--gold)",borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 8px"}}),React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--gold)"}},"Auditing wardrobe...")),
          aiAudit&&React.createElement("div",{className:"fu"},
            /* Grade */
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:14,marginBottom:14}},
              React.createElement("div",{style:{width:56,height:56,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:aiAudit.grade==="A"||aiAudit.grade==="A+"?"rgba(122,184,122,0.15)":aiAudit.grade==="B"?"rgba(201,168,76,0.15)":"rgba(200,90,58,0.15)",border:"3px solid "+(aiAudit.grade==="A"||aiAudit.grade==="A+"?"var(--good)":aiAudit.grade==="B"?"var(--gold)":"var(--warn)"),fontSize:22,fontFamily:"var(--f)",fontWeight:700,color:aiAudit.grade==="A"||aiAudit.grade==="A+"?"var(--good)":aiAudit.grade==="B"?"var(--gold)":"var(--warn)"}},aiAudit.grade),
              React.createElement("div",{style:{flex:1}},
                React.createElement("div",{style:{fontSize:14,fontFamily:"var(--f)",fontWeight:600,color:"var(--text)"}},"Wardrobe Grade"),
                aiAudit.grade_why&&React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginTop:2}},aiAudit.grade_why))),
            /* Details */
            [aiAudit.color_harmony&&{l:"🎨 Color Harmony",t:aiAudit.color_harmony},aiAudit.versatility&&{l:"🔄 Versatility",t:aiAudit.versatility},aiAudit.cost_efficiency&&{l:"💰 Efficiency",t:aiAudit.cost_efficiency},aiAudit.watch_wardrobe_synergy&&{l:"⌚ Watch Synergy",t:aiAudit.watch_wardrobe_synergy}].filter(Boolean).map(function(d,i){
              return React.createElement("div",{key:i,style:{background:"var(--bg)",borderRadius:8,padding:"10px 12px",marginBottom:6,border:"1px solid var(--border)"}},
                React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,marginBottom:3}},d.l),
                React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)"}},d.t))}),
            /* Seasonal scores */
            aiAudit.seasonal_score&&React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:10,marginTop:8}},
              [{s:"spring",i:"🌸"},{s:"summer",i:"☀️"},{s:"fall",i:"🍂"},{s:"winter",i:"❄️"}].map(function(sn){
                var sc=aiAudit.seasonal_score[sn.s]||0;
                return React.createElement("div",{key:sn.s,style:{textAlign:"center",background:"var(--bg)",borderRadius:8,padding:"8px 4px",border:"1px solid var(--border)"}},
                  React.createElement("div",{style:{fontSize:16}},sn.i),
                  React.createElement("div",{style:{fontSize:16,fontFamily:"var(--f)",fontWeight:700,color:sc>=7?"var(--good)":sc>=4?"var(--gold)":"var(--warn)"}},sc+"/10"),
                  React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",textTransform:"capitalize"}},sn.s))})),
            /* Declutter + Invest */
            aiAudit.declutter&&aiAudit.declutter.length>0&&React.createElement("div",{style:{marginBottom:8}},
              React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600,marginBottom:4}},"🧹 Consider Decluttering"),
              aiAudit.declutter.map(function(d,i){return React.createElement("div",{key:i,style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)",padding:"3px 0"}},"• "+d)})),
            aiAudit.invest&&aiAudit.invest.length>0&&React.createElement("div",{style:{marginBottom:8}},
              React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--good)",fontWeight:600,marginBottom:4}},"💎 Worth Investing In"),
              aiAudit.invest.map(function(d,i){return React.createElement("div",{key:i,style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)",padding:"3px 0"}},"• "+d)})),
            aiAudit.style_identity&&React.createElement("div",{style:{background:"var(--bg)",borderRadius:8,padding:"10px 12px",marginBottom:8,border:"1px solid var(--border)"}},
              React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,marginBottom:3}},"🎭 Style Identity"),
              React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)"}},aiAudit.style_identity)),
            aiAudit.pro_tip&&React.createElement("div",{style:{background:"rgba(201,168,76,0.06)",borderRadius:8,padding:"10px 12px",marginTop:8,border:"1px solid rgba(201,168,76,0.2)"}},
              React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},"💡 "),
              React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--text)"}},aiAudit.pro_tip)),
            React.createElement("button",{className:"btn btn-ghost",style:{marginTop:10,fontSize:10},onClick:function(){setAiAudit(null)}},"↻ Re-audit"))),

        /* ── COLLECTION HEATMAP ── */
        React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
            React.createElement("span",{style:{fontSize:20}},"🗺️"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Context Coverage")),
          React.createElement("div",{style:{overflowX:"auto"},className:"hscroll"},
            React.createElement("div",{style:{minWidth:Math.max(500,activeCxIds.slice(0,8).length*60+120)}},
              /* Header row */
              React.createElement("div",{style:{display:"flex",gap:2,marginBottom:4,paddingLeft:110}},
                activeCxIds.slice(0,8).map(function(cx){return React.createElement("div",{key:cx,style:{flex:"0 0 52px",textAlign:"center",fontSize:7,fontFamily:"var(--f)",color:"var(--dim)",letterSpacing:"0.05em"}},(activeCxIcons[cx]||CXI[cx]||"")+"\n"+cx)})),
              /* Watch rows */
              actW.slice(0,20).map(function(w){
                return React.createElement("div",{key:w.id,style:{display:"flex",gap:2,marginBottom:2,alignItems:"center"}},
                  React.createElement("div",{style:{flex:"0 0 108px",display:"flex",alignItems:"center",gap:4,overflow:"hidden"}},
                    React.createElement("span",{style:{fontSize:12}},w.i),
                    React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--sub)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},w.n)),
                  activeCxIds.slice(0,8).map(function(cx){
                    var inCtx=(w.cx||[]).includes(cx);
                    var colorScore=0;
                    (w.mc||[]).forEach(function(mc){if(["navy","charcoal","white","cream","black","grey"].includes(mc))colorScore++});
                    var heat=inCtx?(colorScore>4?3:colorScore>2?2:1):0;
                    var bg=heat===3?"rgba(122,184,122,0.4)":heat===2?"rgba(122,184,122,0.2)":heat===1?"rgba(201,168,76,0.15)":"var(--card)";
                    return React.createElement("div",{key:cx,style:{flex:"0 0 52px",height:20,borderRadius:3,background:bg,border:"1px solid "+(inCtx?"rgba(122,184,122,0.15)":"var(--border)")}})}))}),
              /* Coverage summary */
              React.createElement("div",{style:{display:"flex",gap:2,marginTop:8,paddingLeft:110}},
                activeCxIds.slice(0,8).map(function(cx){
                  var count=actW.filter(function(w){return(w.cx||[]).includes(cx)}).length;
                  var pct=actW.length?Math.round(count/actW.length*100):0;
                  return React.createElement("div",{key:cx,style:{flex:"0 0 52px",textAlign:"center"}},
                    React.createElement("div",{style:{fontSize:12,fontFamily:"var(--f)",fontWeight:700,color:count>=5?"var(--good)":count>=3?"var(--gold)":"var(--warn)"}},count),
                    React.createElement("div",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)"}},pct+"%"))})),
              /* Legend */
              React.createElement("div",{style:{display:"flex",gap:12,marginTop:10,paddingLeft:110}},
                [{c:"rgba(122,184,122,0.4)",l:"Strong"},{c:"rgba(122,184,122,0.2)",l:"Good"},{c:"rgba(201,168,76,0.15)",l:"Basic"},{c:"var(--card)",l:"None"}].map(function(lg){
                  return React.createElement("div",{key:lg.l,style:{display:"flex",alignItems:"center",gap:4}},
                    React.createElement("div",{style:{width:12,height:12,borderRadius:2,background:lg.c,border:"1px solid var(--border)"}}),
                    React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--dim)"}},lg.l))})))),

        /* ── WARDROBE COLOR WHEEL ── */
        React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
            React.createElement("span",{style:{fontSize:20}},"🎨"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Color Distribution")),
          (function(){
            /* Count colors across wardrobe */
            var colorCounts={};
            wd.filter(function(i){return i.color}).forEach(function(i){var c=i.color.toLowerCase();colorCounts[c]=(colorCounts[c]||0)+1});
            var sorted=Object.entries(colorCounts).sort(function(a,b){return b[1]-a[1]});
            var total=wd.filter(function(i){return i.color}).length||1;
            /* Watch dial colors */
            var watchColors={};
            actW.forEach(function(w){var d=(w.d||"").toLowerCase();watchColors[d]=(watchColors[d]||0)+1});
            var wSorted=Object.entries(watchColors).sort(function(a,b){return b[1]-a[1]});
            /* Temperature balance */
            var warm=0,cool=0,neutral=0;
            sorted.forEach(function(e){var t=(CM[e[0]]||{}).t;if(t==="warm")warm+=e[1];else if(t==="cool")cool+=e[1];else neutral+=e[1]});
            return React.createElement("div",null,
              /* Color bars */
              React.createElement("div",{style:{marginBottom:14}},
                sorted.slice(0,12).map(function(e){
                  var pct=Math.round(e[1]/total*100);
                  return React.createElement("div",{key:e[0],style:{display:"flex",alignItems:"center",gap:8,marginBottom:4}},
                    React.createElement(Dot,{color:e[0],size:12}),
                    React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",minWidth:70}},e[0]),
                    React.createElement("div",{style:{flex:1,height:14,background:"var(--card)",borderRadius:4,overflow:"hidden"}},
                      React.createElement("div",{style:{height:"100%",width:pct+"%",background:(CM[e[0]]||{}).h||"#5a5a5a",borderRadius:4,minWidth:2}})),
                    React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",minWidth:24,textAlign:"right"}},e[1]))})),
              /* Temp balance */
              React.createElement("div",{style:{display:"flex",gap:4,marginBottom:14}},
                [{l:"Warm",v:warm,c:"#d87a2a"},{l:"Cool",v:cool,c:"#2a5a9a"},{l:"Neutral",v:neutral,c:"#8a8a8a"}].map(function(t){
                  var pct=Math.round(t.v/total*100);
                  return React.createElement("div",{key:t.l,style:{flex:t.v||1,background:t.c+"30",borderRadius:8,padding:"8px 10px",textAlign:"center",border:"1px solid "+t.c+"20"}},
                    React.createElement("div",{style:{fontSize:14,fontFamily:"var(--f)",fontWeight:700,color:t.c}},pct+"%"),
                    React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},t.l))})),
              /* Watch dials */
              wSorted.length>0&&React.createElement("div",null,
                React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,marginBottom:6,letterSpacing:"0.08em"}},"WATCH DIAL COLORS"),
                React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},
                  wSorted.map(function(e){return React.createElement("div",{key:e[0],style:{display:"flex",alignItems:"center",gap:4,background:"var(--bg)",borderRadius:6,padding:"4px 8px",border:"1px solid var(--border)"}},
                    React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)"}},e[0]),
                    React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600}},"×"+e[1]))}))));
          })())),

        /* ── SEASONAL CLOSET GAPS ── */
        React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
            React.createElement("span",{style:{fontSize:20}},"📅"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Seasonal Readiness")),
          (function(){
            var seasons=["spring","summer","fall","winter"];var icons={spring:"🌸",summer:"☀️",fall:"🍂",winter:"❄️"};
            var cats=["tops","bottoms","shoes"];
            var data=seasons.map(function(s){
              var counts={};cats.forEach(function(cat){
                counts[cat]=wd.filter(function(i){return catOf(i.garmentType)===cat&&i.color&&(!i.seasons||!i.seasons.length||i.seasons.length>=4||i.seasons.includes(s))}).length;
              });
              var total=counts.tops+counts.bottoms+counts.shoes;
              var ready=counts.tops>=2&&counts.bottoms>=2&&counts.shoes>=1;
              return{s:s,icon:icons[s],counts:counts,total:total,ready:ready};
            });
            var curSn=getSeason(weather?weather.temp:undefined,loc?loc.lat:undefined);
            return React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}},
              data.map(function(d){
                return React.createElement("div",{key:d.s,style:{background:d.s===curSn?"rgba(201,168,76,0.06)":"var(--bg)",border:"1px solid "+(d.s===curSn?"rgba(201,168,76,0.3)":"var(--border)"),borderRadius:10,padding:"10px 12px"}},
                  React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,marginBottom:6}},
                    React.createElement("span",{style:{fontSize:16}},d.icon),
                    React.createElement("span",{style:{fontSize:12,fontFamily:"var(--f)",fontWeight:600,color:d.s===curSn?"var(--gold)":"var(--text)",textTransform:"capitalize"}},d.s),
                    d.s===curSn&&React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"var(--gold)",background:"rgba(201,168,76,0.15)",borderRadius:3,padding:"1px 5px"}},"NOW"),
                    React.createElement("span",{style:{marginLeft:"auto",fontSize:10,color:d.ready?"var(--good)":"var(--warn)"}},d.ready?"✓":"⚠")),
                  React.createElement("div",{style:{display:"flex",gap:4}},
                    [{l:"👕",v:d.counts.tops,min:2},{l:"👖",v:d.counts.bottoms,min:2},{l:"👞",v:d.counts.shoes,min:1}].map(function(c,ci){
                      return React.createElement("div",{key:ci,style:{flex:1,textAlign:"center",borderRadius:6,padding:"4px 2px",background:c.v>=c.min?"rgba(122,184,122,0.1)":"rgba(200,90,58,0.08)",border:"1px solid "+(c.v>=c.min?"rgba(122,184,122,0.15)":"rgba(200,90,58,0.15)")}},
                        React.createElement("div",{style:{fontSize:10}},c.l),
                        React.createElement("div",{style:{fontSize:11,fontFamily:"var(--f)",fontWeight:700,color:c.v>=c.min?"var(--good)":"var(--warn)"}},c.v))})));
              }));
          })()),

        /* ── COLOR GAP ANALYSIS ── */
        React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
            React.createElement("span",{style:{fontSize:20}},"🔍"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Color Gap Analysis")),
          (function(){
            /* Find colors needed by watches but missing from wardrobe */
            var wdColors={};wd.filter(function(i){return i.color}).forEach(function(i){wdColors[i.color.toLowerCase()]=true});
            var needed={};actW.forEach(function(w){(w.mc||[]).forEach(function(c){if(c!=="anything"&&!wdColors[c])needed[c]=(needed[c]||0)+1})});
            var gaps=Object.entries(needed).sort(function(a,b){return b[1]-a[1]}).slice(0,8);
            if(!gaps.length)return React.createElement("div",{style:{textAlign:"center",padding:10}},
              React.createElement("span",{style:{fontSize:12}},"✓"),
              React.createElement("p",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--good)",margin:"4px 0 0"}},"Great coverage! Your wardrobe has colors for all your watches."));
            return React.createElement("div",null,
              React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:10}},"Colors your watches want but your wardrobe doesn't have:"),
              React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:6}},
                gaps.map(function(g){
                  var matchingWatches=actW.filter(function(w){return(w.mc||[]).includes(g[0])}).slice(0,3);
                  return React.createElement("div",{key:g[0],style:{display:"flex",alignItems:"center",gap:8,background:"var(--bg)",borderRadius:8,padding:"8px 10px",border:"1px solid rgba(200,90,58,0.15)"}},
                    React.createElement(Dot,{color:g[0],size:14}),
                    React.createElement("div",{style:{flex:1,minWidth:0}},
                      React.createElement("div",{style:{fontSize:11,fontFamily:"var(--f)",fontWeight:600,color:"var(--text)",textTransform:"capitalize"}},g[0]),
                      React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},"Needed by "+matchingWatches.map(function(w){return w.i+" "+w.n}).join(", "))),
                    React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600,flexShrink:0}},g[1]+" watch"+(g[1]>1?"es":"")))})));
          })()),

        /* ── WATCH PAIRING SUGGESTIONS ── */
        actW.length>0&&React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
            React.createElement("span",{style:{fontSize:20}},"⌚"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Watch Pairing Guide")),
          React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:10}},"Best garment colors for each watch, based on your wardrobe:"),
          actW.slice(0,8).map(function(w){
            /* Find best matching garments from wardrobe */
            var scored=wd.filter(function(i){return i.color&&!i.needsEdit}).map(function(i){
              var ic=i.color.toLowerCase().trim();var s=0;
              for(var m of(w.mc||[])){if(m==="anything"||ic.includes(m)||m.includes(ic)){s+=3;break}}
              for(var a of(w.ac||[])){if(ic.includes(a)||a.includes(ic)){s-=3;break}}
              var wt=(CM[ic]||{}).t||"neutral";if(w.mt===wt)s+=1;
              return{g:i,s:s};
            }).filter(function(x){return x.s>0}).sort(function(a,b){return b.s-a.s}).slice(0,4);
            var missingColors=(w.mc||[]).filter(function(mc){return mc!=="anything"&&!wd.some(function(i){return i.color&&i.color.toLowerCase()===mc})}).slice(0,3);
            return React.createElement("div",{key:w.id,style:{background:"var(--bg)",borderRadius:10,padding:"10px 12px",marginBottom:6,border:"1px solid var(--border)"}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:6}},
                React.createElement("div",{style:{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:w.c+"18",fontSize:16,flexShrink:0}},w.i),
                React.createElement("div",{style:{flex:1,minWidth:0}},
                  React.createElement("span",{style:{fontSize:12,fontWeight:600}},w.n),
                  React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",marginLeft:6}},w.d+" · "+(w.straps&&w.straps.length?w.straps.length+" strap"+(w.straps.length>1?"s":""):w.br?"Bracelet":"Strap")))),
              scored.length>0&&React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginBottom:missingColors.length?6:0}},
                React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--good)",alignSelf:"center"}},"✓ Best:"),
                scored.map(function(x){return React.createElement("div",{key:x.g.id,style:{display:"flex",alignItems:"center",gap:3,background:"rgba(122,184,122,0.06)",borderRadius:6,padding:"3px 8px",border:"1px solid rgba(122,184,122,0.15)"}},
                  React.createElement(Dot,{color:x.g.color,size:5}),
                  React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--text)"}},x.g.name||x.g.color))})),
              missingColors.length>0&&React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap"}},
                React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--warn)",alignSelf:"center"}},"+ Need:"),
                missingColors.map(function(mc){return React.createElement("div",{key:mc,style:{display:"flex",alignItems:"center",gap:3,background:"rgba(200,90,58,0.06)",borderRadius:6,padding:"3px 8px",border:"1px solid rgba(200,90,58,0.15)"}},
                  React.createElement(Dot,{color:mc,size:5}),
                  React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--sub)"}},mc))})));
          })),

        /* ── GARMENT ROTATION STATS ── */
        wd.some(function(i){return i.lastWorn})&&React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
            React.createElement("span",{style:{fontSize:20}},"👔"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Garment Rotation")),
          (function(){
            var now=Date.now();var tracked=wd.filter(function(i){return i.lastWorn&&i.color});
            if(!tracked.length)return null;
            /* Sort by stalest first */
            var sorted=tracked.map(function(i){return{g:i,d:Math.floor((now-new Date(i.lastWorn).getTime())/864e5)}}).sort(function(a,b){return b.d-a.d});
            var maxD=sorted[0].d||1;
            return React.createElement("div",null,
              React.createElement("div",{style:{display:"flex",gap:8,fontSize:9,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:8}},
                React.createElement("span",null,"📏 "+tracked.length+" garments tracked"),
                React.createElement("span",null,"Avg "+Math.round(sorted.reduce(function(a,b){return a+b.d},0)/sorted.length)+"d between wears")),
              sorted.slice(0,8).map(function(e){
                var pct=Math.round(e.d/maxD*100);
                var col=e.d<=2?"var(--warn)":e.d<=7?"var(--gold)":e.d<=14?"var(--sub)":"var(--good)";
                return React.createElement("div",{key:e.g.id,style:{display:"flex",alignItems:"center",gap:6,marginBottom:4}},
                  ph(e.g.photoUrl)?React.createElement("img",{src:ph(e.g.photoUrl),alt:"",style:{width:18,height:18,objectFit:"cover",borderRadius:3,flexShrink:0}}):React.createElement(Dot,{color:e.g.color,size:8}),
                  React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)",minWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},e.g.name||e.g.color),
                  React.createElement("div",{style:{flex:1,height:8,background:"var(--card)",borderRadius:4,overflow:"hidden"}},
                    React.createElement("div",{style:{height:"100%",width:pct+"%",background:col,borderRadius:4,minWidth:2}})),
                  React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:col,minWidth:32,textAlign:"right"}},e.d===0?"today":e.d+"d"))}),
              sorted.length>8&&React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",textAlign:"center",marginTop:4}},"+"+(sorted.length-8)+" more garments tracked"));
          })()),

        /* ── WEAR STATS DASHBOARD ── */
        React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"16px",marginBottom:16}},
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:12}},
            React.createElement("span",{style:{fontSize:20}},"📊"),
            React.createElement("span",{style:{fontSize:16,fontFamily:"var(--sf)",fontWeight:600}},"Wear Stats")),
          (function(){
            if(!wearLog.length)return React.createElement("p",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--dim)",textAlign:"center",padding:10}},"Start logging wear in the rotation tab to build stats.");
            /* Count wears per watch */
            var wearCounts={};var genWears=0;var repWears=0;
            wearLog.forEach(function(e){wearCounts[e.watchId]=(wearCounts[e.watchId]||0)+1;var wObj=W.find(function(w){return w.id===e.watchId});if(wObj){if(wObj.t==="genuine")genWears++;else repWears++}});
            var sorted=Object.entries(wearCounts).sort(function(a,b){return b[1]-a[1]});
            var maxWears=sorted.length?sorted[0][1]:1;
            /* Never-worn active watches */
            var neverWorn=actW.filter(function(w){return !wearCounts[w.id]&&w.status==="active"});
            /* Streak — consecutive days logged */
            var dates=wearLog.map(function(e){return e.date}).sort().reverse();
            var uniqueDates=[...new Set(dates)];
            var streak=0;var checkDate=new Date();
            for(var si=0;si<90;si++){var ds=checkDate.toISOString().slice(0,10);if(uniqueDates.includes(ds)){streak++;checkDate.setDate(checkDate.getDate()-1)}else if(si===0){checkDate.setDate(checkDate.getDate()-1);continue}else break}
            return React.createElement("div",null,
              /* Summary row */
              React.createElement("div",{style:{display:"flex",gap:8,marginBottom:14}},
                React.createElement("div",{style:{flex:1,background:"var(--bg)",borderRadius:10,padding:"10px",textAlign:"center",border:"1px solid var(--border)"}},
                  React.createElement("div",{style:{fontSize:20,fontFamily:"var(--f)",fontWeight:700,color:"var(--gold)"}},wearLog.length),
                  React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},"Total wears")),
                React.createElement("div",{style:{flex:1,background:"var(--bg)",borderRadius:10,padding:"10px",textAlign:"center",border:"1px solid var(--border)"}},
                  React.createElement("div",{style:{fontSize:20,fontFamily:"var(--f)",fontWeight:700,color:"var(--good)"}},streak),
                  React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},"Day streak")),
                !IS_SHARED&&React.createElement("div",{style:{flex:1,background:"var(--bg)",borderRadius:10,padding:"10px",textAlign:"center",border:"1px solid "+(genWears>=repWears?"rgba(122,184,122,0.3)":"rgba(200,90,58,0.3)")}},
                  React.createElement("div",{style:{fontSize:14,fontFamily:"var(--f)",fontWeight:700,color:genWears>=repWears?"var(--good)":"var(--warn)"}},genWears+"/"+repWears),
                  React.createElement("div",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)"}},"Gen / Rep"))),
              /* Frequency bars */
              React.createElement("div",{style:{marginBottom:14}},
                sorted.slice(0,12).map(function(e){
                  var wObj=W.find(function(w){return w.id===e[0]});if(!wObj)return null;
                  var pct=Math.round(e[1]/maxWears*100);
                  var barC=IS_SHARED?"var(--gold)":(wObj.t==="genuine"?"var(--good)":"#7ab8d8");
                  return React.createElement("div",{key:e[0],style:{display:"flex",alignItems:"center",gap:6,marginBottom:4}},
                    React.createElement("span",{style:{fontSize:12,flexShrink:0,width:18,textAlign:"center"}},wObj.i),
                    React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)",minWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},wObj.n),
                    React.createElement("div",{style:{flex:1,height:12,background:"var(--card)",borderRadius:4,overflow:"hidden"}},
                      React.createElement("div",{style:{height:"100%",width:pct+"%",background:barC,borderRadius:4,minWidth:2}})),
                    React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",minWidth:18,textAlign:"right"}},e[1]))})),
              /* 4-week wear calendar */
              React.createElement("div",{style:{marginTop:10,paddingTop:10,borderTop:"1px solid var(--border)"}},
                React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--gold)",fontWeight:600,marginBottom:6,letterSpacing:"0.08em"}},"WEAR CALENDAR"),
                React.createElement("div",{style:{display:"flex",gap:3,marginBottom:4}},["S","M","T","W","T","F","S"].map(function(d,i){return React.createElement("div",{key:i,style:{flex:1,textAlign:"center",fontSize:7,fontFamily:"var(--f)",color:"var(--dim)"}},d)})),
                (function(){
                  var cells=[];var today=new Date();
                  for(var ci=27;ci>=0;ci--){var cd=new Date(today);cd.setDate(cd.getDate()-ci);cells.push({date:cd.toISOString().slice(0,10),dow:cd.getDay()})}
                  /* Pad start to align with day-of-week */
                  var padStart=cells[0]?cells[0].dow:0;var padded=[];for(var pi=0;pi<padStart;pi++)padded.push(null);padded=padded.concat(cells);
                  var rows=[];for(var ri=0;ri<padded.length;ri+=7)rows.push(padded.slice(ri,ri+7));
                  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:2}},
                    rows.map(function(row,ri2){return React.createElement("div",{key:ri2,style:{display:"flex",gap:3}},
                      row.concat(Array(7-row.length).fill(null)).slice(0,7).map(function(cell,ci2){
                        if(!cell)return React.createElement("div",{key:ci2,style:{flex:1,height:18,borderRadius:3}});
                        var entry=wearLog.find(function(e){return e.date===cell.date});var wObj=entry?W.find(function(w){return w.id===entry.watchId}):null;
                        var bg=wObj?wObj.c:"var(--card2)";
                        return React.createElement("div",{key:ci2,title:cell.date+(wObj?" — "+wObj.n:""),style:{flex:1,height:18,borderRadius:3,background:bg,border:"1px solid "+(wObj?bg+"60":"var(--border)"),opacity:wObj?1:0.4}})}))}));
                })()),

              /* Never worn section */
              neverWorn.length>0&&React.createElement("div",{style:{marginTop:8,paddingTop:8,borderTop:"1px solid var(--border)"}},
                React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600,marginBottom:6}},"💤 NEVER LOGGED ("+neverWorn.length+")"),
                React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap"}},
                  neverWorn.map(function(w){return React.createElement("div",{key:w.id,style:{display:"flex",alignItems:"center",gap:3,background:"rgba(200,90,58,0.06)",border:"1px solid rgba(200,90,58,0.15)",borderRadius:6,padding:"3px 8px"}},
                    React.createElement("span",{style:{fontSize:10}},w.i),
                    React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"var(--warn)"}},w.n))}))));
          })())),

      /* ═══ WATCHES ═══ */
      view==="watches"&&React.createElement("div",{key:"tab-watches",className:"tab-content",style:{paddingTop:16,paddingBottom:40}},
        /* Collection Stats */
        (function(){
          var gen=W.filter(function(w){return w.t==="genuine"&&w.active}).length;
          var rep=W.filter(function(w){return w.t==="replica"&&w.active}).length;
          var brC=W.filter(function(w){return w.br&&w.active}).length;
          var stC=W.filter(function(w){return!w.br&&w.active}).length;
          var incC=W.filter(function(w){return w.status==="incoming"}).length;
          var pendC=W.filter(function(w){return w.status==="pending-trade"}).length;
          var cats={};W.filter(function(w){return w.active}).forEach(function(w){(w.cx||[]).forEach(function(c){cats[c]=(cats[c]||0)+1})});
          var topCx=Object.entries(cats).sort(function(a,b){return b[1]-a[1]}).slice(0,3);
          return React.createElement("div",{style:{background:"linear-gradient(135deg,var(--card),var(--card2))",border:"1px solid var(--border)",borderRadius:12,padding:"12px 16px",marginBottom:12}},
            React.createElement("div",{style:{display:"flex",gap:16,flexWrap:"wrap",fontSize:10,fontFamily:"var(--f)"}},
              React.createElement("div",null,React.createElement("span",{style:{color:"var(--gold)",fontWeight:700,fontSize:18}},gen+rep),React.createElement("span",{style:{color:"var(--dim)",marginLeft:4}},"active")),
              !IS_SHARED&&React.createElement("div",null,React.createElement("span",{style:{color:"var(--good)"}},"✓ "+gen),React.createElement("span",{style:{color:"var(--dim)",marginLeft:4}},"genuine")),
              !IS_SHARED&&React.createElement("div",null,React.createElement("span",{style:{color:"#7ab8d8"}},"◇ "+rep),React.createElement("span",{style:{color:"var(--dim)",marginLeft:4}},"replica")),
              React.createElement("div",null,React.createElement("span",{style:{color:"var(--sub)"}},"⛓️"+brC+" 🔗"+stC)),
              incC>0&&React.createElement("div",null,React.createElement("span",{style:{color:"#d4b82a"}},"📦 "+incC),React.createElement("span",{style:{color:"var(--dim)",marginLeft:4}},"incoming")),
              pendC>0&&React.createElement("div",null,React.createElement("span",{style:{color:"var(--warn)"}},"🔄 "+pendC),React.createElement("span",{style:{color:"var(--dim)",marginLeft:4}},"pending"))),
            topCx.length>0&&React.createElement("div",{style:{display:"flex",gap:6,marginTop:6}},
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)"}},"Top contexts:"),
              topCx.map(function(e){return React.createElement("span",{key:e[0],style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},(CXI[e[0]]||"")+e[0]+" ×"+e[1])})));
        })(),
        React.createElement("div",{style:{display:"flex",gap:5,flexWrap:"wrap",marginBottom:12}},
          (IS_SHARED?[{id:"all",l:"All "+W.length},{id:"incoming",l:"Incoming"},{id:"pending-trade",l:"Pending"}]:[{id:"all",l:"All "+W.length},{id:"genuine",l:"Gen"},{id:"replica",l:"Rep"},{id:"incoming",l:"Incoming"},{id:"pending-trade",l:"Pending"}]).map(function(f){return React.createElement(Pill,{key:f.id,on:wTab===f.id,onClick:function(){setWTab(f.id)}},f.l)}),
          React.createElement("input",{className:"inp",value:wSearch,onChange:function(e){setWSearch(e.target.value)},placeholder:"Search watches...",style:{flex:1,minWidth:80,fontSize:11,padding:"8px 12px",borderRadius:20,background:"var(--bg)",border:"1px solid var(--border)",color:"var(--text)",fontFamily:"var(--f)"}}),
          wSearch&&React.createElement("button",{onClick:function(){setWSearch("")},style:{background:"none",border:"1px solid var(--border)",borderRadius:20,padding:"8px 10px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:10,minHeight:36}},"✕"),
          React.createElement("button",{onClick:function(){wCamRef.current&&wCamRef.current.click()},style:{marginLeft:wSearch?"0":"auto",background:"none",border:"1px solid rgba(201,168,76,0.4)",borderRadius:20,padding:"8px 14px",cursor:"pointer",color:"var(--gold)",fontFamily:"var(--f)",fontSize:11,fontWeight:600,minHeight:36}},"📸 Camera"),
          React.createElement("button",{onClick:function(){wPhotoRef.current&&wPhotoRef.current.click()},style:{background:"none",border:"1px solid rgba(201,168,76,0.4)",borderRadius:20,padding:"8px 14px",cursor:"pointer",color:"var(--gold)",fontFamily:"var(--f)",fontSize:11,fontWeight:600,minHeight:36}},"🖼️ Gallery"),
          React.createElement("button",{onClick:function(){var nw={id:"c-"+Date.now(),n:"New Watch",t:"genuine",d:"",c:"#5a5a5a",br:true,sc:[],straps:[{type:"bracelet",color:"silver",material:"steel"}],mt:"neutral",i:"⌚",mc:IS_SHARED?autoMatchColors(""):[],ac:[],cx:["casual"],wt:IS_SHARED?["light","mid","heavy"]:["mid"],sg:"",active:true,status:"active"};setW(function(p){var u=p.concat([nw]);ps("w_"+SK,u);return u});setEditW(nw)},style:{background:"linear-gradient(135deg,var(--gold),#a8882a)",border:"none",borderRadius:20,padding:"8px 16px",cursor:"pointer",color:"var(--bg)",fontFamily:"var(--f)",fontSize:11,fontWeight:600,minHeight:36}},"+ Add"),
          React.createElement("button",{onClick:function(){var d=findWatchDupes();setWDupeGroups(d);setShowWDupes(true)},style:{background:"none",border:"1px solid rgba(200,90,58,0.4)",borderRadius:20,padding:"8px 12px",cursor:"pointer",color:"var(--warn)",fontFamily:"var(--f)",fontSize:10,fontWeight:600,minHeight:36}},"🔍 Dupes")),
        /* Hidden file inputs for watch scan */
        React.createElement("input",{ref:wPhotoRef,type:"file",accept:"image/*",multiple:true,style:{display:"none"},onChange:function(e){if(e.target.files&&e.target.files.length){scanWatch(e.target.files);e.target.value=""}}}),
        React.createElement("input",{ref:wCamRef,type:"file",accept:"image/*",capture:"environment",style:{display:"none"},onChange:function(e){if(e.target.files&&e.target.files[0]){scanWatch(e.target.files[0]);e.target.value=""}}}),
        /* Watch scan loading */
        watchScanLoading&&React.createElement("div",{style:{background:"var(--card)",border:"1px solid rgba(201,168,76,0.3)",borderRadius:12,padding:"16px",marginBottom:12,textAlign:"center"}},
          React.createElement("div",{className:"sp",style:{width:24,height:24,border:"2px solid var(--gold)",borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto 8px"}}),
          React.createElement("span",{style:{fontSize:12,fontFamily:"var(--f)",color:"var(--gold)"}},scanProg?"Scanning "+scanProg.c+"/"+scanProg.t+"...":"Identifying watch..."),
          scanProg&&React.createElement("div",{style:{marginTop:8}},
            React.createElement("div",{style:{height:4,background:"var(--bg)",borderRadius:2,overflow:"hidden",marginBottom:8}},
              React.createElement("div",{style:{height:"100%",width:Math.round(scanProg.c/scanProg.t*100)+"%",background:"var(--gold)",borderRadius:2,transition:"width 0.3s"}})),
            React.createElement("button",{onClick:function(){scanCancelRef.current=true},className:"btn btn-ghost",style:{fontSize:9,padding:"4px 12px"}},"\u2715 Cancel"))),
        /* Watch scan result */
        watchScanResult&&!watchScanLoading&&React.createElement("div",{style:{background:"linear-gradient(135deg,var(--card),var(--card2))",border:"1px solid rgba(201,168,76,0.3)",borderRadius:14,padding:"16px",marginBottom:12}},
          watchScanResult.error?React.createElement("div",null,
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:8}},
              React.createElement("span",{style:{fontSize:18}},"⚠️"),
              React.createElement("span",{style:{fontSize:13,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600}},"Could Not Identify Watch")),
            React.createElement("p",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--dim)"}},watchScanResult.error),
            React.createElement("button",{onClick:function(){setWatchScanResult(null)},className:"btn btn-ghost",style:{marginTop:8,fontSize:10}},"Dismiss"))
          :React.createElement("div",null,
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:12}},
              React.createElement("div",{style:{width:48,height:48,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:(watchScanResult.ai.dial_hex||"#5a5a5a")+"20",fontSize:24,border:"2px solid "+(watchScanResult.ai.dial_hex||"#5a5a5a")+"50"}},watchScanResult.ai.emoji||"⌚"),
              React.createElement("div",{style:{flex:1}},
                React.createElement("div",{style:{fontSize:16,fontWeight:600,color:"var(--gold)"}},watchScanResult.ai.brand+" "+watchScanResult.ai.model),
                React.createElement("div",{style:{fontSize:10,fontFamily:"var(--f)",color:"var(--sub)"}},(watchScanResult.ai.dial_color||"")+" dial"+(watchScanResult.ai.case_size?" · "+watchScanResult.ai.case_size+"mm":"")+" · "+(watchScanResult.ai.case_material||"steel")+(watchScanResult.ai.reference?" · Ref "+watchScanResult.ai.reference:"")),
                React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",marginTop:2}},(watchScanResult.ai.complications||[]).join(", "))),
              watchScanResult.ai.confidence&&React.createElement("div",{style:{width:36,height:36,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid "+(watchScanResult.ai.confidence>=7?"var(--good)":watchScanResult.ai.confidence>=4?"var(--gold)":"var(--warn)"),fontSize:14,fontFamily:"var(--f)",fontWeight:700,color:watchScanResult.ai.confidence>=7?"var(--good)":watchScanResult.ai.confidence>=4?"var(--gold)":"var(--warn)"}},watchScanResult.ai.confidence)),
            watchScanResult.ai.notes&&React.createElement("p",{style:{fontSize:10,fontFamily:"var(--sf)",fontStyle:"italic",color:"var(--sub)",marginBottom:10,lineHeight:1.5}},watchScanResult.ai.notes),
            React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}},(watchScanResult.ai.suggested_contexts||[]).map(function(cx){return React.createElement("span",{key:cx,className:"chip",style:{fontSize:8,padding:"2px 8px"}},(CXI[cx]||"")+" "+cx)})),
            watchScanResult.watch&&watchScanResult.watch.photoUrl&&React.createElement("img",{src:ph(watchScanResult.watch.photoUrl),alt:"Scanned watch",style:{width:"100%",maxHeight:180,objectFit:"cover",borderRadius:10,marginBottom:10,border:"1px solid var(--border)"}}),
            React.createElement("div",{style:{display:"flex",gap:8}},
              React.createElement("button",{className:"btn btn-gold",style:{flex:1},onClick:function(){
                var nw=watchScanResult.watch;
                setW(function(p){var u=p.concat([nw]);ps("w_"+SK,u);return u});
                setEditW(nw);setWatchScanResult(null);
              }},"✓ Add to Collection"),
              React.createElement("button",{className:"btn btn-ghost",style:{flex:0,padding:"14px 16px"},onClick:function(){setWatchScanResult(null)}},"✕")))),
        watchScanResult&&!watchScanLoading&&watchScanResult.batch&&React.createElement("div",{style:{background:"linear-gradient(135deg,var(--card),var(--card2))",border:"1px solid "+(watchScanResult.error?"rgba(200,90,58,0.3)":"rgba(122,184,122,0.3)"),borderRadius:14,padding:"16px",marginBottom:12}},
          watchScanResult.error?React.createElement("div",null,
            React.createElement("span",{style:{fontSize:13,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600}},"⚠️ "+watchScanResult.error),
            watchScanResult.failed&&watchScanResult.failed.length>0&&React.createElement("div",{style:{marginTop:8}},watchScanResult.failed.map(function(e,i){return React.createElement("p",{key:i,style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",margin:"2px 0"}},"Image "+(e.fi+1)+": "+e.error)})),
            React.createElement("button",{onClick:function(){setWatchScanResult(null)},className:"btn btn-ghost",style:{marginTop:8,fontSize:10}},"Dismiss"))
          :React.createElement("div",null,
            React.createElement("div",{style:{fontSize:14,fontWeight:600,color:"var(--good)",marginBottom:6}},"✅ Added "+watchScanResult.count+" watch"+(watchScanResult.count>1?"es":"")+" to collection"),
            watchScanResult.watches&&watchScanResult.watches.map(function(s,i){return React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:i?"1px solid var(--border)":"none"}},
              React.createElement("span",{style:{fontSize:16}},s.ai.emoji||"⌚"),
              React.createElement("span",{style:{fontSize:11,fontFamily:"var(--f)",color:"var(--text)"}},s.ai.brand+" "+s.ai.model),
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},s.ai.dial_color||""))}),
            watchScanResult.failed&&watchScanResult.failed.length>0&&React.createElement("div",{style:{marginTop:8,padding:"6px 8px",background:"rgba(200,90,58,0.06)",borderRadius:6,border:"1px solid rgba(200,90,58,0.15)"}},
              React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--warn)",fontWeight:600}},watchScanResult.failed.length+" failed"),
              watchScanResult.failed.map(function(e,i){return React.createElement("p",{key:i,style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",margin:"2px 0"}},"#"+(e.fi+1)+": "+e.error)})),
            React.createElement("button",{onClick:function(){setWatchScanResult(null)},className:"btn btn-ghost",style:{marginTop:8,fontSize:10}},"Dismiss"))),
        filtW.length===0&&React.createElement("div",{style:{textAlign:"center",padding:"40px 16px"}},React.createElement("p",{style:{fontSize:13,fontFamily:"var(--f)",color:"var(--dim)"}},"No watches match filter")),
        filtW.map(function(w){var st=STS.find(function(s){return s.id===w.status});return React.createElement("div",{key:w.id,className:"card-lift",style:{background:w.active?"var(--card)":"var(--bg)",border:"1px solid "+(w.active?"var(--border)":"var(--border)"),borderRadius:12,padding:"14px 16px",opacity:w.active?1:0.5,marginBottom:8}},
          React.createElement("div",{style:{display:"flex",gap:12,alignItems:"flex-start"}},
            React.createElement("div",{onClick:function(){toggleW(w.id)},style:{width:44,height:44,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",background:w.active?w.c+"20":"var(--card)",fontSize:20,flexShrink:0,cursor:"pointer",border:"2px solid "+(w.active?w.c+"60":"var(--border)"),overflow:"hidden"}},ph(w.photoUrl)?React.createElement("img",{src:ph(w.photoUrl),alt:"",decoding:"async",style:{width:"100%",height:"100%",objectFit:"cover"}}):w.i),
            React.createElement("div",{style:{flex:1,minWidth:0,cursor:"pointer"},onClick:function(){setEditW(w)}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:3}},
                React.createElement("span",{style:{fontSize:14,fontWeight:600,color:w.active?"var(--text)":"var(--dim)"}},w.n),
                !IS_SHARED&&w.t==="replica"&&React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"#6a5a50",border:"1px solid var(--rep-border)",borderRadius:3,padding:"1px 5px"}},"REP"),
                React.createElement("span",{style:{width:8,height:8,borderRadius:"50%",background:w.c}}),
                React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:st?st.c:"var(--dim)"}},st?st.l:""),
                (function(){var ds=daysSince(w.id);return ds>=14?React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",color:"#fff",background:"rgba(200,90,58,0.8)",borderRadius:4,padding:"1px 5px",fontWeight:700}},ds+"d"):null}())),
              React.createElement("div",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)",marginBottom:4}},w.d+(w.size?" · "+w.size:"")+(w.ref?" · Ref "+w.ref:"")+" · "+(w.straps&&w.straps.length?w.straps.map(function(s){var td=STRAP_TYPES.find(function(t){return t.id===s.type});return(td?td.icon:"")+s.type+(s.type!=="bracelet"&&s.color?" "+s.color:"")}).join(", "):w.br?"Bracelet":"Strap"+(w.sc&&w.sc.length?": "+w.sc.join(", "):""))+" · "+w.mt+(w.movement?" · "+w.movement:"")+(function(){var ds=daysSince(w.id);return ds<999?" · "+(ds===0?"✔ today":ds+"d ago"):""}())),
              React.createElement("div",{style:{display:"flex",gap:3,flexWrap:"wrap"}},(w.cx||[]).map(function(c){return React.createElement("span",{key:c,style:{fontSize:8,fontFamily:"var(--f)",background:"var(--bg)",borderRadius:8,padding:"2px 6px",color:"var(--dim)"}},(CXI[c]||"")+c)}))),
            (function(){var isWorn=todayWorn&&todayWorn.watchId===w.id;return React.createElement("button",{onClick:function(e){e.stopPropagation();if(isWorn){undoWear(todayStr)}else{logWear(w.id,todayStr);/* Auto-log strap */var _sr2=w.straps&&w.straps.length===1?w.straps[0]:w.straps&&w.straps.length>1?strapRec(w,[],effectiveCtx,{rain:weather&&weather.cond&&weather.cond.rain}).strap:null;if(_sr2)logStrapWear(w.id,_sr2,primaryCtx,getWeatherKey(weather))}},style:{background:isWorn?"rgba(122,184,122,0.15)":"var(--bg)",border:"1px solid "+(isWorn?"rgba(122,184,122,0.3)":"var(--border)"),borderRadius:8,padding:"4px 8px",cursor:"pointer",color:isWorn?"var(--good)":"var(--dim)",fontFamily:"var(--f)",fontSize:9,fontWeight:600,flexShrink:0,minHeight:26,marginRight:4}},isWorn?"✓ Worn":"⌚ Wear")})(),
            React.createElement("button",{onClick:function(e){e.stopPropagation();toggleW(w.id)},style:{width:44,height:26,borderRadius:13,background:w.active?"var(--gold)":"var(--card2)",border:"none",cursor:"pointer",position:"relative",flexShrink:0,minHeight:26}},
              React.createElement("div",{style:{width:20,height:20,borderRadius:"50%",background:w.active?"var(--bg)":"var(--dim)",position:"absolute",top:3,left:w.active?21:3,transition:"left .2s"}}))))}),
        React.createElement("button",{onClick:function(){setConfirmDlg({msg:"Reset watches to defaults?",danger:true,onOk:function(){setW(DEFAULTS);ps("w_"+SK,DEFAULTS);setConfirmDlg(null)}})},style:{display:"block",margin:"12px auto 0",background:"none",border:"1px solid var(--border)",borderRadius:8,padding:"10px 16px",cursor:"pointer",color:"var(--dim)",fontFamily:"var(--f)",fontSize:10,minHeight:40}},"Reset Defaults")),

      /* ═══ SAVED ═══ */
      view==="saved"&&React.createElement("div",{key:"tab-saved",className:"tab-content",style:{paddingTop:16,paddingBottom:40}},
        /* List / Calendar toggle */
        saved.length>0&&React.createElement("div",{style:{display:"flex",gap:5,marginBottom:12}},
          React.createElement(Pill,{on:savedView==="list",onClick:function(){setSavedView("list")}},"📋 List"),
          React.createElement(Pill,{on:savedView==="calendar",onClick:function(){setSavedView("calendar")}},"📅 Calendar")),
        /* ══ CALENDAR VIEW ══ */
        savedView==="calendar"&&saved.length>0&&(function(){
          var now=new Date();var year=now.getFullYear();var month=now.getMonth();
          var firstDay=new Date(year,month,1).getDay();var daysInMonth=new Date(year,month+1,0).getDate();
          var monthName=now.toLocaleDateString(undefined,{month:"long",year:"numeric"});
          /* Build date → outfits map */
          var dateMap={};saved.forEach(function(o){if(o.wearDate)dateMap[o.wearDate]=(dateMap[o.wearDate]||[]).concat([o])});
          var cells=[];for(var b=0;b<firstDay;b++)cells.push(null);
          for(var d=1;d<=daysInMonth;d++)cells.push(d);
          return React.createElement("div",{style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:14,padding:"14px",marginBottom:16}},
            React.createElement("div",{style:{textAlign:"center",fontSize:14,fontFamily:"var(--f)",fontWeight:600,color:"var(--gold)",marginBottom:10}},monthName),
            React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,textAlign:"center",marginBottom:4}},
              ["S","M","T","W","T","F","S"].map(function(d2,i){return React.createElement("div",{key:i,style:{fontSize:8,fontFamily:"var(--f)",color:"var(--dim)",padding:4,fontWeight:600}},d2)})),
            React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}},
              cells.map(function(day,i){
                if(!day)return React.createElement("div",{key:"e"+i});
                var ds=year+"-"+String(month+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
                var outfits=dateMap[ds]||[];var isToday=ds===todayStr;
                return React.createElement("div",{key:i,style:{aspectRatio:"1",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRadius:8,background:isToday?"rgba(201,168,76,0.12)":outfits.length?"rgba(122,184,122,0.08)":"transparent",border:"1px solid "+(isToday?"rgba(201,168,76,0.3)":outfits.length?"rgba(122,184,122,0.2)":"transparent"),cursor:outfits.length?"pointer":"default",position:"relative"},onClick:outfits.length?function(){setSavedView("list")}:undefined},
                  React.createElement("span",{style:{fontSize:10,fontFamily:"var(--f)",color:isToday?"var(--gold)":outfits.length?"var(--good)":"var(--dim)",fontWeight:isToday?700:400}},day),
                  outfits.length>0&&React.createElement("div",{style:{display:"flex",gap:1,marginTop:1}},
                    outfits.slice(0,3).map(function(o,j){
                      var w0=o.watches&&o.watches[0];
                      return React.createElement("span",{key:j,style:{fontSize:6}},w0?w0.i:"👔")})))})));
        })(),
        /* ══ LIST VIEW ══ */
        !saved.length?React.createElement("div",{style:{textAlign:"center",padding:"50px 16px"}},React.createElement("p",{style:{fontSize:28,margin:"0 0 8px"}},"📋"),React.createElement("p",{style:{fontSize:13,fontFamily:"var(--f)",color:"var(--dim)"}},"No saved outfits"))
        :savedView!=="calendar"&&function(){
      var todayISO=new Date().toISOString().slice(0,10);
      return saved.slice().sort(function(a,b){
        var aIsToday=a.wearDate===todayISO?1:0;
        var bIsToday=b.wearDate===todayISO?1:0;
        if(aIsToday!==bIsToday)return bIsToday-aIsToday;
        var aHasDate=a.wearDate?1:0;
        var bHasDate=b.wearDate?1:0;
        if(aHasDate!==bHasDate)return bHasDate-aHasDate;
        if(aHasDate&&bHasDate)return a.wearDate<b.wearDate?-1:a.wearDate>b.wearDate?1:0;
        return (b.ts||0)-(a.ts||0);
      });
    }().map(function(o){var oTop=o.items?o.items.find(function(i){return catOf(i.garmentType)==="tops"}):null;var oBot=o.items?o.items.find(function(i){return catOf(i.garmentType)==="bottoms"}):null;var oSh=o.items?o.items.find(function(i){return catOf(i.garmentType)==="shoes"}):null;return React.createElement("div",{key:o.id,className:"card-lift",style:{background:"var(--card)",border:"1px solid var(--border)",borderRadius:12,padding:"14px 16px",marginBottom:10}},
          React.createElement("div",{style:{display:"flex",gap:10,marginBottom:8}},
            React.createElement(OutfitFigure,{topColor:oTop?oTop.color:"grey",botColor:oBot?oBot.color:"charcoal",shoeColor:oSh?oSh.color:"black",watchColor:o.watches&&o.watches[0]?o.watches[0].c:"#c9a84c",watchIcon:o.watches&&o.watches[0]?o.watches[0].i:"⌚",watchName:"",size:60}),
            React.createElement("div",{style:{flex:1,minWidth:0}},
              React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}},
                React.createElement("div",null,React.createElement("h3",{style:{fontSize:14,fontWeight:500,margin:"0 0 2px"}},o.name),React.createElement("p",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--dim)",margin:0}},(activeCxIcons[o.context]||"")+" "+o.context+" · "+new Date(o.ts).toLocaleDateString()+(o.fs?" · Score "+o.fs:"")),o.weather&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",color:"#7ab8d8",background:"rgba(100,150,220,0.08)",borderRadius:4,padding:"1px 6px",border:"1px solid rgba(100,150,220,0.15)",marginTop:2,display:"inline-block"}},(o.weather.cond?o.weather.cond.i:"")+" "+o.weather.temp+"°C")),
                React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end"}},
                  navigator.share&&React.createElement("button",{onClick:function(ev){ev.stopPropagation();var parts=[];if(o.watches&&o.watches.length)parts.push("⌚ "+o.watches.map(function(w){return w.n}).join(", "));(o.items||[]).forEach(function(item){parts.push(item.name||item.color)});var text=o.name+"\n"+(activeCxIcons[o.context]||"")+" "+o.context+(o.fs?" · Score "+o.fs:"")+"\n\n"+parts.join("\n");navigator.share({title:o.name,text:text}).catch(function(){})},style:{background:"none",border:"1px solid rgba(122,184,216,0.3)",borderRadius:6,padding:"6px 10px",cursor:"pointer",color:"#7ab8d8",fontFamily:"var(--f)",fontSize:10,minHeight:30}},"📤"),
                  React.createElement("button",{onClick:function(){delSaved(o.id)},style:{background:"none",border:"1px solid var(--del-border)",borderRadius:6,padding:"6px 10px",cursor:"pointer",color:"var(--del-text)",fontFamily:"var(--f)",fontSize:10,minHeight:30}},"✕"),
                  /* ═══ WEAR DATE BUTTON ═══ */
                    o.wearDate&&React.createElement("span",{style:{fontSize:8,fontFamily:"var(--f)",fontWeight:600,padding:"2px 7px",borderRadius:4,color:o.wearDate===new Date().toISOString().slice(0,10)?"var(--good)":"var(--gold)",background:o.wearDate===new Date().toISOString().slice(0,10)?"rgba(122,184,122,0.12)":"rgba(201,168,76,0.1)",border:"1px solid "+(o.wearDate===new Date().toISOString().slice(0,10)?"rgba(122,184,122,0.25)":"rgba(201,168,76,0.2)")}},o.wearDate===new Date().toISOString().slice(0,10)?"👔 Wearing Today":"📌 "+new Date(o.wearDate+"T12:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})),
                    React.createElement("button",{onClick:function(ev){ev.stopPropagation();setWearPicker(wearPicker===o.id?null:o.id)},style:{background:"none",border:"1px solid var(--border)",borderRadius:6,padding:"5px 9px",cursor:"pointer",color:"var(--sub)",fontFamily:"var(--f)",fontSize:9,minHeight:26}},o.wearDate?"✎ Change":"👔 Wear"),
                    wearPicker===o.id&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:4,padding:"8px 10px",background:"var(--card)",border:"1px solid var(--gold)",borderRadius:8,marginTop:2,boxShadow:"0 4px 16px rgba(0,0,0,0.15)"}},
                      React.createElement("button",{onClick:function(){setOutfitWear(o.id,new Date().toISOString().slice(0,10))},style:{background:"rgba(122,184,122,0.12)",border:"1px solid rgba(122,184,122,0.25)",borderRadius:6,padding:"6px 12px",cursor:"pointer",color:"var(--good)",fontFamily:"var(--f)",fontSize:10,fontWeight:600}},"👔 Today"),
                      React.createElement("label",{style:{display:"flex",alignItems:"center",gap:6}},React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},"Pick:"),React.createElement("input",{type:"date",defaultValue:o.wearDate||"",onChange:function(ev){if(ev.target.value)setOutfitWear(o.id,ev.target.value)},style:{fontSize:10,fontFamily:"var(--f)",background:"var(--bg)",color:"var(--text)",border:"1px solid var(--border)",borderRadius:4,padding:"4px 6px"}})),
                      o.wearDate&&React.createElement("button",{onClick:function(){setOutfitWear(o.id,null)},style:{background:"none",border:"1px solid var(--del-border)",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"var(--del-text)",fontFamily:"var(--f)",fontSize:9}},"✕ Clear date")),
                  /* Weather match badge */
                  weather&&o.weather&&(function(){var ct=weather.temp||18,ot=o.weather.temp||18,diff=Math.abs(ct-ot);var cRain=weather.cond&&weather.cond.rain,oRain=o.weather.cond&&o.weather.cond.rain;var match=diff<=5&&cRain===oRain?"great":diff<=10?"ok":"poor";return React.createElement("span",{style:{fontSize:7,fontFamily:"var(--f)",padding:"2px 6px",borderRadius:4,color:match==="great"?"var(--good)":match==="ok"?"var(--gold)":"var(--warn)",background:match==="great"?"rgba(122,184,122,0.1)":match==="ok"?"rgba(201,168,76,0.1)":"rgba(200,90,58,0.1)",border:"1px solid "+(match==="great"?"rgba(122,184,122,0.2)":match==="ok"?"rgba(201,168,76,0.2)":"rgba(200,90,58,0.2)")}},match==="great"?"✓ Today match":match==="ok"?"~ Similar wx":"✗ Diff weather")})())))),
          React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}},(o.items||[]).map(function(item,i){return React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",gap:6,background:"var(--bg)",borderRadius:8,padding:"4px 8px",border:"1px solid var(--border)"}},ph(item.photoUrl)?React.createElement("img",{src:ph(item.photoUrl),alt:"",decoding:"async",style:{width:32,height:32,objectFit:"cover",borderRadius:4}}):React.createElement(Dot,{color:item.color,size:10}),React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:"var(--sub)"}},item.name||item.color))})),
          React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap"}},(o.watches||[]).slice(0,3).map(function(w,i){return React.createElement("div",{key:w.id||i,style:{display:"flex",alignItems:"center",gap:3,background:"var(--bg)",borderRadius:6,padding:"4px 8px",border:i===0?"1px solid rgba(201,168,76,0.2)":"1px solid var(--border)"}},React.createElement("span",{style:{fontSize:12}},w.i),React.createElement("span",{style:{fontSize:9,fontFamily:"var(--f)",color:i===0?"var(--gold)":"var(--sub)"}},w.n))})))})))
  );
}
ReactDOM.render(React.createElement(ErrorBoundary,null,React.createElement(App)),document.getElementById("root"));
