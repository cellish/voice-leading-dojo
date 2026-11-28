/* 和声道場 staff.js — 譜表の描画(SVG)と、譜表の上のクリック・ポインタの操作。 */
"use strict";
/* ---------- 譜表 ---------- */
const H=6,T0=46,B0=170,COLW=62;
const trebY=d=>T0+(38-d)*H, bassY=d=>B0+(26-d)*H;
const yOf=(v,d)=>v<2?trebY(d):bassY(d);
const SH_T=[38,35,39,36,33,37,34], FL_T=[34,37,33,36,32,35,31];
let geo={head:0,W:0};
const svg=document.getElementById('staff');
function sigList(){
  const sig=st.ex.key.sig;const sh=Object.values(sig).filter(a=>a>0).length,fl=Object.values(sig).filter(a=>a<0).length;
  return sh?{n:sh,pos:SH_T,g:'♯'}:{n:fl,pos:FL_T,g:'♭'};
}
function ledgers(v,d,x){
  const top=v<2?38:26,bot=v<2?30:18;let s='';
  for(let L=top+2;L<=d;L+=2)s+=`<line class="ledger" x1="${x-11}" x2="${x+11}" y1="${yOf(v,L)}" y2="${yOf(v,L)}"/>`;
  for(let L=bot-2;L>=d;L-=2)s+=`<line class="ledger" x1="${x-11}" x2="${x+11}" y1="${yOf(v,L)}" y2="${yOf(v,L)}"/>`;
  return s;
}
function drawStaff(res,playing){
  const ex=st.ex,K=ex.bass.length,ks=sigList();
  const head=50+ks.n*10+8,W=head+K*COLW+18,Hh=296;geo={head,W};
  svg.setAttribute('viewBox',`0 0 ${W} ${Hh}`);svg.setAttribute('width',W);svg.setAttribute('height',Hh);
  const sev={};res.issues.forEach((is,i)=>is.cells.forEach(([k,v])=>{const id=k+'_'+v;if(sev[id]!=='err')sev[id]=is.sev==='error'?'err':'warn';}));
  const foc=new Set(st.focus>=0&&res.issues[st.focus]?res.issues[st.focus].cells.map(c=>c[0]+'_'+c[1]):[]);
  let s='';
  for(let k=0;k<K;k++){const x=head+k*COLW;
    const cls=k===playing?'colplay':(k===st.sel.k?'colsel':'colbg');
    s+=`<rect class="${cls}" x="${x+2}" y="4" width="${COLW-4}" height="${Hh-8}" rx="6"/>`;
    s+=`<text class="cnum" x="${x+COLW/2}" y="14" text-anchor="middle">${k+1}</text>`;}
  for(let i=0;i<5;i++){s+=`<line class="sline" x1="6" x2="${W-6}" y1="${T0+i*2*H}" y2="${T0+i*2*H}"/>`;
    s+=`<line class="sline" x1="6" x2="${W-6}" y1="${B0+i*2*H}" y2="${B0+i*2*H}"/>`;}
  s+=`<line class="bar" x1="6" x2="6" y1="${T0}" y2="${B0+8*H}"/>`;
  s+=`<line class="bar" x1="${W-10}" x2="${W-10}" y1="${T0}" y2="${T0+8*H}"/><line class="bar" x1="${W-10}" x2="${W-10}" y1="${B0}" y2="${B0+8*H}"/>`;
  s+=`<line x1="${W-6}" x2="${W-6}" y1="${T0}" y2="${T0+8*H}" stroke="var(--staff)" stroke-width="3"/><line x1="${W-6}" x2="${W-6}" y1="${B0}" y2="${B0+8*H}" stroke="var(--staff)" stroke-width="3"/>`;
  s+=`<text id="clefT" class="clef" font-size="60">𝄞</text><text id="clefB" class="clef" font-size="60">𝄢</text>`;
  for(let i=0;i<ks.n;i++){const x=48+i*10,d=ks.pos[i];
    s+=`<text class="kacc" x="${x}" y="${trebY(d)+6}" text-anchor="middle">${ks.g}</text>`;
    s+=`<text class="kacc" x="${x}" y="${bassY(d-14)+6}" text-anchor="middle">${ks.g}</text>`;}
  for(let k=0;k<K;k++){
    const cx=head+k*COLW+COLW/2+4,N=[st.ans[k][0],st.ans[k][1],st.ans[k][2],ex.bass[k].note];
    for(let v=0;v<4;v++){const n=N[v];if(!n)continue;
      const d=dia(n),y=yOf(v,d);
      let x=cx;if(v===1&&N[0]&&Math.abs(dia(N[0])-d)<=1)x+=13;if(v===3&&N[2]&&Math.abs(dia(N[2])-d)<=1)x+=13;
      s+=ledgers(v,d,x);
      if(n.a!==ex.key.sig[n.l])s+=`<text class="acc" x="${x-16}" y="${y+6}" text-anchor="middle">${ACCG[n.a]}</text>`;
      const id=k+'_'+v;let c='nh';
      if(v===3)c+=' given';
      if(sev[id])c+=' '+sev[id];else if(k===st.sel.k&&v===st.sel.v)c+=' sel';
      s+=`<ellipse class="${c}" cx="${x}" cy="${y}" rx="6.4" ry="4.4" transform="rotate(-18 ${x} ${y})"/>`;
      if(foc.has(id))s+=`<circle class="halo" cx="${x}" cy="${y}" r="11"/>`;
    }
    const lines=ex.bass[k].fig?ex.bass[k].fig.split('/').map(t=>t.trim().replace(/#/g,'♯').replace(/(^|[^\d])b|b(?=$)/g,m=>m.replace('b','♭'))):[];
    lines.forEach((t,i)=>{s+=`<text class="fig" x="${cx}" y="${bassY(16)+30+i*15}" text-anchor="middle">${t}</text>`;});
  }
  const sk=st.sel.k,scx=head+sk*COLW+COLW/2+4;
  s+=`<text class="vmark" x="${scx}" y="${st.sel.v<2?T0-20:B0-16}" text-anchor="middle">${['S','A','T'][st.sel.v]}</text>`;
  s+=`<ellipse id="ghost" class="ghost" rx="6.4" ry="4.4" cx="-50" cy="-50"/>`;
  svg.innerHTML=s;fitClefs();
}
function fitClefs(){
  const fit=(id,x,y,h)=>{const el=document.getElementById(id);if(!el)return;try{el.setAttribute('x',0);el.setAttribute('y',0);el.removeAttribute('transform');
    const bb=el.getBBox();if(!bb.height)return;const sc=h/bb.height;
    el.setAttribute('transform',`translate(${x-bb.x*sc},${y-bb.y*sc}) scale(${sc})`);}catch(e){}};
  fit('clefT',12,T0-17,8*H+33);fit('clefB',13,B0-1,6*H+2);
}
function dFromY(v,y){const d=v<2?38-Math.round((y-T0)/H):26-Math.round((y-B0)/H);
  return v<2?Math.max(24,Math.min(43,d)):Math.max(12,Math.min(33,d));}
function svgPt(e){const r=svg.getBoundingClientRect();const sc=geo.W/r.width;return {x:(e.clientX-r.left)*sc,y:(e.clientY-r.top)*sc};}
function smartAcc(k,l){const t=st.ex.bass[k].chord.tones.find(t=>t.l===l);return t?t.a:st.ex.key.sig[l];}
svg.addEventListener('click',e=>{
  const p=svgPt(e),k=Math.floor((p.x-geo.head)/COLW);
  if(k<0||k>=st.ex.bass.length)return;
  const v=st.sel.v,d=dFromY(v,p.y),l=mod(d,7);
  const n={l,a:smartAcc(k,l),o:Math.floor(d/7)};
  st.ans[k][v]=n;st.focus=-1;
  if(st.cfg.sound)playNote(n);
  if(st.cfg.auto){if(v<2)st.sel={k,v:v+1};else st.sel={k:Math.min(k+1,st.ex.bass.length-1),v:k+1<st.ex.bass.length?0:2};}
  else st.sel={k,v};
  commit();
});
svg.addEventListener('pointermove',e=>{
  if(e.pointerType!=='mouse')return;const g=document.getElementById('ghost');if(!g)return;
  const p=svgPt(e),k=Math.floor((p.x-geo.head)/COLW);
  if(k<0||k>=st.ex.bass.length){g.setAttribute('cx',-50);return;}
  const d=dFromY(st.sel.v,p.y);g.setAttribute('cx',geo.head+k*COLW+COLW/2+4);g.setAttribute('cy',yOf(st.sel.v,d));
});
svg.addEventListener('pointerleave',()=>{const g=document.getElementById('ghost');if(g)g.setAttribute('cx',-50);});
