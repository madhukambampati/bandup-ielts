(function(){
"use strict";
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const MODS=[["listening","Listening","--lis"],["reading","Reading","--rea"],["writing","Writing","--wri"],["speaking","Speaking","--spk"]];
const LEVELS={beginner:"Beginner",intermediate:"Intermediate",advanced:"Advanced",professional:"Professional"};

/* ---------- state ---------- */
const KEY="bandup.v1";
let S={level:"beginner",target:6.5,exam:"",scores:{listening:null,reading:null,writing:null,speaking:null},plan:null};
try{const raw=localStorage.getItem(KEY);if(raw)S=Object.assign(S,JSON.parse(raw));}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ---------- AI (server route /api/ai) ---------- */
async function ai(mode,payload){
  let r;
  try{r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({mode,level:S.level},payload))});}
  catch(e){throw new Error("No internet connection. Check your network and try again.");}
  let j={};try{j=await r.json();}catch(e){}
  if(!r.ok)throw new Error(j.error||"The AI examiner could not finish. Please try again.");
  return j;
}
const aiErr=e=>(e&&e.message)||"The AI examiner could not finish. Please try again.";

/* ---------- band maths ---------- */
const LIS_T=[[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5],[0,2]];
const REA_T=[[39,9],[37,8.5],[35,8],[33,7.5],[30,7],[27,6.5],[23,6],[19,5.5],[15,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5],[0,2]];
function bandFrom(correct,total,T){const r=Math.round(correct/total*40);for(const [min,b] of T)if(r>=min)return {band:b,raw40:r};return {band:2,raw40:r};}
function overall(){
  const v=MODS.map(m=>S.scores[m[0]]).filter(x=>x!=null);
  if(v.length<4)return null;
  const avg=v.reduce((a,b)=>a+b,0)/4;const f=Math.floor(avg),d=avg-f;
  return d<.25?f:d<.75?f+.5:f+1;
}
const fmt=b=>b==null?"–":(Number.isInteger(b)?b.toFixed(1):String(b));
function setScore(mod,b){S.scores[mod]=b;save();renderTRF();renderNext();}

/* ---------- home ---------- */
function renderTRF(){
  const cells=MODS.map(([k,n,c])=>{const b=S.scores[k];const pct=b==null?0:b/9*100;
    return `<a class="trf-cell" href="#${k}"><span class="lab">${n}</span><span class="val ${b==null?"empty":""}">${fmt(b)}</span><span class="bar"><i style="width:${pct}%;background:var(${c})"></i></span></a>`;}).join("");
  const o=overall();
  $("#trfCells").innerHTML=cells+`<div class="trf-cell"><span class="lab">Overall</span><span class="val ${o==null?"empty":""}">${fmt(o)}</span><span class="bar"><i style="width:${o==null?0:o/9*100}%;background:var(--accent)"></i></span></div>`;
  const done=MODS.filter(m=>S.scores[m[0]]!=null).length;
  $("#trfNote").textContent=done===0?"No tests taken yet. Each score you earn fills a box.":done<4?`${done} of 4 modules done. Finish all four to see your overall band.`:(o>=S.target?`You are at or above your target of ${fmt(S.target)}. Keep it steady.`:`You need ${fmt(+(S.target-o).toFixed(1))} more to reach your target of ${fmt(S.target)}.`);
  $("#trfTarget").textContent="Target "+fmt(S.target);
  $("#lvlPill").textContent=`${LEVELS[S.level]} · Target ${fmt(S.target)}`;
}
function renderNext(){
  const missing=MODS.find(m=>S.scores[m[0]]==null);
  let html;
  if(missing){html=`<span class="eyebrow">Your next step</span><h3>Take the ${missing[1]} test</h3><p>We need a score in every module to find your weakest skill.</p><a class="btn" href="#${missing[0]}">Start ${missing[1]}</a>`;}
  else{const w=MODS.slice().sort((a,b)=>S.scores[a[0]]-S.scores[b[0]])[0];
    html=`<span class="eyebrow">Your next step</span><h3>${w[1]} is your weakest module (${fmt(S.scores[w[0]])})</h3><p>Raising your lowest band moves the overall score fastest. Read the ${w[1]} tips, then try again.</p><div class="row"><a class="btn" href="#learn">Read ${w[1]} tips</a><a class="btn" style="background:transparent;color:var(--paper)" href="#${w[0]}">Practise ${w[1]}</a></div>`;}
  $("#nextBox").innerHTML=html;
}
function initHome(){
  const sel=$("#targetSel");for(let b=5;b<=9;b+=.5){const o=document.createElement("option");o.value=b;o.textContent="Band "+fmt(b);sel.appendChild(o);}
  sel.value=S.target;sel.onchange=()=>{S.target=+sel.value;save();renderTRF();};
  $("#examDate").value=S.exam||"";$("#examDate").onchange=e=>{S.exam=e.target.value;save();};
  document.querySelectorAll('input[name="lvl"]').forEach(r=>{r.checked=r.value===S.level;r.onchange=()=>{S.level=r.value;save();renderTRF();applyLevel();};});
  $("#lvlPill").onclick=()=>{location.hash="#home";setTimeout(()=>$("#levelCard").scrollIntoView({behavior:"smooth",block:"center"}),50);};
  let armed=false;
  $("#resetBtn").onclick=e=>{if(!armed){armed=true;e.target.textContent="Tap again to clear";setTimeout(()=>{armed=false;e.target.textContent="Clear scores";},3000);return;}
    S.scores={listening:null,reading:null,writing:null,speaking:null};save();renderTRF();renderNext();armed=false;e.target.textContent="Clear scores";};
  $("#planBtn").onclick=buildPlan;
  if(S.plan)renderPlan(S.plan);
}
async function buildPlan(){
  const out=$("#planOut"),btn=$("#planBtn");
  btn.disabled=true;out.innerHTML=`<div class="thinking"><span class="spin"></span>The coach is writing your plan…</div>`;
  const days=S.exam?Math.max(1,Math.round((new Date(S.exam)-new Date())/864e5)):null;
  try{const plan=await ai("plan",{target:S.target,days,scores:S.scores});S.plan=plan;save();renderPlan(plan);}
  catch(e){out.innerHTML=`<p class="note warn">${esc(aiErr(e))}</p>`;}
  finally{btn.disabled=false;}
}
function renderPlan(p){
  if(!p||!p.weeks)return;
  $("#planIntro").textContent=p.headline||"";
  $("#planOut").innerHTML=`<p class="note"><b>Focus:</b> ${esc(p.focus||"")}</p>`+p.weeks.map(w=>`<div class="plan-week"><b>${esc(w.title)}</b><span class="muted">${esc(w.goal||"")}</span><ul>${(w.tasks||[]).map(t=>`<li>${esc(t)}</li>`).join("")}</ul></div>`).join("")+(p.daily_habit?`<p class="note"><b>Every day:</b> ${esc(p.daily_habit)}</p>`:"");
  $("#planBtn").textContent="Rebuild my plan";
}

/* ---------- question engine ---------- */
const norm=s=>String(s||"").toLowerCase().replace(/[$£,]/g,"").replace(/\b(the|a|an)\b/g,"").replace(/[^a-z0-9.:]/g,"").replace(/\.$/,"");
function renderQs(host,qs){
  host.innerHTML=qs.map(q=>{
    let input="";
    if(q.type==="gap")input=`${q.pre?`<span>${esc(q.pre)}</span>`:""}<input class="gap" id="${q.id}" autocomplete="off" aria-label="Answer ${q.n}">`;
    else{const opts=q.type==="tfng"?[["TRUE","T"],["FALSE","F"],["NOT GIVEN","NG"]]:q.options.map((o,i)=>[o,"ABCD"[i]]);
      input=`<div class="opts ${q.type==="mcq"?"col":""}" role="radiogroup">${opts.map(([lab,k])=>`<label class="opt"><input type="radio" name="${q.id}" id="${q.id}-${k}" value="${k}"><span class="bub">${k.length>1?"":k}</span><span>${esc(lab)}</span></label>`).join("")}</div>`;}
    return `${q.head?`<div class="qhead">${esc(q.head)}</div>`:""}<div class="q" id="q-${q.id}"><span class="qn">${q.n}</span><div class="qbody">${q.text?`<span>${esc(q.text)}</span>`:""}${input}<div class="fbslot"></div></div></div>`;
  }).join("");
}
function markQs(qs){
  let c=0;
  qs.forEach(q=>{
    let given;
    if(q.type==="gap")given=document.getElementById(q.id).value;
    else{const r=document.querySelector(`input[name="${q.id}"]:checked`);given=r?r.value:"";}
    const ok=q.answer.some(a=>norm(a)===norm(given))&&given!=="";
    if(ok)c++;
    const el=document.getElementById("q-"+q.id);el.classList.toggle("ok",ok);el.classList.toggle("no",!ok);
    const shown=q.type==="tfng"?{T:"TRUE",F:"FALSE",NG:"NOT GIVEN"}[q.answer[0]]:q.answer[0];
    const showExplain=S.level!=="professional"||!ok;
    el.querySelector(".fbslot").innerHTML=`<div class="fb">${ok?"Correct.":`Answer: <b>${esc(shown)}</b>.`} ${showExplain?esc(q.why):""}</div>`;
  });
  return c;
}
function clearQs(qs){qs.forEach(q=>{const el=document.getElementById("q-"+q.id);el.classList.remove("ok","no");el.querySelector(".fbslot").innerHTML="";
  if(q.type==="gap")document.getElementById(q.id).value="";else document.querySelectorAll(`input[name="${q.id}"]`).forEach(r=>r.checked=false);});}
function resultBox(host,c,total,band,raw40,mod){
  const tip=band>=7?"Strong. Push for accuracy on the hardest question types.":band>=6?"Good base. Review every wrong answer and find the exact words in the text or transcript.":"Read the explanations under each question. They show where the answer was hiding.";
  host.innerHTML=`<div class="result"><div class="bigband">${fmt(band)}</div><div class="stack" style="gap:4px"><b>${c} / ${total} correct</b><span class="muted">That is about ${raw40}/40 on the real ${mod} test, which is band ${fmt(band)}.</span><span>${tip}</span></div></div>`;
  host.scrollIntoView({behavior:"smooth",block:"center"});
}

/* ---------- listening ---------- */
const LIS1=[
 ["Receptionist","Good morning, Riverside Community Centre. How can I help you?"],
 ["Caller","Hi. I'd like to sign up for the evening English conversation class, please."],
 ["Receptionist","Of course. Can I take your full name?"],
 ["Caller","Yes. It's Daniel Okafor. That's O, K, A, F, O, R."],
 ["Receptionist","Thank you, Daniel. And what's the best phone number for you?"],
 ["Caller","It's oh, seven, seven, four, nine, two, three, one, five, eight."],
 ["Receptionist","Lovely. The class runs on Tuesdays and Thursdays. Which day would suit you?"],
 ["Caller","Tuesdays are difficult because I work late, so Thursday, please."],
 ["Receptionist","Thursday it is. The class starts at a quarter past seven and finishes at nine."],
 ["Caller","Great. And how much does it cost?"],
 ["Receptionist","It's normally eighty dollars for the ten-week course, but students and seniors pay fifty-five."],
 ["Caller","I'm not a student any more, so I'll pay the full price."],
 ["Receptionist","No problem. Oh, and the class is held in the library room on the second floor, not in the main hall."],
 ["Caller","The library room, second floor. Got it. Thanks so much."]];
const LIS2=[["Guide","Welcome, everyone, to the Harbour Maritime Museum. Before we begin, a few practical points. The museum opened in nineteen eighty-seven in what used to be the town's fish market, and it was extended in twenty fifteen, when the new glass gallery was added. Today we'll start on the ground floor with the shipwreck collection. It's our most popular exhibit, so it's best to see it now, before the school groups arrive later this morning. Photography is allowed everywhere except in the map room, because the old maps are damaged by camera flash. Please note that the café on the top floor closes at three o'clock today, rather than the usual five, as there is a private event this evening. And finally, if you'd like to try our sailing simulator, please book a time at the information desk, as places are limited."]];
const LQ1=[
 {id:"l1",n:1,type:"gap",text:"Surname:",answer:["Okafor"],why:"He spells it out: O, K, A, F, O, R. Spelled names are very common in Section 1."},
 {id:"l2",n:2,type:"gap",text:"Phone number:",answer:["0774923158","07749 23158"],why:"'Oh' means zero. Listen for the digits one by one and write them as numbers."},
 {id:"l3",n:3,type:"gap",text:"Day chosen:",answer:["Thursday","Thursdays"],why:"Tuesday is mentioned first, but it is rejected. The answer comes after 'so'."},
 {id:"l4",n:4,type:"gap",text:"Class start time:",answer:["7:15","7.15","715","7:15pm","7.15pm","19:15","quarter past seven"],why:"'A quarter past seven' is 7:15. Nine is the finish time, not the start."},
 {id:"l5",n:5,type:"gap",pre:"$",text:"Fee he will pay:",answer:["80","eighty","80dollars"],why:"$55 is for students and seniors. He says he is not a student, so he pays $80."},
 {id:"l6",n:6,type:"gap",text:"Room: the ______ room",answer:["library"],why:"The speaker corrects a likely guess: 'not in the main hall'. Distractors like this are common."}];
const LQ2=[
 {id:"l7",n:7,type:"mcq",text:"The museum building was originally",options:["a shipyard","a fish market","a library"],answer:["B"],why:"'In what used to be the town's fish market.'"},
 {id:"l8",n:8,type:"mcq",text:"Visitors should see the shipwreck collection first because",options:["it closes early today","it is on the top floor","it gets busy later"],answer:["C"],why:"School groups arrive later, so it will be crowded. That is the meaning of 'before the school groups arrive'."},
 {id:"l9",n:9,type:"mcq",text:"Photography is NOT allowed in",options:["the glass gallery","the map room","the shipwreck collection"],answer:["B"],why:"'Everywhere except in the map room.' Listen for 'except'."},
 {id:"l10",n:10,type:"mcq",text:"Today the café will close at",options:["3 pm","5 pm","3:30 pm"],answer:["A"],why:"5 pm is the usual time. Today it is 'three o'clock … rather than the usual five'."}];
let voices=[];
function loadVoices(){if(!("speechSynthesis" in window))return;voices=speechSynthesis.getVoices().filter(v=>/^en/i.test(v.lang));}
if("speechSynthesis" in window){loadVoices();speechSynthesis.onvoiceschanged=loadVoices;}
const RATE=()=>({beginner:.82,intermediate:.92,advanced:1,professional:1.05}[S.level]);
const played={1:0,2:0};
function speakLines(lines,onDone,waveEl,statusEl){
  if(!("speechSynthesis" in window)){statusEl.textContent="Your browser cannot play voice. Open the transcript instead.";$("#lisTx").hidden=false;return;}
  speechSynthesis.cancel();
  const speakers=[...new Set(lines.map(l=>l[0]))];
  const pick=i=>{if(!voices.length)return null;const pref=voices.filter(v=>/en-(GB|AU|CA|US)/i.test(v.lang));const pool=pref.length?pref:voices;return pool[(i*3)%pool.length];};
  let i=0;waveEl.classList.add("on");statusEl.textContent="Playing…";
  const next=()=>{
    if(i>=lines.length){waveEl.classList.remove("on");statusEl.textContent="Finished.";onDone&&onDone();return;}
    const [sp,txt]=lines[i++];const u=new SpeechSynthesisUtterance(txt);const v=pick(speakers.indexOf(sp));if(v)u.voice=v;
    u.rate=RATE();u.pitch=speakers.indexOf(sp)===1?.9:1.05;u.onend=()=>setTimeout(next,350);u.onerror=()=>{waveEl.classList.remove("on");};speechSynthesis.speak(u);
  };next();
}
function initListening(){
  renderQs($("#lisQ1"),LQ1);renderQs($("#lisQ2"),LQ2);
  const mk=(n,lines)=>{const b=$("#play"+n);b.onclick=()=>{
    const once=S.level==="advanced"||S.level==="professional";
    if(once&&played[n]>=1){$("#ps"+n).textContent="Exam mode: each recording plays once.";return;}
    played[n]++;if(once)b.disabled=true;
    speakLines(lines,null,$("#wave"+n),$("#ps"+n));};
    $("#stop"+n).onclick=()=>{if("speechSynthesis" in window)speechSynthesis.cancel();$("#wave"+n).classList.remove("on");$("#ps"+n).textContent="Stopped.";};};
  mk(1,LIS1);mk(2,LIS2);
  $("#lisTxBody").innerHTML=`<div class="qhead">Section 1</div>`+LIS1.map(([s,t])=>`<p><b>${s}:</b> ${esc(t)}</p>`).join("")+`<div class="qhead">Section 2</div>`+LIS2.map(([s,t])=>`<p><b>${s}:</b> ${esc(t)}</p>`).join("");
  $("#lisSubmit").onclick=()=>{const qs=LQ1.concat(LQ2);const c=markQs(qs);const {band,raw40}=bandFrom(c,qs.length,LIS_T);resultBox($("#lisResult"),c,qs.length,band,raw40,"Listening");setScore("listening",band);$("#lisTx").hidden=false;};
  $("#lisReset").onclick=()=>{clearQs(LQ1.concat(LQ2));$("#lisResult").innerHTML="";played[1]=played[2]=0;$("#play1").disabled=$("#play2").disabled=false;$("#ps1").textContent=$("#ps2").textContent="";$("#lisTx").hidden=S.level!=="beginner";};
}

/* ---------- reading ---------- */
const P1={title:"Bees in the city",paras:[
 "Twenty years ago, few city dwellers would have imagined keeping bees on a rooftop. Today, hives sit on top of hotels in London, office towers in Toronto and apartment blocks in Paris. The trend began partly as a response to reports of falling bee numbers in the countryside, where intensive farming and pesticide use had made life difficult for pollinators.",
 "Surprisingly, cities can be good places for bees. Parks, private gardens and street trees provide a wide variety of flowers that bloom at different times of the year. In contrast, a large farm may grow a single crop that flowers for only a few weeks. Some studies have found that honey produced in cities contains pollen from more plant species than honey from rural areas.",
 "However, not all scientists welcome the trend. Honeybees are managed animals, rather like livestock, and they compete with thousands of species of wild bees for the same nectar and pollen. In one study of Paris, researchers found that wild pollinators visited flowers less often in areas with a high density of hives. Critics argue that people who want to help nature should plant flowers rather than install new colonies.",
 "Beekeeping associations have responded by encouraging new keepers to take a training course before buying a hive. In several cities, local governments now require hives to be registered, so that outbreaks of disease can be tracked. A well-kept colony can produce up to 25 kilograms of honey a year, but beginners are often warned that their first summer may produce very little."]};
const P2={title:"Sleep and learning",paras:[
 "For many students, the night before an exam is spent awake, reading notes until the early hours. Research in sleep science suggests that this may be one of the least effective ways to prepare. During sleep, the brain does not simply rest; it actively replays and organises information gathered during the day.",
 "In a well-known type of experiment, volunteers learn a list of word pairs in the evening. Half are allowed to sleep normally, while the other half stay awake through the night. When both groups are tested the following afternoon, after the second group has had time to recover, those who slept usually remember significantly more. The difference remains even when the tired group is given extra coffee.",
 "Scientists believe that a stage known as slow-wave sleep is especially important for facts and vocabulary, while rapid eye movement (REM) sleep seems to support skills and creative problem-solving. Because REM periods become longer towards morning, cutting sleep short by waking very early may reduce its benefits more than going to bed late.",
 "Short daytime naps can also help. A nap of 20 to 30 minutes improves alertness without leaving most people feeling heavy, although longer naps may be needed to reach the deeper stages linked to memory. For language learners, one practical lesson is clear: reviewing new words shortly before sleep, and then again the next day, is more effective than studying them once for a long period."]};
const RQ1=[
 {id:"r1",n:1,type:"tfng",head:"Questions 1–5 · TRUE if the statement agrees with the text, FALSE if it contradicts it, NOT GIVEN if there is no information",text:"Urban beekeeping started partly because of concerns about bees in rural areas.",answer:["T"],why:"Paragraph A: the trend began 'as a response to reports of falling bee numbers in the countryside'."},
 {id:"r2",n:2,type:"tfng",text:"Rooftop hives are more common in London than in Paris.",answer:["NG"],why:"Both cities are named, but the text never compares how common hives are. No comparison = NOT GIVEN."},
 {id:"r3",n:3,type:"tfng",text:"City flowers tend to bloom over a longer part of the year than many farm crops.",answer:["T"],why:"Paragraph B: city flowers bloom 'at different times of the year'; a farm crop flowers 'for only a few weeks'."},
 {id:"r4",n:4,type:"tfng",text:"All scientists agree that urban beekeeping helps wild bees.",answer:["F"],why:"Paragraph C: 'not all scientists welcome the trend'. This directly contradicts the statement."},
 {id:"r5",n:5,type:"tfng",text:"Hives must be registered in every Canadian city.",answer:["NG"],why:"The text says 'several cities' require registration but says nothing about Canada as a whole."},
 {id:"r6",n:6,type:"gap",head:"Questions 6–7 · ONE WORD AND/OR A NUMBER",text:"Critics suggest that people should plant ______ instead of keeping new hives.",answer:["flowers"],why:"Paragraph C, last sentence."},
 {id:"r7",n:7,type:"gap",text:"A well-kept colony may produce as much as ______ kilograms of honey per year.",answer:["25","twenty-five","twentyfive"],why:"Paragraph D: 'up to 25 kilograms'. 'As much as' is a paraphrase of 'up to'."},
 {id:"r8",n:8,type:"mcq",head:"Questions 8–9 · Which paragraph",text:"Which paragraph describes rules introduced to monitor disease?",options:["Paragraph A","Paragraph B","Paragraph C","Paragraph D"],answer:["D"],why:"Paragraph D: hives must be registered 'so that outbreaks of disease can be tracked'."},
 {id:"r9",n:9,type:"mcq",text:"Which paragraph compares the variety of food for bees in cities and on farms?",options:["Paragraph A","Paragraph B","Paragraph C","Paragraph D"],answer:["B"],why:"Paragraph B contrasts many city flowers with a single farm crop."}];
const RQ2=[
 {id:"r10",n:10,type:"mcq",head:"Questions 10–13 · Choose A, B, C or D",text:"According to paragraph A, during sleep the brain",options:["rests completely","processes the day's information","forgets unimportant facts","prepares the body for exercise"],answer:["B"],why:"'It actively replays and organises information gathered during the day.' Option A is the opposite."},
 {id:"r11",n:11,type:"mcq",text:"In the experiment, the group that stayed awake",options:["was tested in the morning","remembered more words","still did worse after drinking coffee","learned a different list"],answer:["C"],why:"'The difference remains even when the tired group is given extra coffee.'"},
 {id:"r12",n:12,type:"mcq",text:"Waking up very early may be harmful because",options:["slow-wave sleep happens at the end of the night","REM periods are longer near the morning","coffee works less well early in the day","it makes daytime naps impossible"],answer:["B"],why:"Paragraph C: 'Because REM periods become longer towards morning…'"},
 {id:"r13",n:13,type:"mcq",text:"The writer advises language learners to",options:["study new words in one long session","avoid naps during the day","review new words before sleep and again the next day","sleep for only 20 to 30 minutes"],answer:["C"],why:"The final sentence gives exactly this advice."}];
let readTimer=null,readLeft=1200;
function initReading(){
  const pr=(p)=>`<h3 style="margin-bottom:12px">${esc(p.title)}</h3>`+p.paras.map((t,i)=>`<p><span class="para">${"ABCD"[i]}</span>${esc(t)}</p>`).join("");
  $("#passage1").innerHTML=pr(P1);$("#passage2").innerHTML=pr(P2);
  renderQs($("#readQ1"),RQ1);renderQs($("#readQ2"),RQ2);
  const show=()=>{const m=Math.floor(readLeft/60),s=readLeft%60;$("#readTimer").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;$("#readTimer").classList.toggle("low",readLeft<=120);};
  $("#readTimerBtn").onclick=()=>{if(readTimer){clearInterval(readTimer);readTimer=null;$("#readTimerBtn").textContent="Resume timer";return;}
    $("#readTimerBtn").textContent="Pause timer";readTimer=setInterval(()=>{readLeft--;show();if(readLeft<=0){clearInterval(readTimer);readTimer=null;$("#readSubmit").click();}},1000);};
  $("#readSubmit").onclick=()=>{if(readTimer){clearInterval(readTimer);readTimer=null;$("#readTimerBtn").textContent="Resume timer";}
    const qs=RQ1.concat(RQ2);const c=markQs(qs);const {band,raw40}=bandFrom(c,qs.length,REA_T);resultBox($("#readResult"),c,qs.length,band,raw40,"Academic Reading");setScore("reading",band);};
  $("#readReset").onclick=()=>{clearQs(RQ1.concat(RQ2));$("#readResult").innerHTML="";if(readTimer)clearInterval(readTimer);readTimer=null;readLeft=1200;show();$("#readTimerBtn").textContent="Start timer";};
  show();
}

/* ---------- writing ---------- */
const T1={title:"Internet access at home",desc:"The chart below shows the percentage of households with internet access in Canada, Brazil and India between 2005 and 2020.",
  ask:"Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
  years:[2005,2010,2015,2020],series:[["Canada",[64,78,87,94],"--lis"],["Brazil",[21,38,58,81],"--rea"],["India",[3,8,22,48],"--wri"]]};
const T2=[
 "Some people believe that university students should study whatever they like, while others think they should only study subjects that will be useful in the job market. Discuss both views and give your own opinion.",
 "In many countries, people are working from home more than before. Do the advantages of this development outweigh the disadvantages?",
 "Governments should spend more money on public transport than on building new roads. To what extent do you agree or disagree?",
 "Many young people today spend a lot of time on social media. What problems does this cause, and what can be done to solve them?"];
let wTask=1,wIdx=0,wTimer=null,wLeft=1200;
function chartSVG(){
  const W=560,H=300,L=44,R=12,T=16,B=60,ch=H-T-B,cw=W-L-R,gw=cw/T1.years.length,bw=22;
  let g="";for(let v=0;v<=100;v+=25){const y=T+ch-v/100*ch;g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${L-8}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${v}%</text>`;}
  T1.years.forEach((yr,i)=>{const x0=L+i*gw+(gw-bw*3-8)/2;
    T1.series.forEach(([n,d,c],k)=>{const h=d[i]/100*ch;const x=x0+k*(bw+4);g+=`<rect x="${x}" y="${T+ch-h}" width="${bw}" height="${h}" fill="var(${c})" rx="2"/><text x="${x+bw/2}" y="${T+ch-h-4}" text-anchor="middle" font-size="10" fill="var(--ink)" font-family="var(--mono)">${d[i]}</text>`;});
    g+=`<text x="${L+i*gw+gw/2}" y="${T+ch+18}" text-anchor="middle" font-size="12" fill="var(--ink)" font-family="var(--mono)" font-weight="700">${yr}</text>`;});
  let lx=L;T1.series.forEach(([n,d,c])=>{g+=`<rect x="${lx}" y="${H-22}" width="12" height="12" fill="var(${c})" rx="2"/><text x="${lx+18}" y="${H-12}" font-size="12" fill="var(--ink)">${n}</text>`;lx+=110;});
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bar chart of household internet access, 2005 to 2020"><title>Households with internet access (%)</title>${g}</svg>`;
}
function wDraftKey(){return `bandup.draft.${wTask}.${wTask===2?wIdx:0}`;}
function renderWriting(){
  $("#wt1").setAttribute("aria-pressed",wTask===1);$("#wt2").setAttribute("aria-pressed",wTask===2);
  if(wTask===1){$("#wPrompt").innerHTML=`<span class="eyebrow">Academic Task 1 · 20 minutes · 150+ words</span><p><b>${esc(T1.desc)}</b></p><p>${esc(T1.ask)}</p>`;$("#wChart").innerHTML=chartSVG();$("#wPromptNav").innerHTML="";}
  else{$("#wPrompt").innerHTML=`<span class="eyebrow">Task 2 · 40 minutes · 250+ words</span><p><b>${esc(T2[wIdx])}</b></p><p>Give reasons for your answer and include any relevant examples from your own knowledge or experience.</p>`;$("#wChart").innerHTML="";
    $("#wPromptNav").innerHTML=`<button class="btn ghost sm" id="wNext" type="button">Another question (${wIdx+1}/${T2.length})</button>`;$("#wNext").onclick=()=>{wIdx=(wIdx+1)%T2.length;renderWriting();};}
  const hints={beginner:wTask===1?"Simple plan: 1) Rewrite the question in your own words. 2) Overview: Canada was highest; India grew the most. 3) Two body paragraphs with numbers. No opinions in Task 1.":"Simple plan: Introduction (repeat the question + your opinion) → Body 1 (one idea + example) → Body 2 (another idea + example) → Conclusion. Aim for 260–280 words.",
    intermediate:wTask===1?"Examiners look for a clear overview. Write one sentence with the biggest trends before any numbers.":"Answer every part of the question. A 'discuss both views' question needs both sides AND your opinion.",
    advanced:wTask===1?"Group the data: Canada near saturation vs Brazil and India catching up. Use varied comparison language (roughly double, a sixteen-fold rise).":"Keep a consistent position throughout and extend each idea with a reason, a consequence and a specific example.",
    professional:wTask===1?"Band 8+: precise data selection, no listing every figure, sophisticated but natural comparisons.":"Band 8+: nuanced position, fully extended ideas, precise collocations, flexible complex grammar with very few errors."}[S.level];
  $("#wHint").innerHTML=`<b>Tip for your level:</b> ${esc(hints)}`;
  let d="";try{d=localStorage.getItem(wDraftKey())||"";}catch(e){}
  $("#wText").value=d;countW();$("#wResult").innerHTML="";
  wLeft=wTask===1?1200:2400;if(wTimer){clearInterval(wTimer);wTimer=null;}$("#wTimerBtn").textContent="Start timer";showWT();
}
function showWT(){const m=Math.floor(wLeft/60),s=wLeft%60;$("#wTimer").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;$("#wTimer").classList.toggle("low",wLeft<=180);}
function words(t){return (t.trim().match(/\b[\w'’-]+\b/g)||[]).length;}
function countW(){const n=words($("#wText").value),min=wTask===1?150:250;$("#wCount").textContent=`${n} words${n<min?` · ${min-n} to go`:""}`;$("#wCount").classList.toggle("under",n<min);}
function critRows(list){return `<div class="crit">${list.map(([nm,sc,why,c])=>`<div class="crit-row"><span class="nm">${esc(nm)}</span><span class="sc">${fmt(sc)}</span><div class="track"><i style="width:${(+sc||0)/9*100}%;background:var(${c})"></i></div>${why?`<span class="why">${esc(why)}</span>`:""}</div>`).join("")}</div>`;}
function roundBand(x){x=+x;if(isNaN(x))return null;const f=Math.floor(x),d=x-f;return d<.25?f:d<.75?f+.5:f+1;}
async function scoreWriting(){
  const text=$("#wText").value.trim(),out=$("#wResult");
  if(words(text)<40){out.innerHTML=`<p class="note warn">Write at least a few sentences first, so the examiner has something to mark.</p>`;return;}
  $("#wScore").disabled=true;out.innerHTML=`<div class="thinking"><span class="spin"></span>The examiner is reading your answer…</div>`;
  const crit1=wTask===1?"Task Achievement":"Task Response";
  try{
    const r=await ai("writing",{task:wTask,index:wIdx,text});
    const c=r.criteria||{};const vals=["ta","cc","lr","gra"].map(k=>+(c[k]&&c[k].band));
    const ov=roundBand(vals.reduce((a,b)=>a+b,0)/4);
    if(wTask===2||S.scores.writing==null)setScore("writing",ov);
    out.innerHTML=`<div class="result"><div class="bigband">${fmt(ov)}</div><div class="stack" style="gap:4px"><b>Writing ${wTask===1?"Task 1":"Task 2"} estimate</b><span>${esc(r.summary||"")}</span></div></div>
      <div class="card">${critRows([[crit1,c.ta&&c.ta.band,c.ta&&c.ta.why,"--wri"],["Coherence & Cohesion",c.cc&&c.cc.band,c.cc&&c.cc.why,"--wri"],["Lexical Resource",c.lr&&c.lr.band,c.lr&&c.lr.why,"--wri"],["Grammatical Range & Accuracy",c.gra&&c.gra.band,c.gra&&c.gra.why,"--wri"]])}</div>
      ${(r.strengths||[]).length?`<div class="note"><b>What you did well:</b> ${r.strengths.map(esc).join(" ")}</div>`:""}
      <h3>Fix these first</h3><div class="stack">${(r.fixes||[]).map(f=>`<div class="fix"><s>${esc(f.original)}</s><ins>${esc(f.better)}</ins><span class="muted">${esc(f.why)}</span></div>`).join("")}</div>
      ${r.next_step?`<p class="note"><b>Next step:</b> ${esc(r.next_step)}</p>`:""}
      ${r.model_paragraph?`<details class="tx"><summary>See one paragraph rewritten half a band higher</summary><p>${esc(r.model_paragraph)}</p></details>`:""}
      <p class="muted" style="font-size:.85rem">${wTask===1?"Task 2 counts twice as much as Task 1 in the real test, so your home score uses your latest Task 2 mark once you have one.":"AI estimates can differ from a human examiner by about half a band."}</p>`;
  }catch(e){out.innerHTML=`<p class="note warn">${esc(aiErr(e))}</p>`;}
  finally{$("#wScore").disabled=false;}
}
function initWriting(){
  $("#wt1").onclick=()=>{wTask=1;renderWriting();};$("#wt2").onclick=()=>{wTask=2;renderWriting();};
  $("#wText").addEventListener("input",()=>{countW();try{localStorage.setItem(wDraftKey(),$("#wText").value);}catch(e){}});
  $("#wTimerBtn").onclick=()=>{if(wTimer){clearInterval(wTimer);wTimer=null;$("#wTimerBtn").textContent="Resume timer";return;}
    $("#wTimerBtn").textContent="Pause timer";wTimer=setInterval(()=>{wLeft--;showWT();if(wLeft<=0){clearInterval(wTimer);wTimer=null;$("#wTimerBtn").textContent="Time is up";}},1000);};
  $("#wScore").onclick=scoreWriting;renderWriting();
}

/* ---------- speaking ---------- */
const SETS=[
 {name:"Home & a special place",p1:["Do you live in a house or an apartment?","What do you like most about your home?","Is there anything you would like to change about where you live?","Do you usually spend time at home at weekends? Why?"],
  cue:{t:"Describe a place you like to visit to relax.",pts:["where it is","how often you go there","what you do there","and explain why it helps you relax."]},
  p3:["Why do many people find it hard to relax these days?","Should employers do more to reduce stress at work?","How has the way people spend their free time changed compared with the past?"]},
 {name:"Work & a useful skill",p1:["Do you work or are you a student?","What do you enjoy about your work or studies?","Do you prefer working in the morning or the evening?","What job did you want to do when you were a child?"],
  cue:{t:"Describe a skill you learned that has been useful to you.",pts:["what the skill is","when and how you learned it","how difficult it was","and explain why it has been useful."]},
  p3:["Which skills will be most important for young people in the future?","Is it better to learn skills at school or at work?","Do you think technology makes people less skilled at some things?"]},
 {name:"Food & a memorable meal",p1:["What kind of food do you enjoy?","Do you like cooking? Why or why not?","Has your diet changed since you were a child?","Do people in your country usually eat together as a family?"],
  cue:{t:"Describe a meal that you remember well.",pts:["where you had it","who you were with","what you ate","and explain why you remember it."]},
  p3:["Why do traditional meals matter to families and cultures?","How have fast food restaurants changed eating habits?","Should schools teach children how to cook?"]}];
let spk={set:0,step:0,answers:[],timer:null,left:0,phase:""};
function spkSteps(){const s=SETS[spk.set];return [...s.p1.map(q=>({part:1,q})),{part:2,q:s.cue.t,cue:s.cue},...s.p3.map(q=>({part:3,q}))];}
function say(t){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);const v=voices.find(v=>/en-GB/i.test(v.lang))||voices[0];if(v)u.voice=v;u.rate=RATE();speechSynthesis.speak(u);}
function renderSpk(){
  stopMic();
  const steps=spkSteps(),st=steps[spk.step],card=$("#spkCard");
  if(spk.timer){clearInterval(spk.timer);spk.timer=null;}
  const bar=`<div class="steps" aria-label="Question ${spk.step+1} of ${steps.length}">${steps.map((_,i)=>`<i class="${i<spk.step?"done":i===spk.step?"now":""}"></i>`).join("")}</div>`;
  const partInfo={1:"Part 1 · Short answers about you (2–3 sentences)",2:"Part 2 · Long turn: 1 minute to prepare, up to 2 minutes to speak",3:"Part 3 · Discussion: give opinions, reasons and examples"}[st.part];
  const tips={beginner:"Answer + reason + example. For example: 'I live in an apartment, because it is close to my work. For example, I can walk there in ten minutes.'",intermediate:"Extend every answer with 'because' and a short example. Don't memorise answers; examiners notice.",advanced:"Use a range of tenses and some less common phrases naturally, like 'to be honest' or 'it depends on'.",professional:"Show flexibility: speculate, contrast and concede ('Admittedly…, but…'). Keep it natural, not rehearsed."}[S.level];
  card.innerHTML=`${bar}<span class="eyebrow" style="color:var(--spk)">${partInfo}</span>
   ${st.cue?`<div class="cue"><b>${esc(st.cue.t)}</b><br><span class="muted">You should say:</span><ul>${st.cue.pts.map(p=>`<li>${esc(p)}</li>`).join("")}</ul></div>`:`<h3>${esc(st.q)}</h3>`}
   <div class="row"><button class="btn sm" id="sHear" type="button">🔊 Hear question</button><button class="btn accent sm" id="sMic" type="button" ${micOK()?"":"hidden"}>🎙 Speak</button>${st.part===2?`<button class="btn ghost sm" id="sPrep" type="button">Start 1-minute prep</button><span class="timer" id="sTimer">1:00</span>`:""}</div>
   ${st.part===2?`<textarea class="short" id="sNotes" placeholder="Notes (not marked)" style="min-height:70px"></textarea>`:""}
   <label class="eyebrow" for="sAns">Your answer ${micOK()?"(tap Speak, or type)":"(tap the mic on your keyboard, or type)"}</label>
   <textarea id="sAns" class="${st.part===2?"":"short"}" placeholder="Speak or type your answer…"></textarea>
   <p class="note warn" id="sMicNote" hidden>Microphone is blocked. Allow it in your browser's site settings, or type your answer.</p>
   <p class="muted" style="font-size:.9rem"><b>Tip:</b> ${esc(tips)}</p>
   <div class="row" style="justify-content:space-between"><button class="btn ghost sm" id="sBack" type="button" ${spk.step===0?"disabled":""}>Back</button><button class="btn ${spk.step===steps.length-1?"accent":""}" id="sNext" type="button">${spk.step===steps.length-1?"Finish and get my band":"Next question"}</button></div>`;
  $("#sAns").value=spk.answers[spk.step]||"";
  $("#sAns").oninput=e=>{spk.answers[spk.step]=e.target.value;};
  $("#sMic").onclick=()=>rec?stopMic():startMic();
  $("#sHear").onclick=()=>say(st.cue?st.cue.t+". You should say: "+st.cue.pts.join(", "):st.q);
  if(st.part===2){$("#sPrep").onclick=()=>runTimer(60,"prep");}
  $("#sBack").onclick=()=>{spk.step--;renderSpk();};
  $("#sNext").onclick=()=>{spk.answers[spk.step]=$("#sAns").value;if(spk.step<steps.length-1){spk.step++;renderSpk();say(steps[spk.step].cue?"Now, part two. "+steps[spk.step].cue.t:steps[spk.step].q);}else scoreSpeaking();};
}
let rec=null,recOn=false;
function micOK(){return !!(window.SpeechRecognition||window.webkitSpeechRecognition);}
function startMic(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;
  if("speechSynthesis" in window)speechSynthesis.cancel();
  const box=$("#sAns");const base=box.value.trim()?box.value.trim()+" ":"";let finals="";
  rec=new SR();rec.lang="en-GB";rec.continuous=true;rec.interimResults=true;recOn=true;
  rec.onresult=e=>{let interim="";for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)finals+=t+" ";else interim+=t;}
    box.value=base+finals+interim;spk.answers[spk.step]=box.value;};
  rec.onerror=e=>{if(e.error==="not-allowed"||e.error==="service-not-allowed"){recOn=false;setMicBtn(false);const n=$("#sMicNote");if(n)n.hidden=false;}};
  rec.onend=()=>{if(recOn){try{rec.start();}catch(err){}}else setMicBtn(false);};
  try{rec.start();setMicBtn(true);}catch(err){}
}
function stopMic(){recOn=false;if(rec){try{rec.stop();}catch(e){}rec=null;}setMicBtn(false);}
function setMicBtn(on){const b=$("#sMic");if(!b)return;b.textContent=on?"■ Stop":"🎙 Speak";b.classList.toggle("accent",!on);}
function runTimer(sec,phase){
  if(spk.timer)clearInterval(spk.timer);spk.left=sec;spk.phase=phase;
  const show=()=>{const t=$("#sTimer");if(!t)return;t.textContent=`${Math.floor(spk.left/60)}:${String(spk.left%60).padStart(2,"0")}`;t.classList.toggle("low",spk.left<=15);};
  const b=$("#sPrep");if(b){b.textContent=phase==="prep"?"Preparing…":"Speaking…";b.disabled=true;}show();
  spk.timer=setInterval(()=>{spk.left--;show();if(spk.left<=0){clearInterval(spk.timer);spk.timer=null;
    if(phase==="prep"){say("Please start speaking now.");runTimer(120,"talk");if(micOK())setTimeout(startMic,1800);else $("#sAns").focus();}
    else{if(b)b.textContent="Time is up";stopMic();say("Thank you.");}}},1000);
}
async function scoreSpeaking(){
  const steps=spkSteps(),out=$("#spkResult");
  const filled=steps.filter((_,i)=>(spk.answers[i]||"").trim().length>0).length;
  if(filled<3){out.innerHTML=`<p class="note warn">Answer at least three questions, including Part 2 if you can, so the examiner can judge fairly.</p>`;return;}
  $("#sNext").disabled=true;out.innerHTML=`<div class="thinking"><span class="spin"></span>The examiner is listening back to your answers…</div>`;
  stopMic();
  try{
    const r=await ai("speaking",{set:spk.set,answers:steps.map((_,i)=>spk.answers[i]||"")});
    const v=[r.fc,r.lr,r.gra].map(x=>+(x&&x.band));const ov=roundBand(v.reduce((a,b)=>a+b,0)/3);
    setScore("speaking",ov);
    out.innerHTML=`<div class="result"><div class="bigband">${fmt(ov)}</div><div class="stack" style="gap:4px"><b>Speaking estimate (3 of 4 criteria)</b><span>${esc(r.summary||"")}</span></div></div>
      <div class="card">${critRows([["Fluency & Coherence",r.fc&&r.fc.band,r.fc&&r.fc.why,"--spk"],["Lexical Resource",r.lr&&r.lr.band,r.lr&&r.lr.why,"--spk"],["Grammatical Range & Accuracy",r.gra&&r.gra.band,r.gra&&r.gra.why,"--spk"]])}
      <p class="note warn" style="margin-top:12px"><b>Pronunciation is not scored here.</b> Text cannot show how you sound. ${esc(r.pronunciation_tip||"")}</p></div>
      ${r.best_answer?`<p class="note"><b>Your best answer:</b> ${esc(r.best_answer)}</p>`:""}
      <h3>Say it better</h3><div class="stack">${(r.upgrades||[]).map(u=>`<div class="fix"><span class="muted" style="font-size:.85rem">${esc(u.question||"")}</span><s>${esc(u.original)}</s><ins>${esc(u.better)}</ins><span class="muted">${esc(u.why)}</span></div>`).join("")}</div>
      ${r.model_part2?`<details class="tx"><summary>Hear a band 7.5 model Part 2 answer</summary><p>${esc(r.model_part2)}</p><button class="btn sm" type="button" id="sModel">🔊 Play model answer</button></details>`:""}
      <div class="row"><button class="btn ghost" id="sAgain" type="button">Start a new speaking test</button></div>`;
    if(r.model_part2)$("#sModel").onclick=()=>say(r.model_part2);
    $("#sAgain").onclick=()=>{spk.set=(spk.set+1)%SETS.length;$("#spkSet").value=spk.set;spk.step=0;spk.answers=[];out.innerHTML="";renderSpk();window.scrollTo({top:0,behavior:"smooth"});};
    out.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){out.innerHTML=`<p class="note warn">${esc(aiErr(e))}</p>`;}
  finally{const b=$("#sNext");if(b)b.disabled=false;}
}
function initSpeaking(){
  const sel=$("#spkSet");SETS.forEach((s,i)=>{const o=document.createElement("option");o.value=i;o.textContent=s.name;sel.appendChild(o);});
  sel.onchange=()=>{spk.set=+sel.value;spk.step=0;spk.answers=[];$("#spkResult").innerHTML="";renderSpk();};
  renderSpk();
}

/* ---------- learn ---------- */
const PLANS={
 beginner:{h:"Beginner plan · from band 4–5 to 5.5–6",items:["Learn the test format first: 4 modules, about 2 hours 45 minutes.","Do the Listening test with hints on, and always read the transcript afterwards.","Learn 10 new words a day from the word list below, with a sentence each.","Write one short Task 1 every week. Use the simple plan shown on the Writing page.","Practise Speaking Part 1 daily: answer, give a reason, give an example."]},
 intermediate:{h:"Intermediate plan · from band 5.5–6 to 6.5–7",items:["Find your weakest module on the Home page and give it half your study time.","For every wrong Reading answer, underline the exact words that prove the answer.","Write one Task 2 essay a week in 40 minutes and fix the 'Fix these first' list.","Stop memorising speaking answers. Practise extending ideas with because, for example, and however.","Learn word families: economy, economic, economical, economically."]},
 advanced:{h:"Advanced plan · from band 6.5–7 to 7.5+",items:["Do every test in exam mode: audio plays once, with the timer on.","Focus on Not Given vs False. Ask: does the text say the opposite, or say nothing?","In Writing, aim for fully extended ideas. Each body paragraph needs claim, reason, consequence, example.","Collect collocations, not single words: 'pose a threat', 'a marked increase'.","Record your speaking answers and listen back for repeated words and long pauses."]},
 professional:{h:"Professional plan · holding band 8+",items:["Practise under full exam conditions, back to back, to build stamina.","Hunt for small accuracy errors: articles, prepositions, subject-verb agreement.","Use precise, less common vocabulary only where it is natural.","In Speaking Part 3, speculate and compare: 'It could be argued that…', 'Whereas in the past…'.","Ask the AI Tutor to mark you strictly and only list what stops you reaching 9."]}};
const TIPS=[
 ["Listening","--lis",["Read the questions before the audio starts and guess the type of answer (a number, a name, a place).","Speakers often change their mind. The first thing you hear is often a trap.","Check spelling and plurals. A wrong spelling is a wrong answer.","Write numbers as digits; it is faster and safer."]],
 ["Reading","--rea",["Do not read every word first. Skim each paragraph for its main idea in 10 seconds.","Answers to completion and TFNG questions usually come in text order.","NOT GIVEN means the text says nothing about it. FALSE means the text says the opposite.","Never spend more than 20 minutes on one passage."]],
 ["Writing","--wri",["Task 1: always write an overview of the main trends. No overview means a maximum of band 5 for Task Achievement.","Task 2: answer every part of the question and make your opinion clear in the introduction and conclusion.","Plan for 5 minutes before you write. It saves time later.","Leave 3 minutes to check articles, verb tenses and plurals."]],
 ["Speaking","--spk",["It is a conversation, not a quiz. Long, natural answers score higher than perfect short ones.","If you do not understand, ask: 'Could you repeat the question, please?' It costs nothing.","In Part 2, use all four bullet points as your plan and keep talking until the examiner stops you.","Pronunciation is a quarter of your score. Speak clearly at a steady pace, not fast."]]];
const VOCAB=[["Significant","Large or important. 'There was a significant rise in prices.'"],["Fluctuate","Go up and down. 'Sales fluctuated between 2010 and 2015.'"],["Considerably","By a large amount. 'India's figure grew considerably.'"],["Whereas","Shows contrast. 'Canada was stable, whereas India grew fast.'"],["Detrimental","Harmful. 'Too much screen time is detrimental to sleep.'"],["Alleviate","Make a problem less bad. 'Public transport could alleviate traffic.'"],["Inevitably","Certainly, cannot be avoided. 'Prices will inevitably rise.'"],["Prioritise","Put first. 'Governments should prioritise education.'"],["A wide range of","Many different. 'Cities offer a wide range of jobs.'"],["To a certain extent","Partly. 'I agree to a certain extent.'"],["Substantial","Large in amount. 'A substantial number of people work from home.'"],["Consequently","As a result. 'Consequently, traffic has fallen.'"]];
function renderLearn(){
  const p=PLANS[S.level];$("#lvlPlan").innerHTML=`<span class="eyebrow">Your level: ${LEVELS[S.level]}</span><h3>${esc(p.h)}</h3><ul>${p.items.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>`;
  $("#tips").innerHTML=TIPS.map(([n,c,l])=>`<div class="tip" style="--c:var(${c})"><h3>${n}</h3><ul>${l.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`).join("");
  $("#vocab").innerHTML=VOCAB.map(([w,d])=>`<div class="vw"><b>${esc(w)}</b><span>${esc(d)}</span></div>`).join("");
}

/* ---------- tutor ---------- */
let chat=[];
const CHIPS=["What is the difference between FALSE and NOT GIVEN?","Give me 5 linking words for Task 2 with examples","Check my sentence: 'The number of people who uses internet increased.'","How can I stop saying 'um' in speaking?","Explain how the overall band is calculated"];
function renderChat(){
  $("#chat").innerHTML=chat.length?chat.map(m=>`<div class="msg ${m.role==="user"?"me":"ai"}">${esc(m.content)}</div>`).join(""):`<div class="msg ai">Hi! I'm your IELTS tutor. Ask me about grammar, vocabulary, strategies, or paste a paragraph and I'll check it. Try one of the questions above.</div>`;
}
async function sendTutor(text){
  text=(text||"").trim();if(!text)return;
  chat.push({role:"user",content:text});$("#tIn").value="";
  chat.push({role:"assistant",content:"Thinking…"});renderChat();
  const hist=chat.slice(0,-1).slice(-10);
  $("#tSend").disabled=true;
  try{const r=await ai("tutor",{messages:hist});chat[chat.length-1].content=r.text;}
  catch(e){chat[chat.length-1].content=aiErr(e);}
  finally{$("#tSend").disabled=false;renderChat();window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"});}
}
function initTutor(){
  $("#chips").innerHTML=CHIPS.map((c,i)=>`<button class="chip" type="button" data-i="${i}">${esc(c)}</button>`).join("");
  $("#chips").onclick=e=>{const b=e.target.closest(".chip");if(b)sendTutor(CHIPS[+b.dataset.i]);};
  $("#tSend").onclick=()=>sendTutor($("#tIn").value);
  $("#tIn").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendTutor($("#tIn").value);}});
  renderChat();
}

/* ---------- level effects + routing ---------- */
function applyLevel(){
  const once=S.level==="advanced"||S.level==="professional";
  $("#lisRule").textContent=once?"Exam mode for your level: each recording plays once, at normal speed. Read the questions first.":S.level==="beginner"?"Beginner mode: slower voices, replay as often as you like, and the transcript is open to help you.":"Practice mode: normal-ish speed and you can replay. Try to answer after one listen first.";
  $("#lisTx").hidden=S.level!=="beginner";
  $("#readRule").textContent=S.level==="beginner"?"Beginner mode: no time pressure. Find the paragraph for each question and read it slowly.":S.level==="intermediate"?"Aim to finish in 20 minutes. Start the timer when you feel ready.":"Exam pace: about 20 minutes for these two passages. Start the timer before you begin.";
  $("#play1").disabled=$("#play2").disabled=false;played[1]=played[2]=0;
  renderLearn();renderWriting();renderSpk();
}
const VIEWS=["home","listening","reading","writing","speaking","learn","tutor"];
function route(){
  const h=(location.hash||"#home").slice(1);const v=VIEWS.includes(h)?h:"home";
  VIEWS.forEach(x=>{$("#view-"+x).hidden=x!==v;});
  document.querySelectorAll("nav.tabs a").forEach(a=>a.setAttribute("aria-current",a.getAttribute("href")==="#"+v?"page":"false"));
  if("speechSynthesis" in window)speechSynthesis.cancel();
  if(typeof stopMic==="function")stopMic();
  window.scrollTo(0,0);
}
window.addEventListener("hashchange",route);

initHome();initListening();initReading();initWriting();initSpeaking();initTutor();
renderTRF();renderNext();applyLevel();route();
})();
