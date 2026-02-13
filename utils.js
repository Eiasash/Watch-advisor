/* ══════ utils.js — Garment Utilities, Watch Parsing, Name Building ══════ */
import { CM, CATS, STRAP_HEX, CP } from './data.js';

/* ═══ AUTO GARMENT NAME BUILDER ═══ */
/* Builds "Color [Material] Type" name. Used when user changes color/material/type. */
function buildGarmentName(color,material,garmentType){
  var parts=[];
  if(color){parts.push(color.charAt(0).toUpperCase()+color.slice(1))}
  /* Include material only if it's not redundant with garmentType (e.g. skip "Denim Jeans", "Chino Chinos") */
  if(material){
    var mt=(material||"").toLowerCase(),gt=(garmentType||"").toLowerCase();
    var redundant=(mt==="denim"&&gt==="jeans")||(mt==="chino"&&gt==="chinos")||(mt==="leather"&&gt==="shoes")||(mt==="knit"&&(gt==="sweater/knit"||gt==="cardigan"));
    if(!redundant)parts.push(material.charAt(0).toUpperCase()+material.slice(1));
  }
  if(garmentType)parts.push(garmentType);
  return parts.join(" ")||"";
}
/* Garment type aliases — AI might say "Blazer" instead of "Jacket/Blazer" */
var _typeAliases={"jacket/blazer":["blazer","jacket","sport coat","sports coat"],"sweater/knit":["sweater","knit","knitwear","jumper","pullover"],"pants/trousers":["trousers","pants","slacks","dress pants"],"t-shirt":["tee","t shirt","tshirt"]};
function _typeWords(gt){
  if(!gt)return[];
  var lc=gt.toLowerCase();
  var words=[lc];
  Object.keys(_typeAliases).forEach(function(k){
    if(k===lc)words=words.concat(_typeAliases[k]);
    else if(_typeAliases[k].indexOf(lc)>=0)words.push(k);
    _typeAliases[k].forEach(function(a){if(a===lc)words.push(k)});
  });
  return words;
}
/* Check if a name looks auto-generated (matches "Color [Material] Type" pattern or is empty).
   Also detects AI-style names like "Navy Wool Blazer" where Type is an alias. */
function isAutoName(name,color,material,garmentType){
  if(!name||!name.trim())return true;
  var nm=name.trim().toLowerCase();
  /* Exact match against buildGarmentName combos */
  var candidates=[
    buildGarmentName(color,material,garmentType),
    buildGarmentName(color,null,garmentType),
    buildGarmentName(color,material,null),
    (color||"")+" "+(garmentType||"")
  ].map(function(s){return s.trim().toLowerCase()});
  if(candidates.indexOf(nm)>=0)return true;
  /* Fuzzy: also check with type aliases ("Blazer" ↔ "Jacket/Blazer") */
  var tw=_typeWords(garmentType);
  for(var i=0;i<tw.length;i++){
    var alt=[buildGarmentName(color,material,tw[i]),buildGarmentName(color,null,tw[i])].map(function(s){return s.trim().toLowerCase()});
    if(alt.indexOf(nm)>=0)return true;
  }
  /* Pattern: name is just color + optional material + any garment-ish word */
  if(color&&nm.indexOf(color.toLowerCase())===0){
    var rest=nm.slice(color.length).trim();
    if(!rest)return true; /* just the color */
    /* Check if the remaining text is just material + type or type alone */
    var matLc=(material||"").toLowerCase();
    if(matLc&&rest.indexOf(matLc)===0)rest=rest.slice(matLc.length).trim();
    var gtLc=(garmentType||"").toLowerCase();
    if(!rest)return true;
    if(rest===gtLc)return true;
    if(tw.indexOf(rest)>=0)return true;
  }
  return false;
}
function smartDefaults(ai){
  var d={};var gt=ai.garmentType;var nm=(ai.name||"").toLowerCase();
  /* Material inference */
  if(gt==="Jeans")d.material="denim";
  else if(gt==="Sweater/Knit"||gt==="Cardigan")d.material="knit";
  else if(gt==="Hoodie"||gt==="Sweatshirt")d.material="fleece";
  else if(gt==="Chinos")d.material="chino";
  else if(nm.includes("suede"))d.material="suede";
  else if(nm.includes("linen"))d.material="linen";
  else if(nm.includes("leather"))d.material="leather";
  else if(nm.includes("canvas"))d.material="canvas";
  else if(nm.includes("corduroy"))d.material="corduroy";
  else if(nm.includes("tweed"))d.material="tweed";
  else if(nm.includes("silk"))d.material="silk";
  else if(nm.includes("wool"))d.material="wool";
  else if(nm.includes("cashmere"))d.material="cashmere";
  else if(nm.includes("fleece"))d.material="fleece";
  else if(nm.includes("denim"))d.material="denim";
  /* Seasons inference */
  if(gt==="Shorts"||gt==="Tank Top")d.seasons=["spring","summer"];
  else if(gt==="Sweater/Knit"||gt==="Jacket/Blazer"||gt==="Cardigan"||gt==="Coat")d.seasons=["fall","winter"];
  else if(gt==="Hoodie"||gt==="Sweatshirt"||gt==="Vest/Gilet"||gt==="Overshirt")d.seasons=["spring","fall","winter"];
  else if(gt==="Jeans")d.seasons=["spring","summer","fall","winter"];
  else if(gt==="Shoes"){d.seasons=["spring","summer","fall","winter"];if(nm.includes("sandal")||nm.includes("espadrille")||nm.includes("flip"))d.seasons=["spring","summer"];else if(nm.includes("boot"))d.seasons=["fall","winter"]}
  else if(gt==="Chinos"||gt==="Pants/Trousers")d.seasons=["spring","summer","fall","winter"];
  else if(gt==="T-Shirt"||gt==="Polo"||gt==="Henley")d.seasons=["spring","summer"];
  else d.seasons=["spring","summer","fall","winter"];
  /* Refine seasons based on inferred material */
  if(d.material==="wool"||d.material==="cashmere"||d.material==="fleece"||d.material==="tweed"||d.material==="corduroy")d.seasons=["fall","winter"];
  else if(d.material==="linen")d.seasons=["spring","summer"];
  return d;
}
const DEFAULT_CX=[

/* ═══ MARKDOWN WATCH LOG PARSER ═══ */
function parseWatchLog(mdText, existingWatches){
  var lines=mdText.split("\n");
  var watches=[];
  var strapMap={};/* watchName -> straps[] */
  var section="";var subSection="";
  
  /* --- Phase 1: Parse watch tables --- */
  var genuineSection=false,replicaSection=false,strapSection=false,pendingSection=false;
  var currentStrapWatch="";
  
  for(var li=0;li<lines.length;li++){
    var line=lines[li].trim();
    
    /* Detect sections */
    if(line.match(/^###?\s+Genuine/i)){genuineSection=true;replicaSection=false;strapSection=false;pendingSection=false;continue}
    if(line.match(/^###?\s+Replica/i)){genuineSection=false;replicaSection=true;strapSection=false;pendingSection=false;continue}
    if(line.match(/^###?\s+Pending/i)){genuineSection=false;replicaSection=false;strapSection=false;pendingSection=true;continue}
    if(line.match(/^##\s+Strap Inventory/i)){genuineSection=false;replicaSection=false;strapSection=true;pendingSection=false;continue}
    if(line.match(/^##\s+(Wishlist|Passed|Traded|Collection by|Dial Color|Trade Summary|Watch Pref|Collection Gap|Strap Sizing|Strap Orders)/i)){strapSection=false;genuineSection=false;replicaSection=false;pendingSection=false;continue}
    
    /* Parse strap sub-sections */
    if(strapSection&&line.match(/^###\s+/)){
      currentStrapWatch=line.replace(/^###\s+/,"").replace(/\s*\([^)]*\)/g,"").trim();
      continue;
    }
    
    /* Parse table rows */
    if(!line.startsWith("|")||line.match(/^\|[-\s|]+$/)||line.match(/^\|\s*Watch\s*\|/i)||line.match(/^\|\s*Strap\s*\|/i)||line.match(/^\|\s*Specification/i)||line.match(/^\|\s*Gap/i)||line.match(/^\|\s*Color/i))continue;
    
    var cells=line.split("|").map(function(c){return c.trim()}).filter(Boolean);
    if(cells.length<2)continue;
    
    /* Genuine watches */
    if(genuineSection&&cells.length>=2){
      var name=cells[0];var details=cells[1]||"";
      var status="active";
      if(details.match(/PENDING TRADE|TRADING TOMORROW/i))status="pending-trade";
      if(details.match(/INCOMING/i))status="incoming";
      var dial=inferDial(name,details);
      var w={id:"md-"+slugify(name),n:name,t:"genuine",d:dial.color,c:dial.hex,br:false,sc:[],mt:dial.temp,i:dial.emoji,mc:autoMatchColors(dial.color),ac:[],cx:inferContexts(name,details),wt:[],sg:[],active:status!=="pending-trade",status:status,size:inferSize(details),ref:inferRef(details)};
      watches.push(w);
    }
    
    /* Replica watches */
    if(replicaSection&&cells.length>=2){
      var rName=cells[0];var rDetails=cells[1]||"";var rStatus=cells[2]||"";
      var st="active";
      if(rStatus.match(/INCOMING/i))st="incoming";
      var rd=inferDial(rName,rDetails);
      var rw={id:"md-"+slugify(rName),n:rName,t:"replica",d:rd.color,c:rd.hex,br:true,sc:[],mt:rd.temp,i:rd.emoji,mc:autoMatchColors(rd.color),ac:[],cx:inferContexts(rName,rDetails),wt:[],sg:[],active:true,status:st,size:inferSize(rDetails)};
      /* Detect bracelet vs strap from details */
      if(rDetails.match(/integrated|bracelet|steel/i))rw.br=true;
      watches.push(rw);
    }
    
    /* Pending acquisitions */
    if(pendingSection&&cells.length>=2){
      var pName=cells[0];var pStatus=cells[1]||"";var pDetails=cells[2]||"";
      var pd=inferDial(pName,pDetails);
      var pw={id:"md-"+slugify(pName),n:pName,t:"genuine",d:pd.color,c:pd.hex,br:true,sc:[],mt:pd.temp,i:pd.emoji,mc:autoMatchColors(pd.color),ac:[],cx:inferContexts(pName,pDetails),wt:[],sg:[],active:false,status:pStatus.match(/INCOMING/i)?"incoming":"pending-trade",size:inferSize(pDetails)};
      watches.push(pw);
    }
    
    /* Strap inventory rows */
    if(strapSection&&currentStrapWatch&&cells.length>=4){
      var strapDesc=cells[0];var source=cells[1]||"";var buckle=cells[2]||"";var useCase=cells[3]||"";
      var strap=parseStrapDesc(strapDesc,source);
      if(!strapMap[currentStrapWatch])strapMap[currentStrapWatch]=[];
      strapMap[currentStrapWatch].push(strap);
    }
  }
  
  /* --- Phase 2: Merge straps into watches --- */
  Object.keys(strapMap).forEach(function(strapWatchName){
    var straps=strapMap[strapWatchName];
    /* Try exact name match first, then best substring, then fuzzy */
    var matchW=watches.find(function(w){return w.n.toLowerCase()===strapWatchName.toLowerCase()});
    if(!matchW){var subs=watches.filter(function(w){var wl=w.n.toLowerCase(),sl=strapWatchName.toLowerCase();var isSubstr=sl.includes(wl)||wl.includes(sl);if(!isSubstr)return false;var shorter=Math.min(wl.length,sl.length),longer=Math.max(wl.length,sl.length);return shorter/longer>=0.5});if(subs.length)matchW=subs.reduce(function(a,b){return a.n.length>b.n.length?a:b})}
    if(!matchW)matchW=watches.find(function(w){return fuzzyMatch(w.n,strapWatchName)});
    if(matchW){
      matchW.straps=straps;
      matchW.br=straps.some(function(s){return s.type==="bracelet"});
      matchW.sc=straps.filter(function(s){return s.type!=="bracelet"}).map(function(s){return s.color});
    }
  });
  
  /* --- Phase 3: Detect bracelet watches without explicit straps --- */
  watches.forEach(function(w){
    if(!w.straps||!w.straps.length){
      if(w.br)w.straps=[{type:"bracelet",color:"silver",material:"steel"}];
      else if(w.sc&&w.sc.length)w.straps=w.sc.map(function(c){return{type:"leather",color:c,material:"calf leather"}});
      else w.straps=[{type:"bracelet",color:"silver",material:"steel"}];
    }
  });
  
  /* --- Phase 4: Merge with existing watches --- */
  if(existingWatches&&existingWatches.length){
    watches=watches.map(function(nw){
      var existing=existingWatches.find(function(ew){return fuzzyMatch(ew.n,nw.n)||ew.id===nw.id});
      if(existing){
        /* Preserve user customizations, update from markdown */
        return Object.assign({},existing,{
          status:nw.status,active:nw.active,
          straps:nw.straps&&nw.straps.length>1?nw.straps:existing.straps,
          br:nw.straps?nw.straps.some(function(s){return s.type==="bracelet"}):existing.br,
          sc:nw.straps?nw.straps.filter(function(s){return s.type!=="bracelet"}).map(function(s){return s.color}):existing.sc
        });
      }
      return nw;
    });
    /* Add existing watches not in markdown */
    existingWatches.forEach(function(ew){
      if(!watches.find(function(w){return fuzzyMatch(w.n,ew.n)||w.id===ew.id})){
        watches.push(ew);
      }
    });
  }
  
  return watches.map(migrateStraps);
}

/* Helper: slugify name to ID */
function slugify(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)}

/* Helper: fuzzy match watch names */
function fuzzyMatch(a,b){
  if(!a||!b)return false;
  var na=a.toLowerCase().replace(/[^a-z0-9]/g,"");
  var nb=b.toLowerCase().replace(/[^a-z0-9]/g,"");
  if(na===nb)return true;
  if(na.includes(nb)||nb.includes(na))return true;
  /* Token overlap */
  var ta=a.toLowerCase().split(/[\s-]+/).filter(function(t){return t.length>2});
  var tb=b.toLowerCase().split(/[\s-]+/).filter(function(t){return t.length>2});
  var overlap=ta.filter(function(t){return tb.some(function(u){return u.includes(t)||t.includes(u)})}).length;
  return(overlap>=2&&overlap/Math.max(ta.length,tb.length)>=0.6)||(overlap>=1&&Math.min(ta.length,tb.length)<=2&&Math.max(ta.length,tb.length)<=3);
}

/* Helper: infer dial color from name/details */
function inferDial(name,details){
  var text=(name+" "+details).toLowerCase();
  var dialMap=[
    {k:["snowflake","silver-white","silvery"],color:"Silver-White",hex:"#c8d0d8",temp:"cool",emoji:"❄️"},
    {k:["rikka","lighter green"],color:"Green",hex:"#5a8a6a",temp:"cool",emoji:"🌿"},
    {k:["ivory","sbgw267"],color:"Ivory",hex:"#f5f0e8",temp:"warm",emoji:"🪷"},
    {k:["blue hobnail","laureato"],color:"Blue",hex:"#2a5a9a",temp:"cool",emoji:"🔷"},
    {k:["reverso","navy blue"],color:"Navy",hex:"#1a2a4a",temp:"cool",emoji:"🌙"},
    {k:["meteorite"],color:"Meteorite",hex:"#6a6a7a",temp:"cool",emoji:"☄️"},
    {k:["turquoise","teal"],color:"Turquoise",hex:"#1a8a7a",temp:"cool",emoji:"💎"},
    {k:["burgundy","oxblood","wine","red dial"],color:"Burgundy",hex:"#6a1a2a",temp:"warm",emoji:"🍷"},
    {k:["purple","grape"],color:"Purple",hex:"#6a3a7a",temp:"cool",emoji:"🍇"},
    {k:["anthracite","grey dial"],color:"Anthracite",hex:"#5a6a7a",temp:"cool",emoji:"🏔️"},
    {k:["rose gold","red dial","rose"],color:"Red/Rose",hex:"#b04040",temp:"warm",emoji:"🌹"},
    {k:["green dial"],color:"Green",hex:"#2a5a3a",temp:"cool",emoji:"🍀"},
    {k:["black dial","black chronograph","black,"],color:"Black",hex:"#1a1a1a",temp:"cool",emoji:"⚫"},
    {k:["white dial","white,"],color:"White",hex:"#f0f0ec",temp:"neutral",emoji:"⚪"},
    {k:["blue dial","blue chronograph"],color:"Blue",hex:"#2a5a9a",temp:"cool",emoji:"🔵"},
    {k:["yellow gold","gold,"],color:"White/Gold",hex:"#d4af37",temp:"mixed",emoji:"💎"},
    {k:["champagne"],color:"Champagne",hex:"#d4c090",temp:"warm",emoji:"🥂"},
    {k:["speedmaster","moonwatch"],color:"Black",hex:"#1a1a1a",temp:"cool",emoji:"🌑"},
    {k:["flieger","laco","pilot"],color:"Black",hex:"#2a2a2a",temp:"cool",emoji:"✈️"},
  ];
  for(var i=0;i<dialMap.length;i++){
    for(var j=0;j<dialMap[i].k.length;j++){
      if(text.includes(dialMap[i].k[j]))return dialMap[i];
    }
  }
  return{color:"",hex:"#5a5a5a",temp:"cool",emoji:"⌚"};
}

/* Helper: infer contexts from name/details */
function inferContexts(name,details){
  var text=(name+" "+details).toLowerCase();
  var cx=[];
  if(text.match(/dress|elegance|reverso|santos octagon|tank/))cx.push("formal","date","event");
  if(text.match(/sport|gmt|diver|sea|aqua|tudor|omega|speedmaster/))cx.push("casual","smart-casual","travel");
  if(text.match(/chrono|monaco|flyback|pioneer/))cx.push("smart-casual","casual");
  if(text.match(/flieger|pilot|laco/))cx.push("casual","weekend");
  if(text.match(/perpetual|complication|moon|tourbillon/))cx.push("formal","date");
  if(text.match(/royal oak|overseas|laureato|ingenieur|alpine/))cx.push("smart-casual","flex","casual");
  if(text.match(/santos large|cartier/))cx.push("clinic","smart-casual","date");
  if(text.match(/grand seiko/))cx.push("clinic","smart-casual");
  if(text.match(/day-date|datejust|date /))cx.push("clinic","smart-casual","flex");
  if(!cx.length)cx.push("casual","smart-casual");
  return[...new Set(cx)];
}

/* Helper: infer size from details */
function inferSize(details){
  var m=details.match(/(\d{2})mm(?!\s*lug)/);
  return m?m[1]+"mm":null;
}

/* Helper: infer reference from details */
function inferRef(details){
  var m=details.match(/Ref\s+([A-Z0-9./-]+)/i);
  return m?m[1]:null;
}

/* Helper: parse strap description into {type, color, material} */
function parseStrapDesc(desc,source){
  var text=desc.toLowerCase();
  /* Detect type */
  var type="leather";
  if(text.match(/bracelet|steel|titanium|metal/))type="bracelet";
  else if(text.match(/nato/))type="nato";
  else if(text.match(/rubber|fkm|silicone/))type="rubber";
  else if(text.match(/canvas|sailcloth/))type="canvas";
  else if(text.match(/perlon/))type="perlon";
  else if(text.match(/mesh/))type="mesh";
  
  /* Detect material */
  var material="calf leather";
  if(text.includes("alligator"))material="alligator";
  else if(text.includes("cordovan"))material="cordovan";
  else if(text.includes("suede"))material="suede";
  else if(text.includes("nubuck"))material="nubuck";
  else if(text.includes("calfskin"))material="calf leather";
  else if(type==="bracelet")material="steel";
  else if(type==="nato")material="nylon";
  else if(type==="rubber")material="rubber";
  
  /* Detect color */
  var color="black";
  var colorMap=["grey","navy","brown","tan","honey","teal","burgundy","black","dark brown","light brown","green","olive","blue","white","beige","orange","red","purple","magenta"];
  for(var i=0;i<colorMap.length;i++){
    if(text.includes(colorMap[i])){
      color=colorMap[i];
      if(color==="honey")color="tan";
      if(color==="dark brown")color="brown";
      if(color==="light brown")color="tan";
      if(color==="magenta")color="burgundy";
      break;
    }
  }
  if(type==="bracelet")color="silver";
  
  return{type:type,color:color,material:material};
}


export {
  buildGarmentName, isAutoName, smartDefaults,
  parseWatchLog, slugify, fuzzyMatch,
  inferDial, inferContexts, inferSize, inferRef, parseStrapDesc
};
