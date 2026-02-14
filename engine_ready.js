/* ══════ engine.js — Scoring Engine, Outfit Generation ══════ */
import {
  CM, CP, COLOR_FAMILIES, STRAP_CTX, STRAP_TYPES, CXR,
  CATS, catOf, layerOf, getSeason, getWT, migrateStraps,
  WATCH_META
} from './data.js';

function getColorFamily(c){for(var fam in COLOR_FAMILIES){if(COLOR_FAMILIES[fam].includes(c))return fam}return null}
var _compatCache={},_compatCacheSize=0;
function clearCompatCache(){_compatCache={};_compatCacheSize=0}
function compat(c1,c2){
  if(!c1||!c2)return 0.1;
  const a=(c1||"").toLowerCase().trim(),b=(c2||"").toLowerCase().trim();
  if(!a||!b)return 0.1;
  var ck=a<b?a+"|"+b:b+"|"+a;
  if(_compatCache[ck]!==undefined)return _compatCache[ck];
  var r;
  if(a===b){r=0.3} /* monochrome — penalize sameness, reward contrast */
  /* Exact match in compatibility matrix */
  else if((CP[a]||[]).includes(b)||(CP[b]||[]).includes(a)){r=1}
  /* Substring fallback for compound colors like "light blue" */
  else if((CP[a]||[]).some(x=>b.includes(x)||x.includes(b))){r=0.85}
  else if((CP[b]||[]).some(x=>a.includes(x)||x.includes(a))){r=0.85}
  else{
    var famA=getColorFamily(a),famB=getColorFamily(b);
    /* Color family: same family = decent pairing (tonal dressing) */
    if(famA&&famB&&famA===famB){r=0.45}
    /* Neutral + anything = safe */
    else if((["blacks","whites","greys"].includes(famA)&&famB)||(["blacks","whites","greys"].includes(famB)&&famA)){r=0.55}
    else{
      /* Temperature harmony */
      const t1=Object.entries(CM).find(([k])=>a.includes(k)),t2=Object.entries(CM).find(([k])=>b.includes(k));
      if(t1&&t2){
        var ta=t1[1].t,tb=t2[1].t;
        if(ta===tb&&ta!=="neutral"){r=0.5}
        else if(ta==="neutral"||tb==="neutral"){r=0.4}
        else if(ta==="mixed"||tb==="mixed"){r=0.45}
        else{r=0.2}
      }else{r=0.2}
    }
  }
  _compatCache[ck]=r;_compatCacheSize++;
  if(_compatCacheSize>500){_compatCache={};_compatCacheSize=0}
  return r;
}

/* ── Parse dial color string into array of CM-recognized colors ── */
function parseDialColors(d){
  if(!d)return[];
  var dl=(d||"").toLowerCase().trim();
  if(CM[dl])return[dl];
  var parts=dl.split('/').map(function(s){return s.trim()}).filter(Boolean);
  if(parts.length>1){
    var found=parts.filter(function(p){return!!CM[p]});
    if(found.length)return found;
  }
  parts=dl.split('-').map(function(s){return s.trim()}).filter(Boolean);
  if(parts.length>1){
    var compound=parts.join(' ');
    if(CM[compound])return[compound];
    var found2=parts.filter(function(p){return!!CM[p]});
    if(found2.length)return found2;
  }
  var keys=Object.keys(CM);
  var match=keys.find(function(k){return dl.includes(k)||k.includes(dl)});
  if(match)return[match];
  return[];
}


function scoreW(w,items,ctx,reps,opts){
  if(!w.active||w.status==="sold"||w.status==="service"||w.status==="pending-trade"||w.status==="incoming")return{total:-1,ctx:0,color:0,temp:0,strap:0,br:0,fresh:0,auth:0,vers:0};
  if(!reps&&w.t==="replica")return{total:-1,ctx:0,color:0,temp:0,strap:0,br:0,fresh:0,auth:0,vers:0};

  var _ctxArr=Array.isArray(ctx)?ctx:[ctx];
  var _ctxPri=_ctxArr[0]||"smart-casual";
  var _ctxSet=new Set(_ctxArr);
  var _o=opts||{};
  var wearLog=_o.wearLog||[];

  let s=0;
  const bd={ctx:0,color:0,temp:0,strap:0,br:0,fresh:0,auth:0,vers:0};

  const ic=items.filter(i=>i.color).map(i=>i.color.toLowerCase().trim());
  const shoe=items.find(i=>i.garmentType==="Shoes");
  const sc=shoe&&shoe.color?shoe.color.toLowerCase().trim():null;

  /* ── Context scoring (unchanged) ── */
  var FORM_TIERS={formal:["reverso","sbgw267","santos-lg","santos-oct","santos-rep"],event:["reverso","sbgw267","santos-lg","santos-oct","santos-rep","laureato","speedy","monaco","gmt"],clinic:["snowflake","rikka","sbgw267","santos-lg","reverso","bb41","speedy"],date:["santos-lg","reverso","laureato","rikka","snowflake","monaco","speedy"]};

  var _bestCxScore=0;
  _ctxArr.forEach(function(_cx){
    var tierList=FORM_TIERS[_cx];
    var _cxS=0;
    if(_cx&&w.cx&&w.cx.includes(_cx)){
      if(tierList&&tierList.includes(w.id)){_cxS=5}
      else{_cxS=3}
    }else if(tierList&&tierList.includes(w.id)){_cxS=2}
    if(_cxS>_bestCxScore)_bestCxScore=_cxS;
  });
  s+=_bestCxScore;
  bd.ctx=_bestCxScore;

  /* ── Dial color source fallback + compat scoring ──
     1) WATCH_META[w.id].dc
     2) w.dc
     3) parseDialColors(w.d)
     4) w.mc.slice(0,3)
  */
  var _wm=WATCH_META[w.id]||null;
  var dc=[];
  if(_wm&&Array.isArray(_wm.dc)&&_wm.dc.length){
    dc=_wm.dc.map(function(x){return (x||"").toLowerCase().trim()}).filter(Boolean);
  }else if(Array.isArray(w.dc)&&w.dc.length){
    dc=w.dc.map(function(x){return (x||"").toLowerCase().trim()}).filter(Boolean);
  }else{
    dc=parseDialColors(w.d);
    if(!dc.length&&w.mc&&w.mc.length){
      dc=w.mc.slice(0,3).map(function(x){return (x||"").toLowerCase().trim()}).filter(Boolean);
    }
  }

  var _dialNeutral=!!(_wm&&_wm.dialNeutral);
  if(!dc.length&&!_dialNeutral){
    var _dl=(w.d||"").toLowerCase();
    _dialNeutral=["blacks","whites","greys"].some(function(f){
      return (COLOR_FAMILIES[f]||[]).some(function(c2){return _dl.includes(c2)});
    });
  }

  var bestCompat=0;
  if(dc.length&&ic.length){
    for(var _di=0;_di<dc.length;_di++){
      for(var _ci=0;_ci<ic.length;_ci++){
        var _cv=compat(dc[_di],ic[_ci]);
        if(_cv>bestCompat)bestCompat=_cv;
      }
    }
  }

  var dialBonus=bestCompat>=0.8?1.5:bestCompat>=0.6?0.9:_dialNeutral?0.5:0;

  /* Avoid-list soft clash */
  if(w.ac&&w.ac.length){
    var _hasClash=ic.some(function(c2){
      return w.ac.some(function(a){
        var al=(a||"").toLowerCase();
        return c2.includes(al)||al.includes(c2);
      });
    });
    if(_hasClash)dialBonus=Math.max(dialBonus-0.5,0);
  }

  s+=dialBonus;
  bd.color+=dialBonus;

  const temps=ic.map(c=>{
    const e=Object.entries(CM).find(([k])=>c.includes(k));
    return e?e[1].t:"neutral"
  });
  const wm=temps.filter(x=>x==="warm").length;
  const co=temps.filter(x=>x==="cool").length;

  if(w.mt==="warm"&&wm>co){s+=2;bd.temp=2}
  if(w.mt==="cool"&&co>=wm){s+=1;bd.temp=1}
  if(w.mt==="warm"&&co>wm+1){s-=1;bd.temp=-1}

  /* ── Strap-shoe (soft tiered — no hard discards) ── */
  if(!w.br&&sc&&w.straps&&w.straps.length){
    var _sBlk=sc.includes("black");
    var _sBrn=sc.includes("brown")||sc.includes("tan")||sc.includes("cognac");
    var _sWht=sc.includes("white");

    var _bestStrap=-Infinity;
    w.straps.forEach(function(st){
      var stc=(st.color||"").toLowerCase();
      var pts=0;
      /* Bracelet/rubber/mesh/nato = shoe-agnostic */
      if(st.type==="bracelet"||st.type==="rubber"||st.type==="mesh"||st.type==="nato"){
        pts=0.5;
      }else{
        var _warmStrap=stc.includes("brown")||stc.includes("tan")||stc.includes("burgundy")||stc.includes("teal")||stc.includes("green")||stc.includes("cognac");
        var _darkStrap=stc.includes("black")||stc.includes("navy");
        if(_sBrn&&_warmStrap)pts=1.2;
        else if(_sBlk&&_darkStrap)pts=1.2;
        else if(_sWht)pts=0.3;
        else if(_sBrn&&_darkStrap)pts=-0.6;
        else if(_sBlk&&_warmStrap)pts=-0.6;
        else pts=0;
      }
      if(pts>_bestStrap)_bestStrap=pts;
    });
    if(_bestStrap>-Infinity){s+=_bestStrap;bd.strap+=_bestStrap}
  }

  /* ── Bracelet bonus ── */
  if(w.br){s+=1;bd.br=1}

  /* ── Rain logic ── */
  var _rain=_o.rain;
  if(_rain){
    if(w.straps&&w.straps.length){
      var _hasWR=w.straps.some(function(st){return st.type==="bracelet"||st.type==="rubber"||st.type==="mesh"});
      var _hasNatoOrCanvas=w.straps.some(function(st){return st.type==="nato"||st.type==="canvas"});
      var _onlyLeather=w.straps.every(function(st){return st.type==="leather"});
      if(_hasWR){s+=1.5;bd.strap+=1.5}
      else if(_hasNatoOrCanvas){s+=0.5;bd.strap+=0.5}
      else if(_onlyLeather){s-=1.0;bd.strap-=1.0}
    }else{
      if(w.br){s+=1.5;bd.strap+=1.5}else{s-=1.0;bd.strap-=1.0}
    }
  }

  /* ── Versatility bonuses ── */
  var _versScore=0;
  if(_wm.twoTone)_versScore+=0.8;
  if(_wm.isNeutralAnchor){_versScore+=0.6;if(bd.strap<0){s-=bd.strap;s+=bd.strap*0.5;bd.strap*=0.5}} /* anchor softens mismatch */
  if(_dialNeutral)_versScore+=0.7;
  var _hasSteel=w.straps&&w.straps.some(function(st){return st.type==="bracelet"&&(st.material||"").toLowerCase().includes("steel")});
  if(_hasSteel)_versScore+=0.5;
  s+=_versScore;
  bd.vers=_versScore;

  /* ── Freshness (unchanged) ── */
  var _prefU=opts&&opts.preferUnworn;
  if(wearLog&&wearLog.length){
    var _now2=Date.now();
    var _last=null;
    for(var _e of wearLog){
      if(_e.watchId===w.id&&(!_last||_e.ts>_last))_last=_e.ts
    }
    if(_last){
      var _daysAgo=Math.floor((_now2-_last)/(864e5));
      if(_daysAgo<=1){s-=(_prefU?5:3);bd.fresh=-(_prefU?5:3)}
      else if(_daysAgo<=3){s-=(_prefU?3:1.5);bd.fresh=-(_prefU?3:1.5)}
      else if(_daysAgo>=14){s+=(_prefU?4:2);bd.fresh=(_prefU?4:2)}
      else if(_daysAgo>=7){s+=(_prefU?2.5:1);bd.fresh=(_prefU?2.5:1)}
    }else{s+=(_prefU?2:1);bd.fresh=(_prefU?2:1)}
  }

  return{total:s,...bd};
}

function strapRec(w,items,ctx,wxOpts){
  var _rain=wxOpts&&wxOpts.rain;

  if(w.straps&&w.straps.length){
    if(w.straps.length===1){
      var s0=w.straps[0];
      var st0=STRAP_TYPES.find(function(t){return t.id===s0.type})||STRAP_TYPES[0];
      var _warn="";
      if(_rain&&s0.type==="leather")_warn=" ⚠️ rain";
      return{
        text:s0.type==="bracelet"
          ?(st0.icon+" Bracelet ("+s0.material+")"+_warn)
          :(st0.icon+" "+s0.color+" "+s0.type+_warn),
        type:_rain&&s0.type==="leather"?"warn":"info",
        strap:s0
      };
    }

    var shoe=items.find(function(i){return i.garmentType==="Shoes"});
    var sc=shoe&&shoe.color?shoe.color.toLowerCase():"";
    var sm=(shoe&&(shoe.material||shoe.name)||"").toLowerCase();
    var _ctxPri2=Array.isArray(ctx)?ctx[0]||"smart-casual":ctx;
    var ctxMap=STRAP_CTX[_ctxPri2]||{};

    var scored=w.straps.map(function(st){
      var pts=ctxMap[st.type]||0;
      var stc=st.color?st.color.toLowerCase():"";

      /* Shoe-strap coordination (soft tiered) */
      if(st.type==="bracelet"||st.type==="rubber"||st.type==="mesh"){
        /* Bracelet/rubber/mesh ignores shoe color */
      }else if(sc){
        var _warmS=stc.includes("brown")||stc.includes("tan")||stc.includes("burgundy")||stc.includes("teal")||stc.includes("cognac");
        var _darkS=stc.includes("black")||stc.includes("navy");
        var _brShoe=sc.includes("brown")||sc.includes("tan")||sc.includes("cognac");
        var _bkShoe=sc.includes("black");
        var _whShoe=sc.includes("white");

        if(_warmS&&_brShoe)pts+=1.2;
        else if(_darkS&&_bkShoe)pts+=1.2;
        else if(_warmS&&_whShoe)pts+=0.3;
        else if(_darkS&&_whShoe)pts+=0.3;
        else if(_warmS&&_bkShoe)pts-=0.6;
        else if(_darkS&&_brShoe)pts-=0.6;
      }

      /* Material harmony */
      if(sm.includes("leather")&&(st.material||"").toLowerCase().match(/leather|alligator|cordovan|nubuck/))pts+=1;
      if(sm.includes("suede")&&(st.material||"").toLowerCase().includes("suede"))pts+=1;

      /* Weather (soft — no hard failures) */
      if(_rain){
        if(st.type==="bracelet"||st.type==="rubber"||st.type==="mesh")pts+=1.5;
        else if(st.type==="leather")pts-=1;
        else if(st.type==="nato"||st.type==="canvas")pts+=0.5;
      }

      return{strap:st,score:pts};
    }).sort(function(a,b){return b.score-a.score});

    var best=scored[0];
    var stDef=STRAP_TYPES.find(function(t){return t.id===best.strap.type})||STRAP_TYPES[0];
    var label=best.strap.type==="bracelet"
      ?"Bracelet ("+best.strap.material+")"
      :best.strap.color+" "+best.strap.type;

    return{
      text:"→ "+stDef.icon+" "+label,
      type:"good",
      strap:best.strap,
      all:scored
    };
  }

  if(w.br)return{text:"⛓️ Bracelet",type:"info"};
  return{text:"Default strap",type:"info"};
}
function getWarns(w,items){
  const ws=[];const shoe=items.find(i=>i.garmentType==="Shoes");
  var hasLeather=w.straps?w.straps.some(function(s){return s.type==="leather"}):!w.br;
  var nonBrStraps=w.straps?w.straps.filter(function(s){return s.type!=="bracelet"}):[];
  if(hasLeather&&shoe&&shoe.color){const sc=shoe.color.toLowerCase();
    if(sc.includes("white"))ws.push("⚠️ Leather strap+white shoes");
    var strapColors=nonBrStraps.length?nonBrStraps.map(function(s){return s.color.toLowerCase()}):w.sc||[];
    if(sc.includes("brown")&&strapColors.length&&strapColors.every(function(x){return x.includes("black")||x.includes("navy")}))ws.push("🚫 Brown shoes+dark strap");
    if(sc.includes("black")&&strapColors.length&&strapColors.every(function(x){return x.includes("brown")||x.includes("tan")||x.includes("teal")}))ws.push("🚫 Black shoes+warm strap");
  }
  /* Strap type formality warnings */
  if(w.straps&&w.straps.length===1){
    var onlyType=w.straps[0].type;
    if((onlyType==="nato"||onlyType==="rubber"||onlyType==="canvas")&&w.cx&&(w.cx.includes("formal")||w.cx.includes("date")))ws.push("⚠️ "+onlyType+" strap may be too casual — consider adding a leather option");
  }
  /* Formality warnings */
  var hasShorts=items.some(function(it){return it.garmentType==="Shorts"});
  var hasTee=items.some(function(it){return it.garmentType==="T-Shirt"||it.garmentType==="Tank Top"});
  var hasCasualKnit=items.some(function(it){return it.garmentType==="Hoodie"||it.garmentType==="Sweatshirt"});
  if(hasShorts&&w.cx&&!w.cx.includes("casual")&&!w.cx.includes("weekend")&&!w.cx.includes("riviera"))ws.push("⚠️ Shorts may clash with this watch's formality");
  if(hasTee&&w.cx&&w.cx.includes("formal")&&!w.cx.includes("casual"))ws.push("⚠️ T-shirt may be too casual for this watch");
  if(hasCasualKnit&&w.cx&&(w.cx.includes("formal")||w.cx.includes("clinic")))ws.push("⚠️ Hoodie/sweatshirt too casual for this context");
  return ws;
}

function makeOutfit(items,watches,ctx,reps,wxOpts,tempVal,extraOpts){
  var _wl=extraOpts&&extraOpts.wearLog||[];
  var tops=items.filter(i=>catOf(i.garmentType)==="tops");
  const top=tops[0]||null,bot=items.find(i=>catOf(i.garmentType)==="bottoms"),shoe=items.find(i=>catOf(i.garmentType)==="shoes");
  /* outermost top layer is what's visible — used for primary color scoring */
  var outerTop=tops.length>0?tops[tops.length-1]:null;
  if(wxOpts&&tempVal!==undefined)wxOpts.temp=tempVal;
  let fs=0;
  /* Layering bonus — reward multi-layer outfits */
  if(tops.length>=2)fs+=0.5;
  if(tops.length>=3)fs+=0.5;
  /* Season penalty for off-season items */
  /* Season — temperature-based when weather available, hemisphere-aware month fallback */
  var _csn=getSeason(wxOpts&&wxOpts.temp!==undefined?wxOpts.temp:undefined,wxOpts&&wxOpts.lat);
  items.forEach(function(it){var s=it.seasons;if(s&&s.length>0&&s.length<4&&!s.includes(_csn))fs-=1});
  /* Freshness penalty — discourage recently-worn garments for variety */
  var _now=Date.now();
  var _prefUnworn=extraOpts&&extraOpts.preferUnworn;
  items.forEach(function(it){if(it.lastWorn){var daysAgo=Math.floor((_now-new Date(it.lastWorn).getTime())/(864e5));if(daysAgo<=1)fs-=(_prefUnworn?4:2);else if(daysAgo<=3)fs-=(_prefUnworn?2:0.8);else if(daysAgo<=5)fs-=(_prefUnworn?1:0.3);else if(daysAgo>=14)fs+=(_prefUnworn?2:0.3);else if(daysAgo>=7&&_prefUnworn)fs+=1}else if(_prefUnworn){fs+=1}});
  /* Color compat — use outermost visible layer for primary scoring */
  if(outerTop&&bot)fs+=compat(outerTop.color,bot.color)*3;
  if(outerTop&&shoe)fs+=compat(outerTop.color,shoe.color)*2;
  if(bot&&shoe)fs+=compat(bot.color,shoe.color)*2;
  /* Layer-to-layer color harmony */
  for(var li=0;li<tops.length-1;li++){fs+=compat(tops[li].color,tops[li+1].color)*1.5}
  /* ══ MONOTONE PENALTY: punish all-same-color outfits ══ */
  if(outerTop&&bot&&shoe){
    var _tc=(outerTop.color||"").toLowerCase(),_bc=(bot.color||"").toLowerCase(),_sc=(shoe.color||"").toLowerCase();
    if(_tc===_bc&&_bc===_sc)fs-=3; /* all 3 same = harsh penalty */
    else if(_tc===_bc||_tc===_sc||_bc===_sc)fs-=1; /* 2 of 3 same = mild penalty */
  }
  /* ══ CONTRAST BONUS: reward mixing warm+cool or different families ══ */
  if(outerTop&&bot){
    var _fT=getColorFamily((outerTop.color||"").toLowerCase()),_fB=getColorFamily((bot.color||"").toLowerCase());
    if(_fT&&_fB&&_fT!==_fB){
      var _neutrals=["blacks","whites","greys"];
      if(!_neutrals.includes(_fT)&&!_neutrals.includes(_fB))fs+=1.5; /* two distinct chromatic families */
      else fs+=0.5; /* neutral + chromatic = safe but intentional */
    }
  }
  /* Jeans-first preference: jeans are the default bottom unless formality demands otherwise.
     If no jeans exist in the current bottom pool, remove casual penalties on chinos/trousers
     so scores don't get artificially depressed when jeans simply aren't available. */
  if(bot){
    var _cx=Array.isArray(ctx)?ctx[0]:ctx;
    var _formalCx=_cx==="formal"||_cx==="event"||_cx==="office";
    var _semiCx=_cx==="clinic"||_cx==="smart-casual"||_cx==="date";
    var _hasJeans=extraOpts&&extraOpts.hasJeansInPool||false;
    if(bot.garmentType==="Jeans"){fs+=_formalCx?0:_semiCx?1.2:2.0}
    else if(bot.garmentType==="Chinos"){fs+=_formalCx?1.0:_semiCx?0:(_hasJeans?-0.8:0.5)}
    else if(bot.garmentType==="Pants/Trousers"){fs+=_formalCx?1.5:_semiCx?0.3:(_hasJeans?-1.2:0)}
  }
  /* Pattern bonus — check outermost top vs bottom */
  if(outerTop&&bot){
    var tp=(outerTop.pattern||"solid"),bp=(bot.pattern||"solid");
    if(tp!=="solid"&&bp!=="solid")fs-=1.5;
    else if((tp==="textured"||bp==="textured")&&(tp==="solid"||bp==="solid"))fs+=0.8;
    else if(tp==="striped"&&bp==="solid")fs+=0.4;
  }
  /* Weather condition scoring */
  var isRainy=wxOpts&&wxOpts.rain;
  var isWindy=wxOpts&&wxOpts.wind&&wxOpts.wind>30;
  var uvHigh=wxOpts&&wxOpts.uv&&wxOpts.uv>=6;
  if(isRainy&&shoe){
    var sc2=(shoe.color||"").toLowerCase();
    var sn2=(shoe.name||"").toLowerCase();
    /* Penalize white/cream shoes in rain */
    if(sc2==="white"||sc2==="cream"||sc2==="beige"||sc2==="sand")fs-=2;
    /* Black shoes safest in rain */
    if(sc2==="black")fs+=1;
    /* Suede/canvas/material penalty in rain */
    var sm=(shoe.material||"").toLowerCase();
    if(sn2.includes("suede")||sm==="suede")fs-=2;
    else if(sn2.includes("canvas")||sm==="canvas")fs-=1;
  }
  /* Material-weather scoring for all items */
  if(wxOpts){
    var wxTemp=wxOpts.temp||18;
    items.forEach(function(it){
      var mat=(it.material||"").toLowerCase();
      if(!mat)return;
      if(isRainy&&mat==="suede")fs-=2;
      if(isRainy&&mat==="canvas")fs-=1;
      if((mat==="wool"||mat==="cashmere"||mat==="fleece")&&wxTemp>28)fs-=2;
      if(mat==="linen"&&wxTemp<10)fs-=1;
      if((mat==="linen"||mat==="cotton")&&wxTemp>25)fs+=1;
      if((mat==="wool"||mat==="cashmere"||mat==="tweed"||mat==="corduroy"||mat==="fleece")&&wxTemp<15)fs+=1;
    });
  }
  const wr=watches.map(w=>{
    var sc=scoreW(w,items,ctx,reps,{wearLog:_wl,preferUnworn:_prefUnworn});
    return{
      ...w,
      score:sc.total,
      bd:sc,
      sr:strapRec(w,items,ctx,{rain:isRainy}),
      wn:getWarns(w,items)
    };
  }).filter(w=>w.score>-1).sort((a,b)=>b.score-a.score);
  if(wr[0])fs+=wr[0].score*0.7;
  /* Rain warning */
  var wxWarns=[];
  if(isRainy)wxWarns.push("🌧️ Rain expected — bracelets/rubber preferred over leather");
  if(isWindy)wxWarns.push("💨 High wind — secure light items");
  return{fs:Math.round(fs*10)/10,watches:wr.slice(0,3),allW:wr,top,bot,shoe,outerTop:outerTop,tops:tops,items,wxWarns:wxWarns};
}


function genFits(wardrobe,watches,ctx,reps,ww,count,opts){
  count=count||10;opts=opts||{};
  var wxOpts=opts.wx||null;
  var rules=CXR[Array.isArray(ctx)?ctx[0]:ctx]||CXR["smart-casual"];
  var curSeason=getSeason(opts.temp,opts.lat);
  var seasonFilter=function(i){var s=i.seasons;if(!s||!s.length||s.length>=4)return true;return s.includes(curSeason)};
  var valid=wardrobe.filter(function(i){return i.color&&!i.needsEdit});
  var allTops=valid.filter(function(i){return catOf(i.garmentType)==="tops"&&!(rules.no||[]).includes(i.garmentType)&&seasonFilter(i)});
  var bots=valid.filter(function(i){return catOf(i.garmentType)==="bottoms"&&!(rules.no||[]).includes(i.garmentType)&&seasonFilter(i)});
  if(!allTops.length)allTops=valid.filter(function(i){return catOf(i.garmentType)==="tops"&&!(rules.no||[]).includes(i.garmentType)});
  if(!bots.length)bots=valid.filter(function(i){return catOf(i.garmentType)==="bottoms"&&!(rules.no||[]).includes(i.garmentType)});
  var shoes=valid.filter(function(i){return catOf(i.garmentType)==="shoes"&&seasonFilter(i)});
  if(!shoes.length)shoes=valid.filter(function(i){return catOf(i.garmentType)==="shoes"});
  if(opts.topType&&opts.topType!=="all"){var ft=allTops.filter(function(i){return i.garmentType===opts.topType});if(ft.length)allTops=ft}
  var lockItem=opts.lockItem||null;
  if(lockItem){var lcat=catOf(lockItem.garmentType);if(lcat==="tops")allTops=[lockItem];else if(lcat==="bottoms")bots=[lockItem]}
  var baseTops=allTops.filter(function(i){return layerOf(i.garmentType)==="base"});
  var midTops=allTops.filter(function(i){return layerOf(i.garmentType)==="mid"});
  var outerTops=allTops.filter(function(i){return layerOf(i.garmentType)==="outer"});
  var topCombos=[];
  if(ww==="light"){
    (baseTops.length?baseTops:allTops).forEach(function(t){topCombos.push([t])});
    var lb=bots.filter(function(i){return["Shorts","Chinos","Jeans"].includes(i.garmentType)});if(lb.length)bots=lb;
  }else if(ww==="mid"){
    var midTemp=opts.temp||18;
    if(midTemp<18){
      baseTops.forEach(function(b){topCombos.push([b]);midTops.forEach(function(m){if(b.id!==m.id&&compat(b.color,m.color)>=0.15)topCombos.push([b,m])});outerTops.forEach(function(o){if(b.id!==o.id&&compat(b.color,o.color)>=0.15)topCombos.push([b,o])})});
      if(!baseTops.length){midTops.forEach(function(m){topCombos.push([m])});outerTops.forEach(function(o){topCombos.push([o])})}
    }else{
      baseTops.forEach(function(b){topCombos.push([b])});midTops.forEach(function(m){topCombos.push([m])});
      baseTops.slice(0,3).forEach(function(b){midTops.filter(function(m){return m.garmentType==="Cardigan"||m.garmentType==="Vest/Gilet"}).forEach(function(m){if(compat(b.color,m.color)>=0.2)topCombos.push([b,m])})});
    }
    var cmb=bots.filter(function(i){return["Pants/Trousers","Jeans","Chinos"].includes(i.garmentType)});if(cmb.length)bots=cmb;
  }else if(ww==="heavy"){
    baseTops.forEach(function(b){
      midTops.forEach(function(m){if(b.id!==m.id&&compat(b.color,m.color)>=0.1)topCombos.push([b,m])});
      outerTops.forEach(function(o){if(b.id!==o.id&&compat(b.color,o.color)>=0.1)topCombos.push([b,o])});
      midTops.forEach(function(m){outerTops.forEach(function(o){if(b.id!==m.id&&m.id!==o.id&&b.id!==o.id&&compat(b.color,m.color)>=0.1&&compat(m.color,o.color)>=0.1)topCombos.push([b,m,o])})});
    });
    if(!baseTops.length){midTops.forEach(function(m){topCombos.push([m]);outerTops.forEach(function(o){if(m.id!==o.id)topCombos.push([m,o])})});outerTops.forEach(function(o){topCombos.push([o])})}
    if(!topCombos.length)allTops.forEach(function(t){topCombos.push([t])});
    var hb=bots.filter(function(i){return["Jeans","Pants/Trousers","Chinos"].includes(i.garmentType)});if(hb.length)bots=hb;
  }
  if(!topCombos.length)allTops.forEach(function(t){topCombos.push([t])});
  if(!topCombos.length||!bots.length)return[];
  if(topCombos.length>50){topCombos.sort(function(a,b){var sa=0,sb=0;for(var ii=0;ii<a.length-1;ii++)sa+=compat(a[ii].color,a[ii+1].color);for(var ii=0;ii<b.length-1;ii++)sb+=compat(b[ii].color,b[ii+1].color);sb+=b.length*0.3;sa+=a.length*0.3;return sb-sa});topCombos=topCombos.slice(0,50)}
  var combos=[];
  for(var tci=0;tci<topCombos.length;tci++){var tc=topCombos[tci];for(var bi=0;bi<bots.length;bi++){var bot=bots[bi];
    var outerItem=tc[tc.length-1];
    if(tc.some(function(t){return t.id===bot.id}))continue;
    var tb=compat(outerItem.color,bot.color);if(tb<0.2)continue;
    for(var si2=0;si2<(shoes.length||1);si2++){var shoe=shoes.length?shoes[si2]:null;
      if(shoe&&tc.some(function(t){return t.id===shoe.id}))continue;
      if(shoe&&shoe.id===bot.id)continue;
      var items=tc.concat([bot]).concat(shoe?[shoe]:[]);
      var r=makeOutfit(items,watches,ctx,reps,wxOpts,opts.temp,{wearLog:opts.wearLog||[],hasJeansInPool:bots.some(function(b2){return b2.garmentType==="Jeans"}),preferUnworn:opts.preferUnworn});
      var topIds=tc.map(function(t){return t.id}).join("+");
      combos.push({id:topIds+"-"+bot.id+"-"+(shoe?shoe.id:"x"),fs:r.fs,watches:r.watches,allW:r.allW,top:r.outerTop||tc[0],bot:r.bot,shoe:r.shoe,outerTop:r.outerTop,tops:tc,layers:tc,items:r.items,topType:outerItem.garmentType,wxWarns:r.wxWarns});
    }
  }}
  combos.sort(function(a,b){return b.fs-a.fs});
  var seen=new Set(),botUse={},uniq=[];
  for(var ci=0;ci<combos.length;ci++){var c=combos[ci];
    var outerC=c.outerTop||c.top;
    var ck=(outerC?outerC.color:"")+ "-"+(c.bot?c.bot.color:"") +"-"+(c.layers?c.layers.length:1);
    var bid=c.bot?c.bot.id:"x";
    if(seen.has(ck)&&uniq.length>2)continue;
    if((botUse[bid]||0)>=3&&uniq.length>4)continue;
    seen.add(ck);botUse[bid]=(botUse[bid]||0)+1;
    uniq.push(c);if(uniq.length>=count)break;
  }
  if(opts.shuffle){for(var shi=uniq.length-1;shi>0;shi--){var shj=Math.floor(Math.random()*(shi+1));var st=uniq[shi];uniq[shi]=uniq[shj];uniq[shj]=st}}
  return uniq;
}


function getSwaps(wd,fit,slot){
  const cat=slot==="top"?"tops":slot==="bot"?"bottoms":"shoes";
  const cur=slot==="top"?fit.top:slot==="bot"?fit.bot:fit.shoe;if(!cur)return[];
  return wd.filter(function(i){return i.color&&!i.needsEdit&&catOf(i.garmentType)===cat&&i.id!==cur.id}).map(function(alt){
    const o1=slot==="top"?fit.bot:fit.top;const o2=slot==="top"?fit.shoe:(slot==="bot"?fit.shoe:fit.bot);
    let sc=o1?compat(alt.color,o1.color)*3:0;if(o2)sc+=compat(alt.color,o2.color)*2;
    return Object.assign({},alt,{ss:Math.round(sc*10)/10})}).sort(function(a,b){return b.ss-a.ss}).slice(0,3);
}


/* ══════ WEEK ROTATION PLANNER ══════ */
function genWeekRotation(watches,forecast,weekCtx,wardrobe,reps,wearLog,rotLock,lat){
  var DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var today=new Date().getDay();
  var plan=[];var used={};var lastId=null;
  var defCtx=["casual","clinic","clinic","clinic","clinic","smart-casual","weekend"];
  /* Build days-since-worn map from log */
  var dsw={};var now=Date.now();
  if(wearLog&&wearLog.length){for(var e of wearLog){if(!dsw[e.watchId]||e.ts>dsw[e.watchId])dsw[e.watchId]=e.ts}}
  for(var d=0;d<7;d++){
    var dayIdx=(today+d)%7;var dayName=DAYS[dayIdx];
    var cx=(weekCtx&&weekCtx.length===7)?weekCtx[dayIdx]:defCtx[dayIdx];
    var fc=forecast&&forecast[d]?forecast[d]:null;
    var dayTier=fc?getWT(fc.feelsAvg):null;
    var dayWt=dayTier?dayTier.weight:"mid";
    /* Check if this day has a locked watch */
    var lockedId=rotLock&&rotLock[d]?rotLock[d]:null;
    var lockedWatch=lockedId?watches.find(function(w){return w.id===lockedId}):null;
    var pick;
    if(lockedWatch){
      pick=lockedWatch;
    }else{
      /* Score watches */
      var scored=watches.filter(function(w){return w.active&&w.status!=="sold"&&w.status!=="service"&&w.status!=="pending-trade"&&w.status!=="incoming"&&(reps||w.t!=="replica")}).map(function(w){
        var s=0;
        if(w.cx&&w.cx.includes(cx))s+=4;
        if(w.wt&&w.wt.includes(dayWt))s+=2;
        if(used[w.id])s-=8;
        if(w.id===lastId)s-=15; /* hard block consecutive same watch */
        if(plan.length>1&&plan[plan.length-2]&&plan[plan.length-2].watch&&plan[plan.length-2].watch.id===w.id)s-=10; /* 2-day minimum gap */
        /* ══ UPGRADE: Dial color variety — penalize consecutive same dial color ══ */
        if(plan.length>0){var _prevW=plan[plan.length-1].watch;if(_prevW&&_prevW.d&&w.d&&_prevW.d.toLowerCase()===w.d.toLowerCase())s-=4}
        if(plan.length>1){var _prev2W=plan[plan.length-2]&&plan[plan.length-2].watch;if(_prev2W&&_prev2W.d&&w.d&&_prev2W.d.toLowerCase()===w.d.toLowerCase())s-=2}
        var types=plan.map(function(p){return p.watch?p.watch.t:""});
        var gc=types.filter(function(t){return t==="genuine"}).length;
        var rc=types.filter(function(t){return t==="replica"}).length;
        if(w.t==="genuine"&&rc>gc)s+=1;
        if(w.t==="replica"&&gc>rc)s+=1;
        var lastWorn=dsw[w.id];
        if(lastWorn){var daysAgo=Math.floor((now-lastWorn)/(24*60*60*1000));if(daysAgo<=1)s-=4;else if(daysAgo<=3)s-=1;else if(daysAgo>=7)s+=2;else if(daysAgo>=14)s+=3}
        else{s+=1}
        /* Weather condition scoring — rain favors bracelets & rubber */
        var dayRain=fc&&fc.cond&&fc.cond.rain;
        if(dayRain){
          if(w.straps&&w.straps.length){
            var _hasWR=w.straps.some(function(s2){return s2.type==="bracelet"||s2.type==="rubber"||s2.type==="mesh"});
            var _onlyL=w.straps.every(function(s2){return s2.type==="leather"});
            if(_hasWR)s+=3;if(_onlyL)s-=2;
          }else{if(w.br)s+=3;else s-=2}
        }
        return Object.assign({},w,{rotScore:s});
      }).sort(function(a,b){return b.rotScore-a.rotScore});
      pick=scored[0]||null;
    }
    if(pick){used[pick.id]=true;lastId=pick.id}
    /* Generate top outfit for this day's watch+context+weather */
    var dayFit=null;var altFits=[];
    var dayWxOpts=fc?{rain:fc.cond&&fc.cond.rain,wind:fc.wind||0,uv:fc.uv||0,rainPct:fc.rainPct||0,lat:lat}:null;
    if(pick&&wardrobe&&wardrobe.filter(function(z){return!z.archived}).length>=2){
      var dayFits=genFits(wardrobe,[pick],cx,true,dayWt,4,{wx:dayWxOpts,temp:fc?fc.feelsAvg:18,wearLog:wearLog,lat:lat});
      if(dayFits.length)dayFit=dayFits[0];
      altFits=dayFits.slice(1,4);
    }
    plan.push({day:d,dayIdx:dayIdx,dayName:dayName,date:fc?fc.date:"",context:cx,tier:dayTier,weight:dayWt,watch:pick,forecast:fc,outfit:dayFit,altOutfits:altFits,locked:!!lockedWatch,
      strapPick:(function(){if(!pick)return null;var pw=pick.straps&&pick.straps.length?pick:migrateStraps(pick);if(pw.straps&&pw.straps.length>1&&dayFit)return strapRec(pw,dayFit.items,cx,dayWxOpts);if(pw.straps&&pw.straps.length===1)return{text:pw.straps[0].type==="bracelet"?"⛓️ Bracelet"+(pw.straps[0].material?" ("+pw.straps[0].material+")":""):pw.straps[0].color+" "+pw.straps[0].type,type:"info",strap:pw.straps[0]};return null})()});
  }
  /* Cross-day dedup: if consecutive days share same top+bot, swap second day to alt */
  for(var dd=0;dd<plan.length-1;dd++){
    var a=plan[dd],b=plan[dd+1];
    if(a.outfit&&b.outfit&&a.outfit.top&&b.outfit.top&&a.outfit.bot&&b.outfit.bot&&a.outfit.top.id===b.outfit.top.id&&a.outfit.bot.id===b.outfit.bot.id){
      if(b.altOutfits&&b.altOutfits.length){var alt=b.altOutfits.find(function(af){return!af.top||!af.bot||af.top.id!==a.outfit.top.id||af.bot.id!==a.outfit.bot.id});if(alt){b.outfit=alt;b.altOutfits=b.altOutfits.filter(function(af){return af!==alt})}}
    }
  }
  return plan;
}


export {
  getColorFamily, clearCompatCache, compat,
  scoreW, strapRec, getWarns, makeOutfit, genFits, getSwaps,
  genWeekRotation
};
