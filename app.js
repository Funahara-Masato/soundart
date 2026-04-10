'use strict';

// =====================================================================
//  画面管理
// =====================================================================
const screens = {
  home:       document.getElementById('screen-home'),
  recording:  document.getElementById('screen-recording'),
  generating: document.getElementById('screen-generating'),
  result:     document.getElementById('screen-result'),
};
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// =====================================================================
//  録音 & 周波数解析
// =====================================================================
class SoundRecorder {
  constructor() {
    this.audioCtx = null; this.analyser = null; this.stream = null;
    this.samples = []; this.frameId = null; this.timerId = null; this.secondsLeft = 10;
  }
  async start(onTick, onFinish) {
    this.samples = []; this.secondsLeft = 10;
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio:true, video:false });
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.75;
    source.connect(this.analyser);
    const bufLen = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufLen);
    let lastSample = 0;
    const loop = (ts) => {
      this.analyser.getByteFrequencyData(dataArray);
      onTick(dataArray);
      if (ts - lastSample > 100) { this.samples.push(new Uint8Array(dataArray)); lastSample = ts; }
      this.frameId = requestAnimationFrame(loop);
    };
    this.frameId = requestAnimationFrame(loop);
    this.timerId = setInterval(() => {
      this.secondsLeft--;
      updateCountdown(this.secondsLeft);
      if (this.secondsLeft <= 0) { this.stop(); onFinish(this.samples); }
    }, 1000);
  }
  stop() {
    cancelAnimationFrame(this.frameId); clearInterval(this.timerId);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.audioCtx) this.audioCtx.close();
  }
}

// =====================================================================
//  カウントダウンUI
// =====================================================================
const countdownEl    = document.getElementById('countdown');
const progressCircle = document.getElementById('progress-circle');
const CIRCUMFERENCE  = 2 * Math.PI * 54;

function updateCountdown(sec) {
  countdownEl.textContent = sec;
  progressCircle.style.strokeDashoffset = CIRCUMFERENCE * (1 - sec / 10);
}

// SVGグラデーション
(function() {
  const svg  = document.querySelector('.progress-ring');
  const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
  defs.innerHTML = `<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#a855f7"/><stop offset="100%" stop-color="#ec4899"/></linearGradient>`;
  svg.prepend(defs);
  progressCircle.setAttribute('stroke','url(#grad)');
  progressCircle.style.strokeDasharray = CIRCUMFERENCE;
  progressCircle.style.strokeDashoffset = 0;
})();

// =====================================================================
//  ビジュアライザー
// =====================================================================
const bars = Array.from({length:16},(_,i)=>document.getElementById(`bar${i}`));
function updateVisualizer(dataArray) {
  const step = Math.floor(dataArray.length / 16);
  bars.forEach((bar,i) => { bar.style.height = `${Math.max(4,(dataArray[i*step]/255)*56)}px`; });
}

// =====================================================================
//  周波数解析ユーティリティ
// =====================================================================
function avg(arr, s, e) {
  let sum=0; for(let i=s;i<e;i++) sum+=arr[i]; return sum/(e-s)||0;
}
function extractFeatures(samples) {
  return samples.map(data => {
    const len = data.length;
    return {
      bass:   avg(data,0,                    Math.floor(len*0.04)),
      mid:    avg(data,Math.floor(len*0.1),   Math.floor(len*0.35)),
      treble: avg(data,Math.floor(len*0.5),   len),
      energy: avg(data,0,len),
    };
  });
}
function computeDNA(features) {
  const n=features.length||1;
  const avgE  = features.reduce((s,f)=>s+f.energy,0)/n/255;
  const avgB  = features.reduce((s,f)=>s+f.bass,  0)/n/255;
  const avgM  = features.reduce((s,f)=>s+f.mid,   0)/n/255;
  const avgT  = features.reduce((s,f)=>s+f.treble,0)/n/255;
  const maxE  = Math.max(...features.map(f=>f.energy))/255;
  const energies=features.map(f=>f.energy/255);
  const variance=energies.reduce((s,e)=>s+(e-avgE)**2,0)/n;
  const dynamics=Math.sqrt(variance);
  let pc=0;
  for(let i=1;i<features.length-1;i++)
    if(features[i].energy>features[i-1].energy&&features[i].energy>features[i+1].energy) pc++;
  const peakDensity=pc/n;
  return {avgE,avgB,avgM,avgT,maxE,dynamics,peakDensity,hasSignal:maxE>0.02};
}

// =====================================================================
//  パーソナルベースライン
// =====================================================================
const BASELINE_KEY='soundart_baseline';
function loadBaseline(){try{return JSON.parse(localStorage.getItem(BASELINE_KEY))||[];}catch{return [];}}
function saveBaseline(h){localStorage.setItem(BASELINE_KEY,JSON.stringify(h.slice(-30)));}
function getPersonalAvg(history){
  if(history.length<3) return null;
  const n=history.length;
  return {
    avgE:        history.reduce((s,h)=>s+h.avgE,       0)/n,
    avgB:        history.reduce((s,h)=>s+h.avgB,       0)/n,
    avgM:        history.reduce((s,h)=>s+h.avgM,       0)/n,
    avgT:        history.reduce((s,h)=>s+h.avgT,       0)/n,
    dynamics:    history.reduce((s,h)=>s+h.dynamics,   0)/n,
    peakDensity: history.reduce((s,h)=>s+h.peakDensity,0)/n,
  };
}

// =====================================================================
//  アート用 要素選択
// =====================================================================
function selectElements(dna, personalAvg) {
  const els=[];
  if(!dna.hasSignal){els.push('AURORA');return els;}
  let scoreB,scoreM,scoreT,scoreDyn,scorePeak;
  if(personalAvg){
    scoreB    = dna.avgB        / Math.max(personalAvg.avgB,       0.001);
    scoreM    = dna.avgM        / Math.max(personalAvg.avgM,       0.001);
    scoreT    = dna.avgT        / Math.max(personalAvg.avgT,       0.001);
    scoreDyn  = dna.dynamics    / Math.max(personalAvg.dynamics,   0.001);
    scorePeak = dna.peakDensity / Math.max(personalAvg.peakDensity,0.001);
  } else {
    const ref=Math.max(dna.avgE,0.001);
    scoreB=dna.avgB/ref/4.0; scoreM=dna.avgM/ref/1.5;
    scoreT=dna.avgT/ref/0.2; scoreDyn=dna.dynamics/Math.max(dna.maxE,0.001)/0.3;
    scorePeak=dna.peakDensity/0.18;
  }
  if(scoreT>1.4)                                  els.push('LIGHTNING');
  if(scoreT>0.85&&scoreT<=1.4&&scorePeak>1.0)     els.push('CRYSTAL');
  if(scorePeak>1.3)                               els.push('FIREWORKS');
  if(scoreB>1.15&&scorePeak>0.7&&scorePeak<=1.3)  els.push('VORTEX');
  if(scoreM>1.1&&scoreDyn<0.9)                    els.push('BLOOM');
  if(scoreDyn>1.3)                                els.push('PARTICLES');
  if(dna.avgE<(personalAvg?personalAvg.avgE*0.5:0.03)) els.push('AURORA');
  if(els.length===0){
    const max=Math.max(scoreB,scoreM,scoreT,scorePeak,scoreDyn);
    if(max===scorePeak)      els.push('FIREWORKS');
    else if(max===scoreT)    els.push('LIGHTNING');
    else if(max===scoreB)    els.push('VORTEX');
    else if(max===scoreDyn)  els.push('PARTICLES');
    else                      els.push('BLOOM');
  }
  return [...new Set(els)];
}

// =====================================================================
//  アート描画（各スタイル）
// =====================================================================
function detectPeaks(features,maxCount){
  const peaks=[];
  for(let i=1;i<features.length-1;i++)
    if(features[i].energy>features[i-1].energy&&features[i].energy>features[i+1].energy)
      peaks.push({idx:i,f:features[i]});
  peaks.sort((a,b)=>b.f.energy-a.f.energy);
  if(peaks.length<maxCount){
    features.map((f,i)=>({idx:i,f})).sort((a,b)=>b.f.energy-a.f.energy)
      .forEach(p=>{if(!peaks.find(q=>q.idx===p.idx)) peaks.push(p);});
  }
  return peaks.slice(0,maxCount);
}

function drawWatermark(ctx,SIZE,dateStr){
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='rgba(255,255,255,0.4)';
  ctx.font=`600 ${SIZE*0.02}px -apple-system,sans-serif`;
  ctx.textAlign='left'; ctx.fillText('◎ SoundArt',SIZE*0.03,SIZE-SIZE*0.03);
  ctx.font=`400 ${SIZE*0.017}px -apple-system,sans-serif`;
  ctx.textAlign='right'; ctx.fillText(dateStr,SIZE-SIZE*0.03,SIZE-SIZE*0.03);
}

function drawFireworks(ctx,SIZE,features){
  const peaks=detectPeaks(features,9); ctx.globalCompositeOperation='lighter';
  peaks.forEach(({f},i)=>{
    if(f.energy<12)return;
    const phi=0.618,px=SIZE*(0.1+(i*phi*0.8%0.8)),py=SIZE*(0.08+(i*phi*0.6%0.72));
    let hue=f.bass>f.treble?15+(f.bass/255)*40:f.treble>f.mid?200+(f.treble/255)*90:90+(f.mid/255)*60;
    const radius=SIZE*(0.05+(f.energy/255)*0.24),count=Math.floor(40+(f.energy/255)*70);
    const core=ctx.createRadialGradient(px,py,0,px,py,SIZE*0.014);
    core.addColorStop(0,'rgba(255,255,255,1)');core.addColorStop(0.4,`hsla(${hue},100%,85%,0.8)`);core.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=core;ctx.beginPath();ctx.arc(px,py,SIZE*0.014,0,Math.PI*2);ctx.fill();
    for(let j=0;j<count;j++){
      const angle=(j/count)*Math.PI*2+(Math.random()-0.5)*0.25;
      const len=radius*(0.5+Math.random()*0.5);
      const cpx=px+Math.cos(angle+(Math.random()-0.5)*0.5)*len*0.4,cpy=py+Math.sin(angle+(Math.random()-0.5)*0.5)*len*0.4;
      const ex=px+Math.cos(angle)*len,ey=py+Math.sin(angle)*len;
      [{w:SIZE*0.006,a:0.10,dh:-10},{w:SIZE*0.0025,a:0.5,dh:10},{w:SIZE*0.001,a:0.95,dh:35}].forEach(({w,a,dh})=>{
        const g=ctx.createLinearGradient(px,py,ex,ey);
        g.addColorStop(0,`hsla(${hue+dh},100%,80%,${a})`);g.addColorStop(0.6,`hsla(${hue+dh},90%,70%,${a*0.4})`);g.addColorStop(1,`hsla(${hue+dh},80%,60%,0)`);
        ctx.beginPath();ctx.moveTo(px,py);ctx.quadraticCurveTo(cpx,cpy,ex,ey);ctx.strokeStyle=g;ctx.lineWidth=w;ctx.stroke();
      });
      if(Math.random()>0.4){const sr=SIZE*(0.0025+Math.random()*0.005),sg=ctx.createRadialGradient(ex,ey,0,ex,ey,sr*3);sg.addColorStop(0,`hsla(${hue+40},100%,95%,0.9)`);sg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=sg;ctx.beginPath();ctx.arc(ex,ey,sr*3,0,Math.PI*2);ctx.fill();}
    }
  });
}
function drawBolt(ctx,SIZE,x1,y1,x2,y2,thick,hue,depth){
  if(depth===0||thick<0.3)return;
  const mx=(x1+x2)/2+(Math.random()-0.5)*Math.abs(y2-y1)*0.65,my=(y1+y2)/2;
  [{w:thick*9,a:0.03},{w:thick*3,a:0.14},{w:thick,a:0.95}].forEach(({w,a})=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(mx,my);ctx.lineTo(x2,y2);
    ctx.strokeStyle=`hsla(${hue},90%,78%,${a})`;ctx.lineWidth=w;ctx.lineJoin='round';ctx.stroke();
  });
  if(depth>2&&Math.random()>0.45){const bx=mx+(Math.random()-0.5)*SIZE*0.28,by=my+SIZE*(0.04+Math.random()*0.14);drawBolt(ctx,SIZE,mx,my,bx,by,thick*0.45,hue+25,depth-2);}
  drawBolt(ctx,SIZE,x1,y1,mx,my,thick*0.85,hue,depth-1);drawBolt(ctx,SIZE,mx,my,x2,y2,thick*0.85,hue,depth-1);
}
function drawLightning(ctx,SIZE,features,dna){
  const peaks=detectPeaks(features,7);ctx.globalCompositeOperation='lighter';
  peaks.forEach(({f})=>{
    if(f.energy<18)return;
    const sx=SIZE*(0.1+Math.random()*0.8),sy=SIZE*(Math.random()*0.12);
    drawBolt(ctx,SIZE,sx,sy,sx+(Math.random()-0.5)*SIZE*0.4,SIZE*(0.4+Math.random()*0.5),0.8+(f.bass/255)*5,195+(f.treble/255)*70,6);
  });
  ctx.globalCompositeOperation='screen';
  ctx.fillStyle=`rgba(120,160,255,${Math.min((dna.avgE||0.1)*0.12,0.10)})`;ctx.fillRect(0,0,SIZE,SIZE);
}
function drawWave(ctx,SIZE,features,dna){
  const CY=SIZE/2,LAYERS=8,baseHue=190;ctx.globalCompositeOperation='screen';
  for(let L=0;L<LAYERS;L++){
    const t=L/(LAYERS-1),hue=baseHue+t*70,yOff=(t-0.5)*SIZE*0.45,amp=SIZE*(0.03+(1-t)*0.15);
    const getY=xi=>{
      const xf=xi/SIZE,si=Math.min(Math.floor(xf*(features.length-1)),features.length-2),lr=xf*(features.length-1)-si;
      const f0=features[si],f1=features[si+1];
      return CY+yOff+Math.sin(xf*Math.PI*(4+L*2)+L)*amp*((f0.energy*(1-lr)+f1.energy*lr)/255)
        +Math.sin(xf*Math.PI*(8+L)+L*0.5)*amp*0.4*((f0.treble*(1-lr)+f1.treble*lr)/255)
        +Math.cos(xf*Math.PI*(2+L*0.5))*amp*0.3*((f0.bass*(1-lr)+f1.bass*lr)/255);
    };
    ctx.beginPath();for(let xi=0;xi<=SIZE;xi+=4){const y=getY(xi);xi===0?ctx.moveTo(xi,y):ctx.lineTo(xi,y);}
    ctx.lineTo(SIZE,SIZE);ctx.lineTo(0,SIZE);ctx.closePath();ctx.fillStyle=`hsla(${hue},70%,${20+t*15}%,${0.12+t*0.22})`;ctx.fill();
    ctx.beginPath();for(let xi=0;xi<=SIZE;xi+=4){const y=getY(xi);xi===0?ctx.moveTo(xi,y):ctx.lineTo(xi,y);}
    ctx.strokeStyle=`hsla(${hue},80%,${45+t*30}%,${0.15+t*0.4})`;ctx.lineWidth=1+(1-t)*2.5;ctx.stroke();
  }
}
function drawVortex(ctx,SIZE,features,dna){
  const cx=SIZE/2,cy=SIZE/2,turns=3+dna.avgM*5,arms=Math.floor(3+dna.peakDensity*8),hueBase=260+dna.avgB*100;
  ctx.globalCompositeOperation='screen';
  for(let arm=0;arm<arms;arm++){
    const armOffset=(arm/arms)*Math.PI*2;ctx.beginPath();
    for(let step=0;step<300;step++){
      const t=step/300,angle=t*Math.PI*2*turns+armOffset,r=t*SIZE*0.48;
      const si=Math.min(Math.floor(t*(features.length-1)),features.length-1),e=features[si].energy/255;
      const wobble=Math.sin(t*Math.PI*12)*r*0.06*e;
      const x=cx+Math.cos(angle)*(r+wobble),y=cy+Math.sin(angle)*(r+wobble);
      step===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    const hue=hueBase+(arm/arms)*80,g=ctx.createLinearGradient(cx,cy,cx+SIZE*0.4,cy+SIZE*0.4);
    g.addColorStop(0,`hsla(${hue},90%,70%,0.7)`);g.addColorStop(1,`hsla(${hue+60},90%,60%,0)`);
    ctx.strokeStyle=g;ctx.lineWidth=1+(1-arm/arms)*2;ctx.stroke();
  }
}
function drawCrystalArm(ctx,x,y,angle,len,hue,f,depth){
  if(depth===0||len<2)return;
  const ex=x+Math.cos(angle)*len,ey=y+Math.sin(angle)*len,a=0.4+(f.energy/255)*0.5;
  const g=ctx.createLinearGradient(x,y,ex,ey);g.addColorStop(0,`hsla(${hue},90%,80%,${a})`);g.addColorStop(1,`hsla(${hue+30},90%,70%,0)`);
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.strokeStyle=g;ctx.lineWidth=depth*0.6;ctx.stroke();
  [0.5,-0.5].forEach(da=>drawCrystalArm(ctx,ex,ey,angle+Math.PI*(0.25+da*0.2),len*0.55,hue+15,f,depth-1));
}
function drawCrystal(ctx,SIZE,features){
  ctx.globalCompositeOperation='screen';
  detectPeaks(features,6).forEach(({f},i)=>{
    if(f.energy<15)return;
    const phi=0.618,cx=SIZE*(0.15+(i*phi*0.7%0.7)),cy=SIZE*(0.15+(i*phi*0.5%0.7));
    const r=SIZE*(0.04+(f.energy/255)*0.12),branches=Math.floor(6+(f.treble/255)*6),hue=170+(f.treble/255)*80;
    for(let b=0;b<branches;b++) drawCrystalArm(ctx,cx,cy,(b/branches)*Math.PI*2,r,hue,f,4);
  });
}
function drawAurora(ctx,SIZE,features,dna){
  ctx.globalCompositeOperation='screen';
  const BANDS=6,baseHue=120+dna.avgM*120;
  for(let band=0;band<BANDS;band++){
    const t=band/BANDS,hue=baseHue+t*80,yBase=SIZE*(0.1+t*0.15),amp=SIZE*(0.04+(1-t)*0.1);
    const getY=xi=>{const xf=xi/SIZE,si=Math.min(Math.floor(xf*(features.length-1)),features.length-2),lr=xf*(features.length-1)-si,e=(features[si].energy*(1-lr)+features[si+1].energy*lr)/255;return yBase+Math.sin(xf*Math.PI*3+band+t)*amp*(0.5+e*0.5)+Math.sin(xf*Math.PI*7+band*2)*amp*0.25*e;};
    ctx.beginPath();for(let xi=0;xi<=SIZE;xi+=6){const y=getY(xi);xi===0?ctx.moveTo(xi,y):ctx.lineTo(xi,y);}
    ctx.lineTo(SIZE,0);ctx.lineTo(0,0);ctx.closePath();ctx.fillStyle=`hsla(${hue},80%,55%,${0.05+t*0.1})`;ctx.fill();
    ctx.beginPath();for(let xi=0;xi<=SIZE;xi+=6){const y=getY(xi);xi===0?ctx.moveTo(xi,y):ctx.lineTo(xi,y);}
    ctx.strokeStyle=`hsla(${hue},90%,75%,${0.15+t*0.25})`;ctx.lineWidth=1.5;ctx.stroke();
  }
}
function drawBloom(ctx,SIZE,features){
  ctx.globalCompositeOperation='screen';
  detectPeaks(features,5).forEach(({f},i)=>{
    if(f.energy<12)return;
    const phi=0.618,cx=SIZE*(0.2+(i*phi*0.6%0.6)),cy=SIZE*(0.2+(i*phi*0.5%0.6));
    const petals=Math.floor(5+(f.treble/255)*9),r=SIZE*(0.04+(f.energy/255)*0.14),hue=280+(f.mid/255)*120;
    for(let p=0;p<petals;p++){
      const angle=(p/petals)*Math.PI*2,px=cx+Math.cos(angle)*r*0.5,py=cy+Math.sin(angle)*r*0.5;
      const cp1x=cx+Math.cos(angle-0.6)*r,cp1y=cy+Math.sin(angle-0.6)*r,cp2x=cx+Math.cos(angle+0.6)*r,cp2y=cy+Math.sin(angle+0.6)*r;
      const g=ctx.createRadialGradient(px,py,0,cx,cy,r);g.addColorStop(0,`hsla(${hue+p*15},90%,80%,0.7)`);g.addColorStop(1,`hsla(${hue},70%,50%,0)`);
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,cx,cy);ctx.fillStyle=g;ctx.fill();
    }
  });
}
function drawParticles(ctx,SIZE,features,dna){
  ctx.globalCompositeOperation='screen';
  const count=Math.floor(150+dna.avgE*400);
  for(let i=0;i<count;i++){
    const f=features[Math.floor(Math.random()*features.length)];
    const x=Math.random()*SIZE,y=Math.random()*SIZE,r=SIZE*(0.001+(f.energy/255)*0.006);
    const hue=200+(f.treble/255)*160+(f.bass/255)*-80,alpha=0.3+(f.energy/255)*0.6;
    const glow=ctx.createRadialGradient(x,y,0,x,y,r*4);glow.addColorStop(0,`hsla(${hue},100%,90%,${alpha})`);glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,r*4,0,Math.PI*2);ctx.fill();
  }
}

function generateArt(samples) {
  const SIZE=1080;
  const canvas=document.getElementById('art-canvas');
  canvas.width=SIZE; canvas.height=SIZE;
  const ctx=canvas.getContext('2d');
  const features=extractFeatures(samples);
  const dna=computeDNA(features);
  const history=loadBaseline();
  const personalAvg=getPersonalAvg(history);
  const elements=selectElements(dna,personalAvg);
  history.push({avgE:dna.avgE,avgB:dna.avgB,avgM:dna.avgM,avgT:dna.avgT,dynamics:dna.dynamics,peakDensity:dna.peakDensity});
  saveBaseline(history);

  // 背景
  ctx.fillStyle='#05030f'; ctx.fillRect(0,0,SIZE,SIZE);
  ctx.globalCompositeOperation='source-over';
  for(let i=0;i<250;i++){ctx.beginPath();ctx.arc(Math.random()*SIZE,Math.random()*SIZE,Math.random()*1.8,0,Math.PI*2);ctx.fillStyle=`rgba(255,255,255,${0.15+Math.random()*0.7})`;ctx.fill();}

  if(elements.includes('AURORA'))    drawAurora(ctx,SIZE,features,dna);
  if(elements.includes('WAVE'))      drawWave(ctx,SIZE,features,dna);
  if(elements.includes('VORTEX'))    drawVortex(ctx,SIZE,features,dna);
  if(elements.includes('BLOOM'))     drawBloom(ctx,SIZE,features);
  if(elements.includes('PARTICLES')) drawParticles(ctx,SIZE,features,dna);
  if(elements.includes('CRYSTAL'))   drawCrystal(ctx,SIZE,features);
  if(elements.includes('LIGHTNING')) drawLightning(ctx,SIZE,features,dna);
  if(elements.includes('FIREWORKS')) drawFireworks(ctx,SIZE,features);

  const now=new Date();
  const dateStr=`${now.getFullYear()}.${String(now.getMonth()+1).padStart(2,'0')}.${String(now.getDate()).padStart(2,'0')}  ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
  drawWatermark(ctx,SIZE,dateStr);

  document.getElementById('result-meta').textContent=elements.join(' · ');
  return { dna, dateStr };
}

// =====================================================================
//  メインフロー
// =====================================================================
const recorder=new SoundRecorder();
let lastMapping=null;

// ホーム画面の星を描画
function refreshHomePlanet() {
  const state=loadPlanet();
  const c=document.getElementById('planet-home');
  c.width=560; c.height=560;
  renderPlanet(c,state,{showLabel:false});
  document.getElementById('home-day').textContent=`Day ${state.day}`;
  const last=state.history[state.history.length-1];
  document.getElementById('home-last-event').textContent=last?last.eventLabel:'最初の録音で星が生まれる';
}
refreshHomePlanet();

document.getElementById('btn-start').addEventListener('click',async()=>{
  try {
    showScreen('recording'); updateCountdown(10);
    await recorder.start(d=>updateVisualizer(d), s=>finishRecording(s));
  } catch(e) {
    alert('マイクへのアクセスが必要です。\n設定からマイクを許可してください。');
    showScreen('home');
  }
});

document.getElementById('btn-stop').addEventListener('click',()=>{
  const samples=[...recorder.samples]; recorder.stop(); finishRecording(samples);
});

function finishRecording(samples) {
  showScreen('generating');
  document.getElementById('generating-label').textContent='アートを生成中...';
  setTimeout(()=>{
    if(samples.length===0){showScreen('home');return;}

    // アート生成
    const {dna,dateStr}=generateArt(samples);

    // 星を更新
    document.getElementById('generating-label').textContent='星が変化中...';
    const mapping=mapSoundToPlanet(dna);
    lastMapping=mapping;
    let planetState=loadPlanet();
    planetState=updatePlanet(planetState,mapping);

    // 結果画面の星を描画
    const pc=document.getElementById('planet-result');
    pc.width=440; pc.height=440;
    renderPlanet(pc,planetState,{showLabel:false});
    document.getElementById('result-day').textContent=`Day ${planetState.day}`;
    document.getElementById('event-label').textContent=mapping.eventLabel;

    showScreen('result');
  },800);
}

document.getElementById('btn-retry').addEventListener('click',()=>{
  refreshHomePlanet();
  showScreen('home');
});

// =====================================================================
//  シェア機能
// =====================================================================
document.getElementById('btn-share').addEventListener('click',async()=>{
  const artCanvas=document.getElementById('art-canvas');
  const planetCanvas=document.getElementById('planet-result');
  const state=loadPlanet();
  const label=lastMapping?lastMapping.eventLabel:'';
  const blob=await composeShareImage(artCanvas,planetCanvas,state,label);
  const file=new File([blob],'soundart.png',{type:'image/png'});
  if(navigator.share&&navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file],title:'SoundArt',text:`Day ${state.day} ${label}\n#SoundArt #私の星`}); }
    catch(e){ if(e.name!=='AbortError') downloadBlob(blob); }
  } else { downloadBlob(blob); }
});

document.getElementById('btn-save').addEventListener('click',async()=>{
  const artCanvas=document.getElementById('art-canvas');
  const planetCanvas=document.getElementById('planet-result');
  const state=loadPlanet();
  const label=lastMapping?lastMapping.eventLabel:'';
  const blob=await composeShareImage(artCanvas,planetCanvas,state,label);
  downloadBlob(blob);
});

function downloadBlob(blob){
  const a=document.createElement('a');
  a.download=`soundart_${Date.now()}.png`;
  a.href=URL.createObjectURL(blob); a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
}

// =====================================================================
//  PWA Service Worker（開発中は無効化）
// =====================================================================
if('serviceWorker' in navigator){
  navigator.serviceWorker.getRegistrations().then(regs=>{regs.forEach(r=>r.unregister());});
}
