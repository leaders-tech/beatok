let P = null;
const curPat = () => P && patById(P, P.curPat);
const chById = id => P.channels.find(c => c.id === id);

const TYPE_COLORS = { drum: '#ff8a4c', bass808: '#ff5d6c', synth: '#5cc8ff', sampler: '#b48cff' };

function presetParams(type, preset) {
  const base = specDefaults(INSTR_SPECS[type]);
  const table = type === 'synth' ? SYNTH_PRESETS : type === 'bass808' ? BASS_PRESETS : type === 'drum' ? DRUM_PRESETS : {};
  return Object.assign(base, deep(table[preset] || {}));
}

function nextFreeInsert(proj) {
  const used = new Set(proj.channels.map(c => c.mixer));
  for (let i = 1; i < proj.mixer.length; i++) if (!used.has(i)) return i;
  return 0;
}

function makeChannel(proj, type, preset, extra) {
  const params = presetParams(type, preset);
  const ch = {
    id: uid('c'),
    name: preset || INSTR_NAMES[type],
    color: PALETTE[proj.channels.length % (PALETTE.length - 1)],
    type, preset: preset || '', params,
    vol: 0.8, pan: 0, mute: false, solo: false,
    mixer: nextFreeInsert(proj),
    mono: type === 'bass808' || (type === 'synth' && params.glide > 0),
    cut: type === 'drum' && (params.kind === 'hat' || params.kind === 'ohat') ? 1 : 0,
    root: type === 'bass808' ? 36 : 60,
  };
  Object.assign(ch, extra || {});
  if (ch.mixer > 0 && proj.mixer[ch.mixer] && !proj.mixer[ch.mixer].name) proj.mixer[ch.mixer].name = ch.name;
  return ch;
}

function makeInsertData(name) {
  return { name: name || '', vol: 0.8, pan: 0, mute: false, solo: false, eq: { low: 0, mid: 0, high: 0 }, fx: [] };
}

function makePattern(proj, name) {
  const n = proj.patterns.length;
  return { id: uid('p'), name: name || 'Паттерн ' + (n + 1), color: PALETTE[n % PALETTE.length], len: 16, notes: {} };
}

function emptyProject(name) {
  const proj = {
    v: 1, id: uid('prj'), name: name || 'Новый бит', bpm: 140, swing: 0, masterVol: 0.85,
    key: 0, scale: 'minor',
    channels: [], patterns: [], curPat: null,
    playlist: { tracks: [], clips: [] },
    mixer: [],
  };
  proj.mixer.push(makeInsertData('Master'));
  for (let i = 1; i <= 16; i++) proj.mixer.push(makeInsertData(''));
  for (let i = 0; i < 12; i++) proj.playlist.tracks.push({ name: 'Дорожка ' + (i + 1), mute: false });
  const pat = makePattern(proj);
  proj.patterns.push(pat);
  proj.curPat = pat.id;
  return proj;
}

function addFx(proj, ins, type, over) {
  const slot = { id: uid('f'), type, on: true, p: Object.assign(fxDefaults(type), over || {}) };
  proj.mixer[ins].fx.push(slot);
  return slot;
}

const N = (t, n, d = 1, v = 0.8) => ({ t, d, n, v });
const hits = (arr, v = 0.85, n = 60) => arr.map(x => Array.isArray(x) ? N(x[0], n, x[2] || 1, x[1]) : N(x, n, 1, v));

const TEMPLATES = {
  trap() {
    const p = emptyProject('Trap · F minor');
    p.bpm = 140; p.key = 5; p.scale = 'minor';
    const C = (type, preset, extra) => { const c = makeChannel(p, type, preset, extra); p.channels.push(c); return c; };
    const kick = C('drum', 'Kick Boom', { name: 'Kick', vol: 0.9 });
    const clap = C('drum', 'Clap', { name: 'Clap', vol: 0.75 });
    const snare = C('drum', 'Snare Trap', { name: 'Snare', vol: 0.75 });
    const hat = C('drum', 'Hi-Hat', { name: 'Hi-Hat', vol: 0.6, pan: 0.12 });
    const oh = C('drum', 'Open Hat', { name: 'Open Hat', vol: 0.5, pan: -0.15 });
    const perc = C('drum', 'Rimshot', { name: 'Perc', vol: 0.4, pan: 0.3 });
    const b808 = C('bass808', 'Classic 808', { name: '808', vol: 0.85 });
    const bell = C('synth', 'Trap Bell', { name: 'Bell', vol: 0.45 });
    const pad = C('synth', 'Warm Pad', { name: 'Pad', vol: 0.3 });
    b808.params.drive = 0.45;
    b808.params.decay = 1.9;
    const drums = p.patterns[0];
    drums.name = 'Drums'; drums.len = 32;
    drums.notes[kick.id] = hits([0, 10, 16, 22, 27], 0.95);
    drums.notes[clap.id] = hits([8, 24], 0.95);
    drums.notes[snare.id] = hits([8, 24], 0.75);
    const hh = [];
    for (let s = 0; s < 14; s += 2) hh.push(N(s, 60, 0.5, s % 4 === 0 ? 0.85 : 0.6));
    for (const t of [14, 14.6667, 15.3333]) hh.push(N(t, 60, 0.5, 0.7));
    for (let s = 16; s < 28; s += 2) if (s !== 22) hh.push(N(s, 60, 0.5, s % 4 === 0 ? 0.85 : 0.6));
    for (let i = 0; i < 8; i++) hh.push(N(28 + i * 0.5, 60, 0.4, 0.45 + i * 0.055));
    drums.notes[hat.id] = hh;
    drums.notes[oh.id] = hits([22], 0.7);
    drums.notes[perc.id] = hits([[3, 0.5], [13, 0.4], [19, 0.55], [29, 0.4]]);
    const bass = makePattern(p, '808'); bass.len = 64; p.patterns.push(bass);
    bass.notes[b808.id] = [N(0, 29, 8, 0.95), N(10, 29, 6, 0.85), N(16, 37, 6, 0.95), N(22, 37, 5, 0.85), N(27, 37, 5, 0.85),
      N(32, 34, 8, 0.95), N(42, 34, 6, 0.85), N(48, 36, 6, 0.95), N(54, 36, 5, 0.85), N(59, 36, 3, 0.85), N(61, 48, 3, 0.85)];
    const mel = makePattern(p, 'Bell'); mel.len = 64; p.patterns.push(mel);
    const line = [[72, 68, 65, 72, 68, 75], [73, 68, 65, 73, 68, 72], [70, 65, 61, 70, 65, 68], [72, 67, 64, 72, 67, 67]];
    const at = [0, 3, 6, 8, 11, 14];
    mel.notes[bell.id] = [];
    line.forEach((bar, b) => bar.forEach((n, i) => mel.notes[bell.id].push(N(b * 16 + at[i], n, 2.5, [0.9, 0.7, 0.75, 0.85, 0.7, 0.8][i]))));
    const pads = makePattern(p, 'Pad'); pads.len = 64; p.patterns.push(pads);
    const chords = [[53, 56, 60], [49, 53, 56], [49, 53, 58], [48, 52, 55]];
    pads.notes[pad.id] = [];
    chords.forEach((c, b) => c.forEach(n => pads.notes[pad.id].push(N(b * 16, n, 16, 0.65))));
    p.playlist.tracks[0].name = 'Bell'; p.playlist.tracks[1].name = 'Pad'; p.playlist.tracks[2].name = 'Drums'; p.playlist.tracks[3].name = '808';
    p.playlist.clips.push({ id: uid('k'), p: mel.id, tr: 0, s: 0, l: 192 }, { id: uid('k'), p: pads.id, tr: 1, s: 0, l: 192 },
      { id: uid('k'), p: drums.id, tr: 2, s: 64, l: 128 }, { id: uid('k'), p: bass.id, tr: 3, s: 64, l: 128 });
    addFx(p, clap.mixer, 'reverb', { size: 1.2, mix: 0.18 });
    addFx(p, hat.mixer, 'eq', { lowcut: 400 });
    addFx(p, b808.mixer, 'eq', { lowcut: 25, midG: -2, midF: 400 });
    addFx(p, bell.mixer, 'delay', { time: '0.75', fb: 0.35, mix: 0.22 });
    addFx(p, bell.mixer, 'reverb', { size: 2.8, mix: 0.3 });
    addFx(p, pad.mixer, 'reverb', { size: 4, mix: 0.45 });
    addFx(p, 0, 'comp', { thr: -14, ratio: 2.5, att: 0.01, rel: 0.2, makeup: 2 });
    p.curPat = drums.id;
    return p;
  },

  house() {
    const p = emptyProject('House · A minor');
    p.bpm = 124; p.key = 9; p.scale = 'minor';
    const C = (type, preset, extra) => { const c = makeChannel(p, type, preset, extra); p.channels.push(c); return c; };
    const kick = C('drum', 'Kick Punch', { name: 'Kick', vol: 0.9 });
    const clap = C('drum', 'Clap', { name: 'Clap', vol: 0.7 });
    const hat = C('drum', 'Hi-Hat Tight', { name: 'Hat', vol: 0.5, cut: 0, pan: 0.1 });
    const oh = C('drum', 'Open Hat', { name: 'Open Hat', vol: 0.55, cut: 0 });
    const shk = C('drum', 'Shaker', { name: 'Shaker', vol: 0.35, pan: -0.25 });
    const bass = C('synth', 'Deep House Bass', { name: 'Bass', vol: 0.55 });
    const keys = C('synth', 'Pluck', { name: 'Chords', vol: 0.5 });
    const pad = C('synth', 'Warm Pad', { name: 'Pad', vol: 0.25 });
    const full = p.patterns[0];
    full.name = 'Drums';
    full.notes[kick.id] = hits([0, 4, 8, 12], 0.95);
    full.notes[clap.id] = hits([4, 12], 0.9);
    full.notes[hat.id] = [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15].map(s => N(s, 60, 0.5, s % 2 ? 0.45 : 0.6));
    full.notes[oh.id] = hits([2, 6, 10, 14], 0.8);
    full.notes[shk.id] = [1, 3, 5, 7, 9, 11, 13, 15].map(s => N(s, 60, 0.5, 0.5));
    const intro = makePattern(p, 'Intro drums'); p.patterns.push(intro);
    intro.notes[kick.id] = hits([0, 4, 8, 12], 0.9);
    intro.notes[oh.id] = hits([2, 6, 10, 14], 0.65);
    const bp = makePattern(p, 'Bass'); bp.len = 64; p.patterns.push(bp);
    const roots = [33, 29, 36, 31];
    bp.notes[bass.id] = [];
    roots.forEach((r, b) => [[2, 0], [6, 0], [10, 0], [14, 12]].forEach(([s, o]) => bp.notes[bass.id].push(N(b * 16 + s, r + o, 1.5, s === 2 ? 0.9 : 0.75))));
    const cp = makePattern(p, 'Chords'); cp.len = 64; p.patterns.push(cp);
    const ch = [[57, 60, 64, 67], [57, 60, 64, 65], [55, 60, 64, 67], [55, 59, 62, 67]];
    cp.notes[keys.id] = [];
    ch.forEach((c, b) => [2, 6, 9, 13].forEach(s => c.forEach(n => cp.notes[keys.id].push(N(b * 16 + s, n, 1.5, s === 2 ? 0.85 : 0.7)))));
    const pp = makePattern(p, 'Pad'); pp.len = 64; p.patterns.push(pp);
    pp.notes[pad.id] = [];
    ch.forEach((c, b) => c.forEach(n => pp.notes[pad.id].push(N(b * 16, n - 12, 16, 0.6))));
    p.playlist.tracks[0].name = 'Drums'; p.playlist.tracks[1].name = 'Bass'; p.playlist.tracks[2].name = 'Chords'; p.playlist.tracks[3].name = 'Pad';
    p.playlist.clips.push({ id: uid('k'), p: intro.id, tr: 0, s: 0, l: 64 }, { id: uid('k'), p: full.id, tr: 0, s: 64, l: 192 },
      { id: uid('k'), p: bp.id, tr: 1, s: 64, l: 192 }, { id: uid('k'), p: cp.id, tr: 2, s: 64, l: 192 }, { id: uid('k'), p: pp.id, tr: 3, s: 0, l: 256 });
    addFx(p, clap.mixer, 'reverb', { size: 1.4, mix: 0.2 });
    addFx(p, hat.mixer, 'eq', { lowcut: 500 });
    addFx(p, bass.mixer, 'pump', { depth: 0.45, rel: 0.5 });
    addFx(p, keys.mixer, 'delay', { time: '0.75', fb: 0.3, mix: 0.2 });
    addFx(p, keys.mixer, 'reverb', { size: 2, mix: 0.25 });
    addFx(p, keys.mixer, 'pump', { depth: 0.55, rel: 0.55 });
    addFx(p, pad.mixer, 'reverb', { size: 3.5, mix: 0.4 });
    addFx(p, pad.mixer, 'pump', { depth: 0.75, rel: 0.6 });
    addFx(p, 0, 'comp', { thr: -12, ratio: 2, att: 0.01, rel: 0.15, makeup: 2 });
    p.curPat = full.id;
    return p;
  },

  lofi() {
    const p = emptyProject('Lo-fi · C major');
    p.bpm = 82; p.swing = 45; p.key = 0; p.scale = 'major'; p.masterVol = 1;
    p.mixer[1].name = 'Drums';
    const C = (type, preset, extra) => { const c = makeChannel(p, type, preset, extra); p.channels.push(c); return c; };
    const kick = C('drum', 'Kick Boom', { name: 'Kick', vol: 0.85, mixer: 1 });
    const snare = C('drum', 'Snare Fat', { name: 'Snare', vol: 0.85, mixer: 1 });
    const hat = C('drum', 'Hi-Hat Tight', { name: 'Hat', vol: 0.45, mixer: 1, pan: 0.15 });
    const shk = C('drum', 'Shaker', { name: 'Shaker', vol: 0.25, mixer: 1, pan: -0.2 });
    kick.params.decay = 1.2; kick.params.tone = 0.25;
    snare.params.tone = 0.6;
    const keys = C('synth', 'E-Piano', { name: 'Keys', vol: 0.65, mixer: 2 });
    const bass = C('synth', 'Sub Bass', { name: 'Bass', vol: 0.5, mixer: 3 });
    p.mixer[2].name = 'Keys'; p.mixer[3].name = 'Bass';
    const dr = p.patterns[0];
    dr.name = 'Drums';
    dr.notes[kick.id] = hits([[0, 0.95], [7, 0.6], [10, 0.85]]);
    dr.notes[snare.id] = hits([[4, 0.9], [12, 0.9], [15, 0.3]]);
    dr.notes[hat.id] = [0, 2, 4, 6, 8, 10, 12, 14].map(s => N(s, 60, 0.5, s % 4 === 0 ? 0.6 : 0.42));
    dr.notes[shk.id] = [1, 3, 5, 7, 9, 11, 13, 15].map(s => N(s, 60, 0.5, 0.35));
    const kp = makePattern(p, 'Keys'); kp.len = 64; p.patterns.push(kp);
    const vo = [[50, 53, 57, 60, 64], [43, 53, 59, 64], [48, 52, 59, 62], [45, 55, 60, 64]];
    kp.notes[keys.id] = [];
    vo.forEach((c, b) => {
      c.forEach((n, i) => kp.notes[keys.id].push(N(b * 16 + i * 0.12, n, 9, 0.72 - i * 0.03)));
      c.slice(1).forEach((n, i) => kp.notes[keys.id].push(N(b * 16 + 10.5 + i * 0.1, n, 5, 0.55)));
    });
    const bpat = makePattern(p, 'Bass'); bpat.len = 64; p.patterns.push(bpat);
    const roots = [38, 31, 36, 33];
    bpat.notes[bass.id] = [];
    roots.forEach((r, b) => { bpat.notes[bass.id].push(N(b * 16, r, 7, 0.9), N(b * 16 + 10, r, 4, 0.75), N(b * 16 + 14, r + 7, 2, 0.6)); });
    p.playlist.tracks[0].name = 'Keys'; p.playlist.tracks[1].name = 'Drums'; p.playlist.tracks[2].name = 'Bass';
    p.playlist.clips.push({ id: uid('k'), p: kp.id, tr: 0, s: 0, l: 128 }, { id: uid('k'), p: dr.id, tr: 1, s: 32, l: 96 }, { id: uid('k'), p: bpat.id, tr: 2, s: 32, l: 96 });
    addFx(p, 1, 'lofi', { bits: 11, tone: 6500, wow: 0, crackle: 0, mix: 1 });
    addFx(p, 1, 'comp', { thr: -20, ratio: 3, makeup: 4 });
    addFx(p, 2, 'lofi', { bits: 12, tone: 3600, wow: 0.45, crackle: 0.4, mix: 1 });
    addFx(p, 2, 'reverb', { size: 2.5, mix: 0.25 });
    addFx(p, 0, 'eq', { hicut: 13000, lowG: 1.5 });
    p.curPat = dr.id;
    return p;
  },

  empty() {
    const p = emptyProject('Новый бит');
    for (const [pr, nm] of [['Kick Punch', 'Kick'], ['Clap', 'Clap'], ['Hi-Hat', 'Hi-Hat'], ['Snare Trap', 'Snare']]) {
      p.channels.push(makeChannel(p, 'drum', pr, { name: nm }));
    }
    return p;
  },
};

const TEMPLATE_LIST = [['trap', 'Trap', '140 BPM, 808 с глайдом, роллы хэтов'], ['house', 'House', '124 BPM, сайдчейн, аккорды'], ['lofi', 'Lo-fi', '82 BPM, свинг, винил'], ['empty', 'Пустой проект', 'Четыре барабана, без нот']];

function normalizeProject(p) {
  const d = emptyProject();
  for (const k of ['bpm', 'swing', 'masterVol', 'key', 'scale', 'name']) if (p[k] == null) p[k] = d[k];
  if (!p.id) p.id = uid('prj');
  if (!p.mixer || !p.mixer.length) p.mixer = d.mixer;
  while (p.mixer.length < 17) p.mixer.push(makeInsertData(''));
  for (const m of p.mixer) { m.eq = m.eq || { low: 0, mid: 0, high: 0 }; m.fx = m.fx || []; for (const f of m.fx) { f.id = f.id || uid('f'); f.p = Object.assign(fxDefaults(f.type), f.p || {}); } }
  p.playlist = p.playlist || d.playlist;
  for (const ch of p.channels) { ch.params = Object.assign(specDefaults(INSTR_SPECS[ch.type]), ch.params || {}); ch.color = OLD_COLORS[ch.color] || ch.color; }
  for (const pt of p.patterns) pt.color = OLD_COLORS[pt.color] || pt.color;
  if (!p.patterns.length) p.patterns.push(makePattern(p));
  if (!patById(p, p.curPat)) p.curPat = p.patterns[0].id;
  return p;
}

const History = {
  stack: [],
  idx: -1,
  reset() {
    this.stack = [JSON.stringify(P)];
    this.idx = 0;
    UI.updateUndo && UI.updateUndo();
  },
  commit(label) {
    const s = JSON.stringify(P);
    UI.ver = (UI.ver || 0) + 1;
    if (s === this.stack[this.idx]) return;
    this.stack.length = this.idx + 1;
    this.stack.push(s);
    if (this.stack.length > 100) this.stack.shift();
    this.idx = this.stack.length - 1;
    Store.autosave();
    UI.updateUndo && UI.updateUndo();
  },
  undo() {
    if (this.idx <= 0) return;
    this.idx--;
    this.apply();
    UI.toast('Отменено');
  },
  redo() {
    if (this.idx >= this.stack.length - 1) return;
    this.idx++;
    this.apply();
    UI.toast('Повторено');
  },
  apply() {
    const was = Engine.playing;
    const keepPat = P && P.curPat;
    P = JSON.parse(this.stack[this.idx]);
    if (keepPat && patById(P, keepPat)) P.curPat = keepPat;
    UI.ver = (UI.ver || 0) + 1;
    if (Engine.ctx) Engine.rebuild();
    if (was && Engine.graph) { /* keep playing */ }
    UI.renderAll();
    Store.autosave();
    UI.updateUndo && UI.updateUndo();
  },
};

const Caps = {
  _c: {},
  use(name) {
    if (this._c[name]) return this._c[name];
    const c = window.claude;
    if (!c || typeof c.use !== 'function') return Promise.resolve(null);
    this._c[name] = Promise.race([Promise.resolve(c.use(name)), new Promise(r => setTimeout(() => r(null), 12000))]).catch(() => null);
    return this._c[name];
  },
};

function toU8(data) {
  if (data instanceof Uint8Array) return data;
  if (typeof data === 'string') return new TextEncoder().encode(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return null;
}

async function saveFile(filename, data, mime) {
  const dl = await Caps.use('downloads');
  if (dl) {
    const ext = filename.split('.').pop().toLowerCase();
    const allowed = ['json', 'zip', 'txt', 'md', 'csv', 'png', 'webm', 'mp4', 'html', 'svg'];
    let name = filename, payload = data;
    if (!allowed.includes(ext)) {
      const u8 = data instanceof Blob ? new Uint8Array(await data.arrayBuffer()) : toU8(data);
      payload = makeZip([{ name: filename, data: u8 }]);
      name = filename.replace(/\.[^.]+$/, '') + '.zip';
    } else if (data instanceof Uint8Array) payload = new Blob([data]);
    try {
      await dl.save({ filename: name, data: payload });
      return name;
    } catch (e) {
      if (e && e.code === 'declined') return null;
      throw e;
    }
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
  return filename;
}

const Store = {
  mode: 'local',
  db: null,
  uid: null,
  ready: null,
  init() {
    this.ready = (async () => {
      try {
        const db = await Caps.use('db');
        const user = await Caps.use('user');
        if (db && user) {
          const id = await user.id();
          if (id) { this.db = db; this.uid = id; this.mode = 'cloud'; }
        }
      } catch (e) { console.warn('cloud store unavailable', e); }
      UI.updateStoreBadge && UI.updateStoreBadge();
    })();
    return this.ready;
  },
  col() { return this.db.collection('data/users/' + this.uid); },
  lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} },
  autosave: debounce(() => {
    if (!P) return;
    const withS = JSON.stringify({ proj: P, samples: Samples.used(P) });
    if (!Store.lsSet('beatok:auto', withS)) Store.lsSet('beatok:auto', JSON.stringify({ proj: P, samples: [] }));
  }, 700),
  loadAuto() {
    const s = this.lsGet('beatok:auto');
    if (!s) return null;
    try { return JSON.parse(s); } catch (e) { return null; }
  },
  async list() {
    await this.ready;
    if (this.mode === 'cloud') {
      const snap = await this.col().where('kind', '==', 'meta').get();
      return snap.docs.map(d => d.data()).filter(Boolean).sort((a, b) => b.updated - a.updated);
    }
    try { return JSON.parse(this.lsGet('beatok:index') || '[]').sort((a, b) => b.updated - a.updated); } catch (e) { return []; }
  },
  async save(proj) {
    await this.ready;
    const meta = { kind: 'meta', pid: proj.id, name: proj.name, bpm: proj.bpm, updated: Date.now() };
    let samples = Samples.used(proj);
    let dropped = false;
    if (this.mode === 'cloud') {
      let data = JSON.stringify({ proj, samples });
      if (data.length > 240000) { samples = []; dropped = true; data = JSON.stringify({ proj, samples }); }
      if (data.length > 250000) throw new Error('Проект слишком большой для облака. Сохрани его файлом.');
      await this.col().doc('p-' + proj.id).set({ kind: 'proj', data });
      await this.col().doc('m-' + proj.id).set(meta);
    } else {
      if (!this.lsSet('beatok:p:' + proj.id, JSON.stringify({ proj, samples }))) {
        dropped = true;
        if (!this.lsSet('beatok:p:' + proj.id, JSON.stringify({ proj, samples: [] }))) throw new Error('В браузере закончилось место. Сохрани проект файлом.');
      }
      const idx = (await this.list()).filter(m => m.pid !== proj.id);
      idx.push(meta);
      this.lsSet('beatok:index', JSON.stringify(idx));
    }
    return { dropped };
  },
  async load(pid) {
    await this.ready;
    let raw;
    if (this.mode === 'cloud') {
      const d = await this.col().doc('p-' + pid).get();
      if (!d.exists) throw new Error('Проект не найден');
      raw = d.data().data;
    } else raw = this.lsGet('beatok:p:' + pid);
    if (!raw) throw new Error('Проект не найден');
    return JSON.parse(raw);
  },
  async remove(pid) {
    await this.ready;
    if (this.mode === 'cloud') {
      await this.col().doc('p-' + pid).delete();
      await this.col().doc('m-' + pid).delete();
    } else {
      this.lsDel('beatok:p:' + pid);
      const idx = (await this.list()).filter(m => m.pid !== pid);
      this.lsSet('beatok:index', JSON.stringify(idx));
    }
  },
};

async function loadProjectData(data) {
  const proj = normalizeProject(data.proj || data);
  await Samples.restore(data.samples);
  Engine.stop(true);
  P = proj;
  Engine.songStart = 0;
  if (Engine.ctx) Engine.rebuild();
  History.reset();
  UI.renderAll();
  Store.autosave();
}
