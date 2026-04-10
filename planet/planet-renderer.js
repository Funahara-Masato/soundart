'use strict';

// シード付き擬似乱数（星の形状を毎回同じにする）
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const BIOME_COLORS = {
  snow:     '#E8F0FF', crystal: '#A0C0FF',
  mountain: '#7A8A6A', grass:   '#5A9A4A',
  flower:   '#D4796A', river:   '#4A90C8',
  lake:     '#2A6AA0', volcano: '#C83A1A',
};

function renderPlanet(canvas, state, opts = {}) {
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  const cx = W / 2, cy = H / 2;
  const R  = Math.min(W, H) * 0.40;

  // シード（createdAtのタイムスタンプ）
  const seed = new Date(state.createdAt).getTime() % 999983;
  const rand = seededRand(seed);

  ctx.clearRect(0, 0, W, H);

  // ── Layer 0: 宇宙背景 ──
  const bg = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, Math.max(W, H));
  bg.addColorStop(0, '#0a0818');
  bg.addColorStop(1, '#020208');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 星屑
  for (let i = 0; i < 180; i++) {
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, rand() * 1.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.7})`;
    ctx.fill();
  }

  // ── Layer 1: 惑星球体ベース ──
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  const { r, g, b } = state.atmosphere;
  const atmHex = `rgb(${Math.round(r*180)},${Math.round(g*180)},${Math.round(b*180)})`;
  const atmLight = `rgb(${Math.round(r*255)},${Math.round(g*235)},${Math.round(b*255)})`;
  const atmDark  = `rgb(${Math.round(r*60)}, ${Math.round(g*60)}, ${Math.round(b*80)})`;

  const base = ctx.createRadialGradient(cx - R*0.3, cy - R*0.3, R*0.1, cx, cy, R);
  base.addColorStop(0.0, atmLight);
  base.addColorStop(0.5, atmHex);
  base.addColorStop(1.0, atmDark);
  ctx.fillStyle = base;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  // ── Layer 2: バイオーム帯 ──
  const total = Object.values(state.biome).reduce((s,v)=>s+v,0) || 1;
  const sorted = Object.entries(state.biome)
    .filter(([,v])=>v>0)
    .sort((a,b)=>b[1]-a[1]);

  // 球体表面に色の帯を描く（ノイズで境界をジャギー化）
  let yPos = cy - R;
  sorted.forEach(([name, val]) => {
    const ratio = val / total;
    const bandH = R * 2 * ratio;
    const color = BIOME_COLORS[name] || '#888';

    ctx.beginPath();
    ctx.moveTo(cx - R, yPos);
    for (let x = cx - R; x <= cx + R; x += 4) {
      const noise = Math.sin(x * 0.08 + seed * 0.001) * 8 + Math.cos(x * 0.13) * 5;
      ctx.lineTo(x, yPos + noise);
    }
    ctx.lineTo(cx + R, yPos + bandH);
    for (let x = cx + R; x >= cx - R; x -= 4) {
      const noise = Math.sin(x * 0.08 + seed * 0.001) * 8 + Math.cos(x * 0.13) * 5;
      ctx.lineTo(x, yPos + bandH + noise);
    }
    ctx.closePath();
    ctx.fillStyle = color + 'cc';
    ctx.fill();

    yPos += bandH;
  });

  // ── Layer 3: 地物 ──
  const rand2 = seededRand(seed + 1);

  // 山
  const mtnCount = Math.min(Math.floor((state.biome.mountain || 0) / 5), 14);
  for (let i = 0; i < mtnCount; i++) {
    const angle  = rand2() * Math.PI * 2;
    const dist   = R * (0.1 + rand2() * 0.65);
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const mh = R * (0.06 + rand2() * 0.10);
    const mw = mh * (0.7 + rand2() * 0.6);
    ctx.beginPath();
    ctx.moveTo(px - mw, py); ctx.lineTo(px, py - mh); ctx.lineTo(px + mw, py);
    ctx.fillStyle = `rgba(90,80,70,0.7)`;
    ctx.fill();
    // 雪帽子
    ctx.beginPath();
    ctx.moveTo(px - mw * 0.3, py - mh * 0.55);
    ctx.lineTo(px, py - mh); ctx.lineTo(px + mw * 0.3, py - mh * 0.55);
    ctx.fillStyle = 'rgba(240,245,255,0.8)';
    ctx.fill();
  }

  // 火山
  const volCount = Math.min(Math.floor((state.biome.volcano || 0) / 6), 5);
  const rand3 = seededRand(seed + 2);
  for (let i = 0; i < volCount; i++) {
    const angle = rand3() * Math.PI * 2;
    const dist  = R * (0.15 + rand3() * 0.5);
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const vh = R * (0.09 + rand3() * 0.09);
    const vw = vh * 0.75;
    ctx.beginPath();
    ctx.moveTo(px - vw, py); ctx.lineTo(px, py - vh); ctx.lineTo(px + vw, py);
    ctx.fillStyle = 'rgba(80,20,5,0.85)';
    ctx.fill();
    // 溶岩グロウ
    const glow = ctx.createRadialGradient(px, py - vh, 0, px, py - vh, vh * 0.6);
    glow.addColorStop(0, 'rgba(255,120,0,0.9)');
    glow.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py - vh, vh * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 結晶
  const cryCount = Math.min(Math.floor((state.biome.crystal || 0) / 4), 10);
  const rand4 = seededRand(seed + 3);
  for (let i = 0; i < cryCount; i++) {
    const angle = rand4() * Math.PI * 2;
    const dist  = R * (0.05 + rand4() * 0.7);
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const ch = R * (0.05 + rand4() * 0.08);
    ctx.beginPath();
    ctx.moveTo(px, py - ch);
    ctx.lineTo(px + ch * 0.25, py); ctx.lineTo(px - ch * 0.25, py);
    ctx.fillStyle = `rgba(180,210,255,0.85)`;
    ctx.fill();
  }

  // 川
  if ((state.biome.river || 0) > 3) {
    const rand5 = seededRand(seed + 4);
    const riverCount = Math.min(Math.floor(state.biome.river / 5), 4);
    for (let i = 0; i < riverCount; i++) {
      const sx = cx + (rand5() - 0.5) * R * 1.5;
      const sy = cy - R * 0.3;
      const ex = cx + (rand5() - 0.5) * R * 1.5;
      const ey = cy + R * 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(
        cx + (rand5()-0.5)*R, cy - R*0.1,
        cx + (rand5()-0.5)*R, cy + R*0.1,
        ex, ey
      );
      ctx.strokeStyle = 'rgba(80,160,220,0.55)';
      ctx.lineWidth = 2 + rand5() * 3;
      ctx.stroke();
    }
  }

  ctx.restore(); // クリップ解除

  // ── Layer 4: 大気の縁 ──
  const rim = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.1);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(0.7, `rgba(${Math.round(r*180)},${Math.round(g*180)},${Math.round(b*220)},0.18)`);
  rim.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2);
  ctx.fillStyle = rim;
  ctx.fill();

  // 雲
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  const cloudCount = Math.floor(state.atmosphere.cloud * 12);
  const rand6 = seededRand(seed + 5);
  for (let i = 0; i < cloudCount; i++) {
    const angle = rand6() * Math.PI * 2;
    const dist  = rand6() * R * 0.85;
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const cw = R * (0.12 + rand6() * 0.18);
    const ch2 = cw * (0.3 + rand6() * 0.3);
    ctx.beginPath();
    ctx.ellipse(px, py, cw, ch2, rand6() * Math.PI, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.12 + rand6() * 0.18})`;
    ctx.fill();
  }
  ctx.restore();

  // ── Layer 5: 光沢ハイライト ──
  const shine = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, 0, cx - R * 0.1, cy - R * 0.1, R * 0.65);
  shine.addColorStop(0, 'rgba(255,255,255,0.22)');
  shine.addColorStop(0.4, 'rgba(255,255,255,0.06)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = shine;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.restore();

  // ── Layer 6: Day表示 ──
  if (opts.showLabel !== false) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `bold ${R * 0.22}px -apple-system,sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`Day ${state.day}`, cx, cy + R + R * 0.35);
  }
}
