/* 和声道場 theory.js
 * 音名・調・数字付き低音の解析・規則の判定(check)。DOM・localStorage・画面の状態に触れない純粋な計算部。
 * ブラウザ(globalThis.VLT)と Node(module.exports)のどちらでも動く。
 * check(ex, ans, cfg) は課題・解答・設定を引数で受け取る(画面の状態 st は読まない)。
 * 音高の計算は書法コア(vendor/dojo-shared/core/。直接編集しない)に任せ、ここは VL の形 {l, a, o} との薄い包みだけ。
 * ブラウザでは vendor/dojo-shared/core/src/ の pitch.js → time.js → key.js の後に読み込む。
 */
(function(root){
'use strict';
const isNode=typeof module!=='undefined'&&module.exports;
const CORE='../vendor/dojo-shared/core/src/';
const C=isNode?Object.assign({},require(CORE+'pitch.js'),require(CORE+'time.js'),require(CORE+'key.js')):root.DojoCore;
if(!C||!C.toMidi||!C.keySignature)throw new Error('theory.js は vendor/dojo-shared/core/src/ の pitch.js・time.js・key.js の後に読み込む');
/* ---------- 基本 ---------- */
const VN=['ソプラノ','アルト','テノール','バス'];
const mod=(x,m)=>((x%m)+m)%m;
/* VL の音 {l, a, o} ↔ コアの音高 {step, alter}(step = o*7 + l)・音名 {letter, alter} */
const dia=n=>n.o*7+n.l;
const toPitch=n=>({step:dia(n),alter:n.a});
const toClass=n=>({letter:n.l,alter:n.a});
const fromPitch=p=>({l:mod(p.step,7),a:p.alter,o:Math.floor(p.step/7)});
const fromClass=p=>({l:p.letter,a:p.alter});
const midi=n=>C.toMidi(toPitch(n));
const pc=n=>C.pitchClassNumber(toClass(n)); // 半音の数 0〜11(オクターヴの無い音でもよい)
const same=(a,b)=>!!a&&!!b&&C.sameSpelling(toClass(a),toClass(b));
const ACCG={'-2':'𝄫','-1':'♭','0':'♮','1':'♯','2':'𝄪'};

/* ---------- 課題（例題はこのドリル用の自作） ---------- */
const EXAMPLES=[
  {id:'ex1',title:'例題1　基本形の三和音',text:'C  C3 A2 F2 G2 C3 F2 G2 C3'},
  {id:'ex2',title:'例題2　第1転回形（6）',text:'G  G2 C3 A2 D3 B2:6 C3 D3 G2'},
  {id:'ex3',title:'例題3　6/4と7',text:'F  F2 Bb2 G2 C3 A2:6 Bb2 C3:6/4 C3:7 F2'},
  {id:'ex4',title:'例題4　短調と導音（＋）',text:'a  A2 C3:6 D3:6 E3:+ F3 D3:6 E3:7/+ A2'},
  {id:'ex5',title:'例題5　6/5と4/3',text:'D  D3 C#3:6/5 D3 E3:4/3 F#3:6 G3 A3:6/4 A3:7 D3'},
  {id:'ex6',title:'例題6　4/2',text:'Bb  Bb2 Eb3 F3 Eb3:4/2 D3:6 Eb3 F3:6/4 F3:7 Bb2'}
];

/* ---------- 規則 ---------- */
const RULES=[
  {id:'chordTone',name:'和音の構成音でない音',sev:'error'},
  {id:'missingTone',name:'根音・第3音・第7音の欠落',sev:'error'},
  {id:'missingFifth',name:'三和音の第5音の省略',sev:'warn'},
  {id:'ltDouble',name:'導音の重複',sev:'error'},
  {id:'range',name:'声部の音域外',sev:'warn'},
  {id:'crossing',name:'声部の交差',sev:'error'},
  {id:'spacing',name:'隣り合う上声部の間隔が1オクターヴを超える',sev:'error'},
  {id:'parallel',name:'連続5度・連続8度（並行）',sev:'error'},
  {id:'contrary',name:'反行による連続5度・連続8度',sev:'error'},
  {id:'hidden',name:'外声の並達5度・8度（ソプラノ跳躍）',sev:'warn'},
  {id:'overlap',name:'声部の超越',sev:'warn'},
  {id:'ltOuter',name:'導音が主音へ進まない（ソプラノ）',sev:'error'},
  {id:'ltInner',name:'導音が主音へ進まない（内声）',sev:'warn'},
  {id:'seventh',name:'第7音が2度下行しない',sev:'error'},
  {id:'augMel',name:'増2度・増4度の旋律進行',sev:'error'},
  {id:'leap',name:'7度またはオクターヴを超える跳躍',sev:'warn'},
  {id:'sameDir',name:'4声すべてが同じ方向へ進む',sev:'warn'}
];
const RANGE=[[60,79],[55,74],[48,67],[40,60]]; // S A T B（MIDI）

/* ---------- 音名 ---------- */
// 表示は ♯・♭・𝄪・𝄫(コアの unicode)かドイツ式。oct===false ならオクターヴを付けない
function nName(n,oct,german){
  const s=C.formatPitchClass(toClass(n),{style:german?'german':'unicode'});
  return oct===false?s:s+n.o;
}
// "G2"・"C#3"・"Bb2"。オクターヴは1桁(0〜9)だけ受け付ける(VL の決まり)。読めなければ null
function parseNote(s){
  if(typeof s!=='string'||!/^\D+\d$/.test(s))return null;
  let p;try{p=C.parsePitch(s);}catch(e){return null;}
  return p.step<0?null:fromPitch(p);
}
/* 調のオブジェクト。tl・ta=主音、sig=文字番号ごとの調号の変化、scale=自然短音階/長音階、lt=導音、
 * name=日本語の調名、core=コアの調 {tonic, mode} */
function makeKey(l,a,mode){
  const key={tonic:{letter:l,alter:a},mode:mode==='maj'?'major':'minor'};
  return {tl:l,ta:a,mode,tpc:C.pitchClassNumber(key.tonic),sig:Object.assign({},C.keySignature(key).alters),
    scale:C.scaleOf(key,'natural').map(fromClass),lt:fromClass(C.leadingTone(key)),
    name:C.formatKey(key,{style:'ja'}),core:key};
}
// 大文字は長調、小文字は短調(VL の決まり)。変化記号は1つまで
function parseKey(s){
  if(typeof s!=='string'||!/^[A-Ga-g](#|♯|b|♭)?$/.test(s))return null;
  const t=C.parsePitchClass(s);
  return makeKey(t.letter,t.alter,s[0]===s[0].toUpperCase()?'maj':'min');
}

/* ---------- 数字付き低音の解釈 ---------- */
const ABBR={'':[5,3],'3':[5,3],'5':[5,3],'5,3':[5,3],'6':[6,3],'6,3':[6,3],'6,4':[6,4],
  '7':[7,5,3],'7,3':[7,5,3],'7,5':[7,5,3],'7,5,3':[7,5,3],'6,5':[6,5,3],'6,5,3':[6,5,3],
  '4,3':[6,4,3],'6,4,3':[6,4,3],'2':[6,4,2],'4,2':[6,4,2],'6,4,2':[6,4,2]};
const SHAPE={'5,3':{root:1,sev:0},'6,3':{root:6,sev:0},'6,4':{root:4,sev:0},
  '7,5,3':{root:1,sev:7},'6,5,3':{root:6,sev:5},'6,4,3':{root:4,sev:3},'6,4,2':{root:2,sev:1}};
function parseFig(fig,bass,key,opts){
  const o=Object.assign({plus4:true,plus6:false},opts||{});
  let items=[];
  if(fig){for(const raw of fig.split('/')){const t=raw.trim();if(!t)continue;
    const m=/^([+#♯b♭♮])?(\d+)?([+#♯b♭♮])?$/.exec(t);
    if(!m||(m[1]&&m[3]))throw new Error('数字「'+fig+'」を読めません');
    items.push({n:m[2]?+m[2]:3,mark:m[1]||m[3]||''});}}
  if(items.length===1&&items[0].mark==='+'){
    if(items[0].n===4&&o.plus4)items=[{n:6,mark:''},{n:4,mark:'+'},{n:2,mark:''}];
    else if(items[0].n===6&&o.plus6)items=[{n:6,mark:'+'},{n:4,mark:''},{n:3,mark:''}];
  }
  const ns=[...new Set(items.map(i=>i.n))].sort((a,b)=>b-a);
  const full=ABBR[ns.join(',')]||ns;
  const marks={};items.forEach(i=>{if(i.mark)marks[i.n]=i.mark;});
  const tones=[{n:1,l:bass.l,a:bass.a}];
  for(const n of full){
    const l=(bass.l+n-1)%7;let a=key.sig[l];const mk=marks[n]||'';
    if(mk==='#'||mk==='♯')a+=1;else if(mk==='b'||mk==='♭')a-=1;else if(mk==='♮')a=0;
    else if(mk==='+')a=(l===key.lt.l)?key.lt.a:a+1;
    tones.push({n,l,a});
  }
  const shape=SHAPE[full.join(',')];
  const rootN=shape?shape.root:1;
  const root=tones.find(t=>t.n===rootN);
  const byL=l=>tones.find(t=>t.l===l)||null;
  const third=byL((root.l+2)%7),fifth=byL((root.l+4)%7);
  const seventh=shape&&shape.sev?tones.find(t=>t.n===shape.sev):null;
  return {tones,root,third,fifth,seventh,known:!!shape,
    sig:full.join(',')+'|'+root.l+'|'+root.a};
}
function parseExercise(text,opts){
  const tk=text.trim().split(/\s+/).filter(Boolean);
  if(tk.length<2)throw new Error('調とバス音を1つ以上入れてください');
  const key=parseKey(tk[0]);if(!key)throw new Error('調「'+tk[0]+'」を読めません（例：C、a、Bb、f#）');
  const bass=[];
  tk.slice(1).forEach((t,i)=>{
    const p=t.indexOf(':');const ns=p<0?t:t.slice(0,p),fig=p<0?'':t.slice(p+1);
    const note=parseNote(ns);if(!note)throw new Error((i+1)+'番目のバス「'+ns+'」を読めません（例：G2、C#3、Bb2）');
    let chord;try{chord=parseFig(fig,note,key,opts);}catch(e){throw new Error((i+1)+'番目：'+e.message);}
    bass.push({note,fig,chord});
  });
  if(bass.length>32)throw new Error('バス音は32個までにしてください');
  return {key,bass,text};
}

/* ---------- チェック ---------- */
const P5=(x,y)=>{const s=Math.abs(midi(x)-midi(y)),g=Math.abs(dia(x)-dia(y));return s%12===7&&g%7===4?'5度':(s%12===0&&g%7===0?(s===0?'1度':'8度'):null);};
function check(ex,ans,cfg){
  const out=[],K=ex.bass.length,key=ex.key,nm=(n,oct)=>nName(n,oct,cfg.german);
  const add=(rule,cells,where,msg)=>{const sev=cfg.sev[rule];if(sev&&sev!=='off')out.push({rule,sev,cells,where,msg});};
  const notes=k=>[ans[k][0],ans[k][1],ans[k][2],ex.bass[k].note];
  let incomplete=0;
  for(let k=0;k<K;k++){
    const N=notes(k),ch=ex.bass[k].chord,w='第'+(k+1)+'和音';
    if(N.slice(0,3).some(x=>!x))incomplete++;
    for(let v=0;v<3;v++){const n=N[v];if(!n)continue;
      if(!ch.tones.some(t=>same(t,n)))add('chordTone',[[k,v]],w,VN[v]+'の '+nm(n)+' は構成音ではありません（構成音：'+ch.tones.map(t=>nm(t,false)).filter((x,i,a)=>a.indexOf(x)===i).join('・')+'）');
      const m=midi(n);if(m<RANGE[v][0]||m>RANGE[v][1])add('range',[[k,v]],w,VN[v]+'の '+nm(n)+' は音域外です');
    }
    if(N.every(Boolean)){
      const has=t=>t&&N.some(n=>same(n,t));
      if(ch.known){
        const miss=[];if(!has(ch.root))miss.push('根音');if(!has(ch.third))miss.push('第3音');if(ch.seventh&&!has(ch.seventh))miss.push('第7音');
        if(miss.length)add('missingTone',[[k,0],[k,1],[k,2]],w,miss.join('・')+'が欠けています');
        else if(!ch.seventh&&ch.fifth&&!has(ch.fifth))add('missingFifth',[[k,0],[k,1],[k,2]],w,'第5音が省略されています');
      }
      const lts=[];N.forEach((n,v)=>{if(same(n,key.lt))lts.push([k,v]);});
      if(lts.length>1)add('ltDouble',lts,w,'導音 '+nm(key.lt,false)+' が重複しています');
      for(let v=0;v<3;v++){if(midi(N[v])<midi(N[v+1]))add('crossing',[[k,v],[k,v+1]],w,VN[v]+'が'+VN[v+1]+'より低くなっています');}
      for(let v=0;v<2;v++){if(midi(N[v])-midi(N[v+1])>12)add('spacing',[[k,v],[k,v+1]],w,VN[v]+'と'+VN[v+1]+'の間が1オクターヴを超えています');}
    }
    if(k===K-1)continue;
    const M=notes(k+1),w2='第'+(k+1)+'→'+(k+2)+'和音',ch2=ex.bass[k+1].chord;
    const dm=[0,1,2,3].map(v=>N[v]&&M[v]?midi(M[v])-midi(N[v]):null);
    const dd=[0,1,2,3].map(v=>N[v]&&M[v]?dia(M[v])-dia(N[v]):null);
    for(let i=0;i<4;i++)for(let j=i+1;j<4;j++){
      if(!N[i]||!N[j]||!M[i]||!M[j])continue;
      const a=P5(N[i],N[j]),b=P5(M[i],M[j]);
      if(a&&b&&(a===b||(a!=='5度'&&b!=='5度'))&&dm[i]!==0&&dm[j]!==0){
        const kind=a==='5度'?'5度':'8度';
        const cells=[[k,i],[k,j],[k+1,i],[k+1,j]];
        if(Math.sign(dm[i])===Math.sign(dm[j]))add('parallel',cells,w2,VN[i]+'と'+VN[j]+'が連続'+kind+'です');
        else add('contrary',cells,w2,VN[i]+'と'+VN[j]+'が反行で連続'+kind+'です');
      }
      if(i===0&&j===3&&b&&!a&&dm[0]&&dm[3]&&Math.sign(dm[0])===Math.sign(dm[3])&&Math.abs(dm[0])>2)
        add('hidden',[[k+1,0],[k+1,3]],w2,'外声が並達'+(b==='5度'?'5度':'8度')+'です（ソプラノが跳躍）');
    }
    for(let v=0;v<3;v++){
      if(N[v]&&M[v+1]&&midi(M[v+1])>midi(N[v]))add('overlap',[[k,v],[k+1,v+1]],w2,VN[v+1]+'が前の和音の'+VN[v]+'より上へ超えています');
      else if(N[v+1]&&M[v]&&midi(M[v])<midi(N[v+1]))add('overlap',[[k,v+1],[k+1,v]],w2,VN[v]+'が前の和音の'+VN[v+1]+'より下へ超えています');
    }
    const domRoot=ch.root.l===(key.tl+4)%7||ch.root.l===(key.tl+6)%7;
    const tonicNext=ch2.tones.some(t=>t.l===key.tl&&t.a===key.ta);
    for(let v=0;v<3;v++){
      if(!N[v]||!M[v])continue;
      if(domRoot&&tonicNext&&same(N[v],key.lt)&&!(M[v].l===key.tl&&dm[v]===1))
        add(v===0?'ltOuter':'ltInner',[[k,v],[k+1,v]],w2,VN[v]+'の導音 '+nm(N[v])+' が主音へ進んでいません');
      if(ch.seventh&&same(N[v],ch.seventh)&&ch.sig!==ch2.sig&&!(dd[v]===-1&&(dm[v]===-1||dm[v]===-2)))
        add('seventh',[[k,v],[k+1,v]],w2,VN[v]+'の第7音 '+nm(N[v])+' が2度下行していません');
      const ad=Math.abs(dd[v]),am=Math.abs(dm[v]);
      if(ad===1&&am===3)add('augMel',[[k,v],[k+1,v]],w2,VN[v]+'が増2度で進んでいます');
      else if(ad===3&&am===6)add('augMel',[[k,v],[k+1,v]],w2,VN[v]+'が増4度で進んでいます');
      if(am>12||ad===6)add('leap',[[k,v],[k+1,v]],w2,VN[v]+'が'+(am>12?'オクターヴを超えて':'7度')+'跳躍しています');
    }
    if(dm.every(x=>x!==null&&x!==0)&&new Set(dm.map(Math.sign)).size===1)
      add('sameDir',[[k,0],[k,1],[k,2],[k+1,0],[k+1,1],[k+1,2]],w2,'4声すべてが'+(dm[0]>0?'上':'下')+'行しています');
  }
  out.sort((a,b)=>(a.sev===b.sev?0:a.sev==='error'?-1:1));
  return {issues:out,incomplete};
}

const api={VN,mod,dia,midi,pc,same,toPitch,toClass,fromPitch,fromClass,ACCG,EXAMPLES,RULES,RANGE,
  nName,parseNote,makeKey,parseKey,ABBR,SHAPE,parseFig,parseExercise,P5,check};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.VLT=api;
})(typeof globalThis!=='undefined'?globalThis:this);
