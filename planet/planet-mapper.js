'use strict';

// 音のDNAを受け取って星の変化マッピングを返す
function mapSoundToPlanet(dna) {
  const { avgE, avgB, avgM, avgT, dynamics, peakDensity } = dna;

  // 音量クラス（相対値で分類）
  const vol = avgE;
  const volClass = vol < 0.04 ? 'quiet'
                 : vol < 0.12 ? 'conversation'
                 : vol < 0.25 ? 'loud'
                               : 'extreme';

  // ピッチクラス（各帯域の相対比）
  const ref = Math.max(avgE, 0.001);
  const pitchClass = (avgT / ref) > 0.30 ? 'high'
                   : (avgB / ref) > 3.5   ? 'low'
                                           : 'mid';

  // リズムスコア（0〜1）
  const rhythmScore = Math.min(dynamics / 0.15, 1.0);

  // バイオームテーブル
  const TABLE = {
    quiet:        { low: {grass:3,flower:2},        mid: {grass:2,flower:3},       high: {crystal:4,snow:2}      },
    conversation: { low: {river:3,lake:1,grass:1},  mid: {river:2,lake:2,grass:1}, high: {lake:3,crystal:2}      },
    loud:         { low: {mountain:3,volcano:1},     mid: {mountain:3,river:1},     high: {mountain:2,crystal:3}  },
    extreme:      { low: {volcano:4,mountain:2},     mid: {volcano:3,mountain:2},   high: {volcano:3,crystal:1}   },
  };

  const delta = { ...TABLE[volClass][pitchClass] };

  // リズムが激しければ山を追加
  if (rhythmScore > 0.6) delta.mountain = (delta.mountain || 0) + 2;

  // 大気色ターゲット
  const ATM = {
    quiet_high:      { r:0.7, g:0.8, b:1.0 },
    quiet_mid:       { r:0.5, g:0.8, b:0.5 },
    quiet_low:       { r:0.4, g:0.7, b:0.4 },
    conversation_high:{ r:0.3, g:0.6, b:0.9 },
    conversation_mid: { r:0.3, g:0.65,b:0.85},
    conversation_low: { r:0.35,g:0.6, b:0.8 },
    loud_high:       { r:0.5, g:0.5, b:0.7 },
    loud_mid:        { r:0.4, g:0.55,b:0.4 },
    loud_low:        { r:0.35,g:0.5, b:0.35},
    extreme_high:    { r:0.9, g:0.4, b:0.2 },
    extreme_mid:     { r:0.95,g:0.35,b:0.1 },
    extreme_low:     { r:1.0, g:0.3, b:0.05},
  };
  const atmosphereTarget = ATM[`${volClass}_${pitchClass}`] || { r:0.4,g:0.6,b:0.8 };

  // イベントラベル（最も多く加算されたバイオーム）
  const LABELS = {
    grass:'穏やかな草原が広がった', flower:'色とりどりの花が咲いた',
    river:'静かな川が生まれた',     lake:'澄んだ湖が広がった',
    mountain:'山脈がそびえ立った',  volcano:'火山が噴き出した！',
    crystal:'水晶の柱が立ち並んだ', snow:'雪原が輝いた',
  };
  const topBiome = Object.entries(delta).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'grass';
  const eventLabel = LABELS[topBiome] || '星が変化した';

  return { biomeDelta: delta, atmosphereTarget, eventLabel, volClass, pitchClass, rhythmScore };
}
