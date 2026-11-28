/* 和声道場 app.js — 画面の更新(render)、課題の切り替え、ボタン・キーの操作、設定、起動。 */
"use strict";
/* ---------- 画面 ---------- */
const $=id=>document.getElementById(id);
function info(msg){$('info').textContent=msg;}
function infoLine(){
  const k=st.sel.k,v=st.sel.v,n=st.ans[k][v],ch=st.ex.bass[k].chord;
  const tones=[ch.root,ch.third,ch.fifth,ch.seventh].filter(Boolean).map(t=>nName(t,false));
  const extra=ch.known?'':'（数字の形が未登録のため構成音の判定のみ）';
  $('info').innerHTML='';
  const b=document.createElement('b');b.textContent='第'+(k+1)+'和音・'+VN[v]+'：'+(n?nName(n):'未入力');
  $('info').append(b,document.createTextNode('　構成音（根音から）'+tones.join('・')+extra));
}
let lastRes=null;
function render(){
  const res=check();lastRes=res;
  drawStaff(res,playing);
  [0,1,2].forEach(v=>$('v'+v).setAttribute('aria-pressed',String(st.sel.v===v)));
  $('tEt').setAttribute('aria-pressed',String(st.tuning==='et'));$('tJi').setAttribute('aria-pressed',String(st.tuning==='ji'));
  infoLine();
  const er=res.issues.filter(i=>i.sev==='error').length,wa=res.issues.length-er,sm=$('summary');sm.innerHTML='';
  const pill=(c,t)=>{const p=document.createElement('span');p.className='pill '+c;p.textContent=t;sm.append(p);};
  if(er)pill('err','エラー '+er);if(wa)pill('warn','注意 '+wa);
  if(res.incomplete)pill('mute','未入力 '+res.incomplete+'和音');
  if(!er&&!wa)pill('ok',res.incomplete?'ここまで禁則なし':'禁則は見つかりません');
  const ul=$('issues');ul.innerHTML='';
  res.issues.forEach((is,i)=>{const li=document.createElement('li'),bt=document.createElement('button');
    if(i===st.focus)bt.className='on';
    const p=document.createElement('span');p.className='pill '+(is.sev==='error'?'err':'warn');p.textContent=is.sev==='error'?'エラー':'注意';
    const w=document.createElement('span');w.className='where';w.textContent=is.where;
    const m=document.createElement('span');m.className='msg';m.textContent=is.msg;
    bt.append(p,w,m);bt.addEventListener('click',()=>{st.focus=i===st.focus?-1:i;const c=is.cells[0];st.sel={k:c[0],v:Math.min(c[1],2)};render();});
    li.append(bt);ul.append(li);});
}
function commit(){save();render();}
function setEx(id){
  st.exId=id;const src=id==='custom'?{text:st.custom}:EXAMPLES.find(e=>e.id===id)||EXAMPLES[0];
  try{st.ex=parseExercise(src.text);}catch(e){st.exId='ex1';st.ex=parseExercise(EXAMPLES[0].text);}
  const K=st.ex.bass.length,saved=st.answers[st.exId];
  st.ans=Array.from({length:K},(_,k)=>saved&&saved[k]?saved[k].slice(0,3):[null,null,null]);
  st.sel={k:0,v:0};st.focus=-1;$('keyName').textContent=st.ex.key.name;fillSel();save();render();
}
function fillSel(){const s=$('exSel');s.innerHTML='';
  EXAMPLES.forEach(e=>{const o=document.createElement('option');o.value=e.id;o.textContent=e.title;s.append(o);});
  if(st.custom){const o=document.createElement('option');o.value='custom';o.textContent='自作課題';s.append(o);}
  s.value=st.exId;}
function reparse(){const keep=st.ans;try{const ex=parseExercise(st.ex.text);st.ex=ex;}catch(e){}st.ans=keep;render();}

$('exSel').addEventListener('change',e=>{stopAll();setEx(e.target.value);});
[0,1,2].forEach(v=>$('v'+v).addEventListener('click',()=>{st.sel.v=v;render();}));
function cur(){return st.ans[st.sel.k][st.sel.v];}
function step(dir){const n=cur();if(!n)return;const v=st.sel.v,d=dia(n)+dir;
  const lim=v<2?[24,43]:[12,33];if(d<lim[0]||d>lim[1])return;const l=mod(d,7);
  const m={l,a:smartAcc(st.sel.k,l),o:Math.floor(d/7)};st.ans[st.sel.k][v]=m;if(st.cfg.sound)playNote(m);commit();}
$('up').addEventListener('click',()=>step(1));$('down').addEventListener('click',()=>step(-1));
const setAcc=a=>{const n=cur();if(!n)return;n.a=a;if(st.cfg.sound)playNote(n);commit();};
$('accF').addEventListener('click',()=>setAcc(-1));$('accN').addEventListener('click',()=>setAcc(0));$('accS').addEventListener('click',()=>setAcc(1));
$('clr').addEventListener('click',()=>{st.ans[st.sel.k][st.sel.v]=null;st.focus=-1;commit();});
$('playAll').addEventListener('click',playAll);$('playOne').addEventListener('click',playOne);
$('cmp').addEventListener('click',compare);$('stop').addEventListener('click',stopAll);
$('tEt').addEventListener('click',()=>{st.tuning='et';commit();});$('tJi').addEventListener('click',()=>{st.tuning='ji';commit();});
$('tempo').addEventListener('input',e=>{st.tempo=+e.target.value;$('tempoV').textContent=st.tempo.toFixed(1)+'秒';save();});
document.addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  const K=st.ex.bass.length;
  if(e.key==='ArrowUp'){e.preventDefault();step(1);}else if(e.key==='ArrowDown'){e.preventDefault();step(-1);}
  else if(e.key==='ArrowRight'){st.sel.k=Math.min(K-1,st.sel.k+1);render();}else if(e.key==='ArrowLeft'){st.sel.k=Math.max(0,st.sel.k-1);render();}
  else if(e.key==='s'||e.key==='S'){st.sel.v=0;render();}else if(e.key==='a'||e.key==='A'){st.sel.v=1;render();}else if(e.key==='t'||e.key==='T'){st.sel.v=2;render();}
  else if(e.key==='Backspace'||e.key==='Delete'){st.ans[st.sel.k][st.sel.v]=null;commit();}
});

/* 設定 */
const rl=$('rules');
RULES.forEach(r=>{const lab=document.createElement('label');lab.htmlFor='rule-'+r.id;lab.textContent=r.name;
  const s=document.createElement('select');s.id='rule-'+r.id;
  [['error','エラー'],['warn','注意'],['off','オフ']].forEach(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;s.append(o);});
  s.addEventListener('change',()=>{st.cfg.sev[r.id]=s.value;st.focus=-1;commit();});rl.append(lab,s);});
const opts={oAuto:'auto',oSound:'sound',oGerman:'german',oPlus4:'plus4',oPlus6:'plus6'};
Object.entries(opts).forEach(([id,k])=>$(id).addEventListener('change',e=>{st.cfg[k]=e.target.checked;save();if(k==='plus4'||k==='plus6')reparse();else render();}));
let armed=false;
$('resetAns').addEventListener('click',e=>{if(!armed){armed=true;e.target.textContent='もう一度押すと消去します';setTimeout(()=>{armed=false;e.target.textContent='この課題の実施を消去';},3000);return;}
  armed=false;e.target.textContent='この課題の実施を消去';st.ans=st.ans.map(()=>[null,null,null]);st.sel={k:0,v:0};st.focus=-1;commit();});
$('loadCustom').addEventListener('click',()=>{const t=$('customText').value;$('customErr').textContent='';
  let ex;try{ex=parseExercise(t);}catch(e){$('customErr').textContent=e.message;return;}
  st.custom=t;delete st.answers.custom;stopAll();setEx('custom');$('customErr').textContent='読み込みました。'+(ex.warnings.length?'　注意：'+ex.warnings.join(''):'');});

/* 起動 */
load();
RULES.forEach(r=>$('rule-'+r.id).value=st.cfg.sev[r.id]);
Object.entries(opts).forEach(([id,k])=>$(id).checked=!!st.cfg[k]);
$('tempo').value=st.tempo;$('tempoV').textContent=(+st.tempo).toFixed(1)+'秒';
$('customText').value=st.custom||'';
setEx(st.exId);
// 例として例題1の冒頭2和音を実施済みにしておく（初回のみ）
if(st.exId==='ex1'&&!st.answers.ex1init&&st.ans.every(r=>r.every(x=>!x))){
  st.ans[0]=[{l:4,a:0,o:4},{l:2,a:0,o:4},{l:0,a:0,o:4}];
  st.ans[1]=[{l:0,a:0,o:5},{l:2,a:0,o:4},{l:0,a:0,o:4}];
  st.answers.ex1init=true;st.sel={k:2,v:0};commit();
}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>render());
