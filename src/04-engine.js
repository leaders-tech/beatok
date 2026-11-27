const Samples = {
  map: {},
  _dc: null,
  decodeCtx() {
    if (Engine.ctx) return Engine.ctx;
    if (!this._dc) this._dc = new OfflineAudioContext(1, 1, 44100);
    return this._dc;
  },
  get(id, rev) {
    const s = this.map[id];
    if (!s || !s.buffer) return null;
    if (!rev) return s.buffer;
    if (!s.rev) {
      const b = s.buffer;
      const r = new AudioBuffer({ length: b.length, numberOfChannels: b.numberOfChannels, sampleRate: b.sampleRate });
      for (let c = 0; c < b.numberOfChannels; c++) r.getChannelData(c).set(Float32Array.from(b.getChannelData(c)).reverse());
      s.rev = r;
    }
    return s.rev;
  },
  async add(name, arrayBuffer, id) {
    const b64 = b64FromBuf(arrayBuffer);
    const buffer = await this.decodeCtx().decodeAudioData(arrayBuffer.slice(0));
    id = id || uid('s');
    this.map[id] = { name, b64, buffer, peaks: null };
    return id;
  },
  async restore(list) {
    for (const s of list || []) {
      if (this.map[s.id] || !s.b64) continue;
      try { await this.add(s.name, bufFromB64(s.b64), s.id); } catch (e) { console.warn('sample decode failed', s.name, e); }
    }
  },
  peaks(id, n) {
    const s = this.map[id];
    if (!s || !s.buffer) return null;
    if (s.peaks && s.peaks.length === n) return s.peaks;
    const d = s.buffer.getChannelData(0), step = Math.max(1, Math.floor(d.length / n)), out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let j = i * step, e = Math.min(d.length, j + step); j < e; j += 4) m = Math.max(m, Math.abs(d[j]));
      out[i] = m;
    }
    return (s.peaks = out);
  },
  list() {
    return Object.entries(this.map).map(([id, s]) => ({ id, name: s.name }));
  },
  used(proj) {
    const ids = new Set(proj.channels.filter(c => c.type === 'sampler' && c.params.sid).map(c => c.params.sid));
    return [...ids].filter(id => this.map[id]).map(id => ({ id, name: this.map[id].name, b64: this.map[id].b64 }));
  },
};

class Graph {
  constructor(ctx, eng, live) {
    this.ctx = ctx;
    this.eng = eng;
    this.live = live;
    this.voices = [];
    this.inserts = [];
    this.chans = {};
    this.masterVol = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.12;
    this.out = ctx.createGain();
    this.masterVol.connect(this.limiter).connect(this.out).connect(ctx.destination);
    if (live) {
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.75;
      this.out.connect(this.analyser);
    }
  }

  build(proj) {
    this.proj = proj;
    for (let i = 0; i < proj.mixer.length; i++) this.inserts[i] = this.makeInsert(i);
    for (let i = 0; i < proj.mixer.length; i++) this.updateInsert(i);
    this.syncChannels();
    this.setMaster();
  }

  setMaster() {
    this.masterVol.gain.value = this.proj.masterVol;
  }

  makeInsert(i) {
    const ctx = this.ctx;
    const I = {};
    I.input = ctx.createGain();
    I.lo = mkFilt(ctx, 'lowshelf', 160);
    I.mid = mkFilt(ctx, 'peaking', 1200, 0.8);
    I.hi = mkFilt(ctx, 'highshelf', 7500);
    I.fxIn = ctx.createGain();
    I.fxOut = ctx.createGain();
    I.pan = ctx.createStereoPanner();
    I.fader = ctx.createGain();
    I.mute = ctx.createGain();
    I.input.connect(I.lo).connect(I.mid).connect(I.hi).connect(I.fxIn);
    I.fxOut.connect(I.pan).connect(I.fader).connect(I.mute);
    I.mute.connect(i === 0 ? this.masterVol : this.inserts[0].input);
    I.fx = [];
    if (this.live) {
      I.split = ctx.createChannelSplitter(2);
      I.anL = ctx.createAnalyser(); I.anR = ctx.createAnalyser();
      I.anL.fftSize = I.anR.fftSize = 512;
      I.mute.connect(I.split);
      I.split.connect(I.anL, 0); I.split.connect(I.anR, 1);
      I.buf = new Float32Array(512);
    }
    this.inserts[i] = I;
    this.rebuildFx(i);
    return I;
  }

  rebuildFx(i) {
    const I = this.inserts[i], m = this.proj.mixer[i];
    if (!I) return;
    try { I.fxIn.disconnect(); } catch (e) {}
    for (const f of I.fx) {
      try { f.output.disconnect(); } catch (e) {}
      if (f.dispose) f.dispose();
    }
    I.fx = [];
    let n = I.fxIn;
    for (const slot of m.fx) {
      if (!slot.on || !FX_BUILD[slot.type]) continue;
      const fx = buildFx(this.ctx, slot.type, slot.p, this.eng);
      fx.slot = slot;
      n.connect(fx.input);
      n = fx.output;
      I.fx.push(fx);
    }
    n.connect(I.fxOut);
  }

  updateFx(i, slot) {
    const I = this.inserts[i];
    if (!I) return;
    const fx = I.fx.find(f => f.slot === slot);
    if (fx) fx.update(slot.p);
  }

  updateInsert(i) {
    const I = this.inserts[i], m = this.proj.mixer[i];
    if (!I) return;
    const anySolo = this.proj.mixer.some((x, k) => k > 0 && x.solo);
    I.fader.gain.value = m.vol;
    I.pan.pan.value = m.pan;
    I.lo.gain.value = m.eq.low;
    I.mid.gain.value = m.eq.mid;
    I.hi.gain.value = m.eq.high;
    const muted = m.mute || (i > 0 && anySolo && !m.solo);
    I.mute.gain.value = muted ? 0 : 1;
  }

  updateAllInserts() {
    for (let i = 0; i < this.inserts.length; i++) this.updateInsert(i);
  }

  syncChannels() {
    const ctx = this.ctx, proj = this.proj;
    const ids = new Set(proj.channels.map(c => c.id));
    for (const id in this.chans) if (!ids.has(id)) {
      try { this.chans[id].mute.disconnect(); } catch (e) {}
      delete this.chans[id];
    }
    for (const ch of proj.channels) {
      let S = this.chans[ch.id];
      if (!S) {
        S = { input: ctx.createGain(), vol: ctx.createGain(), pan: ctx.createStereoPanner(), mute: ctx.createGain(), dest: -1 };
        S.input.connect(S.vol).connect(S.pan).connect(S.mute);
        this.chans[ch.id] = S;
      }
      this.updateChannel(ch);
    }
  }

  updateChannel(ch) {
    const S = this.chans[ch.id];
    if (!S) return;
    const anySolo = this.proj.channels.some(c => c.solo);
    S.vol.gain.value = ch.vol;
    S.pan.pan.value = ch.pan;
    S.mute.gain.value = ch.mute || (anySolo && !ch.solo) ? 0 : 1;
    const dest = clamp(ch.mixer | 0, 0, this.inserts.length - 1);
    if (S.dest !== dest) {
      try { S.mute.disconnect(); } catch (e) {}
      S.mute.connect(this.inserts[dest].input);
      S.dest = dest;
    }
  }

  updateAllChannels() {
    for (const ch of this.proj.channels) this.updateChannel(ch);
  }

  trigger(ch, midi, vel, t, dur) {
    const S = this.chans[ch.id];
    const play = INSTR_PLAY[ch.type];
    if (!S || !play) return null;
    if (this.voices.length > 64) {
      const now = this.ctx.currentTime;
      this.voices = this.voices.filter(v => v.end > now - 0.2 && v.end > t - 30);
    }
    const opt = {};
    if (ch.mono && S.last && S.last.t0 <= t && S.last.end > t) {
      if (S.last.noteEnd > t + 1e-4) opt.slideFrom = S.last.midi;
      S.last.choke(t);
    }
    if (ch.cut) {
      for (const v of this.voices) if (v.cut === ch.cut && v.t0 < t && v.end > t) v.choke(t);
    }
    let v = null;
    try { v = play(this.ctx, S.input, ch.params, t, midi, vel, dur, opt); } catch (e) { console.error(e); }
    if (!v) return null;
    v.midi = midi;
    v.noteEnd = dur != null && isFinite(dur) ? t + dur : Infinity;
    v.cut = ch.cut;
    v.chId = ch.id;
    S.last = v;
    this.voices.push(v);
    return v;
  }

  step(s, t, stepDur) {
    for (const I of this.inserts) for (const f of I.fx) if (f.step) f.step(s, t, stepDur);
  }

  tempo() {
    for (const I of this.inserts) for (const f of I.fx) if (f.tempo) f.tempo();
  }

  killAll() {
    const t = this.ctx.currentTime;
    for (const v of this.voices) v.choke(t);
    this.voices = [];
    for (const id in this.chans) this.chans[id].last = null;
  }

  meter(i) {
    const I = this.inserts[i];
    if (!I || !I.anL) return [0, 0];
    const r = [];
    for (const an of [I.anL, I.anR]) {
      an.getFloatTimeDomainData(I.buf);
      let m = 0;
      for (let k = 0; k < I.buf.length; k++) { const a = Math.abs(I.buf[k]); if (a > m) m = a; }
      r.push(m);
    }
    return r;
  }

  dispose() {
    this.killAll();
    try { this.out.disconnect(); } catch (e) {}
    for (const I of this.inserts) for (const f of I.fx) if (f.dispose) f.dispose();
  }
}

function songLength(proj) {
  let e = 0;
  for (const c of proj.playlist.clips) e = Math.max(e, c.s + c.l);
  return Math.max(16, Math.ceil(e / 16) * 16);
}

function patById(proj, id) {
  return proj.patterns.find(p => p.id === id);
}

function collectEvents(proj, mode, patId, p0, p1, loop) {
  const out = [];
  const chMap = {};
  for (const ch of proj.channels) chMap[ch.id] = ch;
  const push = (pos, chId, n) => {
    const ch = chMap[chId];
    if (ch) out.push({ pos, ch, n });
  };
  if (mode === 'pattern') {
    const pat = patById(proj, patId);
    if (!pat) return out;
    const L = pat.len;
    for (let k = Math.floor(p0 / L); k * L < p1; k++) {
      const base = k * L;
      for (const chId in pat.notes) for (const n of pat.notes[chId]) {
        const pos = base + n.t;
        if (pos >= p0 && pos < p1 && n.t < L) push(pos, chId, n);
      }
    }
  } else {
    const S = songLength(proj);
    const kEnd = loop ? Math.floor((p1 - 1e-9) / S) : 0;
    const muted = new Set(proj.playlist.tracks.map((t, i) => t.mute ? i : -1));
    for (let k = Math.max(0, Math.floor(p0 / S)); k <= kEnd; k++) {
      const base = k * S;
      for (const c of proj.playlist.clips) {
        if (muted.has(c.tr)) continue;
        const cs = base + c.s, ce = cs + c.l;
        if (ce <= p0 || cs >= p1) continue;
        const pat = patById(proj, c.p);
        if (!pat) continue;
        const L = pat.len;
        for (let r = 0; r * L < c.l; r++) {
          const rs = cs + r * L;
          if (rs >= p1 || rs + L <= p0) continue;
          for (const chId in pat.notes) for (const n of pat.notes[chId]) {
            if (n.t >= L || r * L + n.t >= c.l) continue;
            const pos = rs + n.t;
            if (pos >= p0 && pos < p1) push(pos, chId, n);
          }
        }
      }
    }
  }
  out.sort((a, b) => a.pos - b.pos);
  return out;
}

function swingOffset(proj, t) {
  const fr = ((t % 2) + 2) % 2;
  if (Math.abs(fr - 1) < 0.02) return (proj.swing / 100) * 0.5;
  return 0;
}

const Engine = {
  ctx: null,
  graph: null,
  playing: false,
  mode: 'pattern',
  anchorTime: 0,
  anchorPos: 0,
  schedPos: 0,
  songStart: 0,
  loopSong: true,
  metro: false,
  recording: false,
  held: {},
  hits: [],
  timer: null,
  get bpm() { return P ? P.bpm : 120; },

  init() {
    if (this.ctx) {
      if (this.ctx.state !== 'running') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    this.rebuild();
    this.metroOut = this.ctx.createGain();
    this.metroOut.gain.value = 0.35;
    this.metroOut.connect(this.ctx.destination);
    this.startTimer();
  },

  startTimer() {
    const tick = () => this.tick();
    try {
      const src = 'let i=null;onmessage=e=>{if(e.data==="start"){if(!i)i=setInterval(()=>postMessage(0),20)}else{clearInterval(i);i=null}}';
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      w.onmessage = tick;
      w.postMessage('start');
      this.timer = w;
    } catch (e) {
      this.timer = setInterval(tick, 20);
    }
  },

  rebuild() {
    if (!this.ctx) return;
    if (this.graph) this.graph.dispose();
    this.graph = new Graph(this.ctx, this, true);
    this.graph.build(P);
  },

  stepDur() { return 60 / this.bpm / 4; },

  posAt(t) { return this.anchorPos + (t - this.anchorTime) / this.stepDur(); },

  loopLen() {
    if (this.mode === 'pattern') { const p = curPat(); return p ? p.len : 16; }
    return songLength(P);
  },

  heardTime() {
    const c = this.ctx;
    try {
      const ts = c.getOutputTimestamp();
      if (ts && ts.contextTime > 0 && ts.performanceTime > 0) {
        const t = ts.contextTime + (performance.now() - ts.performanceTime) / 1000;
        if (Math.abs(t - c.currentTime) < 0.5) return t;
      }
    } catch (e) {}
    return c.currentTime - (c.outputLatency || c.baseLatency || 0);
  },

  displayPos() {
    if (!this.playing || !this.ctx) return this.mode === 'song' ? this.songStart : 0;
    let t = this.heardTime();
    if (t < this._ht) t = this._ht;
    this._ht = t;
    const p = Math.max(this.anchorPos, this.posAt(t));
    const L = this.loopLen();
    if (this.mode === 'song' && !this.loopSong) return p;
    return ((p % L) + L) % L;
  },

  seek(pos) {
    this.songStart = pos;
    if (!this.playing || !this.ctx) return;
    if (this.graph) this.graph.killAll();
    this.hits = [];
    this._ht = 0;
    this.anchorTime = this.ctx.currentTime + 0.03;
    this.anchorPos = pos;
    this.schedPos = pos;
    this.tick();
  },

  play() {
    this.init();
    if (this.playing) this.stop(true);
    this.playing = true;
    this._ht = 0;
    this.anchorTime = this.ctx.currentTime + 0.06;
    this.anchorPos = this.mode === 'song' ? this.songStart : 0;
    this.schedPos = this.anchorPos;
    this.tick();
    UI.onTransport();
  },

  stop(quiet) {
    if (!this.playing) { if (!quiet && this.mode === 'song') { this.songStart = 0; UI.onTransport(); } return; }
    this.playing = false;
    if (this.graph) this.graph.killAll();
    this.hits = [];
    for (const k in this.held) if (this.held[k].rec) this.finishRec(k);
    if (!quiet) UI.onTransport();
  },

  toggle() { this.playing ? this.stop() : this.play(); },

  setMode(m) {
    if (this.mode === m) return;
    const was = this.playing;
    if (was) this.stop(true);
    this.mode = m;
    if (was) this.play(); else UI.onTransport();
  },

  setBpm(b) {
    b = clamp(Math.round(b * 10) / 10, 30, 300);
    if (this.playing && this.ctx) {
      const now = this.ctx.currentTime;
      const pos = this.posAt(now);
      const ahead = this.schedPos - pos;
      P.bpm = b;
      this.anchorTime = now;
      this.anchorPos = pos;
      this.schedPos = pos + Math.max(0, ahead);
    } else P.bpm = b;
    if (this.graph) this.graph.tempo();
  },

  tick() {
    if (!this.playing || !this.ctx || !this.graph) return;
    const now = this.ctx.currentTime;
    const ahead = 0.12;
    const p1 = this.posAt(now + ahead);
    if (p1 <= this.schedPos) return;
    const p0 = this.schedPos;
    this.schedPos = p1;
    if (this.mode === 'song' && !this.loopSong && p0 >= songLength(P)) {
      if (this.posAt(now) >= songLength(P) + 0.5) { this.stop(); }
      return;
    }
    this.scheduleRange(p0, p1);
  },

  timeOf(pos) { return this.anchorTime + (pos - this.anchorPos) * this.stepDur(); },

  scheduleRange(p0, p1) {
    const g = this.graph, sd = this.stepDur();
    const evs = collectEvents(P, this.mode, P.curPat, p0, p1, this.loopSong);
    for (const e of evs) {
      const t = Math.max(this.ctx.currentTime, this.timeOf(e.pos + swingOffset(P, e.n.t)));
      g.trigger(e.ch, e.n.n, e.n.v, t, e.n.d * sd);
      this.hits.push({ id: e.ch.id, t });
    }
    if (this.hits.length > 400) this.hits.splice(0, this.hits.length - 400);
    for (let s = Math.ceil(p0 - 1e-9); s < p1; s++) {
      const t = this.timeOf(s);
      g.step(s, t, sd);
      if (this.metro && s % 4 === 0) this.click(t, s % 16 === 0);
    }
  },

  click(t, accent) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = accent ? 1760 : 1180;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g).connect(this.metroOut);
    o.start(t);
    o.stop(t + 0.06);
  },

  noteOn(ch, midi, vel = 0.8) {
    this.init();
    const key = ch.id + ':' + midi;
    if (this.held[key]) this.noteOff(ch, midi);
    const t = this.ctx.currentTime + 0.005;
    const v = this.graph.trigger(ch, midi, vel, t, null);
    const h = { v, ch, midi, vel };
    if (this.recording && this.playing) h.rec = { pos: this.posAt(t), pat: P.curPat };
    this.held[key] = h;
    this.hits.push({ id: ch.id, t });
  },

  noteOff(ch, midi) {
    const key = ch.id + ':' + midi;
    const h = this.held[key];
    if (!h) return;
    if (h.v) { h.v.noteEnd = this.ctx.currentTime; h.v.release(this.ctx.currentTime + 0.005); }
    if (h.rec) this.finishRec(key);
    delete this.held[key];
  },

  finishRec(key) {
    const h = this.held[key];
    if (!h || !h.rec) return;
    const pat = patById(P, h.rec.pat);
    if (!pat) return;
    const snap = parseFloat(UI.snap || '1');
    const endPos = this.posAt(this.ctx.currentTime);
    let t = ((h.rec.pos % pat.len) + pat.len) % pat.len;
    if (snap > 0) t = Math.round(t / snap) * snap % pat.len;
    let d = Math.max(endPos - h.rec.pos, 0.25);
    if (snap > 0) d = Math.max(snap, Math.round(d / snap) * snap);
    const arr = pat.notes[h.ch.id] || (pat.notes[h.ch.id] = []);
    arr.push({ t: +t.toFixed(4), d: +d.toFixed(4), n: h.midi, v: h.vel });
    h.rec = null;
    History.commit('Запись ноты', { soft: true });
    UI.refreshNotes();
  },

  allNotesOff() {
    for (const k in this.held) { const h = this.held[k]; this.noteOff(h.ch, h.midi); }
  },

  preview(ch, midi, vel = 0.85, dur = 0.35) {
    this.init();
    const t = this.ctx.currentTime + 0.005;
    this.graph.trigger(ch, midi == null ? ch.root : midi, vel, t, dur);
    this.hits.push({ id: ch.id, t });
  },

  async render(opts) {
    const proj = deep(P);
    const sr = 44100, sd = 60 / proj.bpm / 4;
    const mode = opts.mode;
    let lenSteps;
    if (mode === 'song') lenSteps = songLength(proj);
    else lenSteps = (patById(proj, proj.curPat) || { len: 16 }).len * (opts.loops || 1);
    const total = lenSteps * sd + (opts.tail == null ? 2.5 : opts.tail);
    const octx = new OfflineAudioContext(2, Math.ceil(total * sr), sr);
    const g = new Graph(octx, { bpm: proj.bpm }, false);
    g.build(proj);
    const pid = proj.curPat;
    const schedChunk = (a, b) => {
      const p0 = a / sd, p1 = Math.min(lenSteps, b / sd);
      if (p0 >= lenSteps) return;
      const evs = mode === 'song' ? collectEvents(proj, 'song', pid, p0, p1, false) : collectEvents(proj, 'pattern', pid, p0, p1, true);
      for (const e of evs) g.trigger(e.ch, e.n.n, e.n.v, (e.pos + swingOffset(proj, e.n.t)) * sd, e.n.d * sd);
      for (let s = Math.ceil(p0 - 1e-9); s < p1; s++) g.step(s, s * sd, sd);
    };
    const CH = 2;
    const nChunks = Math.ceil(total / CH);
    let chunked = !!window.chrome && Object.prototype.hasOwnProperty.call(OfflineAudioContext.prototype, 'suspend');
    schedChunk(0, CH + 0.001);
    if (chunked) {
      try {
        for (let c = 1; c < nChunks; c++) {
          octx.suspend(c * CH).then(() => {
            schedChunk(c * CH + 0.001, (c + 1) * CH + 0.001);
            if (opts.onProgress) opts.onProgress(c / nChunks);
            octx.resume();
          });
        }
      } catch (e) { chunked = false; }
    }
    if (!chunked) schedChunk(CH + 0.001, total + 1);
    const buf = await octx.startRendering();
    if (opts.normalize) {
      let peak = 0;
      for (let c = 0; c < buf.numberOfChannels; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
      }
      if (peak > 0.0001) {
        const k = 0.966 / peak;
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const d = buf.getChannelData(c);
          for (let i = 0; i < d.length; i++) d[i] *= k;
        }
      }
    }
    return buf;
  },
};

function makeMidi(proj, mode) {
  const ppq = 96, tps = ppq / 4;
  const lenSteps = mode === 'song' ? songLength(proj) : (patById(proj, proj.curPat) || { len: 16 }).len;
  const evs = mode === 'song' ? collectEvents(proj, 'song', proj.curPat, 0, lenSteps, false) : collectEvents(proj, 'pattern', proj.curPat, 0, lenSteps, false);
  const vlq = n => {
    const b = [n & 0x7f];
    while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80);
    return b;
  };
  const str = s => [...new TextEncoder().encode(s)];
  const track = bytes => {
    const len = bytes.length;
    return [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...bytes];
  };
  const tracks = [];
  const us = Math.round(60000000 / proj.bpm);
  const name0 = str(proj.name || 'Bt');
  tracks.push(track([0, 0xff, 0x03, ...vlq(name0.length), ...name0, 0, 0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255, 0, 0xff, 0x58, 4, 4, 2, 24, 8, 0, 0xff, 0x2f, 0]));
  let chanNo = 0;
  for (const ch of proj.channels) {
    const mine = evs.filter(e => e.ch.id === ch.id);
    if (!mine.length) continue;
    let mc = 9;
    if (ch.type !== 'drum') { mc = chanNo++ % 15; if (mc >= 9) mc++; }
    const list = [];
    for (const e of mine) {
      const on = Math.round(e.pos * tps), off = Math.round((e.pos + Math.max(0.05, e.n.d)) * tps);
      const n = clamp(e.n.n, 0, 127), v = clamp(Math.round(e.n.v * 127), 1, 127);
      list.push([on, 1, 0x90 | mc, n, v], [off, 0, 0x80 | mc, n, 0]);
    }
    list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const nm = str(ch.name);
    const bytes = [0, 0xff, 0x03, ...vlq(nm.length), ...nm];
    let last = 0;
    for (const e of list) { bytes.push(...vlq(e[0] - last), e[2], e[3], e[4]); last = e[0]; }
    bytes.push(0, 0xff, 0x2f, 0);
    tracks.push(track(bytes));
  }
  const hdr = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, (ppq >> 8) & 255, ppq & 255];
  return new Uint8Array([...hdr, ...tracks.flat()]);
}
