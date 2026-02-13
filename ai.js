/* ══════ ai.js — Claude API Integration (Scan, Vision, Recs, Audit) ══════ */
import { AC, IS_SHARED } from './data.js';

/* ══════ AI ERROR LOG (visible in UI) ══════ */
var _lastAiError="";
function getLastAiError(){return _lastAiError}

async function aiID(b64,mime,apiKey){
  _lastAiError="";
  try{
    var headers={"Content-Type":"application/json"};
    if(apiKey){headers["x-api-key"]=apiKey;headers["anthropic-version"]="2023-06-01";headers["anthropic-dangerous-direct-browser-access"]="true"}
    var r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:headers,
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:700,
        messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mime,data:b64}},{type:"text",text:"Identify ALL clothing items in this photo.\n\nRules:\n1. Full outfit shown? Return EACH piece separately.\n2. Single garment? Return one item.\n3. Layered? Identify each layer. Max 5 items.\n4. Note position in frame.\n\nYou MUST pick values from these EXACT lists only:\n\ngarmentType (pick ONE): Shirt, Polo, T-Shirt, Sweater/Knit, Jacket/Blazer, Pants/Trousers, Chinos, Jeans, Shorts, Shoes, Hat, Scarf, Belt, Bag, Sunglasses, Accessory\n\ncolor (pick ONE): "+AC.join(", ")+"\n\npattern (pick ONE): solid, plaid, striped, checked, print, textured\n\nmaterial (pick ONE or null): cotton, wool, linen, denim, leather, silk, cashmere, knit, corduroy, tweed, fleece, suede, canvas, nylon, chino, synthetic, jersey, poplin, oxford, chambray, pique, merino, seersucker, velvet\n\nseason_hint (pick ONE): all-season, warm-weather, cold-weather, transitional\n\nCOLOR ACCURACY IS CRITICAL: Navy vs black, charcoal vs grey, cream vs white, olive vs sage, burgundy vs brown, tan vs beige vs camel. Pick the CLOSEST match from the list above.\n\nReturn ONLY a JSON array:\n[{\\\"garmentType\\\":\\\"value\\\",\\\"name\\\":\\\"2-4 word name\\\",\\\"color\\\":\\\"from list above\\\",\\\"colorConfidence\\\":0.0-1.0,\\\"colorAlternatives\\\":[\\\"2nd best\\\",\\\"3rd best\\\"],\\\"pattern\\\":\\\"from list\\\",\\\"material\\\":\\\"from list or null\\\",\\\"materialConfidence\\\":0.0-1.0,\\\"position\\\":\\\"where in frame\\\",\\\"season_hint\\\":\\\"from list\\\",\\\"notes\\\":\\\"only if confidence<0.6 for any field\\\"}]\nIf only ONE item visible, still return array with one element."}]}]})});
    if(!r.ok){var errTxt=await r.text().catch(function(){return "(no body)"});_lastAiError="HTTP "+r.status+": "+errTxt.slice(0,120);return null}
    var d=await r.json();var txt=(d.content||[]).map(function(b){return b.text||""}).join("").replace(/```json|```/g,"").trim();
    var p=JSON.parse(txt);
    /* Handle both array and single object responses */
    if(Array.isArray(p)){if(p.length&&p[0].garmentType&&p[0].color)return p;_lastAiError="AI returned empty array";return null}
    if(p.garmentType&&p.color)return[p];
    _lastAiError="AI returned incomplete: "+JSON.stringify(p).slice(0,80);return null;
  }catch(e){_lastAiError="Exception: "+String(e.message||e).slice(0,120);return null}
}

async function aiVision(fit,watch,ctx,apiKey){
  _lastAiError="";
  var top=fit.top,bot=fit.bot,shoe=fit.shoe;
  var layers=fit.layers||fit.tops||[];
  var prompt="You are an elite men's luxury style advisor for high-net-worth clients. Analyze this outfit with the precision of a GQ editor and Savile Row tailor combined.\n\n";
  prompt+="OUTFIT DETAILS:\n";
  if(layers&&layers.length>1){
    layers.forEach(function(l,i){prompt+="- Layer "+(i+1)+": "+l.color+" "+(l.pattern||"solid")+" "+l.garmentType+(l.name?" ("+l.name+")":"")+(l.material?" ["+l.material+"]":"")+"\n"});
  }else if(top){prompt+="- Top: "+top.color+" "+(top.pattern||"solid")+" "+(top.garmentType||"")+(top.name?" ("+top.name+")":"")+(top.material?" ["+top.material+"]":"")+"\n"}
  if(bot)prompt+="- Bottom: "+bot.color+" "+(bot.pattern||"solid")+" "+(bot.garmentType||"")+(bot.name?" ("+bot.name+")":"")+(bot.material?" ["+bot.material+"]":"")+"\n";
  if(shoe)prompt+="- Shoes: "+shoe.color+" "+(shoe.name||shoe.garmentType||"shoes")+(shoe.material?" ["+shoe.material+"]":"")+"\n";
  prompt+="- Watch: "+watch.n+" — "+watch.d+" dial, "+(watch.straps&&watch.straps.length?watch.straps.map(function(s){return s.type+(s.material?" ("+s.material+")":"")+(s.color&&s.type!=="bracelet"?" in "+s.color:"")}).join(" + "):watch.br?"steel bracelet":"leather strap"+(watch.sc?" ("+watch.sc.join("/")+")":""))+(IS_SHARED?"":", "+(watch.t==="replica"?"replica":"genuine"))+"\n";
  prompt+="- Context: "+(Array.isArray(ctx)?ctx.join(" + "):ctx)+"\n\n";
  prompt+="Return ONLY valid JSON, no markdown fences:\n";
  prompt+='{"vision":"A 3-4 sentence cinematic, editorial description. Describe the man walking into the room — how fabrics drape, colors interact, and the watch catches light. Write like a luxury editorial spread.",';
  prompt+='"impact":1-10,"impact_why":"One sentence explaining the psychological impact on observers.",';
  prompt+='"color_story":"Analyze the color palette — is it monochrome, complementary, analogous, or triadic? Does the warm/cool balance work? (1-2 sentences).",';
  prompt+='"works":"What color/texture/material combinations create the strongest visual effect (1-2 sentences).",';
  prompt+='"risk":"Any clash, proportion issue, formality mismatch, color temperature conflict, or execution risk (1-2 sentences, or null if flawless).",';
  prompt+='"upgrade":"One specific change that would elevate this outfit even further (1 sentence).",';
  prompt+='"strap_call":"If watch has strap options, which one for this outfit and why (1 sentence, or null if bracelet)."}';
  try{
    var headers={"Content-Type":"application/json"};
    if(apiKey){headers["x-api-key"]=apiKey;headers["anthropic-version"]="2023-06-01";headers["anthropic-dangerous-direct-browser-access"]="true"}
    var r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:headers,
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,
        messages:[{role:"user",content:prompt}]})});
    if(!r.ok){_lastAiError="Vision HTTP "+r.status;return null}
    var d=await r.json();var txt=(d.content||[]).map(function(b){return b.text||""}).join("").replace(/```json|```/g,"").trim();
    return JSON.parse(txt);
  }catch(e){_lastAiError="Vision error: "+String(e.message||e).slice(0,100);return null}
}

async function aiStyleCoach(wardrobe,watches,ctx,apiKey){
  _lastAiError="";
  var colorCounts={};wardrobe.filter(function(i){return i.color}).forEach(function(i){colorCounts[i.color]=(colorCounts[i.color]||0)+1});
  var colors=Object.entries(colorCounts).sort(function(a,b){return b[1]-a[1]}).slice(0,10).map(function(e){return e[0]+" (×"+e[1]+")"}).join(", ");
  var types={};wardrobe.forEach(function(i){if(i.garmentType)types[i.garmentType]=(types[i.garmentType]||0)+1});
  var typeStr=Object.entries(types).sort(function(a,b){return b[1]-a[1]}).map(function(e){return e[0]+" ×"+e[1]}).join(", ");
  var watchStr=watches.map(function(w){return w.n+" ("+w.d+" dial, "+(w.straps&&w.straps.length?w.straps.map(function(s){return s.type}).join("+"):w.br?"bracelet":"strap")+")"}).join(", ");
  var prompt="You are an expert luxury men's style advisor. Analyze this wardrobe and give specific actionable advice.\n\n";
  prompt+="WARDROBE ("+wardrobe.length+" items):\n- Types: "+typeStr+"\n- Colors: "+colors+"\n";
  prompt+="WATCHES: "+watchStr+"\n";
  prompt+="Primary context: "+ctx+"\n\n";
  prompt+='Return ONLY valid JSON:\n{"summary":"2-3 sentence overall assessment — be specific about style identity and trajectory","strengths":["4-5 specific strengths with examples from the wardrobe"],"gaps":["4-5 specific gaps with recommended colors and pieces"],"next_buys":["5 specific items to buy next with exact color and brand tier suggestions"],"style_tip":"One expert styling tip personalized to this exact collection — reference specific pieces","seasonal_weak":"Which season needs most work and why (1 sentence)","signature_combos":["3 killer outfit combinations possible from the current wardrobe — use exact item names/colors"],"versatility":1-10}';
  try{
    var headers={"Content-Type":"application/json"};
    if(apiKey){headers["x-api-key"]=apiKey;headers["anthropic-version"]="2023-06-01";headers["anthropic-dangerous-direct-browser-access"]="true"}
    var r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:headers,
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
    if(!r.ok){_lastAiError="Coach HTTP "+r.status;return null}
    var d=await r.json();var txt=(d.content||[]).map(function(b){return b.text||""}).join("").replace(/```json|```/g,"").trim();
    return JSON.parse(txt);
  }catch(e){_lastAiError="Coach error: "+String(e.message||e).slice(0,100);return null}
}

async function aiOccasionPlan(occasion,wardrobe,watches,apiKey){
  _lastAiError="";
  var items=wardrobe.filter(function(i){return i.color&&!i.needsEdit}).map(function(i){return{type:i.garmentType,name:i.name||i.color,color:i.color,pattern:i.pattern||"solid",material:i.material||""}});
  var watchList=watches.map(function(w){return{name:w.n,ref:w.ref||null,size_mm:w.size||null,movement:w.mvmt||null,type:w.t==="replica"?"REP":"GEN",dial:w.d,bracelet:w.br,strap_colors:w.sc||[],straps:w.straps?w.straps.map(function(s){return{type:s.type,color:s.color,material:s.material}}):[]}}); 
  var prompt="You are a luxury men's style advisor. A client needs outfit recommendations for a specific occasion.\n\n";
  prompt+="OCCASION: "+occasion+"\n\n";
  prompt+="AVAILABLE WARDROBE ("+items.length+" items):\n"+JSON.stringify(items.slice(0,30))+"\n\n";
  prompt+="AVAILABLE WATCHES:\n"+JSON.stringify(watchList)+"\n\n";
  prompt+='Create 2 outfit recommendations from the available pieces. Return ONLY valid JSON:\n{"occasion_tips":"3-4 sentences of detailed advice for this specific occasion — dress code nuances, common mistakes, and power moves","outfits":[{"name":"Creative editorial outfit name","top":"exact item name/color from wardrobe","bottom":"exact item name/color","shoes":"exact item name/color or suggestion","watch":"exact watch name","layers":"optional mid/outer layer from wardrobe if weather warrants","why":"2 sentences explaining the color story and why this combination works","confidence":1-10},{"name":"...","top":"...","bottom":"...","shoes":"...","watch":"...","layers":"...","why":"...","confidence":1-10}],"avoid":"2 sentences on what to avoid for this occasion with specific examples","power_move":"One unexpected styling choice that would make a statement (1 sentence)"}';
  try{
    var headers={"Content-Type":"application/json"};
    if(apiKey){headers["x-api-key"]=apiKey;headers["anthropic-version"]="2023-06-01";headers["anthropic-dangerous-direct-browser-access"]="true"}
    var r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:headers,
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content:prompt}]})});
    if(!r.ok){_lastAiError="Occasion HTTP "+r.status;return null}
    var d=await r.json();var txt=(d.content||[]).map(function(b){return b.text||""}).join("").replace(/```json|```/g,"").trim();
    return JSON.parse(txt);
  }catch(e){_lastAiError="Occasion error: "+String(e.message||e).slice(0,100);return null}
}

async function aiWardrobeAudit(wardrobe,watches,saved,wearLog,apiKey){
  _lastAiError="";
  var colorCounts={};wardrobe.filter(function(i){return i.color}).forEach(function(i){colorCounts[i.color]=(colorCounts[i.color]||0)+1});
  var colors=Object.entries(colorCounts).sort(function(a,b){return b[1]-a[1]}).map(function(e){return e[0]+" ×"+e[1]}).join(", ");
  var types={};wardrobe.forEach(function(i){if(i.garmentType)types[i.garmentType]=(types[i.garmentType]||0)+1});
  var mats={};wardrobe.forEach(function(i){if(i.material)mats[i.material]=(mats[i.material]||0)+1});
  var prompt="You are a luxury men's wardrobe consultant performing a comprehensive audit.\n\n";
  prompt+="WARDROBE ("+wardrobe.length+" items):\n";
  prompt+="Types: "+Object.entries(types).map(function(e){return e[0]+" ×"+e[1]}).join(", ")+"\n";
  prompt+="Colors: "+colors+"\n";
  prompt+="Materials: "+Object.entries(mats).map(function(e){return e[0]+" ×"+e[1]}).join(", ")+"\n";
  prompt+="Watches: "+watches.length+" ("+watches.map(function(w){return w.n}).join(", ")+")\n";
  prompt+="Saved outfits: "+saved.length+"\n";
  prompt+="Wear log entries: "+wearLog.length+"\n\n";
  prompt+='Provide a comprehensive wardrobe audit. Return ONLY valid JSON:\n{"grade":"A+/A/B+/B/C+/C/D/F overall wardrobe grade","grade_why":"2 sentence detailed explanation of the grade","color_harmony":"Assessment of color palette balance — warm/cool ratio, missing neutrals, dominant tones (2-3 sentences)","versatility":"How many distinct looks possible, cross-functionality of pieces (2 sentences)","cost_efficiency":"Whether the wardrobe is well-optimized for max outfits per piece (1-2 sentences)","declutter":["Up to 5 specific items/categories that are redundant with reasoning"],"invest":["Up to 5 specific items worth investing in with price tier and color"],"seasonal_score":{"spring":1-10,"summer":1-10,"fall":1-10,"winter":1-10},"watch_wardrobe_synergy":"How well watches complement the wardrobe — specific matches and gaps (2-3 sentences)","style_identity":"What style archetype this wardrobe represents (1-2 sentences)","pro_tip":"One advanced styling insight specific to this collection (1-2 sentences)"}';
  try{
    var headers={"Content-Type":"application/json"};
    if(apiKey){headers["x-api-key"]=apiKey;headers["anthropic-version"]="2023-06-01";headers["anthropic-dangerous-direct-browser-access"]="true"}
    var r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:headers,
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1200,messages:[{role:"user",content:prompt}]})});
    if(!r.ok){_lastAiError="Audit HTTP "+r.status;return null}
    var d=await r.json();var txt=(d.content||[]).map(function(b){return b.text||""}).join("").replace(/```json|```/g,"").trim();
    return JSON.parse(txt);
  }catch(e){_lastAiError="Audit error: "+String(e.message||e).slice(0,100);return null}
}

/* ══════ AI WATCH RECOMMENDATION (stub) ══════ */
async function aiWatchRec(){return null}

/* ══════ AI WATCH IDENTIFICATION ══════ */
async function aiWatchID(b64,mime,apiKey){
  _lastAiError="";
  try{
    var headers={"Content-Type":"application/json"};
    if(apiKey){headers["x-api-key"]=apiKey;headers["anthropic-version"]="2023-06-01";headers["anthropic-dangerous-direct-browser-access"]="true"}
    var r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:headers,
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,
        messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mime,data:b64}},{type:"text",text:"You are an expert watch identifier for a luxury watch collection app. Analyze this watch photo and identify it.\n\nReturn ONLY valid JSON, no markdown:\n{\"brand\":\"Full brand name\",\"model\":\"Model name\",\"reference\":\"Reference number if identifiable or null\",\"dial_color\":\"Primary dial color description (e.g. Silver-White, Blue, Black, Teal, Burgundy, Green, White, Meteorite, Turquoise, Ivory, Purple)\",\"dial_hex\":\"Hex color code for the dial\",\"case_material\":\"steel/titanium/gold/rose gold/two-tone\",\"case_size\":\"Estimated size in mm or null\",\"movement_type\":\"automatic/manual/quartz/spring drive\",\"has_bracelet\":true/false,\"strap_type\":\"bracelet/leather/rubber/nato/canvas or null\",\"strap_color\":\"strap color or null\",\"complications\":[\"list of complications like chronograph, GMT, moon phase, perpetual calendar, date, day-date\"],\"style_category\":\"dress/sport/diver/pilot/chronograph/field/integrated\",\"suggested_contexts\":[\"formal\",\"clinic\",\"smart-casual\",\"casual\",\"date\",\"weekend\",\"riviera\",\"flex\",\"event\",\"travel\"],\"temperature\":\"warm/cool/neutral/mixed\",\"confidence\":1-10,\"emoji\":\"Single emoji that best represents this watch\",\"notes\":\"Any additional identification notes (1 sentence)\"}"}]}]})});
    if(!r.ok){var errTxt=await r.text().catch(function(){return "(no body)"});_lastAiError="WatchID HTTP "+r.status+": "+errTxt.slice(0,120);return null}
    var d=await r.json();var txt=(d.content||[]).map(function(b){return b.text||""}).join("").replace(/```json|```/g,"").trim();
    return JSON.parse(txt);
  }catch(e){_lastAiError="WatchID error: "+String(e.message||e).slice(0,120);return null}
}

/* ══════ AI SELFIE CHECK ══════ */
async function aiSelfieCheck(b64,mime,apiKey,watches,selWatch,ctx){
  _lastAiError="";
  try{
    var headers={"Content-Type":"application/json"};
    if(apiKey){headers["x-api-key"]=apiKey;headers["anthropic-version"]="2023-06-01";headers["anthropic-dangerous-direct-browser-access"]="true"}
    var r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:headers,
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,
        messages:[{role:"user",content:[{type:"image",source:{type:"base64",media_type:mime,data:b64}},{type:"text",text:"You are an elite men's luxury style advisor with encyclopedic horological knowledge.\n\nOWNER'S COLLECTION (ref numbers, sizes, movements for watch identification):\n"+JSON.stringify((watches||[]).map(function(w){return{name:w.n,ref:w.ref||null,size_mm:w.size||null,movement:w.mvmt||null,dial:w.d,bracelet:w.br,straps:w.straps?w.straps.map(function(s){return{type:s.type,color:s.color}}):[]}}),null,0)+"\n\n"+(selWatch?"CONFIRMED: "+selWatch.n+(selWatch.ref?" (Ref "+selWatch.ref+")":"")+(selWatch.size?" "+selWatch.size+"mm":"")+"\n":"")+"Context: "+(Array.isArray(ctx)?ctx.join(" + "):ctx||"smart-casual")+"\n\nAnalyze:\n1. Every visible garment — color, material, fit, proportion\n2. WATCH DETECTION — examine wrist for: case shape, dial color/texture, bezel, bracelet/strap, size. Match against collection using ref numbers.\n3. Color harmony, formality coherence\n4. CRITICAL: brown strap MUST match brown shoes, black strap MUST match black shoes\n5. Overall impression\n\nReturn ONLY valid JSON, no markdown:\n{\"impact\":1-10,\"impact_why\":\"One sentence on the psychological impression this look makes\",\"vision\":\"3-4 sentence cinematic editorial description of the look\",\"color_story\":\"Analysis of color palette — monochrome/complementary/analogous? Warm/cool balance? (2 sentences)\",\"fit_assessment\":\"How well do the clothes fit? Proportions correct? (1-2 sentences)\",\"works\":\"What specific elements create the strongest visual effect (1-2 sentences)\",\"risk\":\"Any clash, proportion issue, formality mismatch, or execution risk (1-2 sentences, or null if flawless)\",\"upgrade\":\"One specific change to elevate this look (1 sentence)\",\"strap_call\":\"Strap recommendation for the watch, or null if current is optimal (1 sentence)\",\"better_watch\":\"If a different watch from the collection would score higher, name it with ref and why (1 sentence, or null)\",\"watch_confidence\":1-10,\"watch_details\":\"What watch is visible and how it fits the outfit, or 'No watch visible' (1-2 sentences)\",\"items_detected\":[{\"type\":\"Top/Bottom/Shoes/Watch/Accessory\",\"color\":\"detected color\",\"description\":\"brief description\"}]}"}]}]})});
    if(!r.ok){var errTxt=await r.text().catch(function(){return "(no body)"});_lastAiError="Selfie HTTP "+r.status+": "+errTxt.slice(0,120);return null}
    var d=await r.json();var txt=(d.content||[]).map(function(b){return b.text||""}).join("").replace(/```json|```/g,"").trim();
    return JSON.parse(txt);
  }catch(e){_lastAiError="Selfie error: "+String(e.message||e).slice(0,120);return null}
}


export {
  getLastAiError, aiID, aiVision, aiOccasionPlan as aiOccasion,
  aiWardrobeAudit, aiWatchID, aiSelfieCheck
};
