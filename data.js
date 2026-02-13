/* ══════ data.js — Constants, Color Maps, Presets, Defaults ══════ */
/* Set IS_SHARED=true to create a version for friends (empty collection, onboarding) */
const IS_SHARED=false;
const SK="v14"; /* storage key suffix — change to reset data */

/* ══════ HEMISPHERE-AWARE SEASON ══════ */
/* Temperature-first, month fallback respects latitude for hemisphere */
function getSeason(temp,lat){
  if(temp!==undefined&&temp!==null){
    if(temp>=28)return"summer";if(temp>=20)return"spring";if(temp>=12)return"fall";return"winter";
  }
  var m=new Date().getMonth();
  /* Northern hemisphere (default): Mar-May spring, Jun-Aug summer, Sep-Nov fall, Dec-Feb winter */
  var nSeason;
  if(m>=2&&m<=4)nSeason="spring";else if(m>=5&&m<=7)nSeason="summer";else if(m>=8&&m<=10)nSeason="fall";else nSeason="winter";
  /* Southern hemisphere: flip seasons */
  if(lat!==undefined&&lat<0){
    var flip={"spring":"fall","summer":"winter","fall":"spring","winter":"summer"};
    return flip[nSeason]||nSeason;
  }
  return nSeason;
}

/* ══════ DATA ══════ */
const CM={
"black":{h:"#1a1a1a",t:"cool"},"white":{h:"#f0f0ec",t:"neutral"},"cream":{h:"#f5f0e0",t:"warm"},
"ivory":{h:"#f8f4ea",t:"warm"},"grey":{h:"#8a8a8a",t:"cool"},"light grey":{h:"#c0c0c0",t:"cool"},
"charcoal":{h:"#3a3a3a",t:"cool"},"navy":{h:"#1a2a4a",t:"cool"},"blue":{h:"#2a5a9a",t:"cool"},
"light blue":{h:"#7ab0d8",t:"cool"},"cobalt":{h:"#0047AB",t:"cool"},"teal":{h:"#1a8a7a",t:"cool"},
"turquoise":{h:"#2ab8a8",t:"cool"},"green":{h:"#2a6a3a",t:"cool"},"forest green":{h:"#1a4a2a",t:"cool"},
"olive":{h:"#5a6a3a",t:"warm"},"sage":{h:"#8aaa7a",t:"cool"},"red":{h:"#b83a3a",t:"warm"},
"burgundy":{h:"#6a1a2a",t:"warm"},"wine":{h:"#5a1a2a",t:"warm"},"plum":{h:"#6a2a5a",t:"warm"},
"pink":{h:"#d88a9a",t:"warm"},"orange":{h:"#d87a2a",t:"warm"},"burnt orange":{h:"#b85a2a",t:"warm"},
"yellow":{h:"#d4b82a",t:"warm"},"brown":{h:"#6a4a2a",t:"warm"},"tan":{h:"#c8a878",t:"warm"},
"camel":{h:"#c8a060",t:"warm"},"chocolate":{h:"#3a2a1a",t:"warm"},"khaki":{h:"#b8a878",t:"warm"},
"beige":{h:"#d8c8a8",t:"warm"},"lavender":{h:"#9a8abc",t:"cool"},"purple":{h:"#5a2a7a",t:"cool"},
"denim":{h:"#4a6a8a",t:"cool"},"dark brown":{h:"#4a3020",t:"warm"},"rust":{h:"#a84a2a",t:"warm"},
"sand":{h:"#c8b898",t:"warm"},"mint":{h:"#7ac8a8",t:"cool"},"slate":{h:"#6a7a8a",t:"cool"},
"gold":{h:"#c9a84c",t:"warm"},"mauve":{h:"#a07888",t:"warm"},"silver":{h:"#b0b0b0",t:"cool"},
"coral":{h:"#e87461",t:"warm"},"dusty rose":{h:"#c4867a",t:"warm"},"pewter":{h:"#8e9196",t:"cool"},
"mushroom":{h:"#b5a99a",t:"warm"},"charcoal blue":{h:"#36454f",t:"cool"},"stone":{h:"#bab5a8",t:"warm"},
"steel blue":{h:"#4682b4",t:"cool"},"taupe":{h:"#8b7d6b",t:"warm"},"indigo":{h:"#3f4fa1",t:"cool"},
"cognac":{h:"#9a4a2a",t:"warm"},"ecru":{h:"#c8b88a",t:"warm"},"powder blue":{h:"#a8c8e0",t:"cool"},
"emerald":{h:"#1a7a4a",t:"cool"},"copper":{h:"#b87333",t:"warm"},"graphite":{h:"#4a4a52",t:"cool"},
};
const AC=Object.keys(CM);
const CG=[
{l:"Neutrals",c:["black","charcoal","graphite","grey","light grey","pewter","silver","slate","white","cream","ivory","ecru","beige","sand","stone","mushroom","taupe"]},
{l:"Blues",c:["navy","indigo","cobalt","blue","steel blue","charcoal blue","light blue","powder blue","denim","teal","turquoise","mint"]},
{l:"Greens",c:["forest green","emerald","green","olive","sage"]},
{l:"Reds",c:["burgundy","wine","red","coral","dusty rose","rust","burnt orange","orange","copper"]},
{l:"Warm",c:["brown","dark brown","chocolate","cognac","tan","camel","khaki","gold","yellow"]},
{l:"Others",c:["plum","purple","lavender","mauve","pink"]},
];
const PATTERNS=["solid","plaid","striped","checked","print","textured"];
const MATERIALS=["cotton","linen","wool","cashmere","silk","denim","chino","suede","leather","canvas","synthetic","knit","tweed","corduroy","fleece","nylon"];

const DEFAULT_CX=[
{id:"clinic",l:"Clinic",icon:"🏥"},{id:"smart-casual",l:"Smart Casual",icon:"👔"},{id:"formal",l:"Formal",icon:"🎩"},
{id:"date",l:"Date",icon:"🌹"},{id:"riviera",l:"Riviera",icon:"🌊"},{id:"casual",l:"Casual",icon:"☀️"},
{id:"weekend",l:"Weekend",icon:"🛒"},{id:"flex",l:"Flex",icon:"💎"},{id:"travel",l:"Travel",icon:"✈️"},{id:"event",l:"Event",icon:"🎭"}];
const SHARE_DEFAULT_CX=[
{id:"office",l:"Office",icon:"💼"},{id:"smart-casual",l:"Smart Casual",icon:"👔"},{id:"formal",l:"Formal",icon:"🎩"},
{id:"date",l:"Date",icon:"🌹"},{id:"riviera",l:"Riviera",icon:"🌊"},{id:"casual",l:"Casual",icon:"☀️"},
{id:"weekend",l:"Weekend",icon:"🛒"},{id:"flex",l:"Flex",icon:"💎"},{id:"travel",l:"Travel",icon:"✈️"},{id:"event",l:"Event",icon:"🎭"}];
var ALL_CX=DEFAULT_CX.map(function(c){return c.id});
var CXI={};DEFAULT_CX.forEach(function(c){CXI[c.id]=c.icon});
const CATS={tops:["Shirt","Polo","T-Shirt","Henley","Tank Top","Sweater/Knit","Cardigan","Hoodie","Sweatshirt","Vest/Gilet","Jacket/Blazer","Coat","Overshirt"],bottoms:["Pants/Trousers","Chinos","Jeans","Shorts"],shoes:["Shoes"],accessories:["Hat","Scarf","Belt","Bag","Sunglasses","Accessory"]};
const ALL_T=[...CATS.tops,...CATS.bottoms,...CATS.shoes,...CATS.accessories];
const LAYER_BASE=["Shirt","Polo","T-Shirt","Henley","Tank Top"];
const LAYER_MID=["Sweater/Knit","Cardigan","Hoodie","Sweatshirt","Vest/Gilet"];
const LAYER_OUTER=["Jacket/Blazer","Coat","Overshirt"];
function layerOf(gt){return LAYER_BASE.includes(gt)?"base":LAYER_MID.includes(gt)?"mid":LAYER_OUTER.includes(gt)?"outer":"base"}
const catOf=g=>CATS.tops.includes(g)?"tops":CATS.bottoms.includes(g)?"bottoms":CATS.shoes.includes(g)?"shoes":CATS.accessories.includes(g)?"accessories":"other";
const EMOJIS=["⌚","❄️","🌿","🪷","🔷","🌙","💎","👑","🔴","🏁","⭐","🌍","✈️","🧭","🛩️","🍀","🔵","🌊","🍷","◻️","🏔️","🟢","☄️","💠","🌻","⚫","🔥","💜","🌑","🔺","🍇"];
const STRAP_TYPES=[
{id:"bracelet",l:"Bracelet",icon:"⛓️",mats:["steel","titanium","gold","rose gold","ceramic"]},
{id:"leather",l:"Leather",icon:"🔗",mats:["calf leather","alligator","cordovan","suede","shell cordovan","nubuck"]},
{id:"rubber",l:"Rubber",icon:"⬛",mats:["rubber","FKM rubber","silicone"]},
{id:"nato",l:"NATO",icon:"🎗️",mats:["nylon"]},
{id:"mesh",l:"Mesh",icon:"🔘",mats:["steel","titanium"]},
{id:"canvas",l:"Canvas",icon:"📐",mats:["canvas","sailcloth"]},
{id:"perlon",l:"Perlon",icon:"🧵",mats:["perlon"]}];
const STRAP_COLORS=["black","brown","tan","navy","grey","green","teal","burgundy","blue","white","olive","orange","red","beige"];
/* Strap color → hex for visual swatches */
const STRAP_HEX={
"black":"#1a1a1a","brown":"#6a4a2a","tan":"#c8a878","navy":"#1a2a4a","grey":"#8a8a8a",
"green":"#2a6a3a","teal":"#1a8a7a","burgundy":"#6a1a2a","blue":"#2a5a9a","white":"#f0f0ec",
"olive":"#5a6a3a","orange":"#d87a2a","red":"#b83a3a","beige":"#d8c8a8","silver":"#b0b0b0",
"gold":"#c9a84c","rose gold":"#b87a6a","light brown":"#a07848"
};
function strapHex(color){if(!color)return"#8a8a8a";var lc=color.toLowerCase();if(STRAP_HEX[lc])return STRAP_HEX[lc];if(CM[lc])return CM[lc].h;return"#8a8a8a"}
/* Strap swatch: renders a colored dot + type icon for visual identification */

/* Note: StrapSwatch is a React component — stays in app.js */

const STRAP_CTX={
"formal":{bracelet:1,leather:3,rubber:-2,nato:-2,mesh:1,canvas:-2,perlon:-1},
"clinic":{bracelet:2,leather:2,rubber:1,nato:0,mesh:1,canvas:0,perlon:0},
"smart-casual":{bracelet:2,leather:2,rubber:0,nato:0,mesh:1,canvas:0,perlon:0},
"date":{bracelet:1,leather:3,rubber:-1,nato:-1,mesh:1,canvas:-1,perlon:0},
"casual":{bracelet:1,leather:1,rubber:1,nato:1,mesh:1,canvas:1,perlon:1},
"weekend":{bracelet:1,leather:0,rubber:1,nato:2,mesh:0,canvas:1,perlon:1},
"riviera":{bracelet:2,leather:-1,rubber:3,nato:2,mesh:1,canvas:1,perlon:1},
"travel":{bracelet:1,leather:0,rubber:2,nato:2,mesh:0,canvas:1,perlon:1},
"event":{bracelet:1,leather:3,rubber:-2,nato:-2,mesh:1,canvas:-2,perlon:0},
"flex":{bracelet:2,leather:1,rubber:0,nato:0,mesh:1,canvas:0,perlon:0},
"office":{bracelet:1,leather:2,rubber:-1,nato:-1,mesh:1,canvas:-1,perlon:0}
};
const STS=[{id:"active",l:"Active",c:"var(--good)"},{id:"incoming",l:"Incoming",c:"#7ab8d8"},{id:"pending-trade",l:"Pending",c:"var(--warn)"},{id:"sold",l:"Sold",c:"var(--dim)"},{id:"service",l:"Service",c:"#b87ab8"}];
const WT_TIERS=[
{max:5,label:"Freezing",icon:"🥶",weight:"heavy",advice:"Heavy layers. Leather straps stay warm."},
{max:12,label:"Cold",icon:"🧥",weight:"heavy",advice:"Layer up: jacket + sweater."},
{max:18,label:"Cool",icon:"🧣",weight:"mid",advice:"Light jacket or sweater."},
{max:24,label:"Mild",icon:"👔",weight:"mid",advice:"Shirt sleeves or light knit."},
{max:30,label:"Warm",icon:"☀️",weight:"light",advice:"Light fabrics. Bracelets/rubber > leather."},
{max:50,label:"Hot",icon:"🔥",weight:"light",advice:"Steel bracelets or rubber only."},
];
const getWT=t=>WT_TIERS.find(x=>t<=x.max)||WT_TIERS[5];
/* WMO Weather Code decoder */
const WMO={0:{i:"☀️",l:"Clear",rain:false},1:{i:"🌤️",l:"Mostly Clear",rain:false},2:{i:"⛅",l:"Partly Cloudy",rain:false},3:{i:"☁️",l:"Overcast",rain:false},
45:{i:"🌫️",l:"Fog",rain:false},48:{i:"🌫️",l:"Rime Fog",rain:false},
51:{i:"🌦️",l:"Light Drizzle",rain:true},53:{i:"🌦️",l:"Drizzle",rain:true},55:{i:"🌧️",l:"Heavy Drizzle",rain:true},
56:{i:"🌧️",l:"Freezing Drizzle",rain:true},57:{i:"🌧️",l:"Heavy Frzg Drizzle",rain:true},
61:{i:"🌦️",l:"Light Rain",rain:true},63:{i:"🌧️",l:"Rain",rain:true},65:{i:"🌧️",l:"Heavy Rain",rain:true},
66:{i:"🧊",l:"Freezing Rain",rain:true},67:{i:"🧊",l:"Heavy Frzg Rain",rain:true},
71:{i:"🌨️",l:"Light Snow",rain:false},73:{i:"🌨️",l:"Snow",rain:false},75:{i:"❄️",l:"Heavy Snow",rain:false},
77:{i:"🌨️",l:"Snow Grains",rain:false},
80:{i:"🌦️",l:"Light Showers",rain:true},81:{i:"🌧️",l:"Showers",rain:true},82:{i:"⛈️",l:"Heavy Showers",rain:true},
85:{i:"🌨️",l:"Snow Showers",rain:false},86:{i:"❄️",l:"Heavy Snow Showers",rain:false},
95:{i:"⛈️",l:"Thunderstorm",rain:true},96:{i:"⛈️",l:"T-Storm + Hail",rain:true},99:{i:"⛈️",l:"T-Storm + Heavy Hail",rain:true}};
const getWMO=c=>WMO[c]||{i:"❓",l:"Unknown",rain:false};

const WATCH_PRESETS=[
{id:"p-aw",n:"Apple Watch",d:"Black",c:"#1a1a1a",br:true,sc:[],mt:"cool",i:"⌚",mc:["black","grey","navy","white","charcoal"],ac:[],cx:["casual","weekend","clinic","travel"],wt:["light","mid","heavy"]},
{id:"p-gshock",n:"G-Shock",d:"Black",c:"#2a2a2a",br:true,sc:[],mt:"cool",i:"💪",mc:["black","olive","navy","grey","khaki"],ac:["formal"],cx:["casual","weekend","travel"],wt:["light","mid","heavy"]},
{id:"p-seiko5",n:"Seiko 5",d:"Blue",c:"#2a5a9a",br:true,sc:[],mt:"cool",i:"🔵",mc:["navy","white","cream","grey","light blue"],ac:[],cx:["casual","smart-casual","weekend"],wt:["light","mid","heavy"]},
{id:"p-sub",n:"Submariner-style",d:"Black",c:"#1a1a1a",br:true,sc:[],mt:"cool",i:"🤿",mc:["black","navy","white","grey","olive"],ac:[],cx:["casual","smart-casual","weekend","riviera","travel"],wt:["light","mid","heavy"]},
{id:"p-tank",n:"Tank-style",d:"White",c:"#f0f0ec",br:false,sc:["black"],mt:"cool",i:"🏛️",mc:["white","charcoal","navy","cream","black"],ac:["casual"],cx:["formal","date","smart-casual","clinic"],wt:["mid","heavy"]},
{id:"p-chrono",n:"Chronograph",d:"Black",c:"#1a1a1a",br:true,sc:[],mt:"cool",i:"⏱️",mc:["black","navy","white","grey","charcoal"],ac:[],cx:["smart-casual","casual","weekend"],wt:["light","mid","heavy"]},
{id:"p-dress",n:"Dress Watch",d:"White",c:"#f5f0e8",br:false,sc:["brown"],mt:"warm",i:"👔",mc:["cream","white","charcoal","navy","tan","burgundy"],ac:["casual"],cx:["formal","date","smart-casual","clinic"],wt:["mid","heavy"]},
{id:"p-field",n:"Field Watch",d:"Green",c:"#3a5a3a",br:false,sc:["brown","olive"],mt:"cool",i:"🧭",mc:["olive","khaki","cream","brown","tan","navy"],ac:["formal"],cx:["casual","weekend","travel"],wt:["light","mid","heavy"]},
];
const GARMENT_PRESETS=[
{garmentType:"Shirt",name:"White Shirt",color:"white",pattern:"solid"},
{garmentType:"Shirt",name:"Light Blue Shirt",color:"light blue",pattern:"solid"},
{garmentType:"T-Shirt",name:"Black T-Shirt",color:"black",pattern:"solid"},
{garmentType:"T-Shirt",name:"Grey T-Shirt",color:"grey",pattern:"solid"},
{garmentType:"T-Shirt",name:"Navy T-Shirt",color:"navy",pattern:"solid"},
{garmentType:"T-Shirt",name:"White T-Shirt",color:"white",pattern:"solid"},
{garmentType:"Chinos",name:"Navy Chinos",color:"navy",pattern:"solid"},
{garmentType:"Chinos",name:"Khaki Chinos",color:"khaki",pattern:"solid"},
{garmentType:"Chinos",name:"Charcoal Chinos",color:"charcoal",pattern:"solid"},
{garmentType:"Jeans",name:"Blue Jeans",color:"denim",pattern:"solid"},
{garmentType:"Jeans",name:"Black Jeans",color:"black",pattern:"solid"},
{garmentType:"Shorts",name:"Navy Shorts",color:"navy",pattern:"solid"},
{garmentType:"Shorts",name:"Khaki Shorts",color:"khaki",pattern:"solid"},
{garmentType:"Shoes",name:"White Sneakers",color:"white",pattern:"solid"},
{garmentType:"Shoes",name:"Black Shoes",color:"black",pattern:"solid"},
{garmentType:"Shoes",name:"Brown Shoes",color:"brown",pattern:"solid"},
{garmentType:"Polo",name:"Navy Polo",color:"navy",pattern:"solid"},
{garmentType:"Polo",name:"White Polo",color:"white",pattern:"solid"},
{garmentType:"Sweater/Knit",name:"Grey Sweater",color:"grey",pattern:"solid"},
{garmentType:"Jacket/Blazer",name:"Navy Blazer",color:"navy",pattern:"solid"},
{garmentType:"Shoes",name:"Brown Lace-ups",color:"brown",pattern:"solid"},
{garmentType:"Hoodie",name:"Grey Hoodie",color:"grey",pattern:"solid"},
{garmentType:"Hoodie",name:"Black Hoodie",color:"black",pattern:"solid"},
{garmentType:"Cardigan",name:"Navy Cardigan",color:"navy",pattern:"solid"},
{garmentType:"Cardigan",name:"Grey Cardigan",color:"grey",pattern:"solid"},
{garmentType:"Vest/Gilet",name:"Navy Vest",color:"navy",pattern:"solid"},
{garmentType:"Henley",name:"White Henley",color:"white",pattern:"solid"},
{garmentType:"Henley",name:"Grey Henley",color:"grey",pattern:"solid"},
{garmentType:"Coat",name:"Charcoal Coat",color:"charcoal",pattern:"solid"},
{garmentType:"Coat",name:"Navy Coat",color:"navy",pattern:"solid"},
{garmentType:"Overshirt",name:"Olive Overshirt",color:"olive",pattern:"solid"},
{garmentType:"Sweatshirt",name:"Grey Sweatshirt",color:"grey",pattern:"solid"},
{garmentType:"Tank Top",name:"White Tank Top",color:"white",pattern:"solid"},
];

function autoMatchColors(dialColor){
  var dc=(dialColor||"").toLowerCase().trim();
  var key=Object.keys(CP).find(function(k){return dc.includes(k)||k.includes(dc)});
  if(key)return CP[key].slice(0,8);
  return["white","cream","navy","charcoal","grey","black","tan","light blue"];
}

const _OWNER_DEFAULTS=[
{id:"snowflake",n:"GS Snowflake",t:"genuine",d:"Silver-White",c:"#c8d0d8",straps:[
  {type:"leather",color:"grey",material:"alligator",source:"Gentry Tao",buckle:"GS script pin"},
  {type:"leather",color:"navy",material:"alligator",source:"DayDayWatchband",buckle:"deployant",notes:"Blue contrast stitch, 19→18mm taper"}
],mt:"cool",i:"❄️",mc:["grey","navy","white","light blue","charcoal","silver","lavender","slate"],ac:["orange","red"],cx:["clinic","formal","smart-casual"],sg:"Grey→dark shoes. Navy→navy outfits.",wt:["light","mid","heavy"],active:true,status:"active",ref:"SBGA211",size:41,lug:19,mvmt:"Spring Drive 9R65"},
{id:"rikka",n:"GS Rikka",t:"genuine",d:"Green",c:"#5a8a6a",straps:[
  {type:"leather",color:"teal",material:"alligator",source:"Gentry Tao",buckle:"Seiko script pin"},
  {type:"leather",color:"brown",material:"calf leather",buckle:"pin"}
],mt:"cool",i:"🌿",mc:["cream","ivory","sage","olive","teal","khaki","tan","forest green","white"],ac:["black","bright red"],cx:["smart-casual","date","weekend"],sg:"Teal→brown shoes. Brown leather→smart casual.",wt:["light","mid"],active:true,status:"active",ref:"SBGH351",size:40,lug:21,mvmt:"Hi-Beat 36000 9S85"},
{id:"sbgw267",n:"GS SBGW267",t:"genuine",d:"Ivory",c:"#f5f0e8",straps:[
  {type:"leather",color:"burgundy",material:"alligator",source:"Gentry Tao",buckle:"GS script pin",notes:"Reads purple/magenta, not true oxblood"},
  {type:"leather",color:"burgundy",material:"alligator",source:"DayDayWatchband",buckle:"pin",notes:"Redundant with Gentry Tao — both read purple"},
  {type:"leather",color:"tan",material:"calf leather",buckle:"pin",notes:"Honey tone, white contrast stitch"}
],mt:"warm",i:"🪷",mc:["burgundy","plum","cream","mauve","ivory","charcoal","wine","tan","honey"],ac:["cobalt","neon"],cx:["formal","date","clinic","smart-casual"],sg:"Purple straps→oxblood shoes. Tan→brown Ecco lace-ups.",wt:["mid","heavy"],active:true,status:"active",ref:"SBGW267",size:37.3,lug:19,mvmt:"Manual 9S64"},
{id:"laureato",n:"GP Laureato",t:"genuine",d:"Blue",c:"#2a5a9a",straps:[
  {type:"bracelet",color:"silver",material:"steel"}
],mt:"cool",i:"🔷",mc:["white","cream","light grey","navy","cobalt","light blue","silver"],ac:["brown","olive"],cx:["riviera","smart-casual","flex","date"],sg:"Integrated bracelet only.",wt:["light","mid"],active:true,status:"active",ref:"81010",size:42,mvmt:"GP03300"},
{id:"reverso",n:"JLC Reverso",t:"genuine",d:"Navy",c:"#1a2a4a",straps:[
  {type:"leather",color:"navy",material:"alligator",buckle:"deployant"}
],mt:"cool",i:"🌙",mc:["white","charcoal","navy","dark grey","silver"],ac:["casual"],cx:["formal","clinic","event"],sg:"Navy→black/dark brown shoes.",wt:["mid","heavy"],active:true,status:"active",ref:"216.8.D3",size:42,mvmt:"Cal 986"},
{id:"santos-lg",n:"Santos Large",t:"genuine",d:"White/Gold",c:"#d4af37",straps:[
  {type:"bracelet",color:"silver",material:"steel",notes:"QuickSwitch"},
  {type:"leather",color:"brown",material:"calfskin",source:"Cartier OEM",buckle:"QuickSwitch deployant"}
],mt:"mixed",i:"💎",mc:["cream","white","light blue","tan","black","navy","gold"],ac:["neon"],cx:["clinic","smart-casual","date","riviera","flex"],sg:"Two-tone. QuickSwitch bracelet + brown calfskin. Most versatile.",wt:["light","mid","heavy"],active:true,status:"active",ref:"W2SA0009",size:39.8,mvmt:"1847MC"},
{id:"santos-oct",n:"Santos Octagon YG",t:"genuine",d:"White",c:"#c5a03a",straps:[
  {type:"leather",color:"brown",material:"alligator",buckle:"deployant",notes:"Brown alligator, stainless deployant, cream lining"}
],mt:"warm",i:"👑",mc:["cream","tan","camel","chocolate","ivory","gold","brown"],ac:["grey","navy","silver"],cx:["formal","date","flex"],sg:"Brown shoes mandatory.",wt:["mid","heavy"],active:true,status:"active",ref:"Vintage 1980s",size:29,mvmt:"Quartz"},
{id:"bb41",n:"Tudor BB41",t:"genuine",d:"Black/Red",c:"#8b1a1a",straps:[
  {type:"bracelet",color:"silver",material:"steel",source:"Tudor OEM",notes:"Five-link"},
  {type:"leather",color:"brown",material:"distressed leather",source:"Tudor OEM",buckle:"Tudor deployant",notes:"Rough-out finish, ecru stitching. Via Speedmaster trade."},
  {type:"leather",color:"black",material:"calf leather",buckle:"pin",notes:"White stitch, 22/22mm straight. Dressy/clinic."}
],mt:"cool",i:"🔴",mc:["black","grey","white","charcoal","dark green","navy","olive","rust","brown","tan"],ac:["pastel"],cx:["casual","weekend","smart-casual"],sg:"Bracelet default. Brown strap→brown shoes, warm tones. Black strap→clinic/dressy.",wt:["light","mid","heavy"],active:true,status:"active",ref:"7941A1A0RU",size:41,lug:22,mvmt:"MT5400 METAS"},
{id:"monaco",n:"TAG Monaco",t:"genuine",d:"Black",c:"#1a1a1a",straps:[
  {type:"leather",color:"black",material:"calf leather",buckle:"pin"}
],mt:"cool",i:"🏁",mc:["black","charcoal","white","navy"],ac:["brown","warm"],cx:["smart-casual","date","weekend"],sg:"Black shoes ONLY.",wt:["mid","heavy"],active:true,status:"active",ref:"CW2111",size:39,mvmt:"ETA 2894-2"},
{id:"gmt",n:"Rolex GMT-II",t:"genuine",d:"Black",c:"#2a2a2a",straps:[
  {type:"bracelet",color:"silver",material:"steel",source:"Rolex OEM"}
],mt:"cool",i:"🌍",mc:["black","navy","grey","white","olive"],ac:[],cx:["casual","travel","smart-casual"],sg:"PENDING TRADE→Alpine Eagle 8HF.",wt:["light","mid","heavy"],active:true,status:"pending-trade",ref:"116710LN",size:40,mvmt:"Cal 3186"},
{id:"alpine-8hf",n:"Chopard Alpine Eagle 8HF",t:"genuine",d:"Blue-Grey",c:"#5a6a7a",straps:[
  {type:"bracelet",color:"silver",material:"titanium"}
],mt:"cool",i:"🏔️",mc:["grey","navy","white","light blue","charcoal","silver","cream","slate"],ac:["orange","bright red"],cx:["clinic","smart-casual","date","flex","riviera"],sg:"GPHG Sports Watch. 8Hz movement. Replaces GMT-II.",wt:["light","mid","heavy"],active:false,status:"incoming",ref:"298600-3005",size:41,mvmt:"L.U.C 01.12-C 8Hz"},
{id:"hanhart",n:"Hanhart Pioneer",t:"genuine",d:"White/Teal",c:"#3a8a8a",straps:[
  {type:"leather",color:"teal",material:"leather",source:"Hanhart OEM",notes:"Yellow lining, statement"},
  {type:"leather",color:"black",material:"calf leather",buckle:"pin"},
  {type:"leather",color:"light brown",material:"calf leather",buckle:"pin"},
  {type:"leather",color:"green",material:"suede",buckle:"pin",notes:"Dark green rough-out, tan lining. Textured casual."},
  {type:"leather",color:"olive",material:"full grain leather",buckle:"pin",notes:"Sage/olive chunky, cream stitch. Field/military."},
  {type:"canvas",color:"grey",material:"canvas",buckle:"bronze pin",notes:"Grey woven canvas. Vintage tool watch vibe."}
],mt:"cool",i:"✈️",mc:["teal","cream","sage","white","burnt orange","olive","khaki","tan","black","grey"],ac:["formal"],cx:["casual","weekend","riviera","smart-casual"],sg:"Teal→statement. Black→versatile. Light brown→brown Eccos. Green suede→field. Olive→military. Canvas→vintage.",wt:["light","mid"],active:true,status:"active",ref:"417 ES",size:39,mvmt:"Flyback chronograph"},
{id:"laco",n:"Laco Flieger",t:"genuine",d:"Black",c:"#3a3a3a",straps:[
  {type:"leather",color:"brown",material:"distressed leather",buckle:"pin",notes:"Pilot style, aged"}
],mt:"cool",i:"🛩️",mc:["olive","brown","dark green","grey","khaki","tan"],ac:["silk","suits"],cx:["casual","weekend"],sg:"Rugged only.",wt:["mid","heavy"],active:true,status:"active",ref:"Type B",size:42,mvmt:"Manual wind"},
{id:"speedy",n:"Omega Speedmaster 3861",t:"genuine",d:"Black",c:"#1a1a1a",straps:[
  {type:"bracelet",color:"silver",material:"steel",source:"Omega OEM"},
  {type:"leather",color:"teal",material:"Buttero Italian veg-tanned",buckle:"pin",notes:"Dark teal, cream stitch. Statement."},
  {type:"leather",color:"black",material:"calf leather",buckle:"pin",notes:"Orange lining, white stitch. NASA heritage nod."},
  {type:"rubber",color:"navy",material:"leather/rubber hybrid",buckle:"pin",notes:"White stitch. Clinic/smart casual."},
  {type:"rubber",color:"white",material:"rubber",buckle:"pin",notes:"Perforated rally-style. Summer statement."},
  {type:"canvas",color:"navy",material:"canvas",buckle:"gold pin",notes:"Dark navy, gold stitch/buckle. Unconventional warm accent."},
  {type:"leather",color:"black",material:"grained leather",buckle:"gold butterfly deployant",notes:"Gold hardware on steel — intentional warm accent."},
  {type:"leather",color:"tan",material:"calf leather",buckle:"pin",notes:"Tan/honey, 20→18mm taper. Brown shoe pairing."},
  {type:"nato",color:"navy",material:"nylon",notes:"Navy/white/orange striped. Regatta casual."}
],mt:"neutral",i:"🌑",mc:["black","navy","white","grey","charcoal","cream","olive","denim","burgundy"],ac:[],cx:["clinic","smart-casual","casual","date","flex","weekend","travel","event"],sg:"Moonwatch. 9 strap options. Most versatile watch in collection.",wt:["mid","heavy"],active:true,status:"active",ref:"310.30.42.50.01.001",size:42,lug:20,mvmt:"Cal 3861 manual"},
{id:"iwc-perp",n:"IWC Perpetual",t:"replica",d:"Blue",c:"#1a3a7a",straps:[
  {type:"leather",color:"blue",material:"alligator",buckle:"deployant"}
],mt:"cool",i:"🔵",mc:["navy","charcoal","white","silver"],ac:["casual"],cx:["formal","date","flex"],sg:"Dark shoes only.",wt:["mid","heavy"],active:true,status:"active",size:42},
{id:"iwc-ing",n:"IWC Ingenieur",t:"replica",d:"Teal",c:"#1a8a7a",straps:[
  {type:"bracelet",color:"silver",material:"steel"}
],mt:"cool",i:"🌊",mc:["teal","cream","white","sage","turquoise","mint"],ac:["dark heavy"],cx:["riviera","smart-casual","flex"],sg:"Summer coastal.",wt:["light"],active:true,status:"active",size:40},
{id:"vc-perp",n:"VC Overseas Perp",t:"replica",d:"Burgundy",c:"#6a1a2a",straps:[
  {type:"bracelet",color:"silver",material:"steel"}
],mt:"cool",i:"🍷",mc:["burgundy","cream","plum","black","ivory","charcoal","wine"],ac:["cobalt"],cx:["date","formal","flex"],sg:"Fills burgundy gap.",wt:["mid","heavy"],active:true,status:"active",size:41.5},
{id:"santos-rep",n:"Santos 35mm",t:"replica",d:"White",c:"#e0d8c8",straps:[
  {type:"bracelet",color:"silver",material:"steel"}
],mt:"cool",i:"◻️",mc:["white","light blue","cream","grey"],ac:[],cx:["clinic","smart-casual"],sg:"Universal.",wt:["light","mid"],active:true,status:"active",size:35},
{id:"alpine-red",n:"Chopard Alpine",t:"replica",d:"Red",c:"#b83a3a",straps:[
  {type:"bracelet",color:"rose gold",material:"steel"}
],mt:"warm",i:"🔺",mc:["black","cream","burgundy","charcoal","white"],ac:["cool blues"],cx:["date","flex","riviera"],sg:"Rose gold. Black anchors.",wt:["light","mid"],active:true,status:"active",size:41},
{id:"ap-roc",n:"AP Royal Oak",t:"replica",d:"Green",c:"#1a5a2a",straps:[
  {type:"bracelet",color:"silver",material:"steel"}
],mt:"cool",i:"🟢",mc:["dark green","cream","white","olive","black","navy"],ac:["close greens"],cx:["smart-casual","flex","date"],sg:"Dark makes green pop.",wt:["mid","heavy"],active:true,status:"active",size:41},
{id:"gmt-met",n:"GMT Meteorite",t:"replica",d:"Meteorite",c:"#6a6a6a",straps:[
  {type:"bracelet",color:"silver",material:"steel"}
],mt:"cool",i:"☄️",mc:["grey","silver","charcoal","white","black"],ac:["warm earth"],cx:["flex","date"],sg:"Cool monochrome.",wt:["mid","heavy"],active:true,status:"active",size:40},
{id:"dd-turq",n:"Day-Date Turq",t:"replica",d:"Turquoise",c:"#2ab8a8",straps:[
  {type:"bracelet",color:"rose gold",material:"steel"}
],mt:"warm",i:"💠",mc:["white","cream","turquoise","tan","light blue","sand"],ac:["dark formal"],cx:["riviera","flex","date"],sg:"Pure summer.",wt:["light"],active:true,status:"active",size:36},
{id:"op-grape",n:"Rolex OP Grape",t:"replica",d:"Purple",c:"#6a3d7d",straps:[
  {type:"bracelet",color:"silver",material:"steel"}
],mt:"cool",i:"🍇",mc:["navy","white","cream","grey","charcoal","light blue","olive","tan","lavender"],ac:["orange","bright red"],cx:["casual","weekend","smart-casual","date","riviera"],sg:"Purple/grape dial. Bold statement.",wt:["light","mid"],active:true,status:"active",size:36},
{id:"breguet",n:"Breguet Tradition",t:"replica",d:"Black",c:"#0a0a0a",straps:[
  {type:"leather",color:"black",material:"alligator",buckle:"pin"}
],mt:"cool",i:"⚫",mc:["black","charcoal","white"],ac:["color","casual"],cx:["formal","date"],sg:"Black shoes only.",wt:["mid","heavy"],active:true,status:"active",size:40},
];
function migrateStraps(w){
  if(w.straps&&w.straps.length){
    var o=Object.assign({},w);
    o.br=o.straps.some(function(s){return s.type==="bracelet"});
    o.sc=o.straps.filter(function(s){return s.type!=="bracelet"}).map(function(s){return s.color});
    return o;
  }
  var straps=[];
  if(w.br)straps.push({type:"bracelet",color:"silver",material:"steel"});
  if(w.sc&&w.sc.length)w.sc.forEach(function(c){straps.push({type:"leather",color:c,material:"calf leather"})});
  if(!straps.length)straps.push({type:"bracelet",color:"silver",material:"steel"});
  return Object.assign({},w,{straps:straps});
}
const DEFAULTS=IS_SHARED?[]:_OWNER_DEFAULTS.map(migrateStraps);
const _OWNER_WARDROBE=[
{id:"ow-blazer-camel",garmentType:"Jacket/Blazer",name:"Camel Wool Blazer",color:"camel",pattern:"solid",active:true,ts:1},
{id:"ow-hoodie-grey",garmentType:"Sweater/Knit",name:"Grey Zip Hoodie",color:"grey",pattern:"solid",active:true,ts:2},
{id:"ow-sweater-ltblue",garmentType:"Sweater/Knit",name:"Light Blue Cable Sweater",color:"light blue",pattern:"textured",active:true,ts:3},
{id:"ow-sweater-black",garmentType:"Sweater/Knit",name:"Black Cable Knit Sweater",color:"black",pattern:"textured",active:true,ts:4},
{id:"ow-coat-camel",garmentType:"Jacket/Blazer",name:"Camel Wool Coat",color:"camel",pattern:"solid",active:true,ts:5},
{id:"ow-shirt-plaid-brown",garmentType:"Shirt",name:"Plaid Button Down Shirt",color:"brown",pattern:"plaid",active:true,ts:6},
{id:"ow-shirt-plaid-blue",garmentType:"Shirt",name:"Blue Plaid Flannel Shirt",color:"blue",pattern:"plaid",active:true,ts:7},
{id:"ow-cardigan-beige",garmentType:"Sweater/Knit",name:"Beige Ribbed Cardigan",color:"beige",pattern:"textured",active:true,ts:8},
{id:"ow-shirt-stripe",garmentType:"Shirt",name:"Striped Button-Up Shirt",color:"cream",pattern:"striped",active:true,ts:9},
{id:"ow-shirt-dot-blue",garmentType:"Shirt",name:"Blue Dotted Dress Shirt",color:"blue",pattern:"print",active:true,ts:10},
{id:"ow-shirt-plaid-multi",garmentType:"Shirt",name:"Multicolor Plaid Flannel Shirt",color:"cream",pattern:"plaid",active:true,ts:11},
{id:"ow-cardigan-grey",garmentType:"Jacket/Blazer",name:"Light Grey Knit Cardigan",color:"light grey",pattern:"textured",active:true,ts:12},
{id:"ow-shirt-dot-cream",garmentType:"Shirt",name:"Cream Dotted Button Shirt",color:"cream",pattern:"print",active:true,ts:13},
{id:"ow-jeans-dist",garmentType:"Jeans",name:"Distressed Blue Jeans",color:"denim",pattern:"solid",active:true,ts:14},
{id:"ow-jeans-light",garmentType:"Jeans",name:"Light Wash Denim Jeans",color:"denim",pattern:"solid",active:true,ts:15},
/* ── ESSENTIALS (photograph these to add photos) ── */
{id:"ow-shoe-ecco",garmentType:"Shoes",name:"Brown Ecco Lace-ups",color:"brown",pattern:"solid",active:true,ts:16},
{id:"ow-shoe-white",garmentType:"Shoes",name:"White Sneakers",color:"white",pattern:"solid",active:true,ts:17},
{id:"ow-shoe-formal",garmentType:"Shoes",name:"Formal Black Shoes",color:"black",pattern:"solid",active:true,ts:18}
];
const WD_DEFAULTS=IS_SHARED?[]:_OWNER_WARDROBE;

/* ══════ SCORING (null-safe) ══════ */
const CP={
"black":["white","grey","charcoal","light grey","red","navy","cream","silver","gold","burgundy","cobalt","coral","pewter","graphite","powder blue"],
"white":["navy","black","cobalt","teal","grey","cream","light blue","burnt orange","olive","burgundy","charcoal","forest green","red","coral","indigo","emerald","steel blue"],
"cream":["navy","olive","teal","burgundy","brown","tan","sage","burnt orange","forest green","charcoal","wine","plum","cobalt","dark brown","cognac","dusty rose","copper","emerald","indigo"],
"ivory":["navy","olive","burgundy","brown","tan","sage","charcoal","wine","forest green","cobalt","cognac","copper","emerald","dusty rose","teal"],
"navy":["white","cream","light grey","tan","khaki","light blue","grey","gold","burnt orange","ivory","beige","sand","camel","coral","dusty rose","copper","cognac","ecru","stone","powder blue"],
"grey":["white","navy","black","charcoal","light blue","burgundy","teal","lavender","wine","cobalt","cream","dusty rose","coral","pewter","steel blue","powder blue"],
"light grey":["navy","charcoal","cobalt","burgundy","teal","forest green","plum","white","coral","dusty rose","steel blue","indigo"],
"charcoal":["white","cream","light grey","light blue","lavender","burgundy","gold","teal","cobalt","ivory","beige","coral","dusty rose","pewter","powder blue","emerald","copper"],
"light blue":["white","cream","navy","grey","tan","khaki","charcoal","brown","camel","beige","cognac","taupe","stone"],
"teal":["cream","white","tan","khaki","burnt orange","sage","ivory","brown","beige","sand","camel","coral","copper","cognac","mushroom"],
"turquoise":["white","cream","tan","navy","sand","beige","khaki","coral","copper"],
"olive":["cream","white","tan","khaki","brown","burnt orange","navy","ivory","beige","sand","rust","cognac","mushroom","ecru","copper"],
"sage":["cream","ivory","brown","tan","white","khaki","burnt orange","olive","dusty rose","mushroom","stone","taupe"],
"burgundy":["cream","ivory","charcoal","black","grey","white","light grey","beige","camel","gold","stone","mushroom","ecru","taupe"],
"wine":["cream","ivory","charcoal","grey","white","gold","beige","stone","mushroom","taupe"],
"brown":["cream","white","tan","olive","navy","khaki","sage","ivory","beige","light blue","burnt orange","ecru","stone","mushroom","powder blue"],
"dark brown":["cream","ivory","tan","khaki","beige","white","camel","light blue","ecru","stone","mushroom","powder blue"],
"tan":["navy","white","olive","brown","cream","teal","cobalt","light blue","charcoal","forest green","burgundy","indigo","steel blue","emerald"],
"camel":["navy","white","charcoal","cobalt","cream","light blue","burgundy","forest green","indigo","steel blue","teal","emerald"],
"khaki":["navy","white","cobalt","teal","olive","brown","cream","burnt orange","charcoal","burgundy","forest green","indigo","steel blue","emerald"],
"beige":["navy","charcoal","cobalt","forest green","burgundy","brown","teal","olive","indigo","steel blue","emerald"],
"sand":["navy","cobalt","teal","olive","brown","charcoal","forest green","burgundy","indigo","steel blue","emerald"],
"denim":["white","cream","tan","khaki","navy","grey","olive","brown","burnt orange","camel","cognac","coral"],
"red":["black","charcoal","grey","white","navy","cream","graphite"],
"rust":["cream","olive","navy","tan","khaki","ivory","white","brown","teal","sage","mushroom","ecru"],
"burnt orange":["cream","navy","olive","khaki","teal","tan","ivory","white","charcoal","brown","sage","mushroom"],
"gold":["navy","charcoal","black","cream","burgundy","forest green","white","emerald","indigo","wine"],
"lavender":["charcoal","grey","navy","white","cream","light grey","pewter","graphite","slate"],
"plum":["cream","ivory","charcoal","grey","white","gold","light grey","stone","mushroom","taupe"],
"mauve":["cream","charcoal","grey","ivory","navy","white","mushroom","stone","taupe"],
"forest green":["cream","ivory","tan","khaki","white","beige","camel","brown","navy","cognac","copper","stone","mushroom","ecru"],
"mint":["navy","charcoal","white","cream","grey","chocolate","slate"],
"silver":["black","charcoal","navy","white","grey","cobalt","indigo","graphite"],
"cobalt":["white","cream","light grey","tan","khaki","beige","gold","camel","coral","copper"],
"slate":["white","cream","light blue","navy","tan","coral","dusty rose","powder blue"],
"blue":["white","cream","navy","grey","tan","khaki","charcoal","brown","camel","beige","light grey","coral","copper","cognac"],
"green":["cream","ivory","tan","khaki","white","beige","camel","brown","navy","olive","burnt orange","cognac","copper"],
"pink":["navy","charcoal","grey","white","cream","light grey","black","slate","pewter"],
"orange":["navy","white","cream","charcoal","teal","olive","brown","khaki","indigo"],
"yellow":["navy","charcoal","grey","white","cobalt","denim","olive","indigo"],
"purple":["cream","ivory","charcoal","grey","white","gold","light grey","silver","stone","mushroom"],
"chocolate":["cream","ivory","tan","khaki","beige","white","camel","light blue","navy","ecru","stone","mushroom","powder blue"],
"coral":["navy","white","cream","charcoal","teal","light grey","grey","pewter","slate","powder blue","denim","turquoise"],
"dusty rose":["navy","charcoal","grey","cream","white","light grey","olive","sage","pewter","slate","taupe","mushroom"],
"pewter":["white","navy","cream","burgundy","charcoal","black","cobalt","dusty rose","coral","teal","forest green"],
"mushroom":["navy","charcoal","burgundy","forest green","teal","cobalt","cream","white","olive","sage","plum","wine","indigo"],
"charcoal blue":["white","cream","tan","light grey","coral","dusty rose","beige","khaki","gold","ivory","sand"],
"stone":["navy","charcoal","burgundy","forest green","teal","cobalt","olive","brown","wine","plum","indigo","emerald"],
"steel blue":["white","cream","tan","khaki","beige","camel","coral","sand","ivory","brown","cognac"],
"taupe":["navy","cream","white","charcoal","burgundy","forest green","teal","cobalt","light blue","dusty rose","indigo"],
"indigo":["white","cream","tan","khaki","beige","gold","sand","camel","coral","ivory","light grey","copper","cognac"],
"cognac":["navy","cream","white","charcoal","ivory","light blue","olive","forest green","beige","teal","indigo","powder blue"],
"ecru":["navy","burgundy","charcoal","forest green","cobalt","olive","brown","teal","wine","plum","indigo","emerald"],
"powder blue":["navy","charcoal","tan","brown","cream","white","cognac","taupe","chocolate","dark brown","grey","khaki"],
"emerald":["cream","ivory","tan","white","khaki","gold","beige","camel","navy","charcoal","cognac","copper","sand"],
"copper":["navy","cream","white","teal","charcoal","olive","ivory","beige","forest green","cobalt","indigo","emerald"],
"graphite":["white","cream","light grey","light blue","coral","gold","powder blue","lavender","dusty rose","cobalt","teal"],
};
/* Color family mapping for smarter matching */
const COLOR_FAMILIES={
  "blacks":["black","charcoal","graphite"],
  "whites":["white","cream","ivory","ecru"],
  "greys":["grey","light grey","pewter","silver","slate","stone"],
  "blues":["navy","blue","cobalt","light blue","steel blue","powder blue","charcoal blue","indigo","denim"],
  "greens":["green","forest green","emerald","olive","sage","teal","mint"],
  "browns":["brown","dark brown","tan","camel","chocolate","cognac","taupe","mushroom","khaki"],
  "reds":["red","burgundy","wine","rust","coral","dusty rose","copper","burnt orange"],
  "purples":["purple","plum","lavender","mauve"],
};

const CXR={
"clinic":{no:["Shorts","Jeans","T-Shirt","Tank Top","Hoodie","Sweatshirt"]},
"smart-casual":{no:["Shorts","Tank Top","Hoodie","Sweatshirt"]},
"formal":{no:["T-Shirt","Shorts","Jeans","Polo","Henley","Tank Top","Hoodie","Sweatshirt","Overshirt"]},
"date":{no:["Shorts","T-Shirt","Tank Top","Hoodie","Sweatshirt"]},
"riviera":{no:[]},
"casual":{no:[]},
"weekend":{no:[]},
"flex":{no:["Shorts","Tank Top","Hoodie","Sweatshirt"]},
"travel":{no:[]},
"event":{no:["T-Shirt","Shorts","Tank Top","Hoodie","Sweatshirt"]},
"office":{no:["Shorts","T-Shirt","Jeans","Tank Top","Hoodie","Sweatshirt"]},
};


/* ══════ WATCH_META — versatility traits per watch ══════ */
export const WATCH_META = {

  "snowflake": {
    twoTone: false,
    steel: true,
    dialNeutral: true,
    isNeutralAnchor: true,
    dc: ["white", "silver"]
  },

  "rikka": {
    twoTone: false,
    steel: true,
    dialNeutral: false,
    isNeutralAnchor: false,
    dc: ["green"]
  },

  "sbgw267": {
    twoTone: false,
    steel: false,
    dialNeutral: true,
    isNeutralAnchor: false,
    dc: ["cream", "beige"]
  },

  "laureato": {
    twoTone: false,
    steel: true,
    dialNeutral: false,
    isNeutralAnchor: false,
    dc: ["blue"]
  },

  "reverso": {
    twoTone: false,
    steel: false,
    dialNeutral: true,
    isNeutralAnchor: true,
    dc: ["silver", "white"]
  },

  "santos-lg": {
    twoTone: true,
    steel: true,
    dialNeutral: true,
    isNeutralAnchor: true,
    dc: ["white", "silver"]
  },

  "santos-oct": {
    twoTone: true,
    steel: false,
    dialNeutral: true,
    isNeutralAnchor: false,
    dc: ["white", "silver"]
  },

  "bb41": {
    twoTone: false,
    steel: true,
    dialNeutral: true,
    isNeutralAnchor: true,
    dc: ["blue", "black"]
  },

  "monaco": {
    twoTone: false,
    steel: false,
    dialNeutral: false,
    isNeutralAnchor: false,
    dc: ["blue"]
  },

  "gmt": {
    twoTone: false,
    steel: true,
    dialNeutral: true,
    isNeutralAnchor: true,
    dc: ["black"]
  },

  "alpine-8hf": {
    twoTone: false,
    steel: true,
    dialNeutral: true,
    isNeutralAnchor: true,
    dc: ["black"]
  },

  "hamart": {
    twoTone: false,
    steel: false,
    dialNeutral: false,
    isNeutralAnchor: false
  },

  "laco": {
    twoTone: false,
    steel: false,
    dialNeutral: false,
    isNeutralAnchor: false,
    dc: ["black"]
  },

  "speedy": {
    twoTone: false,
    steel: true,
    dialNeutral: true,
    isNeutralAnchor: true,
    dc: ["black"]
  },

  "iwc-perp": {
    twoTone: false,
    steel: false,
    dialNeutral: true,
    isNeutralAnchor: false,
    dc: ["silver"]
  },

  "iwc-ing": {
    twoTone: false,
    steel: true,
    dialNeutral: false,
    isNeutralAnchor: false,
    dc: ["blue"]
  },

  "vc-perp": {
    twoTone: false,
    steel: true,
    dialNeutral: false,
    isNeutralAnchor: false,
    dc: ["blue"]
  },

  "santos-rep": {
    twoTone: true,
    steel: true,
    dialNeutral: true,
    isNeutralAnchor: true,
    dc: ["white", "silver"]
  },

  "alpine-rep": {
    twoTone: false,
    steel: false,
    dialNeutral: false,
    isNeutralAnchor: false
  },

  "ap-roc": {
    twoTone: false,
    steel: true,
    dialNeutral: false,
    isNeutralAnchor: false,
    dc: ["blue"]
  },

  "gmt-met": {
    twoTone: false,
    steel: true,
    dialNeutral: true,
    isNeutralAnchor: false,
    dc: ["black"]
  },

  "dd-turq": {
    twoTone: true,
    steel: false,
    dialNeutral: false,
    isNeutralAnchor: false,
    dc: ["turquoise"]
  },

  "op-grape": {
    twoTone: false,
    steel: true,
    dialNeutral: false,
    isNeutralAnchor: false,
    dc: ["purple"]
  },

  "breguet": {
    twoTone: false,
    steel: false,
    dialNeutral: true,
    isNeutralAnchor: false,
    dc: ["silver"]
  }

};



export {
  IS_SHARED, SK, getSeason,
  CM, AC, CG, PATTERNS, MATERIALS,
  DEFAULT_CX, SHARE_DEFAULT_CX, ALL_CX, CXI,
  CATS, ALL_T, LAYER_BASE, LAYER_MID, LAYER_OUTER, layerOf, catOf,
  EMOJIS, STRAP_TYPES, STRAP_COLORS, STRAP_HEX, strapHex,
  STRAP_CTX, STS, WT_TIERS, getWT, WMO, getWMO,
  WATCH_PRESETS, GARMENT_PRESETS,
  autoMatchColors,
  _OWNER_DEFAULTS, migrateStraps, DEFAULTS,
  _OWNER_WARDROBE, WD_DEFAULTS,
  CP, COLOR_FAMILIES, CXR,
  WATCH_META
};
