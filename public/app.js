"use strict";
import { browserRegistry } from "./engine/registry.js";
import { markAll, questionsOf } from "./engine/marker.js";
import * as itemtypes from "./engine/itemtypes/index.js";
import { esc } from "./engine/dom.js";
import { text as scoreText, fraction, fromRaw, aggregate } from "./engine/scale.js";

const $=s=>document.querySelector(s);
const registry=browserRegistry();

/* The exam this build opens on. The exam picker in Phase 2 makes this a choice. */
const EXAM_ID="ielts-academic";

/* Filled by boot() from public/content/ — the single source of truth, shared
   with the server. Nothing below hardcodes practice content any more. */
let EXAM=null, RUBRICS={}, LIS=null, REA=null, WT1=null, WT2=[], SPK=[], PATHS=null, TIPSET={}, VOCAB=[];
const MODS=[["listening","Listening","--lis"],["reading","Reading","--rea"],["writing","Writing","--wri"],["speaking","Speaking","--spk"]];
const LEVELS={beginner:"Beginner",intermediate:"Intermediate",advanced:"Advanced",professional:"Professional"};

/* ---------- state ---------- */
const KEY="bandup.v2";
const blankScores=()=>({listening:null,reading:null,writing:null,speaking:null});
let S={level:"beginner",target:6.5,exam:"",examId:EXAM_ID,byExam:{}};
/* `scores`, `writingTasks` and `plan` are views onto the current exam's slot. */
function loadState(){
  let raw=null,migrated=false;try{raw=localStorage.getItem(KEY);}catch(e){}
  if(raw){try{S=Object.assign(S,JSON.parse(raw));}catch(e){}}
  else{
    /* one-time migration: v1 stored a single IELTS score set */
    try{const old=localStorage.getItem("bandup.v1");
      if(old){const o=JSON.parse(old);
        if(o.level)S.level=o.level;
        if(o.target!=null)S.target=o.target;
        if(o.exam)S.exam=o.exam;
        S.byExam[EXAM_ID]={scores:Object.assign(blankScores(),o.scores||{}),writingTasks:{},plan:o.plan||null};
        migrated=true;}
    }catch(e){}
  }
  if(!S.examId)S.examId=EXAM_ID;
  slot();
  /* Persist straight away, so a migrated v1 profile survives even if the
     student never changes anything and v1's key is later cleared. */
  if(migrated)save();
}
function slot(){
  let b=S.byExam[S.examId];
  if(!b)b=S.byExam[S.examId]={scores:blankScores(),writingTasks:{},plan:null};
  if(!b.scores)b.scores=blankScores();
  if(!b.writingTasks)b.writingTasks={};
  S.scores=b.scores;S.writingTasks=b.writingTasks;S.plan=b.plan;
  return b;
}
function save(){
  const b=slot();b.scores=S.scores;b.writingTasks=S.writingTasks;b.plan=S.plan;
  try{localStorage.setItem(KEY,JSON.stringify({level:S.level,target:S.target,exam:S.exam,examId:S.examId,byExam:S.byExam}));}catch(e){}
}
loadState();

/* ---------- AI (server route /api/ai) ---------- */
async function ai(mode,payload){
  let r;
  try{r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({mode,examId:S.examId,level:S.level},payload))});}
  catch(e){throw new Error("No internet connection. Check your network and try again.");}
  let j={};try{j=await r.json();}catch(e){}
  if(!r.ok)throw new Error(j.error||"The AI examiner could not finish. Please try again.");
  return j;
}
const aiErr=e=>(e&&e.message)||"The AI examiner could not finish. Please try again.";

/* ---------- band maths ---------- */
const sectionOf=skill=>EXAM.sections.find(x=>x.skill===skill);
/* A short practice set is reported against the exam's full question count. */
function scoreFromRaw(correct,asked,skill){
  const sec=sectionOf(skill);
  return fromRaw(correct,{raw:Object.assign({},sec.raw,{asked})});
}
function overall(){
  const vals=MODS.map(m=>S.scores[m[0]]);
  if(vals.some(v=>v==null))return null;
  return aggregate(vals,EXAM.scale.overall.method,EXAM.scale);
}
const fmt=v=>scoreText(v,EXAM.scale);
const pct=v=>fraction(v,EXAM.scale)*100;
function setScore(mod,b){S.scores[mod]=b;save();renderTRF();renderNext();}
/* Writing is the weighted combination the real test uses, once both tasks exist. */
function setWritingTask(taskId,score){
  S.writingTasks[taskId]=score;
  const sec=sectionOf("writing");
  const have=sec.tasks.filter(t=>S.writingTasks[t.id]!=null);
  const combined=have.length
    ? aggregate(have.map(t=>S.writingTasks[t.id]),
        have.length===sec.tasks.length?sec.aggregate:"mean-round-half-band",
        EXAM.scale,{weights:have.map(t=>t.weight)})
    : null;
  setScore("writing",combined);
  return {combined,complete:have.length===sec.tasks.length};
}

/* ---------- home ---------- */
function renderTRF(){
  const cells=MODS.map(([k,n,c])=>{const b=S.scores[k];const w=b==null?0:pct(b);
    return `<a class="trf-cell" href="#${k}"><span class="lab">${n}</span><span class="val ${b==null?"empty":""}">${fmt(b)}</span><span class="bar"><i style="width:${w}%;background:var(${c})"></i></span></a>`;}).join("");
  const o=overall();
  $("#trfCells").innerHTML=cells+`<div class="trf-cell"><span class="lab">Overall</span><span class="val ${o==null?"empty":""}">${fmt(o)}</span><span class="bar"><i style="width:${o==null?0:pct(o)}%;background:var(--accent)"></i></span></div>`;
  const done=MODS.filter(m=>S.scores[m[0]]!=null).length;
  $("#trfNote").textContent=done===0?"No tests taken yet. Each score you earn fills a box.":done<4?`${done} of 4 modules done. Finish all four to see your overall ${EXAM.scale.label.toLowerCase()}.`:(o>=S.target?`You are at or above your target of ${fmt(S.target)}. Keep it steady.`:`You need ${fmt(+(S.target-o).toFixed(1))} more to reach your target of ${fmt(S.target)}.`);
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
  const sel=$("#targetSel"),sc=EXAM.scale,step=sc.step||1,lo=sc.min+(sc.max-sc.min)/2;
  for(let b=lo;b<=sc.max;b+=step){const o=document.createElement("option");o.value=b;o.textContent=`${sc.label} ${fmt(b)}`;sel.appendChild(o);}
  if(!S.target||S.target<sc.min||S.target>sc.max)S.target=aggregate([lo,sc.max],"mean-round-half-band",sc);
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
/* Rendering, collecting and clearing are delegated to engine/itemtypes/, so a new
   question type is a new module there and nothing here changes. */
function renderQs(host,qs){
  host.innerHTML=qs.map(q=>{
    const input=itemtypes.get(q.type).render(q);
    return `${q.head?`<div class="qhead">${esc(q.head)}</div>`:""}<div class="q" id="q-${q.id}"><span class="qn">${q.n}</span><div class="qbody">${q.prompt?`<span>${esc(q.prompt)}</span>`:""}${input}<div class="fbslot"></div></div></div>`;
  }).join("");
}
const collectQs=qs=>Object.fromEntries(qs.map(q=>[q.id,itemtypes.get(q.type).collect(q)]));
function markQs(qs){
  const marked=markAll(qs,collectQs(qs));
  qs.forEach(q=>{
    const r=marked.byId[q.id],el=document.getElementById("q-"+q.id);
    el.classList.toggle("ok",r.ok);el.classList.toggle("no",!r.ok);
    const showExplain=S.level!=="professional"||!r.ok;
    el.querySelector(".fbslot").innerHTML=`<div class="fb">${r.ok?"Correct.":`Answer: <b>${esc(r.shown)}</b>.`} ${showExplain?esc(r.explain):""}</div>`;
  });
  return marked.correct;
}
function clearQs(qs){qs.forEach(q=>{
  const el=document.getElementById("q-"+q.id);
  if(el){el.classList.remove("ok","no");el.querySelector(".fbslot").innerHTML="";}
  itemtypes.get(q.type).clear(q);});}
function resultBox(host,correct,asked,res,label){
  const sc=EXAM.scale,hi=sc.min+(sc.max-sc.min)*0.78,mid=sc.min+(sc.max-sc.min)*0.67;
  const tip=res.score>=hi?"Strong. Push for accuracy on the hardest question types.":res.score>=mid?"Good base. Review every wrong answer and find the exact words in the text or transcript.":"Read the explanations under each question. They show where the answer was hiding.";
  host.innerHTML=`<div class="result"><div class="bigband">${fmt(res.score)}</div><div class="stack" style="gap:4px"><b>${correct} / ${asked} correct</b><span class="muted">That is about ${res.raw}/${res.outOf} on the real ${label} test, which is ${sc.label.toLowerCase()} ${fmt(res.score)}.</span><span>${tip}</span></div></div>`;
  host.scrollIntoView({behavior:"smooth",block:"center"});
}

/* ---------- listening ---------- */
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
function lisQs(){return questionsOf(LIS);}
function initListening(){
  const p1=LIS.parts[0],p2=LIS.parts[1];
  renderQs($("#lisQ1"),p1.questions);renderQs($("#lisQ2"),p2.questions);
  const mk=(n,lines)=>{const b=$("#play"+n);b.onclick=()=>{
    const once=S.level==="advanced"||S.level==="professional";
    if(once&&played[n]>=1){$("#ps"+n).textContent="Exam mode: each recording plays once.";return;}
    played[n]++;if(once)b.disabled=true;
    speakLines(lines,null,$("#wave"+n),$("#ps"+n));};
    $("#stop"+n).onclick=()=>{if("speechSynthesis" in window)speechSynthesis.cancel();$("#wave"+n).classList.remove("on");$("#ps"+n).textContent="Stopped.";};};
  mk(1,p1.audio.lines);mk(2,p2.audio.lines);
  const tx=part=>`<div class="qhead">Part ${part.n}${part.context?" · "+esc(part.context):""}</div>`+part.audio.lines.map(([sp,t])=>`<p><b>${esc(sp)}:</b> ${esc(t)}</p>`).join("");
  $("#lisTxBody").innerHTML=tx(p1)+tx(p2);
  $("#lisSubmit").onclick=()=>{const qs=lisQs();const c=markQs(qs);
    const res=scoreFromRaw(c,qs.length,"listening");
    resultBox($("#lisResult"),c,qs.length,res,"Listening");setScore("listening",res.score);$("#lisTx").hidden=false;};
  $("#lisReset").onclick=()=>{clearQs(lisQs());$("#lisResult").innerHTML="";played[1]=played[2]=0;$("#play1").disabled=$("#play2").disabled=false;$("#ps1").textContent=$("#ps2").textContent="";$("#lisTx").hidden=S.level!=="beginner";};
}

/* ---------- reading ---------- */
let readTimer=null,readLeft=1200;
function initReading(){
  const pr=(p)=>`<h3 style="margin-bottom:12px">${esc(p.title)}</h3>`+p.paragraphs.map((t,i)=>`<p><span class="para">${"ABCDEFGH"[i]}</span>${esc(t)}</p>`).join("");
  $("#passage1").innerHTML=pr(REA.passages[0]);$("#passage2").innerHTML=pr(REA.passages[1]);
  const q1=REA.questions.filter(q=>q.passage===1),q2=REA.questions.filter(q=>q.passage===2);
  renderQs($("#readQ1"),q1);renderQs($("#readQ2"),q2);
  readLeft=(REA.minutes||20)*60;
  const show=()=>{const m=Math.floor(readLeft/60),s=readLeft%60;$("#readTimer").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;$("#readTimer").classList.toggle("low",readLeft<=120);};
  $("#readTimerBtn").onclick=()=>{if(readTimer){clearInterval(readTimer);readTimer=null;$("#readTimerBtn").textContent="Resume timer";return;}
    $("#readTimerBtn").textContent="Pause timer";readTimer=setInterval(()=>{readLeft--;show();if(readLeft<=0){clearInterval(readTimer);readTimer=null;$("#readSubmit").click();}},1000);};
  $("#readSubmit").onclick=()=>{if(readTimer){clearInterval(readTimer);readTimer=null;$("#readTimerBtn").textContent="Resume timer";}
    const qs=REA.questions;const c=markQs(qs);
    const res=scoreFromRaw(c,qs.length,"reading");
    resultBox($("#readResult"),c,qs.length,res,`${EXAM.name} Reading`);setScore("reading",res.score);};
  $("#readReset").onclick=()=>{clearQs(REA.questions);$("#readResult").innerHTML="";if(readTimer)clearInterval(readTimer);readTimer=null;readLeft=(REA.minutes||20)*60;show();$("#readTimerBtn").textContent="Start timer";};
  show();
}

/* ---------- writing ---------- */
let wTask=1,wIdx=0,wTimer=null,wLeft=1200;
/* Colours are presentation, so the view assigns them; the item carries only data. */
const SERIES_COLOURS=["--lis","--rea","--wri","--spk"];
function chartSVG(item){
  const ch_=item.chart,unit=ch_.unit||"",n=ch_.series.length;
  const W=560,H=300,L=44,R=12,T=16,B=60,ch=H-T-B,cw=W-L-R,gw=cw/ch_.years.length,bw=Math.max(10,Math.min(22,Math.floor((gw-12)/n)));
  const top=Math.max(100,...ch_.series.flatMap(x=>x.values));
  let g="";for(let v=0;v<=top;v+=Math.round(top/4)){const y=T+ch-v/top*ch;g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${L-8}" y="${y+4}" text-anchor="end" font-size="11" fill="var(--muted)" font-family="var(--mono)">${v}${unit}</text>`;}
  ch_.years.forEach((yr,i)=>{const x0=L+i*gw+(gw-bw*n-(n-1)*4)/2;
    ch_.series.forEach((ser,k)=>{const h=ser.values[i]/top*ch,x=x0+k*(bw+4);const c=SERIES_COLOURS[k%SERIES_COLOURS.length];
      g+=`<rect x="${x}" y="${T+ch-h}" width="${bw}" height="${h}" fill="var(${c})" rx="2"/><text x="${x+bw/2}" y="${T+ch-h-4}" text-anchor="middle" font-size="10" fill="var(--ink)" font-family="var(--mono)">${ser.values[i]}</text>`;});
    g+=`<text x="${L+i*gw+gw/2}" y="${T+ch+18}" text-anchor="middle" font-size="12" fill="var(--ink)" font-family="var(--mono)" font-weight="700">${yr}</text>`;});
  let lx=L;ch_.series.forEach((ser,k)=>{const c=SERIES_COLOURS[k%SERIES_COLOURS.length];
    g+=`<rect x="${lx}" y="${H-22}" width="12" height="12" fill="var(${c})" rx="2"/><text x="${lx+18}" y="${H-12}" font-size="12" fill="var(--ink)">${esc(ser.name)}</text>`;lx+=110;});
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(item.prompt)}"><title>${esc(item.title||"Chart")}</title>${g}</svg>`;
}
const wTaskSpec=()=>sectionOf("writing").tasks[wTask-1];
const wItem=()=>wTask===1?WT1:WT2[wIdx];
function wDraftKey(){return `bandup.draft.${S.examId}.${wTask}.${wTask===2?wIdx:0}`;}
function renderWriting(){
  $("#wt1").setAttribute("aria-pressed",wTask===1);$("#wt2").setAttribute("aria-pressed",wTask===2);
  const spec=wTaskSpec(),item=wItem();
  if(wTask===1){$("#wPrompt").innerHTML=`<span class="eyebrow">${esc(spec.name)} · ${spec.minutes} minutes · ${spec.minWords}+ words</span><p><b>${esc(item.prompt)}</b></p><p>${esc(item.instruction||"")}</p>`;$("#wChart").innerHTML=item.chart?chartSVG(item):"";$("#wPromptNav").innerHTML="";}
  else{$("#wPrompt").innerHTML=`<span class="eyebrow">${esc(spec.name)} · ${spec.minutes} minutes · ${spec.minWords}+ words</span><p><b>${esc(item.prompt)}</b></p><p>${esc(item.instruction||"")}</p>`;$("#wChart").innerHTML="";
    $("#wPromptNav").innerHTML=`<button class="btn ghost sm" id="wNext" type="button">Another question (${wIdx+1}/${WT2.length})</button>`;$("#wNext").onclick=()=>{wIdx=(wIdx+1)%WT2.length;renderWriting();};}
  const lvlTips=(TIPSET.writing&&TIPSET.writing.byLevel&&TIPSET.writing.byLevel[S.level])||[];
  const hint=lvlTips.find(t=>!t.task||t.task===spec.id);
  const hints=hint?hint.body:"";
  $("#wHint").innerHTML=`<b>Tip for your level:</b> ${esc(hints)}`;
  let d="";try{d=localStorage.getItem(wDraftKey())||"";}catch(e){}
  $("#wText").value=d;countW();$("#wResult").innerHTML="";
  wLeft=wTask===1?1200:2400;if(wTimer){clearInterval(wTimer);wTimer=null;}$("#wTimerBtn").textContent="Start timer";showWT();
}
function showWT(){const m=Math.floor(wLeft/60),s=wLeft%60;$("#wTimer").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;$("#wTimer").classList.toggle("low",wLeft<=180);}
function words(t){return (t.trim().match(/\b[\w'’-]+\b/g)||[]).length;}
function countW(){const n=words($("#wText").value),min=wTaskSpec().minWords;$("#wCount").textContent=`${n} words${n<min?` · ${min-n} to go`:""}`;$("#wCount").classList.toggle("under",n<min);}
/* Rows are built from rubric.criteria, so an exam with differently-named or
   differently-numbered criteria needs no change here. */
function critRows(rubric,got,colour){
  const rows=rubric.criteria.map(c=>{
    const v=got&&got[c.key],score=v&&v.band,why=v&&v.why;
    return `<div class="crit-row"><span class="nm">${esc(c.name)}</span><span class="sc">${fmt(score)}</span><div class="track"><i style="width:${score==null?0:pct(score)}%;background:var(${colour})"></i></div>${why?`<span class="why">${esc(why)}</span>`:""}</div>`;
  });
  const unmarked=(rubric.cannotAssess||[]).map(c=>
    `<div class="crit-row"><span class="nm">${esc(c.name)}</span><span class="sc">–</span><div class="track"></div><span class="why">${esc(c.why)}</span></div>`);
  return `<div class="crit">${rows.concat(unmarked).join("")}</div>`;
}
const critScores=(rubric,got)=>rubric.criteria.map(c=>+(got&&got[c.key]&&got[c.key].band));
async function scoreWriting(){
  const text=$("#wText").value.trim(),out=$("#wResult");
  if(words(text)<40){out.innerHTML=`<p class="note warn">Write at least a few sentences first, so the examiner has something to mark.</p>`;return;}
  $("#wScore").disabled=true;out.innerHTML=`<div class="thinking"><span class="spin"></span>The examiner is reading your answer…</div>`;
  const spec=wTaskSpec(),rubric=RUBRICS[spec.rubric];
  try{
    const r=await ai("writing",{itemId:wItem().id,text});
    const c=r.criteria||{};
    const ov=aggregate(critScores(rubric,c),rubric.aggregate,EXAM.scale);
    const combined=setWritingTask(spec.id,ov);
    out.innerHTML=`<div class="result"><div class="bigband">${fmt(ov)}</div><div class="stack" style="gap:4px"><b>${esc(spec.name)} estimate</b><span>${esc(r.summary||"")}</span></div></div>
      <div class="card">${critRows(rubric,c,"--wri")}</div>
      ${(r.strengths||[]).length?`<div class="note"><b>What you did well:</b> ${r.strengths.map(esc).join(" ")}</div>`:""}
      <h3>Fix these first</h3><div class="stack">${(r.fixes||[]).map(f=>`<div class="fix"><s>${esc(f.original)}</s><ins>${esc(f.better)}</ins><span class="muted">${esc(f.why)}</span></div>`).join("")}</div>
      ${r.next_step?`<p class="note"><b>Next step:</b> ${esc(r.next_step)}</p>`:""}
      ${r.model_paragraph?`<details class="tx"><summary>See one paragraph rewritten half a band higher</summary><p>${esc(r.model_paragraph)}</p></details>`:""}
      <p class="muted" style="font-size:.85rem">${combined.complete?`Your Writing score is ${fmt(S.scores.writing)}, combining both tasks with Task 2 weighted twice, as the real test does.`:`Do the other Writing task too — the real test weights Task 2 twice as heavily, so your Writing score is provisional until both are marked.`} AI estimates can differ from a human examiner by about half a ${EXAM.scale.label.toLowerCase()}.</p>`;
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
let spk={set:0,step:0,answers:[],timer:null,left:0,phase:""};
/* Steps are derived from whatever parts the set declares, so a CELPIP set of
   eight single-question parts walks through the same runner. */
function spkSteps(){
  const set=SPK[spk.set];
  return set.parts.flatMap(part=>part.cue
    ? [{part:part.n,q:part.cue.topic,cue:part.cue,kind:part.kind}]
    : (part.questions||[]).map(q=>({part:part.n,q,kind:part.kind})));
}
function say(t){if(!("speechSynthesis" in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);const v=voices.find(v=>/en-GB/i.test(v.lang))||voices[0];if(v)u.voice=v;u.rate=RATE();speechSynthesis.speak(u);}
function renderSpk(){
  stopMic();
  const steps=spkSteps(),st=steps[spk.step],card=$("#spkCard");
  if(spk.timer){clearInterval(spk.timer);spk.timer=null;}
  const bar=`<div class="steps" aria-label="Question ${spk.step+1} of ${steps.length}">${steps.map((_,i)=>`<i class="${i<spk.step?"done":i===spk.step?"now":""}"></i>`).join("")}</div>`;
  const partInfo={1:"Part 1 · Short answers about you (2–3 sentences)",2:"Part 2 · Long turn: 1 minute to prepare, up to 2 minutes to speak",3:"Part 3 · Discussion: give opinions, reasons and examples"}[st.part];
  const spkTips=(TIPSET.speaking&&TIPSET.speaking.byLevel&&TIPSET.speaking.byLevel[S.level])||[];
  const tips=spkTips.length?spkTips[0].body:"";
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
    const r=await ai("speaking",{itemId:SPK[spk.set].id,answers:steps.map((_,i)=>spk.answers[i]||"")});
    const rubric=RUBRICS[sectionOf("speaking").rubric];
    const ov=aggregate(critScores(rubric,r),rubric.aggregate,EXAM.scale);
    setScore("speaking",ov);
    out.innerHTML=`<div class="result"><div class="bigband">${fmt(ov)}</div><div class="stack" style="gap:4px"><b>Speaking estimate (3 of 4 criteria)</b><span>${esc(r.summary||"")}</span></div></div>
      <div class="card">${critRows(rubric,r,"--spk")}
      <p class="note warn" style="margin-top:12px"><b>Pronunciation is not scored here.</b> Text cannot show how you sound. ${esc(r.pronunciation_tip||"")}</p></div>
      ${r.best_answer?`<p class="note"><b>Your best answer:</b> ${esc(r.best_answer)}</p>`:""}
      <h3>Say it better</h3><div class="stack">${(r.upgrades||[]).map(u=>`<div class="fix"><span class="muted" style="font-size:.85rem">${esc(u.question||"")}</span><s>${esc(u.original)}</s><ins>${esc(u.better)}</ins><span class="muted">${esc(u.why)}</span></div>`).join("")}</div>
      ${r.model_part2?`<details class="tx"><summary>Hear a band 7.5 model Part 2 answer</summary><p>${esc(r.model_part2)}</p><button class="btn sm" type="button" id="sModel">🔊 Play model answer</button></details>`:""}
      <div class="row"><button class="btn ghost" id="sAgain" type="button">Start a new speaking test</button></div>`;
    if(r.model_part2)$("#sModel").onclick=()=>say(r.model_part2);
    $("#sAgain").onclick=()=>{spk.set=(spk.set+1)%SPK.length;$("#spkSet").value=spk.set;spk.step=0;spk.answers=[];out.innerHTML="";renderSpk();window.scrollTo({top:0,behavior:"smooth"});};
    out.scrollIntoView({behavior:"smooth",block:"start"});
  }catch(e){out.innerHTML=`<p class="note warn">${esc(aiErr(e))}</p>`;}
  finally{const b=$("#sNext");if(b)b.disabled=false;}
}
function initSpeaking(){
  const sel=$("#spkSet");SPK.forEach((set,i)=>{const o=document.createElement("option");o.value=i;o.textContent=set.name;sel.appendChild(o);});
  sel.onchange=()=>{spk.set=+sel.value;spk.step=0;spk.answers=[];$("#spkResult").innerHTML="";renderSpk();};
  renderSpk();
}

/* ---------- learn ---------- */
function renderLearn(){
  const p=PATHS.levels[S.level];
  $("#lvlPlan").innerHTML=`<span class="eyebrow">Your level: ${LEVELS[S.level]}</span><h3>${esc(p.heading)}</h3><ul>${p.steps.map(i=>`<li>${esc(i)}</li>`).join("")}</ul>`;
  $("#tips").innerHTML=MODS.map(([k,n,c])=>{
    const t=TIPSET[k];if(!t)return "";
    const lvl=(t.byLevel&&t.byLevel[S.level])||[];
    const items=t.general.concat(lvl).map(x=>`<li>${esc(x.body)}</li>`).join("");
    return `<div class="tip" style="--c:var(${c})"><h3>${esc(n)}</h3><ul>${items}</ul></div>`;}).join("");
  $("#vocab").innerHTML=VOCAB.map(v=>`<div class="vw"><b>${esc(v.word)}</b><span>${esc(v.meaning)}</span></div>`).join("");
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
/* ---------- boot ---------- */
/* Everything above reads from the pack, so nothing can run until it is loaded. */
async function boot(){
  EXAM=await registry.exam(S.examId);
  const sec=skill=>EXAM.sections.find(x=>x.skill===skill);
  const src=async skill=>(sec(skill).sharesItemsWith||S.examId);

  const [lisSrc,spkSrc]=await Promise.all([src("listening"),src("speaking")]);
  const [lis,rea,wt1,...wt2]=await Promise.all([
    registry.item(`${lisSrc}/listening/set-01`),
    registry.item(`${S.examId}/reading/set-01`),
    registry.item(`${S.examId}/writing/${sec("writing").tasks[0].id}-01`),
    ...["01","02","03","04"].map(n=>registry.item(`${S.examId}/writing/task2-${n}`)),
  ]);
  LIS=lis;REA=rea;WT1=wt1;WT2=wt2;
  SPK=await Promise.all(["01","02","03"].map(n=>registry.item(`${spkSrc}/speaking/set-${n}`)));

  const names=new Set();
  for(const x of EXAM.sections){if(x.rubric)names.add(x.rubric);for(const t of x.tasks||[])if(t.rubric)names.add(t.rubric);}
  for(const n of names)RUBRICS[n]=await registry.rubric(S.examId,n);

  PATHS=await registry.learning(S.examId,"paths");
  VOCAB=(await registry.learning(S.examId,"vocab")).words;
  for(const [k] of MODS)TIPSET[k]=await registry.tips(S.examId,k);

  document.title=`BandUp ${EXAM.name} · Free practice with AI ${EXAM.scale.label.toLowerCase()} scores`;
  initHome();initListening();initReading();initWriting();initSpeaking();initTutor();
  renderTRF();renderNext();applyLevel();route();
  window.addEventListener("hashchange",route);
}

boot().catch(err=>{
  console.error(err);
  const main=document.querySelector("main")||document.body;
  main.innerHTML=`<div class="wrap"><p class="note warn">BandUp could not load its practice content (${esc(err.message)}). Please reload the page.</p></div>`;
});
