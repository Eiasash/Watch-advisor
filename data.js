/* ══════ data.js — Constants, Color Maps, Presets, Defaults ══════ */
/* Set IS_SHARED=true to create a version for friends (empty collection, onboarding) */
const IS_SHARED=false;
const SK="v14"; /* bump to reset localStorage if schema changes */

/* ── Categories & layering ── */
const CATS={
  tops:["Shirt","T-Shirt","Tank Top","Sweater","Cardigan","Hoodie","Sweatshirt","Jacket","Coat","Blazer","Overshirt","Vest/Gilet"],
  bottoms:["Jeans","Chinos","Pants/Trousers","Shorts"],
  shoes:["Shoes"],
  accessories:["Accessories"]
};
function catOf(gt){
  if(CATS.tops.includes(gt))return"tops";
  if(CATS.bottoms.includes(gt))return"bottoms";
  if(CATS.shoes.includes(gt))return"shoes";
  if(CATS.accessories.includes(gt))return"accessories";
  return"misc";
}
const LAYERS={
  base:["Shirt","T-Shirt","Tank Top"],
  mid:["Sweater","Cardigan","Hoodie","Sweatshirt","Vest/Gilet","Overshirt"],
  outer:["Jacket","Coat","Blazer"]
};
function layerOf(gt){
  if(LAYERS.base.includes(gt))return"base";
  if(LAYERS.mid.includes(gt))return"mid";
  if(LAYERS.outer.includes(gt))return"outer";
  return"base";
}

/* ── Context rules ── */
const CXR={
  "smart-casual":{no:["Tank Top"]},
  "clinic":{no:["Tank Top","Shorts"]},
  "formal":{no:["Tank Top","Shorts","Hoodie","Sweatshirt"]},
  "event":{no:["Tank Top","Shorts","Hoodie","Sweatshirt"]},
  "date":{no:[]},
  "weekend":{no:[]},
  "casual":{no:[]},
  "riviera":{no:[]},
  "office":{no:["Tank Top","Shorts"]}
};

/* ── Weather tiers ── */
function getWT(feels){
  if(feels===undefined||feels===null)return{tier:"mid",weight:"mid"};
  if(feels>=28)return{tier:"hot",weight:"light"};
  if(feels>=18)return{tier:"warm",weight:"mid"};
  if(feels>=10)return{tier:"cool",weight:"mid"};
  return{tier:"cold",weight:"heavy"};
}

/* Season — temperature-based when weather available, hemisphere-aware month fallback */
function getSeason(temp,lat){
  const m=new Date().getMonth(); /* 0-11 */
  const isSouth=lat!==undefined&&lat!==null&&lat<0;
  const mm=isSouth?(m+6)%12:m;
  if(temp!==undefined&&temp!==null){
    if(temp>=24)return"summer";
    if(temp>=16)return"spring";
    if(temp>=10)return"fall";
    return"winter";
  }
  if([11,0,1].includes(mm))return"winter";
  if([2,3,4].includes(mm))return"spring";
  if([5,6,7].includes(mm))return"summer";
  return"fall";
}

/* ───────────────────────── COLORS ─────────────────────────
   CM = color meta: temperature (warm/cool/neutral/mixed)
   CP = compatibility matrix: good pairings
   COLOR_FAMILIES = high-level family buckets for tonal dressing
*/
const CM={
  "black":{t:"neutral"}, "white":{t:"neutral"}, "grey":{t:"neutral"}, "gray":{t:"neutral"},
  "navy":{t:"cool"}, "blue":{t:"cool"}, "light blue":{t:"cool"}, "teal":{t:"cool"}, "green":{t:"cool"},
  "brown":{t:"warm"}, "tan":{t:"warm"}, "beige":{t:"warm"}, "cream":{t:"warm"}, "sand":{t:"warm"},
  "burgundy":{t:"warm"}, "red":{t:"warm"}, "orange":{t:"warm"}, "yellow":{t:"warm"},
  "purple":{t:"cool"}, "pink":{t:"warm"},
  "silver":{t:"neutral"}, "gold":{t:"warm"},
  "champagne":{t:"warm"},
  "ivory":{t:"warm"},
  "olive":{t:"warm"},
  "khaki":{t:"warm"},
  "mint":{t:"cool"},
  "turquoise":{t:"cool"},
  "maroon":{t:"warm"},
  "rose":{t:"warm"},
  "salmon":{t:"warm"},
  "aqua":{t:"cool"},
  "charcoal":{t:"neutral"},
  "off-white":{t:"neutral"},
  "cognac":{t:"warm"},
  "camel":{t:"warm"},
  "mustard":{t:"warm"},
  "forest green":{t:"cool"},
  "emerald":{t:"cool"},
  "sea green":{t:"cool"},
  "sky blue":{t:"cool"},
  "stone":{t:"neutral"}
};

const COLOR_FAMILIES={
  blacks:["black","charcoal"],
  whites:["white","off-white","cream","ivory"],
  greys:["grey","gray","silver","stone"],
  blues:["navy","blue","light blue","sky blue","aqua","turquoise"],
  greens:["green","forest green","emerald","sea green","olive","mint","teal"],
  browns:["brown","tan","beige","khaki","camel","cognac","sand"],
  reds:["red","burgundy","maroon","rose","salmon","pink"],
  yellows:["yellow","mustard","gold","champagne"],
  purples:["purple"]
};

const CP={
  "black":["white","grey","gray","tan","beige","blue","navy","olive","green","burgundy","red","silver","gold","champagne"],
  "white":["black","navy","blue","grey","gray","tan","beige","olive","green","burgundy","red","silver","gold"],
  "grey":["black","white","navy","blue","tan","beige","olive","burgundy","red","green","silver"],
  "navy":["white","grey","gray","tan","beige","brown","olive","burgundy","red"],
  "blue":["white","grey","gray","tan","beige","brown"],
  "brown":["white","navy","blue","tan","beige","olive","green","burgundy"],
  "tan":["black","white","navy","blue","grey","gray","brown","olive","green","burgundy"],
  "beige":["black","white","navy","blue","grey","gray","brown","olive","green"],
  "olive":["black","white","tan","beige","navy","brown"],
  "green":["black","white","tan","beige","navy","brown"],
  "burgundy":["black","white","grey","gray","tan","navy","olive","green"],
  "red":["black","white","grey","gray","navy","tan","beige"],
  "silver":["black","white","navy","blue","grey","gray","tan","beige","burgundy"],
  "gold":["black","white","navy","blue","grey","gray","tan","beige","burgundy"]
};

/* ───────────────────────── STRAPS ───────────────────────── */
const STRAP_TYPES=[
  {id:"bracelet",icon:"⛓️",label:"Bracelet"},
  {id:"leather",icon:"🟤",label:"Leather"},
  {id:"rubber",icon:"🟦",label:"Rubber"},
  {id:"mesh",icon:"🕸️",label:"Mesh"},
  {id:"nato",icon:"🪢",label:"NATO"},
  {id:"canvas",icon:"🧵",label:"Canvas"}
];

const STRAP_CTX={
  "smart-casual":{bracelet:1.0,leather:0.8,rubber:0.6,mesh:0.7,nato:0.4,canvas:0.4},
  "clinic":{bracelet:1.0,leather:0.6,rubber:0.9,mesh:0.8,nato:0.5,canvas:0.5},
  "formal":{bracelet:0.9,leather:1.2,rubber:-0.5,mesh:0.6,nato:-0.6,canvas:-0.6},
  "event":{bracelet:0.9,leather:1.0,rubber:-0.2,mesh:0.7,nato:-0.2,canvas:-0.2},
  "date":{bracelet:0.8,leather:1.0,rubber:0.4,mesh:0.7,nato:0.2,canvas:0.2},
  "weekend":{bracelet:0.7,leather:0.6,rubber:0.8,mesh:0.6,nato:0.8,canvas:0.7},
  "casual":{bracelet:0.7,leather:0.6,rubber:0.8,mesh:0.6,nato:0.8,canvas:0.7},
  "riviera":{bracelet:0.9,leather:0.4,rubber:0.8,mesh:0.9,nato:0.6,canvas:0.6},
  "office":{bracelet:0.9,leather:0.9,rubber:0.3,mesh:0.7,nato:0.1,canvas:0.1}
};

function migrateStraps(w){
  if(w.straps&&Array.isArray(w.straps)&&w.straps.length)return w;
  /* legacy: br=true and sc=[colors] */
  var nw=Object.assign({},w);
  nw.straps=[];
  if(w.br){nw.straps.push({type:"bracelet",color:"steel",material:"steel"})}
  if(w.sc&&Array.isArray(w.sc)&&w.sc.length){
    w.sc.forEach(function(c){
      nw.straps.push({type:"leather",color:c,material:"leather"})
    });
  }
  if(!nw.straps.length)nw.straps.push({type:"leather",color:"black",material:"leather"});
  return nw;
}

/* ───────────────────────── WATCH META ───────────────────────── */
const WATCH_META={
  /* Add per-watch overrides here. Example:
  "santos-lg":{steel:true,twoTone:false,dialNeutral:true,isNeutralAnchor:true,dc:["white","silver"]},
  */
};

/* ───────────────────────── PRESETS / SHARED MODE ───────────────────────── */
const WATCH_PRESETS=[
  /* optional: saved watches setup, onboarding presets */
];

const WARDROBE_PRESETS=[
  /* optional: saved wardrobe setup, onboarding presets */
];

export {
  IS_SHARED, SK,
  CATS, catOf, LAYERS, layerOf,
  CXR, getWT, getSeason,
  CM, CP, COLOR_FAMILIES,
  STRAP_TYPES, STRAP_CTX,
  migrateStraps,
  WATCH_META,
  WATCH_PRESETS, WARDROBE_PRESETS
};