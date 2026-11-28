/* 和声道場 audio.js — 音の再生(Web Audio の合成。平均律・純正律)。 */
"use strict";
/* ---------- 音 ---------- */
let actx=null,wave=null,master=null,live=[],timers=[],playing=-1;
function ac(){
  if(!actx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;actx=new C();
    const n=12,re=new Float32Array(n),im=new Float32Array(n);for(let i=1;i<n;i++)im[i]=1/Math.pow(i,1.15);
    wave=actx.createPeriodicWave(re,im);const comp=actx.createDynamicsCompressor();master=actx.createGain();master.gain.value=0.8;master.connect(comp);comp.connect(actx.destination);}
  if(actx.state==='suspended')actx.resume();return actx;
}
const etF=m=>440*Math.pow(2,(m-69)/12);
const JR=[1,16/15,9/8,6/5,5/4,4/3,36/25,3/2,8/5,5/3,9/5,15/8];
function tone(f,t0,dur,vol){
  const o=actx.createOscillator(),g=actx.createGain();o.setPeriodicWave(wave);o.frequency.value=f;
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+0.03);g.gain.setValueAtTime(vol,Math.max(t0+0.04,t0+dur-0.08));g.gain.linearRampToValueAtTime(0,t0+dur);
  o.connect(g);g.connect(master);o.start(t0);o.stop(t0+dur+0.05);live.push(o);
}
function freqs(k,tuning){
  const N=[st.ans[k][0],st.ans[k][1],st.ans[k][2],st.ex.bass[k].note].filter(Boolean);
  if(tuning==='et')return N.map(n=>etF(midi(n)));
  const ch=st.ex.bass[k].chord,bm=midi(st.ex.bass[k].note);
  const rpc=mod(NAT[ch.root.l]+ch.root.a,12),rm=bm-mod(mod(bm,12)-rpc,12),rf=etF(rm);
  return N.map(n=>{const d=midi(n)-rm;return rf*Math.pow(2,Math.floor(d/12))*JR[mod(d,12)];});
}
function playChordAt(k,t0,dur,tuning){freqs(k,tuning).forEach(f=>tone(f,t0,dur,0.13));}
function stopAll(){live.forEach(o=>{try{o.stop();}catch(e){}});live=[];timers.forEach(clearTimeout);timers=[];playing=-1;render();}
function mark(k,at){timers.push(setTimeout(()=>{playing=k;render();},Math.max(0,(at-actx.currentTime)*1000)));}
function playNote(n){if(!ac())return;tone(etF(midi(n)),actx.currentTime+0.01,0.45,0.15);}
function playAll(){stopAll();if(!ac())return;let t=actx.currentTime+0.08;const d=st.tempo;
  for(let k=0;k<st.ex.bass.length;k++){playChordAt(k,t,d*0.96,st.tuning);mark(k,t);t+=d;}
  mark(-1,t);}
function playOne(){stopAll();if(!ac())return;const t=actx.currentTime+0.05;playChordAt(st.sel.k,t,st.tempo*1.4,st.tuning);mark(st.sel.k,t);mark(-1,t+st.tempo*1.4);}
function compare(){stopAll();if(!ac())return;const k=st.sel.k,d=Math.max(1.6,st.tempo*1.4);let t=actx.currentTime+0.05;
  playChordAt(k,t,d,'et');info('平均律で再生中…');timers.push(setTimeout(()=>info('純正律で再生中…'),(d+0.3)*1000));
  t+=d+0.3;playChordAt(k,t,d,'ji');timers.push(setTimeout(()=>render(),(d*2+0.5)*1000));}
