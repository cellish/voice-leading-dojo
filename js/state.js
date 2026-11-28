/* 和声道場 state.js — 画面の状態 st と、localStorage への保存・読み込み。計算部(js/theory.js)の呼び出し口。
 * 保存のキー harmony-figured-bass-drill-v1 は変えない(以前の実施を残すため)。
 */
"use strict";
/* ---------- 基本（計算部は js/theory.js） ---------- */
const {VN,mod,dia,midi,pc,same,ACCG,EXAMPLES,RULES,RANGE,parseNote}=VLT;
/* ---------- 状態と保存 ---------- */
const KEY='harmony-figured-bass-drill-v1';
const st={exId:'ex1',ex:null,ans:[],sel:{k:0,v:0},tuning:'et',tempo:1.4,focus:-1,
  cfg:{sev:{},auto:true,sound:true,german:false,plus4:true,plus6:false},answers:{},custom:''};
RULES.forEach(r=>st.cfg.sev[r.id]=r.sev);
function load(){try{const s=JSON.parse(localStorage.getItem(KEY)||'null');if(!s)return;
  const defSev=st.cfg.sev;Object.assign(st.cfg,s.cfg||{});st.cfg.sev=Object.assign({},defSev,(s.cfg&&s.cfg.sev)||{});
  st.answers=s.answers||{};st.custom=s.custom||'';if(s.exId)st.exId=s.exId;if(s.tuning)st.tuning=s.tuning;if(s.tempo)st.tempo=s.tempo;}catch(e){}}
function save(){try{st.answers[st.exId]=st.ans;localStorage.setItem(KEY,JSON.stringify({cfg:st.cfg,answers:st.answers,custom:st.custom,exId:st.exId,tuning:st.tuning,tempo:st.tempo}));}catch(e){}}

/* ---------- 計算部の呼び出し（画面の状態 st を渡す） ---------- */
const nName=(n,oct)=>VLT.nName(n,oct,st.cfg.german);
const parseExercise=text=>VLT.parseExercise(text,st.cfg);
const check=()=>VLT.check(st.ex,st.ans,st.cfg);
