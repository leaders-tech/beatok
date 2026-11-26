const _noiseCache = new WeakMap();
function noiseBuf(ctx) {
  let b = _noiseCache.get(ctx);
  if (!b) {
    const len = ctx.sampleRate * 2;
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    _noiseCache.set(ctx, b);
  }
  return b;
}

const _curveCache = {};
function driveCurve(mode, amt) {
  const key = mode + Math.round(amt * 100);
  if (_curveCache[key]) return _curveCache[key];
  const n = 2048, c = new Float32Array(n);
  const k = 1 + amt * 40;
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * 2 - 1;
    let y;
    if (mode === 'hard') y = clamp(x * (1 + amt * 20), -1, 1) * 0.92 + Math.tanh(x * k) * 0.08;
    else if (mode === 'fuzz') y = x < 0 ? Math.tanh(x * k * 0.5) / Math.tanh(k * 0.5) : Math.tanh(x * k * 1.6) / Math.tanh(k * 1.6);
    else if (mode === 'fold') y = Math.sin(x * (1 + amt * 7) * Math.PI / 2);
    else y = Math.tanh(x * k) / Math.tanh(k);
    c[i] = y;
  }
  return (_curveCache[key] = c);
}

function crushCurve(bits) {
  const key = 'crush' + bits;
  if (_curveCache[key]) return _curveCache[key];
  const n = 8192, c = new Float32Array(n), lv = Math.pow(2, bits - 1);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * 2 - 1;
    c[i] = Math.round(x * lv) / lv;
  }
  return (_curveCache[key] = c);
}

function makeIR(ctx, sec) {
  const sr = ctx.sampleRate, len = Math.max(256, Math.floor(sr * sec));
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const a = 0.2 + t * 0.7;
      y = (1 - a) * (Math.random() * 2 - 1) + a * y;
      d[i] = y * Math.exp(-6.9 * t) * (1 + (1 - a));
    }
    for (let k = 0; k < 8; k++) {
      const p = Math.floor(sr * (0.004 + Math.random() * 0.05));
      if (p < len) d[p] += (Math.random() < 0.5 ? -1 : 1) * (0.5 - k * 0.05);
    }
  }
  return buf;
}

let _vinyl = null;
function vinylBuf(ctx) {
  if (_vinyl && _vinyl.sampleRate === ctx.sampleRate) return _vinyl;
  const sr = ctx.sampleRate, len = sr * 4;
  const b = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      lp = lp * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = lp * 0.25;
      if (Math.random() < 0.00018) {
        const amp = 0.3 + Math.random() * 0.6, l = 20 + Math.floor(Math.random() * 60);
        for (let j = 0; j < l && i + j < len; j++) d[i + j] += amp * (Math.random() * 2 - 1) * (1 - j / l);
      }
    }
  }
  return (_vinyl = b);
}

function applyEnv(param, t, env, lo, hi, dur, geo) {
  const a = Math.max(0.001, env.a), d = Math.max(0.003, env.d), r = Math.max(0.005, env.r), s = clamp(env.s, 0, 1);
  const E = 1e-4, ex = x => Math.max(E, x);
  const sv = geo ? lo * Math.pow(hi / lo, s) : lo + (hi - lo) * s;
  const at = x => x <= 0 ? lo : x < a ? lo + (hi - lo) * x / a : x < a + d ? ex(hi) * Math.pow(ex(sv) / ex(hi), (x - a) / d) : sv;
  param.setValueAtTime(lo, t);
  if (dur == null || !isFinite(dur)) {
    param.linearRampToValueAtTime(hi, t + a);
    param.exponentialRampToValueAtTime(ex(sv), t + a + d);
    return {
      end: Infinity,
      release(tr) {
        tr = Math.max(tr, t);
        if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(tr);
        else { param.cancelScheduledValues(tr); param.setValueAtTime(ex(at(tr - t)), tr); }
        param.exponentialRampToValueAtTime(ex(lo), tr + r);
        return tr + r;
      },
    };
  }
  const x = Math.max(0.001, dur), rel = t + x;
  if (x < a) param.linearRampToValueAtTime(at(x), rel);
  else {
    param.linearRampToValueAtTime(hi, t + a);
    if (x < a + d) param.exponentialRampToValueAtTime(ex(at(x)), rel);
    else { param.exponentialRampToValueAtTime(ex(sv), t + a + d); param.setValueAtTime(ex(sv), rel); }
  }
  param.exponentialRampToValueAtTime(ex(lo), rel + r);
  return { end: rel + r, release() { return rel + r; } };
}

class Voice {
  constructor(ctx, out, t) {
    this.ctx = ctx;
    this.t0 = t;
    this.end = Infinity;
    this.vca = ctx.createGain();
    this.vca.connect(out);
    this.srcs = [];
    this.relFns = [];
  }
  add(src, off) {
    src._off = off;
    this.srcs.push(src);
    return src;
  }
  start() {
    for (const s of this.srcs) s._off != null ? s.start(this.t0, s._off) : s.start(this.t0);
    const last = this.srcs[0];
    if (last) last.onended = () => { try { this.vca.disconnect(); } catch (e) {} };
  }
  stopAt(tt) {
    this.end = tt;
    for (const s of this.srcs) { try { s.stop(tt + 0.02); } catch (e) {} }
  }
  release(tr) {
    if (isFinite(this.end) && this.end <= tr) return;
    let e = tr + 0.01;
    for (const f of this.relFns) e = Math.max(e, f(tr));
    if (this.relFns.length) this.stopAt(e);
  }
  choke(tt) {
    tt = Math.max(tt, this.ctx.currentTime);
    if (this.end <= tt) return;
    const g = this.vca.gain;
    g.cancelScheduledValues(tt);
    g.setValueAtTime(1, tt);
    g.linearRampToValueAtTime(0, tt + 0.012);
    this.stopAt(tt + 0.015);
  }
}

const mkOsc = (ctx, type) => { const o = ctx.createOscillator(); o.type = type; return o; };
const mkGain = (ctx, v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
const mkFilt = (ctx, type, f, q) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; };
function mkNoise(V, ctx) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf(ctx);
  s.loop = true;
  V.add(s, Math.random() * 1.5);
  return s;
}
function hit(g, t, peak, att, dec) {
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(Math.max(peak, 1e-4), t + att);
  g.gain.exponentialRampToValueAtTime(1e-4, t + att + dec);
  return t + att + dec;
}

function playSynth(ctx, out, p, t, midi, vel, dur, opt) {
  const V = new Voice(ctx, out, t);
  const nU = Math.max(1, Math.round(p.uni));
  const velAmt = 1 - p.velS + p.velS * vel;
  const amp = mkGain(ctx, 0);
  let tail = amp;
  if (p.lfoT === 'amp' && p.lfoD > 0) {
    const trem = mkGain(ctx, 1 - p.lfoD / 2);
    amp.connect(trem);
    tail = trem;
    const l = V.add(mkOsc(ctx, p.lfoW));
    l.frequency.value = p.lfoR;
    const lg = mkGain(ctx, p.lfoD / 2);
    l.connect(lg).connect(trem.gain);
  }
  tail.connect(V.vca);
  const filt = mkFilt(ctx, p.fType, 1000, p.res);
  filt.connect(amp);
  let pre = filt;
  if (p.drive > 0.01) {
    const ws = ctx.createWaveShaper();
    ws.curve = driveCurve('soft', p.drive);
    ws.oversample = '2x';
    const dg = mkGain(ctx, 1 / (1 + p.drive * 1.5));
    ws.connect(dg).connect(filt);
    pre = ws;
  }
  const mix = mkGain(ctx, 1 / Math.sqrt(nU));
  const f = mtof(midi);
  if (p.fm > 0) {
    const hp = mkFilt(ctx, 'highpass', Math.max(25, f * 0.55), 0.6);
    mix.connect(hp).connect(pre);
  } else mix.connect(pre);
  const slide = opt && opt.slideFrom != null && p.glide > 0 ? mtof(opt.slideFrom) : 0;
  const setF = (param, mult) => {
    const target = f * mult;
    if (slide) { param.setValueAtTime(slide * mult, t); param.exponentialRampToValueAtTime(target, t + Math.max(0.005, p.glide)); }
    else if (p.pEnv) { param.setValueAtTime(target * Math.pow(2, p.pEnv / 12), t); param.exponentialRampToValueAtTime(target, t + p.pDec); }
    else param.setValueAtTime(target, t);
  };
  const r1 = Math.pow(2, p.o1oct + p.o1semi / 12), r2 = Math.pow(2, p.o2oct + p.o2semi / 12);
  const o1s = [], all = [];
  const useO2 = p.o2lvl > 0;
  for (let u = 0; u < nU; u++) {
    const sp = nU === 1 ? 0 : (u / (nU - 1)) * 2 - 1;
    const pan = ctx.createStereoPanner();
    pan.pan.value = sp * p.uniSpr;
    pan.connect(mix);
    const det = sp * p.uniDet;
    if (p.o1lvl > 0) {
      const o = V.add(mkOsc(ctx, p.o1w));
      setF(o.frequency, r1);
      o.detune.value = p.o1fine + det;
      o.connect(mkGain(ctx, p.o1lvl)).connect(pan);
      o1s.push(o);
      all.push(o);
    }
    if (useO2) {
      const o = V.add(mkOsc(ctx, p.o2w));
      setF(o.frequency, r2);
      o.detune.value = p.o2fine - det * 0.7;
      o.connect(mkGain(ctx, p.o2lvl)).connect(pan);
      all.push(o);
    }
  }
  if (p.sub > 0) {
    const o = V.add(mkOsc(ctx, 'sine'));
    setF(o.frequency, 0.5);
    o.connect(mkGain(ctx, p.sub)).connect(mix);
  }
  if (p.noise > 0) mkNoise(V, ctx).connect(mkGain(ctx, p.noise * 0.6)).connect(mix);
  if (p.fm > 0 && o1s.length) {
    const m = V.add(mkOsc(ctx, p.o2w));
    setF(m.frequency, r2);
    m.detune.value = p.o2fine;
    const mg = ctx.createGain();
    const depth = p.fm * f * r2 * (0.5 + 0.5 * vel);
    mg.gain.setValueAtTime(depth, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(depth * 0.06, 0.01), t + p.fmDec);
    m.connect(mg);
    for (const o of o1s) mg.connect(o.frequency);
  }
  const kt = Math.pow(2, (midi - 60) / 12 * p.keyTr);
  const base = clamp(p.cutoff * kt, 20, 20000);
  let fe = null;
  if (Math.abs(p.fEnv) > 0.005) {
    const peakF = clamp(base * Math.pow(2, p.fEnv * 7), 20, 20000);
    fe = applyEnv(filt.frequency, t, { a: p.fa, d: p.fd, s: p.fs, r: p.fr }, base, peakF, dur, true);
  } else filt.frequency.value = base;
  if (p.lfoT === 'pitch' && p.lfoD > 0) {
    const l = V.add(mkOsc(ctx, p.lfoW));
    l.frequency.value = p.lfoR;
    const lg = mkGain(ctx, p.lfoD * 200);
    l.connect(lg);
    for (const o of all) lg.connect(o.detune);
  } else if (p.lfoT === 'filter' && p.lfoD > 0) {
    const l = V.add(mkOsc(ctx, p.lfoW));
    l.frequency.value = p.lfoR;
    const lg = mkGain(ctx, p.lfoD * 2400);
    l.connect(lg).connect(filt.detune);
  }
  const peak = 0.3 * velAmt * p.gain;
  const ae = applyEnv(amp.gain, t, { a: p.a, d: p.d, s: p.s, r: p.r }, 0, peak, dur, false);
  V.relFns.push(tr => ae.release(tr));
  if (fe) V.relFns.push(tr => fe.release(tr));
  V.start();
  if (isFinite(ae.end)) V.stopAt(ae.end);
  return V;
}

function play808(ctx, out, p, t, midi, vel, dur, opt) {
  const V = new Voice(ctx, out, t);
  const f = mtof(midi);
  const o = V.add(mkOsc(ctx, 'sine'));
  const slide = opt && opt.slideFrom != null && p.glide > 0;
  if (slide) {
    o.frequency.setValueAtTime(mtof(opt.slideFrom), t);
    o.frequency.exponentialRampToValueAtTime(f, t + p.glide);
  } else {
    o.frequency.setValueAtTime(f * Math.pow(2, p.punch / 12), t);
    o.frequency.exponentialRampToValueAtTime(f, t + p.pTime);
  }
  const amp = mkGain(ctx, 0);
  const ws = ctx.createWaveShaper();
  ws.curve = driveCurve('soft', p.drive * 0.85);
  ws.oversample = '4x';
  const lp = mkFilt(ctx, 'lowpass', p.tone, 0.5);
  const post = mkGain(ctx, 1 / (1 + p.drive * 0.6));
  o.connect(amp).connect(ws).connect(lp).connect(post).connect(V.vca);
  const peak = 0.85 * (0.45 + 0.55 * vel) * p.gain;
  const g = amp.gain, A = slide ? 0.006 : 0.003, D = p.decay;
  const val = x => x < A ? peak * x / A : peak * Math.pow(5e-4 / peak, (x - A) / (D - A));
  g.setValueAtTime(0, t);
  let end;
  const follow = +p.follow === 1;
  if (follow && dur != null && isFinite(dur) && dur < D) {
    const x = Math.max(0.01, dur);
    if (x < A) g.linearRampToValueAtTime(val(x), t + x);
    else { g.linearRampToValueAtTime(peak, t + A); g.exponentialRampToValueAtTime(Math.max(1e-4, val(x)), t + x); }
    g.exponentialRampToValueAtTime(1e-4, t + x + 0.06);
    end = t + x + 0.06;
  } else {
    g.linearRampToValueAtTime(peak, t + A);
    g.exponentialRampToValueAtTime(5e-4, t + D);
    end = t + D;
    if (follow && (dur == null || !isFinite(dur))) {
      V.relFns.push(tr => {
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(tr);
        else { g.cancelScheduledValues(tr); g.setValueAtTime(Math.max(1e-4, val(tr - t)), tr); }
        g.exponentialRampToValueAtTime(1e-4, tr + 0.06);
        return tr + 0.06;
      });
    }
  }
  if (p.click > 0 && !slide) {
    const n = mkNoise(V, ctx);
    const hp = mkFilt(ctx, 'highpass', 2500);
    const cg = ctx.createGain();
    hit(cg, t, peak * p.click * 0.6, 0.0005, 0.008);
    n.connect(hp).connect(cg).connect(V.vca);
  }
  V.start();
  V.stopAt(end);
  return V;
}

function playDrum(ctx, out, p, t, midi, vel, dur) {
  const V = new Voice(ctx, out, t);
  const tr = Math.pow(2, (p.tune + (midi - 60)) / 12);
  const dm = p.decay, tone = p.tone, snap = p.snap;
  const lvl = (0.3 + 0.7 * vel) * p.gain;
  let dest = V.vca;
  if (p.drive > 0.01) {
    const ws = ctx.createWaveShaper();
    ws.curve = driveCurve('soft', p.drive);
    ws.oversample = '2x';
    ws.connect(mkGain(ctx, 1 / (1 + p.drive))).connect(V.vca);
    dest = ws;
  }
  let end = t + 0.1;
  const metal = (base, gainV) => {
    const m = mkGain(ctx, gainV);
    for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) {
      const o = V.add(mkOsc(ctx, 'square'));
      o.frequency.value = base * r;
      o.connect(m);
    }
    return m;
  };
  switch (p.kind) {
    case 'kick': {
      const o = V.add(mkOsc(ctx, 'sine'));
      const fEnd = 47 * tr, fStart = fEnd * (2.5 + tone * 5);
      o.frequency.setValueAtTime(fStart, t);
      o.frequency.exponentialRampToValueAtTime(fEnd, t + 0.025 + 0.09 * (1 - snap));
      const g = ctx.createGain();
      end = hit(g, t, lvl, 0.0015, 0.45 * dm);
      o.connect(g).connect(dest);
      const n = mkNoise(V, ctx);
      const hp = mkFilt(ctx, 'highpass', 1500 + tone * 4000);
      const cg = ctx.createGain();
      hit(cg, t, lvl * 0.45 * snap, 0.0005, 0.012);
      n.connect(hp).connect(cg).connect(dest);
      break;
    }
    case 'snare': {
      const f = 190 * tr;
      const o = V.add(mkOsc(ctx, 'triangle'));
      o.frequency.setValueAtTime(f * 1.45, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      const g = ctx.createGain();
      hit(g, t, lvl * 0.62 * (1 - tone * 0.55), 0.001, 0.13 * dm);
      o.connect(g).connect(dest);
      const o2 = V.add(mkOsc(ctx, 'sine'));
      o2.frequency.value = f * 1.68;
      const g2 = ctx.createGain();
      hit(g2, t, lvl * 0.19, 0.001, 0.06 * dm);
      o2.connect(g2).connect(dest);
      const n = mkNoise(V, ctx);
      const hp = mkFilt(ctx, 'highpass', 900 + tone * 1600);
      const lp = mkFilt(ctx, 'lowpass', 9000 + tone * 6000);
      const ng = ctx.createGain();
      end = hit(ng, t, lvl * (0.45 + 0.55 * tone) * 0.53, 0.001, 0.24 * dm);
      n.connect(hp).connect(lp).connect(ng).connect(dest);
      const sg = ctx.createGain();
      hit(sg, t, lvl * snap * 0.3, 0.0005, 0.02);
      const hp2 = mkFilt(ctx, 'highpass', 4000);
      n.connect(hp2).connect(sg).connect(dest);
      break;
    }
    case 'clap': {
      const n = mkNoise(V, ctx);
      const bp = mkFilt(ctx, 'bandpass', (1000 + 700 * tone) * tr, 1.3);
      const hp = mkFilt(ctx, 'highpass', 650);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      for (let k = 0; k < 3; k++) {
        const tk = t + k * 0.0095;
        g.gain.setValueAtTime(lvl * 1.7, tk);
        g.gain.exponentialRampToValueAtTime(lvl * 0.2, tk + 0.0085);
      }
      const tt = t + 0.0285;
      g.gain.setValueAtTime(lvl * 1.5, tt);
      g.gain.exponentialRampToValueAtTime(1e-4, tt + 0.23 * dm);
      end = tt + 0.23 * dm;
      n.connect(bp).connect(hp).connect(g).connect(dest);
      break;
    }
    case 'hat': case 'ohat': case 'crash': case 'ride': {
      const isO = p.kind === 'ohat', isC = p.kind === 'crash', isR = p.kind === 'ride';
      const base = (isR ? 62 : 40) * tr * (0.9 + tone * 0.3);
      const m = metal(base, 0.18);
      const bp = mkFilt(ctx, 'bandpass', isR ? 5200 : 10000, isR ? 1.6 : 0.9);
      const hp = mkFilt(ctx, 'highpass', isC ? 4000 : isR ? 3000 : 7000);
      const n = mkNoise(V, ctx);
      const nhp = mkFilt(ctx, 'highpass', isC ? 5000 : 8000);
      const nm = mkGain(ctx, isC ? 0.75 : 0.25 + tone * 0.25);
      const g = ctx.createGain();
      const dec = (p.kind === 'hat' ? 0.055 : isO ? 0.5 : isC ? 1.7 : 1.3) * dm;
      end = hit(g, t, lvl * (isC || isR ? 0.7 : 1), 0.0006, dec);
      m.connect(bp).connect(hp).connect(g);
      n.connect(nhp).connect(nm).connect(g);
      g.connect(dest);
      if (isR) {
        const b = V.add(mkOsc(ctx, 'sine'));
        b.frequency.value = 2900 * tr;
        const bg = ctx.createGain();
        hit(bg, t, lvl * 0.12, 0.001, 0.5 * dm);
        b.connect(bg).connect(dest);
      }
      break;
    }
    case 'tom': {
      const f = 125 * tr;
      const o = V.add(mkOsc(ctx, 'sine'));
      o.frequency.setValueAtTime(f * 1.6, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
      const g = ctx.createGain();
      end = hit(g, t, lvl, 0.001, 0.42 * dm);
      o.connect(g).connect(dest);
      const n = mkNoise(V, ctx);
      const lp = mkFilt(ctx, 'lowpass', 3000);
      const ng = ctx.createGain();
      hit(ng, t, lvl * 0.15 * (0.5 + snap), 0.001, 0.05);
      n.connect(lp).connect(ng).connect(dest);
      break;
    }
    case 'rim': {
      const o = V.add(mkOsc(ctx, 'triangle'));
      o.frequency.value = 480 * tr;
      const o2 = V.add(mkOsc(ctx, 'square'));
      o2.frequency.value = 1720 * tr;
      const bp = mkFilt(ctx, 'bandpass', 1900 * tr, 1.2);
      const g = ctx.createGain();
      end = hit(g, t, lvl * 0.9, 0.0005, 0.035 * dm);
      o.connect(g);
      o2.connect(mkGain(ctx, 0.4)).connect(g);
      g.connect(bp).connect(dest);
      g.connect(mkGain(ctx, 0.4)).connect(dest);
      break;
    }
    case 'shaker': {
      const n = mkNoise(V, ctx);
      const bp = mkFilt(ctx, 'bandpass', 6500 * tr, 1.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lvl * 0.9, t + 0.012 * (1.4 - snap));
      g.gain.exponentialRampToValueAtTime(1e-4, t + 0.012 + 0.08 * dm);
      end = t + 0.1 * dm + 0.02;
      n.connect(bp).connect(g).connect(dest);
      break;
    }
    case 'cowbell': {
      const g = ctx.createGain();
      for (const fr of [540, 800]) {
        const o = V.add(mkOsc(ctx, 'square'));
        o.frequency.value = fr * tr;
        o.connect(g);
      }
      const bp = mkFilt(ctx, 'bandpass', 1100 * tr, 1.1);
      const out2 = ctx.createGain();
      out2.gain.setValueAtTime(0, t);
      out2.gain.linearRampToValueAtTime(lvl * 0.5, t + 0.0008);
      out2.gain.exponentialRampToValueAtTime(lvl * 0.18, t + 0.03);
      out2.gain.exponentialRampToValueAtTime(1e-4, t + 0.36 * dm);
      end = t + 0.36 * dm;
      g.connect(bp).connect(out2).connect(dest);
      break;
    }
    case 'snap': {
      const n = mkNoise(V, ctx);
      const bp = mkFilt(ctx, 'bandpass', 2300 * tr, 3.5);
      const g = ctx.createGain();
      end = hit(g, t, lvl * 1.4, 0.0008, 0.07 * dm);
      n.connect(bp).connect(g).connect(dest);
      const o = V.add(mkOsc(ctx, 'sine'));
      o.frequency.value = 1500 * tr;
      const og = ctx.createGain();
      hit(og, t, lvl * 0.25, 0.0005, 0.02);
      o.connect(og).connect(dest);
      break;
    }
    case 'perc': {
      const o = V.add(mkOsc(ctx, 'sine'));
      o.frequency.setValueAtTime(1100 * tr, t);
      o.frequency.exponentialRampToValueAtTime(620 * tr, t + 0.02);
      const g = ctx.createGain();
      end = hit(g, t, lvl * 0.8, 0.0005, 0.1 * dm);
      o.connect(g).connect(dest);
      const o2 = V.add(mkOsc(ctx, 'triangle'));
      o2.frequency.value = 2480 * tr;
      const g2 = ctx.createGain();
      hit(g2, t, lvl * 0.2 * (0.4 + tone), 0.0005, 0.03 * dm);
      o2.connect(g2).connect(dest);
      break;
    }
    case 'conga': {
      const f = 330 * tr;
      const o = V.add(mkOsc(ctx, 'sine'));
      o.frequency.setValueAtTime(f * 1.18, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      const g = ctx.createGain();
      end = hit(g, t, lvl * 0.9, 0.001, 0.24 * dm);
      o.connect(g).connect(dest);
      break;
    }
    case 'impact': {
      const o = V.add(mkOsc(ctx, 'sine'));
      o.frequency.setValueAtTime(170 * tr, t);
      o.frequency.exponentialRampToValueAtTime(42 * tr, t + 0.45);
      const g = ctx.createGain();
      end = hit(g, t, lvl * 0.7, 0.002, 2.2 * dm);
      o.connect(g).connect(dest);
      const n = mkNoise(V, ctx);
      const lp = mkFilt(ctx, 'lowpass', 7000, 0.7);
      lp.frequency.setValueAtTime(7000, t);
      lp.frequency.exponentialRampToValueAtTime(150, t + 1.6 * dm);
      const ng = ctx.createGain();
      hit(ng, t, lvl * 0.4, 0.002, 1.6 * dm);
      n.connect(lp).connect(ng).connect(dest);
      break;
    }
    case 'riser': case 'down': {
      const L = dur != null && isFinite(dur) && dur > 0.15 ? dur : 2.5 * dm;
      const up = p.kind === 'riser';
      const n = mkNoise(V, ctx);
      const bp = mkFilt(ctx, 'bandpass', 300, 2.5 + tone * 4);
      bp.frequency.setValueAtTime(up ? 250 * tr : 9000 * tr, t);
      bp.frequency.exponentialRampToValueAtTime(up ? 9000 * tr : 200 * tr, t + L);
      const g = ctx.createGain();
      g.gain.setValueAtTime(up ? 1e-4 : lvl * 1.6, t);
      g.gain.exponentialRampToValueAtTime(up ? lvl * 1.6 : 1e-4, t + L);
      if (up) g.gain.linearRampToValueAtTime(0, t + L + 0.04);
      n.connect(bp).connect(g).connect(dest);
      const o = V.add(mkOsc(ctx, 'sawtooth'));
      o.frequency.setValueAtTime(up ? 180 * tr : 1500 * tr, t);
      o.frequency.exponentialRampToValueAtTime(up ? 1500 * tr : 160 * tr, t + L);
      const og = mkGain(ctx, 0.12);
      o.connect(og).connect(bp);
      end = t + L + 0.05;
      break;
    }
    default: {
      const o = V.add(mkOsc(ctx, 'sine'));
      o.frequency.value = 440 * tr;
      const g = ctx.createGain();
      end = hit(g, t, lvl * 0.5, 0.001, 0.2);
      o.connect(g).connect(dest);
    }
  }
  V.start();
  V.stopAt(end + 0.02);
  return V;
}

function playSampler(ctx, out, p, t, midi, vel, dur) {
  const buf = Samples.get(p.sid, +p.rev === 1);
  if (!buf) return null;
  const V = new Voice(ctx, out, t);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const semis = (+p.keytrack === 1 ? midi - p.root : 0) + p.tune;
  const rate = Math.pow(2, semis / 12);
  src.playbackRate.value = rate;
  const st = clamp(p.start, 0, 0.99) * buf.duration;
  const en = Math.max(st + 0.005, clamp(p.end, 0.01, 1) * buf.duration);
  const sampleLen = (en - st) / rate;
  if (p.mode === 'loop') { src.loop = true; src.loopStart = st; src.loopEnd = en; }
  V.add(src, st);
  const amp = mkGain(ctx, 0);
  src.connect(amp).connect(V.vca);
  const peak = (0.35 + 0.65 * vel) * p.gain;
  const g = amp.gain, A = Math.max(0.001, p.a), R = Math.max(0.005, p.r);
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + A);
  let len;
  if (p.mode === 'oneshot') len = sampleLen;
  else if (dur != null && isFinite(dur)) len = p.mode === 'loop' ? dur : Math.min(dur, sampleLen);
  else len = p.mode === 'loop' ? Infinity : sampleLen;
  if (isFinite(len)) {
    const relT = t + Math.max(A, len - (p.mode === 'oneshot' ? 0.004 : 0));
    g.setValueAtTime(peak, relT);
    const fall = p.mode === 'oneshot' ? 0.004 : R;
    g.linearRampToValueAtTime(0, relT + fall);
    V.start();
    V.stopAt(relT + fall);
  } else {
    V.relFns.push(tr => {
      tr = Math.max(tr, t + A);
      g.cancelScheduledValues(tr);
      g.setValueAtTime(peak, tr);
      g.linearRampToValueAtTime(0, tr + R);
      return tr + R;
    });
    if (p.mode !== 'loop') V.relFns.push(() => t + sampleLen);
    V.start();
  }
  return V;
}

const INSTR_PLAY = { synth: playSynth, bass808: play808, drum: playDrum, sampler: playSampler };

function fxWetDry(ctx, mix) {
  const input = ctx.createGain(), output = ctx.createGain();
  const dry = ctx.createGain(), wet = ctx.createGain();
  input.connect(dry).connect(output);
  wet.connect(output);
  const setMix = m => {
    dry.gain.value = Math.cos(m * Math.PI / 2);
    wet.gain.value = Math.sin(m * Math.PI / 2);
  };
  setMix(mix);
  return { input, output, wet, setMix };
}

const dbToG = db => Math.pow(10, db / 20);

const FX_BUILD = {
  eq(ctx, p) {
    const hp = mkFilt(ctx, 'highpass', p.lowcut, 0.7);
    const ls = mkFilt(ctx, 'lowshelf', p.lowF);
    const pk = mkFilt(ctx, 'peaking', p.midF, p.midQ);
    const hs = mkFilt(ctx, 'highshelf', p.highF);
    const lp = mkFilt(ctx, 'lowpass', p.hicut, 0.7);
    hp.connect(ls).connect(pk).connect(hs).connect(lp);
    const fx = { input: hp, output: lp };
    fx.update = q => {
      hp.frequency.value = q.lowcut; ls.frequency.value = q.lowF; ls.gain.value = q.lowG;
      pk.frequency.value = q.midF; pk.Q.value = q.midQ; pk.gain.value = q.midG;
      hs.frequency.value = q.highF; hs.gain.value = q.highG; lp.frequency.value = q.hicut;
    };
    fx.update(p);
    return fx;
  },
  comp(ctx, p) {
    const c = ctx.createDynamicsCompressor();
    const g = ctx.createGain();
    c.connect(g);
    const fx = { input: c, output: g, node: c };
    fx.update = q => {
      c.threshold.value = q.thr; c.ratio.value = q.ratio; c.attack.value = q.att;
      c.release.value = q.rel; c.knee.value = q.knee; g.gain.value = dbToG(q.makeup);
    };
    fx.update(p);
    return fx;
  },
  reverb(ctx, p) {
    const w = fxWetDry(ctx, p.mix);
    const pre = ctx.createDelay(0.2);
    const conv = ctx.createConvolver();
    const hp = mkFilt(ctx, 'highpass', p.lowcut, 0.7);
    const lp = mkFilt(ctx, 'lowpass', p.damp, 0.5);
    w.input.connect(pre).connect(conv).connect(hp).connect(lp).connect(w.wet);
    let size = null;
    const fx = { input: w.input, output: w.output };
    fx.update = q => {
      pre.delayTime.value = q.pre; hp.frequency.value = q.lowcut; lp.frequency.value = q.damp;
      w.setMix(q.mix);
      if (size !== q.size) { size = q.size; conv.buffer = makeIR(ctx, q.size); }
    };
    fx.update(p);
    return fx;
  },
  delay(ctx, p, eng) {
    const w = fxWetDry(ctx, p.mix);
    const dL = ctx.createDelay(4), dR = ctx.createDelay(4);
    const tone = mkFilt(ctx, 'lowpass', p.tone, 0.5);
    const fb1 = ctx.createGain(), fb2 = ctx.createGain();
    const merger = ctx.createChannelMerger(2);
    let mode = null;
    const fx = { input: w.input, output: w.output };
    const wire = ping => {
      for (const n of [dL, dR, tone, fb1, fb2]) { try { n.disconnect(); } catch (e) {} }
      try { w.input.disconnect(dL); } catch (e) {}
      w.input.connect(dL);
      if (ping) {
        dL.connect(tone).connect(fb1).connect(dR);
        dR.connect(fb2).connect(dL);
        dL.connect(merger, 0, 0);
        dR.connect(merger, 0, 1);
        merger.connect(w.wet);
      } else {
        try { merger.disconnect(); } catch (e) {}
        dL.connect(tone).connect(w.wet);
        tone.connect(fb1).connect(dL);
      }
    };
    fx.update = q => {
      const ping = +q.ping === 1;
      if (mode !== ping) { mode = ping; wire(ping); }
      const sec = clamp(parseFloat(q.time) * 60 / (eng.bpm || 120), 0.01, 3.9);
      dL.delayTime.value = sec; dR.delayTime.value = sec;
      fb1.gain.value = q.fb; fb2.gain.value = ping ? 1 : q.fb;
      tone.frequency.value = q.tone;
      w.setMix(q.mix);
    };
    fx.tempo = () => fx.update(fx.p);
    fx.update(p);
    return fx;
  },
  dist(ctx, p) {
    const w = fxWetDry(ctx, p.mix);
    const ws = ctx.createWaveShaper();
    ws.oversample = '4x';
    const lp = mkFilt(ctx, 'lowpass', p.tone, 0.6);
    const og = ctx.createGain();
    w.input.connect(ws).connect(lp).connect(og).connect(w.wet);
    const fx = { input: w.input, output: w.output };
    fx.update = q => {
      ws.curve = driveCurve(q.mode, q.drive);
      lp.frequency.value = q.tone; og.gain.value = dbToG(q.out); w.setMix(q.mix);
    };
    fx.update(p);
    return fx;
  },
  filter(ctx, p, eng) {
    const f = ctx.createBiquadFilter();
    const fx = { input: f, output: f };
    let lfo = null, lg = null;
    fx.update = q => {
      f.type = q.type; f.frequency.value = q.cutoff; f.Q.value = q.res;
      const beats = parseFloat(q.rate);
      if (beats > 0) {
        if (!lfo) {
          lfo = mkOsc(ctx, 'sine'); lg = ctx.createGain();
          lfo.connect(lg).connect(f.detune);
          lfo.start();
        }
        lfo.frequency.value = (eng.bpm || 120) / 60 / beats;
        lg.gain.value = q.depth * 2400;
      } else if (lg) lg.gain.value = 0;
    };
    fx.tempo = () => fx.update(fx.p);
    fx.dispose = () => { if (lfo) try { lfo.stop(); } catch (e) {} };
    fx.update(p);
    return fx;
  },
  chorus(ctx, p) {
    const w = fxWetDry(ctx, p.mix);
    const dl = ctx.createDelay(0.1), dr = ctx.createDelay(0.1);
    dl.delayTime.value = 0.012; dr.delayTime.value = 0.017;
    const lfo = mkOsc(ctx, 'sine');
    const gl = ctx.createGain(), gr = ctx.createGain();
    lfo.connect(gl).connect(dl.delayTime);
    lfo.connect(gr).connect(dr.delayTime);
    const m = ctx.createChannelMerger(2);
    w.input.connect(dl).connect(m, 0, 0);
    w.input.connect(dr).connect(m, 0, 1);
    m.connect(w.wet);
    lfo.start();
    const fx = { input: w.input, output: w.output };
    fx.update = q => {
      lfo.frequency.value = q.rate;
      gl.gain.value = q.depth * 0.004; gr.gain.value = -q.depth * 0.004;
      w.setMix(q.mix);
    };
    fx.dispose = () => { try { lfo.stop(); } catch (e) {} };
    fx.update(p);
    return fx;
  },
  phaser(ctx, p) {
    const w = fxWetDry(ctx, p.mix);
    const aps = [0, 1, 2, 3].map(() => mkFilt(ctx, 'allpass', 700, 0.6));
    const lfo = mkOsc(ctx, 'sine');
    const lg = ctx.createGain();
    lfo.connect(lg);
    const sum = ctx.createGain();
    w.input.connect(sum);
    let n = sum;
    for (const a of aps) { n.connect(a); n = a; lg.connect(a.frequency); }
    n.connect(w.wet);
    const fbd = ctx.createDelay(0.01);
    fbd.delayTime.value = 0.003;
    const fbg = ctx.createGain();
    n.connect(fbd).connect(fbg).connect(sum);
    lfo.start();
    const fx = { input: w.input, output: w.output };
    fx.update = q => { lfo.frequency.value = q.rate; lg.gain.value = q.depth * 600; fbg.gain.value = q.fb * 0.85; w.setMix(q.mix); };
    fx.dispose = () => { try { lfo.stop(); } catch (e) {} };
    fx.update(p);
    return fx;
  },
  lofi(ctx, p) {
    const w = fxWetDry(ctx, p.mix);
    const ws = ctx.createWaveShaper();
    const lp = mkFilt(ctx, 'lowpass', p.tone, 0.8);
    const hp = mkFilt(ctx, 'highpass', 90, 0.7);
    const wow = ctx.createDelay(0.05);
    wow.delayTime.value = 0.008;
    const lfo = mkOsc(ctx, 'sine');
    lfo.frequency.value = 0.55;
    const lg = ctx.createGain();
    lfo.connect(lg).connect(wow.delayTime);
    const lfo2 = mkOsc(ctx, 'sine');
    lfo2.frequency.value = 5.3;
    const lg2 = ctx.createGain();
    lfo2.connect(lg2).connect(wow.delayTime);
    w.input.connect(ws).connect(hp).connect(lp).connect(wow).connect(w.wet);
    const vin = ctx.createBufferSource();
    vin.buffer = vinylBuf(ctx);
    vin.loop = true;
    const vg = ctx.createGain();
    vin.connect(vg).connect(w.wet);
    lfo.start(); lfo2.start(); vin.start();
    const fx = { input: w.input, output: w.output };
    fx.update = q => {
      ws.curve = crushCurve(Math.round(q.bits));
      lp.frequency.value = q.tone;
      lg.gain.value = q.wow * 0.0025; lg2.gain.value = q.wow * 0.00025;
      vg.gain.value = q.crackle * 0.12;
      w.setMix(q.mix);
    };
    fx.dispose = () => { for (const s of [lfo, lfo2, vin]) try { s.stop(); } catch (e) {} };
    fx.update(p);
    return fx;
  },
  pump(ctx, p) {
    const g = ctx.createGain();
    const fx = { input: g, output: g };
    fx.update = q => {};
    fx.step = (step, t, stepDur) => {
      const q = fx.p, every = parseInt(q.rate);
      if (step % every !== 0) return;
      const len = every * stepDur;
      g.gain.setTargetAtTime(1 - q.depth, t, 0.002);
      g.gain.setTargetAtTime(1, t + 0.012, len * q.rel / 3.5);
    };
    return fx;
  },
  width(ctx, p) {
    const sp = ctx.createChannelSplitter(2), m = ctx.createChannelMerger(2);
    const ll = ctx.createGain(), lr = ctx.createGain(), rl = ctx.createGain(), rr = ctx.createGain();
    sp.connect(ll, 0); sp.connect(lr, 0); sp.connect(rl, 1); sp.connect(rr, 1);
    ll.connect(m, 0, 0); rl.connect(m, 0, 0); rr.connect(m, 0, 1); lr.connect(m, 0, 1);
    const fx = { input: sp, output: m };
    fx.update = q => {
      const a = (1 + q.width) / 2, b = (1 - q.width) / 2;
      ll.gain.value = a; rr.gain.value = a; rl.gain.value = b; lr.gain.value = b;
    };
    fx.update(p);
    return fx;
  },
  limiter(ctx, p) {
    const ig = ctx.createGain(), c = ctx.createDynamicsCompressor(), og = ctx.createGain();
    c.threshold.value = -6; c.ratio.value = 20; c.knee.value = 0; c.attack.value = 0.001;
    ig.connect(c).connect(og);
    const fx = { input: ig, output: og, node: c };
    fx.update = q => { ig.gain.value = dbToG(q.gain); c.release.value = q.rel; og.gain.value = dbToG(6 + q.ceil); };
    fx.update(p);
    return fx;
  },
};

function buildFx(ctx, type, p, eng) {
  const fx = FX_BUILD[type](ctx, p, eng);
  fx.p = p;
  const upd = fx.update;
  fx.update = q => { fx.p = q; upd(q); };
  return fx;
}

function encodeWav(buf, bits = 16) {
  const nCh = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
  const bps = bits / 8, dataLen = len * nCh * bps;
  const ab = new ArrayBuffer(44 + dataLen), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); ws(8, 'WAVE'); ws(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * nCh * bps, true); v.setUint16(32, nCh * bps, true);
  v.setUint16(34, bits, true); ws(36, 'data'); v.setUint32(40, dataLen, true);
  const chs = [];
  for (let c = 0; c < nCh; c++) chs.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = clamp(chs[c][i], -1, 1);
      if (bits === 16) { v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
      else { const x = Math.round(s < 0 ? s * 0x800000 : s * 0x7fffff); v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); o += 3; }
    }
  }
  return new Uint8Array(ab);
}

const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(u8) {
  let c = 0xffffffff;
  for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeZip(files) {
  const enc = new TextEncoder();
  const parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true); lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
    parts.push(new Uint8Array(lh.buffer), name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), name);
    off += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
