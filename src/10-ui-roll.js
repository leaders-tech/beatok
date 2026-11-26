const RK = { KW: 58, RH: 22, VH: 72 };

Object.assign(UI, {
  rollCh: null,
  tool: 'draw',
  chord: 'none',
  ghost: true,
  rollSel: new Set(),
  lastLen: 2,
  lastVel: 0.8,
  clipboard: null,
  rv: { pps: 22, rh: 15, sx: 0, top: 84 },

  openRoll(id) {
    if (id) this.rollCh = id;
    this.showTab('top', 'roll');
    this.renderRoll();
    requestAnimationFrame(() => this.centerRoll());
  },

  rollChannel() {
    let ch = this.rollCh && chById(this.rollCh);
    if (!ch) {
      ch = (this.selCh && chById(this.selCh)) || P.channels.find(c => c.type !== 'drum') || P.channels[0];
      this.rollCh = ch ? ch.id : null;
    }
    return ch;
  },

  rollNotes() {
    const pat = curPat(), ch = this.rollChannel();
    if (!pat || !ch) return [];
    return pat.notes[ch.id] || (pat.notes[ch.id] = []);
  },

  renderRoll() {
    const v = $('#vRoll');
    v.replaceChildren();
    const ch = this.rollChannel();
    const pat = curPat();
    const wrap = h('div', { class: 'roll' });
    v.append(wrap);
    if (!ch || !pat) { wrap.append(h('div', { class: 'empty', text: 'Добавь канал, чтобы писать ноты' })); return; }
    const notes = pat.notes[ch.id] || [];
    for (const n of [...this.rollSel]) if (!notes.includes(n)) this.rollSel.delete(n);
    const bar = h('div', { class: 'rbar' });
    const chSel = optSelect(P.channels.map(c => [c.id, c.name]), ch.id, id => { this.rollCh = id; this.selCh = id; this.rollSel.clear(); this.renderRoll(); requestAnimationFrame(() => this.centerRoll()); this.renderRack(); });
    chSel.setAttribute('aria-label', 'Канал');
    chSel.style.borderLeft = '4px solid ' + ch.color;
    const tools = h('div', { class: 'tools' });
    for (const [k, ic, hint] of [['draw', 'pen', 'Карандаш: клик — нота, тяни — длина, правая кнопка — стереть'], ['select', 'sel', 'Выделение рамкой (или Ctrl + тянуть)'], ['erase', 'erase', 'Ластик']]) {
      const b = h('button', { class: this.tool === k ? 'on' : '', 'aria-label': hint, hint }, ico(ic));
      b.addEventListener('click', () => { this.tool = k; this.renderRoll(); });
      tools.append(b);
    }
    const snap = optSelect(SNAPS, this.snap, x => { this.snap = x; this.drawRoll(); });
    snap.dataset.hint = 'Привязка к сетке';
    const chord = optSelect(Object.entries(CHORDS).map(([k, [n]]) => [k, n]), this.chord, x => { this.chord = x; });
    chord.dataset.hint = 'Штамп аккорда: один клик ставит весь аккорд';
    const key = optSelect(NOTE_NAMES.map((n, i) => [i, n]), P.key, x => { P.key = +x; History.commit('Тональность'); this.drawRoll(); });
    key.dataset.hint = 'Тональность (подсветка нот лада)';
    key.style.maxWidth = '60px';
    const scale = optSelect(Object.entries(SCALES).map(([k, [n]]) => [k, n]), P.scale, x => { P.scale = x; History.commit('Лад'); this.drawRoll(); });
    const ghost = h('button', { class: 'btn small' + (this.ghost ? ' on' : ''), hint: 'Показывать полупрозрачно ноты других каналов этого паттерна', text: 'Призраки' });
    ghost.addEventListener('click', () => { this.ghost = !this.ghost; ghost.classList.toggle('on', this.ghost); this.drawRoll(); });
    const q = h('button', { class: 'btn small', hint: 'Квантовать: выровнять начало нот по сетке (Ctrl+Q)', text: 'Квантовать', onclick: () => this.quantize() });
    const tl = h('button', { class: 'btn small', hint: 'Роллы, легато, арпеджио, хуманайз и другие операции над нотами', text: 'Инструменты' });
    tl.addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); this.rollToolsMenu(r.left, r.bottom + 4); });
    const play = h('button', { class: 'btn small icon ghost', 'aria-label': 'Прослушать', hint: 'Прослушать звук канала', onclick: () => Engine.preview(ch, null, 0.85, 0.5) }, ico('tri'));
    const inst = h('button', { class: 'btn small icon ghost', 'aria-label': 'Настройки инструмента', hint: 'Настройки инструмента', onclick: () => this.openInstr(ch.id) }, ico('gear'));
    const lenSel = optSelect([16, 32, 48, 64, 96, 128].map(n => [n, n / 16 + ' т.']), pat.len, x => { pat.len = +x; History.commit('Длина'); this.renderRack(); this.drawRoll(); this.renderPlaylist(); });
    lenSel.dataset.hint = 'Длина паттерна в тактах';
    bar.append(chSel, play, inst, h('span', { class: 'sep' }), tools, snap, chord, h('span', { class: 'sep' }), key, scale, ghost, h('span', { class: 'sep' }), q, tl, lenSel);
    const area = h('div', { class: 'rcv' });
    const cv = h('canvas', { class: 'cv', tabindex: 0, 'aria-label': 'Piano Roll' });
    area.append(cv);
    wrap.append(bar, area);
    this.rollCv = cv;
    this.bindRoll(cv);
    if (!this._rollRO) {
      this._rollRO = new ResizeObserver(() => this.drawRoll());
      this._rollRO.observe(v);
    }
    requestAnimationFrame(() => this.drawRoll());
  },

  centerRoll() {
    const ch = this.rollChannel();
    if (!ch) return;
    const notes = this.rollNotes();
    const cv = this.rollCv;
    const rows = cv && cv.clientHeight ? Math.floor((cv.clientHeight - RK.RH - RK.VH) / this.rv.rh) : 24;
    if (notes.length) {
      let lo = 127, hi = 0;
      for (const n of notes) { lo = Math.min(lo, n.n); hi = Math.max(hi, n.n); }
      const avail = cv && cv.clientHeight ? cv.clientHeight - RK.RH - RK.VH : 0;
      if (avail > 0) {
        this.rv.rh = clamp(Math.floor(avail / (hi - lo + 5)), 10, 15);
        const rows2 = Math.floor(avail / this.rv.rh);
        this.rv.top = clamp(Math.round((lo + hi) / 2 + rows2 / 2), rows2, 127);
      } else this.rv.top = clamp(Math.round((lo + hi) / 2 + rows / 2), rows, 127);
    } else this.rv.top = clamp(ch.root + Math.round(rows / 2), rows, 127);
    this.rv.sx = 0;
    this.drawRoll();
  },

  snapV() { return parseFloat(this.snap) || 0; },
  snapFloor(t) { const s = this.snapV(); return s ? Math.floor(t / s + 1e-6) * s : t; },
  snapRound(t) { const s = this.snapV(); return s ? Math.round(t / s) * s : t; },

  rollGeo() {
    const cv = this.rollCv;
    const W = cv.clientWidth, H = cv.clientHeight;
    const { pps, rh, sx, top } = this.rv;
    return {
      W, H, pps, rh, sx, top, gy1: H - RK.VH,
      x: t => RK.KW + (t - sx) * pps,
      y: n => RK.RH + (top - n) * rh,
      t: x => sx + (x - RK.KW) / pps,
      n: y => Math.floor(top - (y - RK.RH) / rh) + 1,
    };
  },

  drawRoll() {
    const cv = this.rollCv;
    if (!cv || !cv.isConnected || !cv.clientWidth || this.topTab !== 'roll') return;
    const { c, w: W, h: H } = setupCanvas(cv);
    const ch = this.rollChannel(), pat = curPat();
    if (!ch || !pat) return;
    const G = this.rollGeo();
    const { pps, rh, gy1 } = G;
    const sc = SCALES[P.scale] ? SCALES[P.scale][1] : [];
    c.fillStyle = '#16171b';
    c.fillRect(0, 0, W, H);
    const nTop = G.top, nBot = G.n(gy1);
    c.save();
    c.beginPath(); c.rect(RK.KW, RK.RH, W - RK.KW, gy1 - RK.RH); c.clip();
    for (let n = nTop; n >= nBot - 1; n--) {
      const y = G.y(n), pc = ((n - P.key) % 12 + 12) % 12;
      const inS = sc.length && sc.includes(pc);
      c.fillStyle = sc.length ? (inS ? (isBlack(n) ? '#1d1e23' : '#202127') : '#16171b') : (isBlack(n) ? '#18191d' : '#1e1f24');
      if (sc.length && pc === 0) c.fillStyle = '#2a1e1b';
      c.fillRect(RK.KW, y, W - RK.KW, rh);
      c.fillStyle = n % 12 === 0 ? '#0e0f12' : '#141519';
      c.fillRect(RK.KW, y + rh - 1, W - RK.KW, 1);
    }
    const t0 = Math.floor(G.sx), t1 = G.t(W) + 1;
    for (let t = t0; t <= t1; t++) {
      if (pps < 9 && t % 4) continue;
      const x = Math.round(G.x(t)) + 0.5;
      c.fillStyle = t % 16 === 0 ? '#3d3f49' : t % 4 === 0 ? '#2b2c34' : '#1f2026';
      c.fillRect(x, RK.RH, 1, gy1 - RK.RH);
    }
    const xe = G.x(pat.len);
    if (xe < W) { c.fillStyle = 'rgba(8,9,11,.55)'; c.fillRect(Math.max(RK.KW, xe), RK.RH, W, gy1 - RK.RH); }
    if (this.ghost) {
      for (const id in pat.notes) {
        if (id === ch.id) continue;
        const oc = chById(id);
        if (!oc) continue;
        c.fillStyle = hexA(oc.color, 0.14);
        for (const n of pat.notes[id]) {
          const y = G.y(n.n);
          if (y < RK.RH - rh || y > gy1) continue;
          c.beginPath(); c.roundRect(G.x(n.t), y + 2, Math.max(2, n.d * pps - 1), rh - 4, 2); c.fill();
        }
      }
    }
    const notes = pat.notes[ch.id] || [];
    c.font = '600 11px Inter, sans-serif';
    c.textBaseline = 'middle';
    for (const n of notes) {
      const x = G.x(n.t), y = G.y(n.n), w = Math.max(3, n.d * pps - 1);
      if (y < RK.RH - rh || y > gy1 || x > W || x + w < RK.KW) continue;
      const sel = this.rollSel.has(n);
      c.fillStyle = shade(ch.color, -0.4 + n.v * 0.4);
      c.beginPath(); c.roundRect(x, y + 1, w, rh - 2, 3); c.fill();
      if (sel) { c.strokeStyle = '#ffffff'; c.lineWidth = 1.5; c.beginPath(); c.roundRect(x + 0.75, y + 1.75, w - 1.5, rh - 3.5, 2.5); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.28)';
      c.fillRect(x + w - 4, y + 4, 1.5, rh - 8);
      if (w > 30 && rh >= 13) { c.fillStyle = 'rgba(10,10,12,.8)'; c.fillText(noteName(n.n), x + 5, y + rh / 2 + 0.5); }
    }
    if (this.band) {
      const b = this.band;
      c.fillStyle = 'rgba(255,107,61,.1)'; c.strokeStyle = '#ff6b3d'; c.lineWidth = 1;
      c.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
      c.strokeRect(Math.min(b.x0, b.x1) + 0.5, Math.min(b.y0, b.y1) + 0.5, Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    }
    if (Engine.playing && Engine.mode === 'pattern') {
      const px = G.x(Engine.displayPos());
      c.fillStyle = '#ff6b3d';
      c.fillRect(px, RK.RH, 1.5, gy1 - RK.RH);
    }
    c.restore();
    c.fillStyle = '#131418';
    c.fillRect(0, 0, W, RK.RH);
    c.fillStyle = '#22232a';
    c.fillRect(0, RK.RH - 1, W, 1);
    c.font = '500 11px "JetBrains Mono", monospace';
    for (let t = t0; t <= t1; t++) {
      const x = G.x(t);
      if (x < RK.KW) continue;
      if (t % 16 === 0) { c.fillStyle = '#8e909a'; c.fillText(String(t / 16 + 1), x + 5, RK.RH / 2 + 1); c.fillStyle = '#3d3f49'; c.fillRect(x, 6, 1, RK.RH - 6); }
      else if (t % 4 === 0 && pps > 7) { c.fillStyle = '#2b2c34'; c.fillRect(x, RK.RH - 6, 1, 6); }
    }
    c.save();
    c.beginPath(); c.rect(0, RK.RH, RK.KW, gy1 - RK.RH); c.clip();
    for (let n = nTop; n >= nBot - 1; n--) {
      const y = G.y(n), blk = isBlack(n);
      c.fillStyle = this.rollKey === n ? '#ff6b3d' : blk ? '#1b1c21' : '#dcdde3';
      c.fillRect(0, y, RK.KW - 2, rh - 1);
      if (blk && this.rollKey !== n) { c.fillStyle = '#dcdde3'; c.fillRect(RK.KW - 16, y, 14, rh - 1); c.fillStyle = '#1b1c21'; c.fillRect(0, y, RK.KW - 16, rh - 1); }
      if (n % 12 === 0) { c.fillStyle = '#6d6f79'; c.font = '600 10px Inter, sans-serif'; c.fillText(noteName(n), RK.KW - 28, y + rh / 2 + 1); }
    }
    c.restore();
    c.fillStyle = '#131418';
    c.fillRect(0, gy1, W, H - gy1);
    c.fillStyle = '#22232a';
    c.fillRect(0, gy1, W, 1);
    c.fillStyle = '#5d5f69';
    c.font = '500 11px Inter, sans-serif';
    c.fillText('Velocity', 8, gy1 + 14);
    c.save();
    c.beginPath(); c.rect(RK.KW, gy1, W - RK.KW, H - gy1); c.clip();
    const lh = RK.VH - 14;
    for (const n of notes) {
      const x = G.x(n.t);
      if (x < RK.KW - 4 || x > W) continue;
      const sel = this.rollSel.has(n);
      const top = H - 4 - n.v * lh;
      c.fillStyle = sel ? '#ffffff' : ch.color;
      c.fillRect(x, top, 2, H - 4 - top);
      c.beginPath(); c.arc(x + 1, top, 3.5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  },

  hitNote(G, x, y) {
    const notes = this.rollNotes();
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      const nx = G.x(n.t), ny = G.y(n.n), w = Math.max(3, n.d * G.pps - 1);
      if (x >= nx && x <= nx + w + 2 && y >= ny && y < ny + G.rh) return { note: n, edge: x > nx + w - Math.min(8, w * 0.35) };
    }
    return null;
  },

  bindRoll(cv) {
    let op = null;
    const loc = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      const ch = this.rollChannel(), pat = curPat();
      if (!ch || !pat) return;
      Engine.init();
      cv.focus({ preventScroll: true });
      const G = this.rollGeo();
      const { x, y } = loc(e);
      cv.setPointerCapture(e.pointerId);
      if (y < RK.RH) { op = null; return; }
      if (x < RK.KW && y < G.gy1) {
        const n = G.n(y);
        this.rollKey = n;
        Engine.noteOn(ch, n, 0.8);
        op = { kind: 'key', n };
        this.drawRoll();
        return;
      }
      if (y >= G.gy1) { op = { kind: 'vel', changed: false }; this.velEdit(G, x, y); op.changed = true; return; }
      const hit = this.hitNote(G, x, y);
      const notes = this.rollNotes();
      if (e.button === 2 || this.tool === 'erase') {
        op = { kind: 'erase', changed: false };
        if (hit) { notes.splice(notes.indexOf(hit.note), 1); this.rollSel.delete(hit.note); op.changed = true; }
        this.drawRoll();
        return;
      }
      if (hit) {
        if (!this.rollSel.has(hit.note)) { if (!e.shiftKey) this.rollSel.clear(); this.rollSel.add(hit.note); }
        else if (e.shiftKey && !hit.edge) { this.rollSel.delete(hit.note); this.drawRoll(); op = null; return; }
        let sel = [...this.rollSel];
        if (e.altKey && !hit.edge) {
          const copies = sel.map(n => ({ ...n }));
          notes.push(...copies);
          this.rollSel = new Set(copies);
          const anchor = copies[sel.indexOf(hit.note)];
          sel = copies;
          hit.note = anchor;
        }
        this.lastLen = hit.note.d;
        this.lastVel = hit.note.v;
        op = { kind: hit.edge ? 'resize' : 'move', t0: G.t(x), n0: G.n(y), anchor: hit.note, orig: sel.map(n => ({ n, t: n.t, d: n.d, p: n.n })), changed: !!e.altKey, lastDn: 0 };
        if (!hit.edge) Engine.preview(ch, hit.note.n, hit.note.v, 0.2);
        this.drawRoll();
        return;
      }
      if (this.tool === 'select' || e.ctrlKey || e.metaKey) {
        if (!e.shiftKey) this.rollSel.clear();
        this.band = { x0: x, y0: y, x1: x, y1: y };
        op = { kind: 'band', base: new Set(this.rollSel) };
        this.drawRoll();
        return;
      }
      const t = Math.max(0, this.snapFloor(G.t(x))), n = G.n(y);
      const ivs = CHORDS[this.chord] ? CHORDS[this.chord][1] : [0];
      const len = this.lastLen || Math.max(this.snapV(), 1);
      const made = ivs.map(iv => ({ t: +t.toFixed(4), d: len, n: clamp(n + iv, 0, 127), v: this.lastVel }));
      notes.push(...made);
      this.rollSel = new Set(made);
      for (const m of made) Engine.preview(ch, m.n, m.v, 0.25);
      op = { kind: 'resize', t0: G.t(x), anchor: made[0], orig: made.map(m => ({ n: m, t: m.t, d: m.d, p: m.n })), changed: true, fresh: true };
      this.drawRoll();
    });
    cv.addEventListener('pointermove', e => {
      const { x, y } = loc(e);
      const G = this.rollGeo();
      if (!op) {
        if (y > RK.RH && y < G.gy1 && x > RK.KW) {
          const hit = this.hitNote(G, x, y);
          cv.style.cursor = this.tool === 'erase' ? 'not-allowed' : hit ? (hit.edge ? 'ew-resize' : 'grab') : this.tool === 'select' ? 'crosshair' : 'copy';
          if (hit) this.showValue(noteName(hit.note.n) + ' · ' + Math.round(hit.note.v * 100) + '%');
        } else cv.style.cursor = x < RK.KW ? 'pointer' : y >= G.gy1 ? 'ns-resize' : 'default';
        return;
      }
      const ch = this.rollChannel();
      if (op.kind === 'key') {
        const n = G.n(y);
        if (n !== op.n && y > RK.RH && y < G.gy1) { Engine.noteOff(ch, op.n); Engine.noteOn(ch, n, 0.8); op.n = n; this.rollKey = n; this.drawRoll(); }
      } else if (op.kind === 'vel') {
        this.velEdit(G, x, y);
      } else if (op.kind === 'erase') {
        const hit = this.hitNote(G, x, y);
        if (hit) { const notes = this.rollNotes(); notes.splice(notes.indexOf(hit.note), 1); this.rollSel.delete(hit.note); op.changed = true; this.drawRoll(); }
      } else if (op.kind === 'move') {
        const a = op.orig.find(o => o.n === op.anchor);
        const rawT = a.t + (G.t(x) - op.t0);
        const dt = Math.max(-Math.min(...op.orig.map(o => o.t)), this.snapRound(rawT) - a.t);
        const dn = G.n(y) - op.n0;
        for (const o of op.orig) { o.n.t = +(o.t + dt).toFixed(4); o.n.n = clamp(o.p + dn, 0, 127); }
        if (dt || dn) op.changed = true;
        if (dn !== op.lastDn) { op.lastDn = dn; Engine.preview(ch, op.anchor.n, op.anchor.v, 0.15); }
        this.showValue(noteName(op.anchor.n) + ' · такт ' + (Math.floor(op.anchor.t / 16) + 1));
        this.drawRoll();
      } else if (op.kind === 'resize') {
        const dt = G.t(x) - op.t0;
        const s = this.snapV() || 0.125;
        for (const o of op.orig) {
          const end = this.snapV() ? this.snapRound(o.t + o.d + dt) : o.t + o.d + dt;
          o.n.d = +Math.max(s, end - o.t).toFixed(4);
        }
        op.changed = true;
        this.lastLen = op.anchor.d;
        this.showValue('Длина: ' + (op.anchor.d / 4).toFixed(2) + ' доли');
        this.drawRoll();
      } else if (op.kind === 'band') {
        this.band.x1 = x; this.band.y1 = y;
        const b = this.band;
        const t0 = G.t(Math.min(b.x0, b.x1)), t1 = G.t(Math.max(b.x0, b.x1));
        const nHi = G.n(Math.min(b.y0, b.y1)), nLo = G.n(Math.max(b.y0, b.y1));
        this.rollSel = new Set(op.base);
        for (const n of this.rollNotes()) if (n.t + n.d > t0 && n.t < t1 && n.n >= nLo && n.n <= nHi) this.rollSel.add(n);
        this.drawRoll();
      }
    });
    const end = () => {
      if (!op) return;
      const ch = this.rollChannel();
      if (op.kind === 'key') { Engine.noteOff(ch, op.n); this.rollKey = null; }
      if (op.kind === 'band') this.band = null;
      if (op.changed) this.notesChanged(op.kind === 'erase' ? 'Стереть' : op.kind === 'vel' ? 'Громкость' : op.fresh ? 'Нота' : 'Правка нот');
      op = null;
      this.drawRoll();
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const { x } = loc(e);
      const G = this.rollGeo();
      if (e.ctrlKey || e.metaKey) {
        const t = G.t(x);
        this.rv.pps = clamp(this.rv.pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 4, 90);
        this.rv.sx = Math.max(0, t - (x - RK.KW) / this.rv.pps);
      } else if (e.altKey) {
        this.rv.rh = clamp(this.rv.rh + (e.deltaY < 0 ? 1 : -1), 9, 28);
      } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        this.rv.sx = Math.max(0, this.rv.sx + (e.deltaX || e.deltaY) / this.rv.pps);
      } else {
        const rows = Math.max(1, Math.round(Math.abs(e.deltaY) / 30));
        this.rv.top = clamp(this.rv.top + (e.deltaY < 0 ? rows : -rows), 20, 127);
      }
      this.drawRoll();
    }, { passive: false });
  },

  velEdit(G, x, y) {
    const notes = this.rollNotes();
    const v = clamp(1 - (y - G.gy1 - 10) / (RK.VH - 14), 0.03, 1);
    const pool = this.rollSel.size ? [...this.rollSel] : notes;
    let any = false;
    for (const n of pool) {
      if (Math.abs(G.x(n.t) - x) <= Math.max(5, G.pps * 0.45)) { n.v = +v.toFixed(3); any = true; }
    }
    if (any) { this.lastVel = v; this.showValue('Громкость: ' + Math.round(v * 100) + '%'); this.drawRoll(); }
  },

  notesChanged(label) {
    const pat = curPat();
    let end = 0;
    for (const id in pat.notes) for (const n of pat.notes[id]) end = Math.max(end, n.t + Math.min(n.d, 1));
    if (end > pat.len) pat.len = Math.min(256, Math.ceil(end / 16) * 16);
    History.commit(label);
    this.renderRack();
    this.renderPlaylist();
  },

  quantize() {
    const s = this.snapV() || 1;
    const sel = this.rollSel.size ? [...this.rollSel] : this.rollNotes();
    for (const n of sel) n.t = Math.round(n.t / s) * s;
    this.notesChanged('Квантовать');
    this.drawRoll();
    this.toast('Ноты выровнены по сетке');
  },

  rollToolsMenu(x, y) {
    const notes = this.rollNotes();
    const target = () => (this.rollSel.size ? [...this.rollSel] : notes.slice());
    const done = (label, sel) => { if (sel) this.rollSel = new Set(sel); this.notesChanged(label); this.drawRoll(); };
    const chop = k => () => {
      const src = target();
      if (!src.length) return this.toast('Нет нот');
      const made = [];
      for (const n of src) {
        notes.splice(notes.indexOf(n), 1);
        const part = n.d / k;
        for (let i = 0; i < k; i++) made.push({ t: +(n.t + i * part).toFixed(4), d: +Math.max(0.05, part * 0.9).toFixed(4), n: n.n, v: +clamp(n.v * (0.75 + 0.25 * (i + 1) / k), 0.05, 1).toFixed(3) });
      }
      notes.push(...made);
      done('Нарезать', made);
    };
    const scaleLen = f => () => {
      const src = target();
      if (!src.length) return;
      const t0 = Math.min(...src.map(n => n.t));
      for (const n of src) { n.t = +(t0 + (n.t - t0) * f).toFixed(4); n.d = +Math.max(0.05, n.d * f).toFixed(4); }
      done(f > 1 ? 'Растянуть' : 'Сжать');
    };
    this.menu(x, y, [
      { head: this.rollSel.size ? 'Для выделенных нот (' + this.rollSel.size + ')' : 'Для всех нот канала' },
      { label: 'Ролл: нарезать на 2', action: chop(2) },
      { label: 'Ролл: нарезать на 3 (триоль)', action: chop(3) },
      { label: 'Ролл: нарезать на 4', action: chop(4) },
      { label: 'Ролл: нарезать на 8', action: chop(8) },
      '-',
      { label: 'Легато (дотянуть до следующей)', action: () => {
        const src = target().sort((a, b) => a.t - b.t);
        const starts = [...new Set(src.map(n => n.t))].sort((a, b) => a - b);
        const pat = curPat();
        for (const n of src) { const nx = starts.find(s => s > n.t + 1e-6); n.d = +((nx != null ? nx : Math.max(pat.len, Math.ceil((n.t + n.d) / 16) * 16)) - n.t).toFixed(4); }
        done('Легато');
      } },
      { label: 'Хуманайз (живая игра)', action: () => {
        for (const n of target()) { n.v = +clamp(n.v + (Math.random() - 0.5) * 0.18, 0.05, 1).toFixed(3); n.t = +Math.max(0, n.t + (Math.random() - 0.5) * 0.12).toFixed(4); }
        done('Хуманайз');
      } },
      { label: 'Страм (аккорды «гитарой»)', action: () => {
        const by = {};
        for (const n of target()) (by[n.t.toFixed(3)] = by[n.t.toFixed(3)] || []).push(n);
        for (const k in by) by[k].sort((a, b) => a.n - b.n).forEach((n, i) => { n.t = +(n.t + i * 0.12).toFixed(4); });
        done('Страм');
      } },
      { label: 'Арпеджио вверх (1/16)', action: () => {
        const src = target();
        const by = {};
        for (const n of src) (by[n.t.toFixed(3)] = by[n.t.toFixed(3)] || []).push(n);
        const made = [];
        for (const k in by) {
          const ch = by[k].sort((a, b) => a.n - b.n);
          const t0 = ch[0].t, len = Math.max(...ch.map(n => n.d));
          for (const n of ch) notes.splice(notes.indexOf(n), 1);
          for (let i = 0; i < Math.max(1, Math.round(len)); i++) { const n = ch[i % ch.length]; made.push({ t: +(t0 + i).toFixed(4), d: 1, n: n.n + (ch.length < 3 && i % 2 ? 12 : 0), v: n.v }); }
        }
        notes.push(...made);
        done('Арпеджио', made);
      } },
      '-',
      { label: 'Растянуть ×2', action: scaleLen(2) },
      { label: 'Сжать ×½', action: scaleLen(0.5) },
      { label: 'Октава вверх', action: () => { for (const n of target()) n.n = clamp(n.n + 12, 0, 127); done('Октава'); } },
      { label: 'Октава вниз', action: () => { for (const n of target()) n.n = clamp(n.n - 12, 0, 127); done('Октава'); } },
      { label: 'Развернуть задом наперёд', action: () => {
        const src = target();
        if (!src.length) return;
        const a = Math.min(...src.map(n => n.t)), b = Math.max(...src.map(n => n.t + n.d));
        for (const n of src) n.t = +(a + b - n.t - n.d).toFixed(4);
        done('Реверс');
      } },
      { label: 'Выделить всё', kbd: 'Ctrl+A', action: () => { this.rollSel = new Set(notes); this.drawRoll(); } },
    ]);
  },

  rollKeys(e) {
    const notes = this.rollNotes();
    const sel = [...this.rollSel];
    const k = e.key, ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k.toLowerCase() === 'a') { this.rollSel = new Set(notes); this.drawRoll(); return true; }
    if (ctrl && k.toLowerCase() === 'c') { if (sel.length) { const m = Math.min(...sel.map(n => n.t)); this.clipboard = sel.map(n => ({ ...n, t: n.t - m })); this.toast('Скопировано: ' + sel.length); } return true; }
    if (ctrl && k.toLowerCase() === 'x') { if (sel.length) { const m = Math.min(...sel.map(n => n.t)); this.clipboard = sel.map(n => ({ ...n, t: n.t - m })); for (const n of sel) notes.splice(notes.indexOf(n), 1); this.rollSel.clear(); this.notesChanged('Вырезать'); this.drawRoll(); } return true; }
    if (ctrl && k.toLowerCase() === 'v') {
      if (!this.clipboard) return true;
      const at = sel.length ? Math.max(...sel.map(n => n.t + n.d)) : this.snapFloor(this.rv.sx);
      const at2 = this.snapV() ? Math.ceil(at / this.snapV() - 1e-6) * this.snapV() : at;
      const made = this.clipboard.map(n => ({ ...n, t: +(n.t + at2).toFixed(4) }));
      notes.push(...made);
      this.rollSel = new Set(made);
      this.notesChanged('Вставить');
      this.drawRoll();
      return true;
    }
    if (ctrl && k.toLowerCase() === 'd') {
      if (!sel.length) return true;
      const m = Math.min(...sel.map(n => n.t)), e2 = Math.max(...sel.map(n => n.t + n.d));
      const span = Math.ceil((e2 - m) / 4 - 1e-6) * 4;
      const made = sel.map(n => ({ ...n, t: +(n.t + span).toFixed(4) }));
      notes.push(...made);
      this.rollSel = new Set(made);
      this.notesChanged('Дублировать');
      this.drawRoll();
      return true;
    }
    if (ctrl && k.toLowerCase() === 'q') { this.quantize(); return true; }
    if (k === 'Delete' || k === 'Backspace') {
      if (!sel.length) return false;
      for (const n of sel) notes.splice(notes.indexOf(n), 1);
      this.rollSel.clear();
      this.notesChanged('Удалить ноты');
      this.drawRoll();
      return true;
    }
    if ((k === 'ArrowUp' || k === 'ArrowDown') && sel.length) {
      const d = (k === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 12 : 1);
      for (const n of sel) n.n = clamp(n.n + d, 0, 127);
      Engine.preview(this.rollChannel(), sel[0].n, sel[0].v, 0.2);
      this._arC = this._arC || debounce(() => this.notesChanged('Транспонировать'), 400);
      this._arC();
      this.drawRoll();
      return true;
    }
    if ((k === 'ArrowLeft' || k === 'ArrowRight') && sel.length) {
      const s = this.snapV() || 0.25;
      const d = k === 'ArrowRight' ? s : -s;
      if (Math.min(...sel.map(n => n.t)) + d < 0) return true;
      for (const n of sel) n.t = +(n.t + d).toFixed(4);
      this._arC = this._arC || debounce(() => this.notesChanged('Сдвиг'), 400);
      this._arC();
      this.drawRoll();
      return true;
    }
    if (k === 'Escape') { this.rollSel.clear(); this.drawRoll(); return true; }
    return false;
  },
});
