'use strict';

const PLANET_KEY = 'soundart_planet_v1';
const HISTORY_MAX = 30;

const DEFAULT_STATE = () => ({
  version: 1,
  day: 0,
  createdAt: new Date().toISOString(),
  lastRecordedAt: null,
  biome: { grass:0, flower:0, river:0, lake:0, mountain:0, volcano:0, crystal:0, snow:0 },
  atmosphere: { r:0.3, g:0.6, b:0.9, density:0.3, cloud:0.2 },
  surface: { waterRatio:0.1, roughness:0.2 },
  history: [],
});

function loadPlanet() {
  try {
    const s = localStorage.getItem(PLANET_KEY);
    return s ? JSON.parse(s) : DEFAULT_STATE();
  } catch { return DEFAULT_STATE(); }
}

function savePlanet(state) {
  state.history = state.history.slice(-HISTORY_MAX);
  localStorage.setItem(PLANET_KEY, JSON.stringify(state));
}

// 音マッピング結果を受け取って状態を更新し、eventLabelを返す
function updatePlanet(state, mapping) {
  state.day += 1;
  state.lastRecordedAt = new Date().toISOString();

  // バイオームを加算
  const delta = mapping.biomeDelta;
  Object.keys(delta).forEach(k => { state.biome[k] = (state.biome[k] || 0) + delta[k]; });

  // 大気色をスムージング更新
  const t = mapping.atmosphereTarget;
  state.atmosphere.r = state.atmosphere.r * 0.88 + t.r * 0.12;
  state.atmosphere.g = state.atmosphere.g * 0.88 + t.g * 0.12;
  state.atmosphere.b = state.atmosphere.b * 0.88 + t.b * 0.12;

  // 水の比率を更新
  const total = Object.values(state.biome).reduce((s,v)=>s+v,0) || 1;
  const water = (state.biome.river||0) + (state.biome.lake||0);
  state.surface.waterRatio = Math.min(water / total, 0.7);

  // 荒れ度を更新
  const rough = (state.biome.mountain||0) + (state.biome.volcano||0);
  state.surface.roughness = Math.min(rough / total, 0.8);

  // 履歴追加
  state.history.push({
    day: state.day,
    timestamp: state.lastRecordedAt,
    biomeDelta: delta,
    eventLabel: mapping.eventLabel,
  });

  savePlanet(state);
  return state;
}
