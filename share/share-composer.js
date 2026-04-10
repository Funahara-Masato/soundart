'use strict';

// アートCanvasと星Canvasを合成して1枚のBlobを返す
async function composeShareImage(artCanvas, planetCanvas, state, eventLabel) {
  const W = 1080, H = 1920;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');

  // 背景
  ctx.fillStyle = '#05030f';
  ctx.fillRect(0, 0, W, H);

  // ── 上半分：アート ──
  const artH = 960;
  ctx.drawImage(artCanvas, 0, 0, W, artH);

  // 区切りグラデーション
  const sep = ctx.createLinearGradient(0, artH - 30, 0, artH + 30);
  sep.addColorStop(0, 'rgba(255,255,255,0)');
  sep.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  sep.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sep;
  ctx.fillRect(0, artH - 30, W, 60);

  // ── 下半分：星 ──
  const planetSize = 680;
  const planetX = (W - planetSize) / 2;
  const planetY = artH + 30;
  ctx.drawImage(planetCanvas, planetX, planetY, planetSize, planetSize);

  // Day テキスト
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `bold 88px -apple-system,sans-serif`;
  ctx.fillText(`Day ${state.day}`, W / 2, planetY + planetSize + 90);

  // イベントラベル
  ctx.font = `48px -apple-system,sans-serif`;
  ctx.fillStyle = 'rgba(200,180,255,0.85)';
  ctx.fillText(eventLabel || '', W / 2, planetY + planetSize + 160);

  // ハッシュタグ
  ctx.font = `38px -apple-system,sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('#SoundArt  #私の星', W / 2, H - 50);

  return new Promise(resolve => out.toBlob(resolve, 'image/png'));
}
