const WAVES = [['sawtooth', 'Saw'], ['square', 'Square'], ['triangle', 'Tri'], ['sine', 'Sine']];
const fmtHz = v => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 1 : 2) + ' kHz' : Math.round(v) + ' Hz';
const fmtS = v => v >= 1 ? v.toFixed(2) + ' s' : Math.round(v * 1000) + ' ms';
const fmtPct = v => Math.round(v * 100) + '%';
const fmtDb = v => (v > 0 ? '+' : '') + v.toFixed(1) + ' dB';
const fmtInt = v => String(Math.round(v));
const fmtSemi = v => (v > 0 ? '+' : '') + Math.round(v) + ' st';
const fmtCt = v => (v > 0 ? '+' : '') + Math.round(v) + ' ct';

const SYNTH_SPEC = [
  { group: 'Осциллятор 1', params: [
    { id: 'o1w', label: 'Волна', options: WAVES, def: 'sawtooth' },
    { id: 'o1oct', label: 'Октава', min: -3, max: 3, def: 0, step: 1, fmt: fmtInt },
    { id: 'o1semi', label: 'Полутон', min: -12, max: 12, def: 0, step: 1, fmt: fmtSemi },
    { id: 'o1fine', label: 'Тонко', min: -100, max: 100, def: 0, fmt: fmtCt },
    { id: 'o1lvl', label: 'Уровень', min: 0, max: 1, def: 0.8, fmt: fmtPct },
  ] },
  { group: 'Осциллятор 2', params: [
    { id: 'o2w', label: 'Волна', options: WAVES, def: 'sawtooth' },
    { id: 'o2oct', label: 'Октава', min: -3, max: 3, def: 0, step: 1, fmt: fmtInt },
    { id: 'o2semi', label: 'Полутон', min: -12, max: 12, def: 0, step: 1, fmt: fmtSemi },
    { id: 'o2fine', label: 'Тонко', min: -100, max: 100, def: 7, fmt: fmtCt },
    { id: 'o2lvl', label: 'Уровень', min: 0, max: 1, def: 0, fmt: fmtPct },
    { id: 'fm', label: 'FM', min: 0, max: 10, def: 0, fmt: v => v.toFixed(2), hint: 'Осц. 2 модулирует частоту осц. 1 — колокола, электропиано' },
    { id: 'fmDec', label: 'FM спад', min: 0.02, max: 4, def: 0.3, curve: 'log', fmt: fmtS },
  ] },
  { group: 'Саб, шум, унисон', params: [
    { id: 'sub', label: 'Саб', min: 0, max: 1, def: 0, fmt: fmtPct, hint: 'Синус на октаву ниже' },
    { id: 'noise', label: 'Шум', min: 0, max: 1, def: 0, fmt: fmtPct },
    { id: 'uni', label: 'Голоса', min: 1, max: 8, def: 1, step: 1, fmt: fmtInt, hint: 'Унисон: сколько расстроенных копий звучит' },
    { id: 'uniDet', label: 'Расстр.', min: 0, max: 100, def: 20, fmt: fmtCt },
    { id: 'uniSpr', label: 'Ширина', min: 0, max: 1, def: 0.6, fmt: fmtPct },
  ] },
  { group: 'Фильтр', params: [
    { id: 'fType', label: 'Тип', options: [['lowpass', 'LP'], ['highpass', 'HP'], ['bandpass', 'BP']], def: 'lowpass' },
    { id: 'cutoff', label: 'Срез', min: 30, max: 20000, def: 6000, curve: 'log', fmt: fmtHz },
    { id: 'res', label: 'Резон.', min: 0, max: 20, def: 1, fmt: v => v.toFixed(1) },
    { id: 'fEnv', label: 'Огиб.', min: -1, max: 1, def: 0, fmt: fmtPct, bipolar: true },
    { id: 'keyTr', label: 'Key trk', min: 0, max: 1, def: 0.3, fmt: fmtPct },
  ] },
  { group: 'Огибающая фильтра', env: 'f', params: [
    { id: 'fa', label: 'Attack', min: 0.001, max: 4, def: 0.005, curve: 'log', fmt: fmtS },
    { id: 'fd', label: 'Decay', min: 0.005, max: 4, def: 0.3, curve: 'log', fmt: fmtS },
    { id: 'fs', label: 'Sustain', min: 0, max: 1, def: 0, fmt: fmtPct },
    { id: 'fr', label: 'Release', min: 0.005, max: 5, def: 0.3, curve: 'log', fmt: fmtS },
  ] },
  { group: 'Огибающая громкости', env: 'a', params: [
    { id: 'a', label: 'Attack', min: 0.001, max: 4, def: 0.005, curve: 'log', fmt: fmtS },
    { id: 'd', label: 'Decay', min: 0.005, max: 6, def: 0.3, curve: 'log', fmt: fmtS },
    { id: 's', label: 'Sustain', min: 0, max: 1, def: 0.7, fmt: fmtPct },
    { id: 'r', label: 'Release', min: 0.005, max: 6, def: 0.25, curve: 'log', fmt: fmtS },
  ] },
  { group: 'LFO', params: [
    { id: 'lfoT', label: 'Цель', options: [['off', 'Выкл'], ['pitch', 'Тон'], ['filter', 'Фильтр'], ['amp', 'Громк.']], def: 'off' },
    { id: 'lfoW', label: 'Форма', options: [['sine', 'Sine'], ['triangle', 'Tri'], ['square', 'Square'], ['sawtooth', 'Saw']], def: 'sine' },
    { id: 'lfoR', label: 'Скорость', min: 0.05, max: 20, def: 5, curve: 'log', fmt: v => v.toFixed(2) + ' Hz' },
    { id: 'lfoD', label: 'Глубина', min: 0, max: 1, def: 0.2, fmt: fmtPct },
  ] },
  { group: 'Тон и выход', params: [
    { id: 'pEnv', label: 'Pitch env', min: -24, max: 24, def: 0, fmt: fmtSemi, bipolar: true, hint: 'Начальный сдвиг высоты, который уходит в ноль' },
    { id: 'pDec', label: 'Pitch dec', min: 0.005, max: 1, def: 0.05, curve: 'log', fmt: fmtS },
    { id: 'glide', label: 'Глайд', min: 0, max: 0.5, def: 0, fmt: fmtS, hint: 'Скольжение между нотами (работает в моно)' },
    { id: 'drive', label: 'Драйв', min: 0, max: 1, def: 0, fmt: fmtPct },
    { id: 'velS', label: 'Velocity', min: 0, max: 1, def: 0.6, fmt: fmtPct, hint: 'Насколько сила нажатия влияет на громкость' },
    { id: 'gain', label: 'Громк.', min: 0, max: 2, def: 0.8, fmt: fmtPct },
  ] },
];

const BASS_SPEC = [
  { group: '808', params: [
    { id: 'decay', label: 'Длина', min: 0.1, max: 5, def: 1.6, curve: 'log', fmt: fmtS },
    { id: 'punch', label: 'Удар', min: 0, max: 36, def: 12, fmt: fmtSemi, hint: 'Насколько высоко стартует тон в начале удара' },
    { id: 'pTime', label: 'Время удара', min: 0.005, max: 0.3, def: 0.05, curve: 'log', fmt: fmtS },
    { id: 'click', label: 'Щелчок', min: 0, max: 1, def: 0.2, fmt: fmtPct },
  ] },
  { group: 'Окрас', params: [
    { id: 'drive', label: 'Дисторшн', min: 0, max: 1, def: 0.25, fmt: fmtPct },
    { id: 'tone', label: 'Яркость', min: 100, max: 12000, def: 2500, curve: 'log', fmt: fmtHz },
    { id: 'glide', label: 'Глайд', min: 0, max: 0.5, def: 0.06, fmt: fmtS, hint: 'Скольжение, когда новая нота перекрывает старую' },
    { id: 'follow', label: 'По длине ноты', options: [[0, 'Нет'], [1, 'Да']], def: 0 },
    { id: 'gain', label: 'Громк.', min: 0, max: 2, def: 1, fmt: fmtPct },
  ] },
];

const DRUM_KINDS = [
  ['kick', 'Бочка'], ['snare', 'Снейр'], ['clap', 'Клэп'], ['hat', 'Хэт закрытый'], ['ohat', 'Хэт открытый'],
  ['crash', 'Крэш'], ['ride', 'Райд'], ['tom', 'Том'], ['rim', 'Римшот'], ['shaker', 'Шейкер'],
  ['cowbell', 'Ковбелл'], ['snap', 'Щелчок пальцами'], ['perc', 'Перкуссия'], ['conga', 'Конга'],
  ['impact', 'Импакт'], ['riser', 'Райзер'], ['down', 'Даунлифтер'],
];

const DRUM_SPEC = [
  { group: 'Звук', params: [
    { id: 'kind', label: 'Тип', options: DRUM_KINDS, def: 'kick' },
    { id: 'tune', label: 'Тон', min: -24, max: 24, def: 0, fmt: fmtSemi, bipolar: true },
    { id: 'decay', label: 'Длина', min: 0.1, max: 4, def: 1, curve: 'log', fmt: v => '×' + v.toFixed(2) },
    { id: 'tone', label: 'Окрас', min: 0, max: 1, def: 0.5, fmt: fmtPct },
    { id: 'snap', label: 'Атака', min: 0, max: 1, def: 0.5, fmt: fmtPct },
    { id: 'drive', label: 'Драйв', min: 0, max: 1, def: 0, fmt: fmtPct },
    { id: 'gain', label: 'Громк.', min: 0, max: 2, def: 1, fmt: fmtPct },
  ] },
];

const SAMPLER_SPEC = [
  { group: 'Сэмпл', params: [
    { id: 'root', label: 'Корень', min: 24, max: 96, def: 60, step: 1, fmt: noteName, hint: 'Нота, на которой сэмпл звучит в оригинале' },
    { id: 'tune', label: 'Подстр.', min: -24, max: 24, def: 0, fmt: fmtSemi, bipolar: true },
    { id: 'start', label: 'Старт', min: 0, max: 0.99, def: 0, fmt: fmtPct },
    { id: 'end', label: 'Конец', min: 0.01, max: 1, def: 1, fmt: fmtPct },
  ] },
  { group: 'Воспроизведение', params: [
    { id: 'mode', label: 'Режим', options: [['oneshot', 'Целиком'], ['gate', 'По ноте'], ['loop', 'Петля']], def: 'oneshot' },
    { id: 'keytrack', label: 'Высота по нотам', options: [[1, 'Да'], [0, 'Нет']], def: 1 },
    { id: 'rev', label: 'Реверс', options: [[0, 'Нет'], [1, 'Да']], def: 0 },
    { id: 'a', label: 'Attack', min: 0.001, max: 2, def: 0.002, curve: 'log', fmt: fmtS },
    { id: 'r', label: 'Release', min: 0.005, max: 3, def: 0.05, curve: 'log', fmt: fmtS },
    { id: 'gain', label: 'Громк.', min: 0, max: 2, def: 1, fmt: fmtPct },
  ] },
];

const INSTR_SPECS = { synth: SYNTH_SPEC, bass808: BASS_SPEC, drum: DRUM_SPEC, sampler: SAMPLER_SPEC };
const INSTR_NAMES = { synth: 'Синтезатор', bass808: '808', drum: 'Драм-синт', sampler: 'Сэмплер' };

function specDefaults(spec) {
  const o = {};
  for (const g of spec) for (const p of g.params) o[p.id] = p.def;
  return o;
}

const SYNTH_PRESETS = {
  'Supersaw Lead': { o1w: 'sawtooth', o2w: 'sawtooth', o2oct: 1, o2lvl: 0.3, o2fine: 5, uni: 7, uniDet: 28, uniSpr: 0.9, cutoff: 9000, res: 1, fEnv: 0.15, fd: 0.4, a: 0.005, d: 0.4, s: 0.75, r: 0.3, lfoT: 'pitch', lfoR: 5.5, lfoD: 0.05, gain: 0.7 },
  'Pluck': { o1w: 'sawtooth', o2w: 'square', o2oct: -1, o2lvl: 0.35, uni: 3, uniDet: 10, cutoff: 480, res: 5, fEnv: 0.75, fa: 0.001, fd: 0.22, fs: 0, fr: 0.2, a: 0.001, d: 0.45, s: 0, r: 0.25, gain: 0.85 },
  'Warm Pad': { o1w: 'sawtooth', o2w: 'sawtooth', o2fine: 9, o2lvl: 0.7, uni: 4, uniDet: 18, uniSpr: 0.9, cutoff: 1400, res: 0.8, fEnv: 0.25, fa: 0.8, fd: 1.5, fs: 0.5, fr: 1.2, a: 0.7, d: 1.2, s: 0.85, r: 1.4, lfoT: 'filter', lfoR: 0.25, lfoD: 0.35, gain: 0.7 },
  'Glass Pad': { o1w: 'triangle', o2w: 'sine', o2oct: 1, o2semi: 7, o2lvl: 0.35, uni: 3, uniDet: 12, uniSpr: 1, cutoff: 5000, res: 0.5, a: 1.1, d: 2, s: 0.8, r: 2.2, lfoT: 'amp', lfoR: 0.6, lfoD: 0.15, gain: 0.9 },
  'Sub Bass': { o1w: 'sine', o2lvl: 0, cutoff: 1500, res: 0, keyTr: 0, a: 0.003, d: 0.3, s: 1, r: 0.08, drive: 0.15, glide: 0.05, velS: 0.3, gain: 1.5 },
  'Reese Bass': { o1w: 'sawtooth', o2w: 'sawtooth', o2fine: 18, o2lvl: 1, uni: 2, uniDet: 14, uniSpr: 0.3, cutoff: 700, res: 3, fEnv: 0.1, lfoT: 'filter', lfoR: 0.35, lfoD: 0.5, drive: 0.35, a: 0.005, d: 0.3, s: 1, r: 0.12, glide: 0.04, gain: 1.0 },
  'Acid 303': { o1w: 'sawtooth', o2lvl: 0, cutoff: 260, res: 16, fEnv: 0.85, fa: 0.001, fd: 0.18, fs: 0.05, fr: 0.1, a: 0.001, d: 0.2, s: 0.8, r: 0.05, glide: 0.06, drive: 0.45, keyTr: 0.5, gain: 1.0 },
  'Deep House Bass': { o1w: 'sawtooth', o2w: 'square', o2oct: -1, o2lvl: 0.5, cutoff: 380, res: 3, fEnv: 0.45, fa: 0.002, fd: 0.18, fs: 0.1, a: 0.002, d: 0.25, s: 0.6, r: 0.08, sub: 0.4, gain: 1.2 },
  'FM Bell': { o1w: 'sine', o2w: 'sine', o2oct: 1, o2semi: 9, o2lvl: 0, fm: 4.5, fmDec: 1.2, cutoff: 12000, a: 0.001, d: 2.2, s: 0, r: 1.4, velS: 0.7, gain: 0.9 },
  'Trap Bell': { o1w: 'sine', o2w: 'sine', o2oct: 2, o2lvl: 0, fm: 2.6, fmDec: 0.6, cutoff: 9000, a: 0.001, d: 1.6, s: 0, r: 0.9, gain: 0.95 },
  'E-Piano': { o1w: 'sine', o2w: 'sine', o2lvl: 0, fm: 2.2, fmDec: 0.35, sub: 0.12, cutoff: 9000, a: 0.002, d: 2.5, s: 0.15, r: 0.45, lfoT: 'amp', lfoR: 4.5, lfoD: 0.15, velS: 0.8, gain: 0.85 },
  'Lo-fi Keys': { o1w: 'triangle', o2w: 'sine', o2oct: 1, o2lvl: 0.25, cutoff: 2200, res: 0.5, a: 0.004, d: 1.4, s: 0.25, r: 0.35, lfoT: 'pitch', lfoR: 0.9, lfoD: 0.06, velS: 0.7, gain: 0.9 },
  'Strings': { o1w: 'sawtooth', o2w: 'sawtooth', o2fine: -8, o2lvl: 0.8, uni: 5, uniDet: 16, uniSpr: 0.8, cutoff: 3200, res: 0.5, a: 0.35, d: 0.6, s: 0.9, r: 0.7, lfoT: 'pitch', lfoR: 5, lfoD: 0.08, gain: 0.65 },
  'Brass': { o1w: 'sawtooth', o2w: 'sawtooth', o2fine: 6, o2lvl: 0.9, cutoff: 900, res: 1.5, fEnv: 0.55, fa: 0.06, fd: 0.4, fs: 0.4, a: 0.04, d: 0.3, s: 0.85, r: 0.2, gain: 0.5 },
  'Organ': { o1w: 'sine', o2w: 'sine', o2oct: 1, o2lvl: 0.5, sub: 0.5, cutoff: 8000, res: 0, a: 0.005, d: 0.1, s: 1, r: 0.08, lfoT: 'amp', lfoR: 6, lfoD: 0.1, gain: 0.6 },
  'Chip Lead': { o1w: 'square', o2lvl: 0, cutoff: 20000, res: 0, a: 0.001, d: 0.1, s: 0.8, r: 0.05, lfoT: 'pitch', lfoR: 6, lfoD: 0.1, gain: 0.6 },
  'Arp Square': { o1w: 'square', o2w: 'square', o2oct: 1, o2lvl: 0.3, cutoff: 1800, res: 4, fEnv: 0.5, fd: 0.15, a: 0.001, d: 0.25, s: 0.2, r: 0.15, gain: 0.7 },
  'Flute': { o1w: 'sine', o2lvl: 0, noise: 0.08, cutoff: 3500, res: 0.5, a: 0.06, d: 0.2, s: 0.9, r: 0.15, lfoT: 'pitch', lfoR: 5, lfoD: 0.12, gain: 0.8 },
};

const BASS_PRESETS = {
  'Classic 808': {},
  '808 Distorted': { decay: 1.4, punch: 16, drive: 0.75, tone: 4000, click: 0.35 },
  '808 Long Glide': { decay: 2.8, glide: 0.12, drive: 0.35 },
  '808 Short': { decay: 0.5, punch: 10, drive: 0.2, glide: 0 },
};

const DRUM_PRESETS = {
  'Kick Punch': { kind: 'kick', decay: 0.9, tone: 0.5, snap: 0.55, drive: 0.2 },
  'Kick Boom': { kind: 'kick', tune: -3, decay: 1.8, tone: 0.3, snap: 0.3, drive: 0.1 },
  'Kick Hard': { kind: 'kick', tune: 2, decay: 0.7, tone: 0.8, snap: 0.9, drive: 0.7 },
  'Snare Trap': { kind: 'snare', tune: 2, decay: 0.9, tone: 0.7, snap: 0.7 },
  'Snare Tight': { kind: 'snare', tune: 4, decay: 0.55, tone: 0.8, snap: 0.8 },
  'Snare Fat': { kind: 'snare', tune: -3, decay: 1.4, tone: 0.45, snap: 0.6, drive: 0.25 },
  'Clap': { kind: 'clap', decay: 1, tone: 0.5 },
  'Clap Big': { kind: 'clap', decay: 1.8, tone: 0.4 },
  'Hi-Hat': { kind: 'hat', decay: 1, tone: 0.6, gain: 0.8 },
  'Hi-Hat Tight': { kind: 'hat', decay: 0.55, tone: 0.8, gain: 0.8 },
  'Open Hat': { kind: 'ohat', decay: 1, tone: 0.6, gain: 0.7 },
  'Crash': { kind: 'crash', decay: 1, tone: 0.5, gain: 0.6 },
  'Ride': { kind: 'ride', decay: 1, tone: 0.5, gain: 0.6 },
  'Tom Low': { kind: 'tom', tune: -5 },
  'Tom Mid': { kind: 'tom', tune: 0 },
  'Tom High': { kind: 'tom', tune: 5 },
  'Rimshot': { kind: 'rim' },
  'Shaker': { kind: 'shaker', gain: 0.7 },
  'Cowbell': { kind: 'cowbell', gain: 0.6 },
  'Snap': { kind: 'snap' },
  'Perc Blip': { kind: 'perc' },
  'Conga': { kind: 'conga' },
  'Impact': { kind: 'impact', gain: 0.9 },
  'Riser': { kind: 'riser', gain: 0.6 },
  'Downlifter': { kind: 'down', gain: 0.6 },
};

const SYNC_RATES = [['0.25', '1/16'], ['0.5', '1/8'], ['0.75', '1/8.'], ['0.3333', '1/8T'], ['1', '1/4'], ['1.5', '1/4.'], ['0.6667', '1/4T'], ['2', '1/2'], ['4', '1 такт'], ['8', '2 такта']];

const FX_DEFS = {
  eq: { name: 'Эквалайзер', params: [
    { id: 'lowcut', label: 'Low cut', min: 20, max: 1000, def: 20, curve: 'log', fmt: fmtHz },
    { id: 'lowG', label: 'Низ', min: -15, max: 15, def: 0, fmt: fmtDb, bipolar: true },
    { id: 'lowF', label: 'Низ Гц', min: 40, max: 500, def: 120, curve: 'log', fmt: fmtHz },
    { id: 'midG', label: 'Сер.', min: -15, max: 15, def: 0, fmt: fmtDb, bipolar: true },
    { id: 'midF', label: 'Сер. Гц', min: 200, max: 8000, def: 1000, curve: 'log', fmt: fmtHz },
    { id: 'midQ', label: 'Ширина', min: 0.2, max: 8, def: 0.9, curve: 'log', fmt: v => v.toFixed(2) },
    { id: 'highG', label: 'Верх', min: -15, max: 15, def: 0, fmt: fmtDb, bipolar: true },
    { id: 'highF', label: 'Верх Гц', min: 2000, max: 16000, def: 8000, curve: 'log', fmt: fmtHz },
    { id: 'hicut', label: 'High cut', min: 1000, max: 20000, def: 20000, curve: 'log', fmt: fmtHz },
  ] },
  comp: { name: 'Компрессор', params: [
    { id: 'thr', label: 'Порог', min: -60, max: 0, def: -18, fmt: fmtDb },
    { id: 'ratio', label: 'Ratio', min: 1, max: 20, def: 4, curve: 'log', fmt: v => v.toFixed(1) + ':1' },
    { id: 'att', label: 'Атака', min: 0.0005, max: 0.2, def: 0.005, curve: 'log', fmt: fmtS },
    { id: 'rel', label: 'Восст.', min: 0.02, max: 1, def: 0.15, curve: 'log', fmt: fmtS },
    { id: 'knee', label: 'Колено', min: 0, max: 30, def: 6, fmt: v => v.toFixed(0) + ' dB' },
    { id: 'makeup', label: 'Усил.', min: 0, max: 24, def: 4, fmt: fmtDb },
  ] },
  reverb: { name: 'Реверб', params: [
    { id: 'size', label: 'Хвост', min: 0.3, max: 8, def: 2.2, curve: 'log', fmt: fmtS },
    { id: 'damp', label: 'Глушение', min: 1000, max: 16000, def: 6000, curve: 'log', fmt: fmtHz },
    { id: 'pre', label: 'Пред.', min: 0, max: 0.12, def: 0.01, fmt: fmtS },
    { id: 'lowcut', label: 'Low cut', min: 20, max: 1000, def: 200, curve: 'log', fmt: fmtHz },
    { id: 'mix', label: 'Микс', min: 0, max: 1, def: 0.3, fmt: fmtPct },
  ] },
  delay: { name: 'Дилей', params: [
    { id: 'time', label: 'Время', options: SYNC_RATES, def: '0.75' },
    { id: 'fb', label: 'Повторы', min: 0, max: 0.95, def: 0.35, fmt: fmtPct },
    { id: 'tone', label: 'Тон', min: 500, max: 16000, def: 5000, curve: 'log', fmt: fmtHz },
    { id: 'ping', label: 'Пинг-понг', options: [[1, 'Да'], [0, 'Нет']], def: 1 },
    { id: 'mix', label: 'Микс', min: 0, max: 1, def: 0.25, fmt: fmtPct },
  ] },
  dist: { name: 'Дисторшн', params: [
    { id: 'mode', label: 'Тип', options: [['soft', 'Тёплый'], ['hard', 'Жёсткий'], ['fuzz', 'Фузз'], ['fold', 'Фолд']], def: 'soft' },
    { id: 'drive', label: 'Драйв', min: 0, max: 1, def: 0.4, fmt: fmtPct },
    { id: 'tone', label: 'Тон', min: 500, max: 20000, def: 8000, curve: 'log', fmt: fmtHz },
    { id: 'out', label: 'Выход', min: -24, max: 6, def: -3, fmt: fmtDb },
    { id: 'mix', label: 'Микс', min: 0, max: 1, def: 1, fmt: fmtPct },
  ] },
  filter: { name: 'Фильтр', params: [
    { id: 'type', label: 'Тип', options: [['lowpass', 'LP'], ['highpass', 'HP'], ['bandpass', 'BP']], def: 'lowpass' },
    { id: 'cutoff', label: 'Срез', min: 20, max: 20000, def: 2000, curve: 'log', fmt: fmtHz },
    { id: 'res', label: 'Резон.', min: 0, max: 20, def: 1, fmt: v => v.toFixed(1) },
    { id: 'rate', label: 'LFO', options: [['0', 'Выкл']].concat(SYNC_RATES.slice(1)), def: '0' },
    { id: 'depth', label: 'Глубина', min: 0, max: 1, def: 0.5, fmt: fmtPct },
  ] },
  chorus: { name: 'Хорус', params: [
    { id: 'rate', label: 'Скорость', min: 0.05, max: 5, def: 0.8, curve: 'log', fmt: v => v.toFixed(2) + ' Hz' },
    { id: 'depth', label: 'Глубина', min: 0, max: 1, def: 0.5, fmt: fmtPct },
    { id: 'mix', label: 'Микс', min: 0, max: 1, def: 0.45, fmt: fmtPct },
  ] },
  phaser: { name: 'Фейзер', params: [
    { id: 'rate', label: 'Скорость', min: 0.05, max: 5, def: 0.4, curve: 'log', fmt: v => v.toFixed(2) + ' Hz' },
    { id: 'depth', label: 'Глубина', min: 0, max: 1, def: 0.7, fmt: fmtPct },
    { id: 'fb', label: 'Обр. связь', min: 0, max: 0.9, def: 0.5, fmt: fmtPct },
    { id: 'mix', label: 'Микс', min: 0, max: 1, def: 0.5, fmt: fmtPct },
  ] },
  lofi: { name: 'Lo-Fi', params: [
    { id: 'bits', label: 'Биты', min: 3, max: 16, def: 10, step: 1, fmt: fmtInt },
    { id: 'tone', label: 'Тон', min: 500, max: 14000, def: 4500, curve: 'log', fmt: fmtHz },
    { id: 'wow', label: 'Плавание', min: 0, max: 1, def: 0.3, fmt: fmtPct, hint: 'Гуляние высоты, как у старой кассеты' },
    { id: 'crackle', label: 'Винил', min: 0, max: 1, def: 0.3, fmt: fmtPct },
    { id: 'mix', label: 'Микс', min: 0, max: 1, def: 1, fmt: fmtPct },
  ] },
  pump: { name: 'Сайдчейн', params: [
    { id: 'depth', label: 'Глубина', min: 0, max: 1, def: 0.7, fmt: fmtPct },
    { id: 'rel', label: 'Возврат', min: 0.05, max: 1, def: 0.55, fmt: fmtPct },
    { id: 'rate', label: 'Каждые', options: [['4', '1/4'], ['2', '1/8'], ['8', '1/2'], ['16', '1 такт']], def: '4' },
  ] },
  width: { name: 'Стерео ширина', params: [
    { id: 'width', label: 'Ширина', min: 0, max: 2, def: 1.4, fmt: fmtPct },
  ] },
  limiter: { name: 'Лимитер', params: [
    { id: 'gain', label: 'Вход', min: 0, max: 24, def: 3, fmt: fmtDb },
    { id: 'ceil', label: 'Потолок', min: -12, max: 0, def: -0.3, fmt: fmtDb },
    { id: 'rel', label: 'Восст.', min: 0.01, max: 0.5, def: 0.06, curve: 'log', fmt: fmtS },
  ] },
};

function fxDefaults(type) {
  const o = {};
  for (const p of FX_DEFS[type].params) o[p.id] = p.def;
  return o;
}

const SCALES = {
  none: ['Без лада', []],
  minor: ['Минор', [0, 2, 3, 5, 7, 8, 10]],
  major: ['Мажор', [0, 2, 4, 5, 7, 9, 11]],
  harm: ['Гарм. минор', [0, 2, 3, 5, 7, 8, 11]],
  dorian: ['Дорийский', [0, 2, 3, 5, 7, 9, 10]],
  phryg: ['Фригийский', [0, 1, 3, 5, 7, 8, 10]],
  penmin: ['Пентатоника мин.', [0, 3, 5, 7, 10]],
  penmaj: ['Пентатоника маж.', [0, 2, 4, 7, 9]],
  blues: ['Блюз', [0, 3, 5, 6, 7, 10]],
};

const CHORDS = {
  none: ['Без аккорда', [0]],
  maj: ['Мажор', [0, 4, 7]],
  min: ['Минор', [0, 3, 7]],
  maj7: ['Maj7', [0, 4, 7, 11]],
  min7: ['Min7', [0, 3, 7, 10]],
  dom7: ['7', [0, 4, 7, 10]],
  min9: ['Min9', [0, 3, 7, 10, 14]],
  maj9: ['Maj9', [0, 4, 7, 11, 14]],
  sus2: ['Sus2', [0, 2, 7]],
  sus4: ['Sus4', [0, 5, 7]],
  dim: ['Dim', [0, 3, 6]],
  aug: ['Aug', [0, 4, 8]],
  pow: ['Квинта', [0, 7, 12]],
  oct: ['Октава', [0, 12]],
};

const SNAPS = [['16', 'Сетка: такт'], ['4', 'Сетка: доля'], ['2', 'Сетка: 1/8'], ['1', 'Сетка: 1/16'], ['0.5', 'Сетка: 1/32'], ['0.6667', 'Сетка: 1/8 T'], ['0.3333', 'Сетка: 1/16 T'], ['0', 'Без сетки']];
