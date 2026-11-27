const PLK = { TW: 118, RH: 24, TRH: 44 };

Object.assign(UI, {
  pv: { pps: 6, sx: 0, sy: 0 },
  plSnap: '16',

  renderPlaylist() {
    const v = $('#vPlaylist');
    v.replaceChildren();
    const wrap = h('div', { class: 'pl' });
    const pick = h('div', { class: 'picker', 'aria-label': 'Паттерны' });
    const add = h('button', { class: 'btn small ghost', style: { width: '100%', marginBottom: '4px', justifyContent: 'flex-start' }, hint: 'Новый паттерн', onclick: () => this.newPattern() }, ico('plus'), 'Новый паттерн');
    pick.append(add);
    for (const p of P.patterns) {
      const el = h('div', { class: 'pick' + (p.id === P.curPat ? ' on' : ''), hint: 'Клик — выбрать и рисовать им в Playlist, двойной клик — открыть, правый клик — меню' }, h('i', { style: { background: p.color } }), h('span', { text: p.name }));
      el.addEventListener('click', () => this.selectPattern(p.id));
      el.addEventListener('dblclick', () => { this.selectPattern(p.id); this.showTab('top', 'rack'); });
      el.addEventListener('contextmenu', e => { e.preventDefault(); this.patternMenu(p, e.clientX, e.clientY); });
      pick.append(el);
    }
    const right = h('div', { class: 'plr' });
    const bar = h('div', { class: 'rbar' });
    const snap = optSelect([['16', 'Такт'], ['4', 'Доля'], ['1', '1/16']], this.plSnap, x => { this.plSnap = x; });
    bar.append(h('span', { class: 'lbl', text: 'Сетка' }), snap,
      h('button', { class: 'btn small', hint: 'Добавить дорожку', onclick: () => { P.playlist.tracks.push({ name: 'Дорожка ' + (P.playlist.tracks.length + 1), mute: false }); History.commit('Дорожка'); this.drawPlaylist(); } }, ico('plus'), 'Дорожка'),
      h('button', { class: 'btn small', 'aria-label': 'Отдалить', hint: 'Отдалить (Ctrl + колесо)', onclick: () => { this.pv.pps = clamp(this.pv.pps / 1.3, 1.5, 40); this.drawPlaylist(); } }, '−'),
      h('button', { class: 'btn small', 'aria-label': 'Приблизить', hint: 'Приблизить (Ctrl + колесо)', onclick: () => { this.pv.pps = clamp(this.pv.pps * 1.3, 1.5, 40); this.drawPlaylist(); } }, '+'),
    );
    bar.dataset.hint = 'Клик — поставить выбранный паттерн, тяни — двигать, за правый край — длина, правая кнопка — удалить, Shift+тянуть — копия';
    const area = h('div', { class: 'rcv' });
    const cv = h('canvas', { class: 'cv', 'aria-label': 'Playlist' });
    area.append(cv);
    right.append(bar, area);
    wrap.append(pick, right);
    v.append(wrap);
    this.plCv = cv;
    this.bindPlaylist(cv);
    if (!this._plRO) {
      this._plRO = new ResizeObserver(() => this.drawPlaylist());
      this._plRO.observe(v);
    }
    requestAnimationFrame(() => this.drawPlaylist());
  },

  plGeo() {
    const cv = this.plCv;
    const { pps, sx, sy } = this.pv;
    return {
      W: cv.clientWidth, H: cv.clientHeight, pps,
      x: s => PLK.TW + (s - sx) * pps,
      s: x => sx + (x - PLK.TW) / pps,
      y: tr => PLK.RH + (tr - sy) * PLK.TRH,
      tr: y => Math.floor((y - PLK.RH) / PLK.TRH + sy),
    };
  },

  patPreview(pat) {
    const key = (UI.ver || 0) + ':' + pat.len;
    if (pat._pv && pat._pvKey === key) return pat._pv;
    let lo = 127, hi = 0;
    const list = [];
    for (const id in pat.notes) {
      const ch = chById(id);
      for (const n of pat.notes[id]) {
        const isDrum = ch && ch.type === 'drum';
        list.push({ t: n.t, d: n.d, n: n.n, drum: isDrum, row: isDrum ? P.channels.indexOf(ch) : 0, c: ch ? ch.color : '#888' });
        if (!isDrum) { lo = Math.min(lo, n.n); hi = Math.max(hi, n.n); }
      }
    }
    if (hi < lo) { lo = 48; hi = 72; }
    if (hi - lo < 8) { lo -= 4; hi += 4; }
    const pv = { list, lo, hi };
    Object.defineProperty(pat, '_pv', { value: pv, writable: true, enumerable: false, configurable: true });
    Object.defineProperty(pat, '_pvKey', { value: key, writable: true, enumerable: false, configurable: true });
    return pv;
  },

  drawPlaylist() {
    const cv = this.plCv;
    if (!cv || !cv.isConnected || !cv.clientWidth || this.botTab !== 'playlist') return;
    const { c, w: W, h: H } = setupCanvas(cv);
    const G = this.plGeo();
    const pps = G.pps;
    const tracks = P.playlist.tracks;
    c.fillStyle = '#16171b';
    c.fillRect(0, 0, W, H);
    const songEnd = songLength(P);
    c.save();
    c.beginPath(); c.rect(PLK.TW, PLK.RH, W - PLK.TW, H - PLK.RH); c.clip();
    for (let i = Math.floor(this.pv.sy); i < tracks.length; i++) {
      const y = G.y(i);
      if (y > H) break;
      c.fillStyle = i % 2 ? '#17181c' : '#1a1b20';
      c.fillRect(PLK.TW, y, W, PLK.TRH);
      c.fillStyle = '#121317';
      c.fillRect(PLK.TW, y + PLK.TRH - 1, W, 1);
    }
    const s0 = Math.floor(this.pv.sx / 4) * 4, s1 = G.s(W) + 4;
    for (let s = s0; s <= s1; s += 4) {
      if (s % 16 && pps * 4 < 10) continue;
      c.fillStyle = s % 64 === 0 ? '#3d3f49' : s % 16 === 0 ? '#2b2c34' : '#1f2026';
      c.fillRect(Math.round(G.x(s)), PLK.RH, 1, H);
    }
    const xe = G.x(songEnd);
    if (xe < W) { c.fillStyle = 'rgba(8,9,11,.35)'; c.fillRect(xe, PLK.RH, W, H); }
    c.font = '600 11px Inter, sans-serif';
    c.textBaseline = 'middle';
    for (const cl of P.playlist.clips) {
      const pat = patById(P, cl.p);
      if (!pat) continue;
      const x = G.x(cl.s), y = G.y(cl.tr) + 2, w = Math.max(3, cl.l * pps - 1), hh = PLK.TRH - 4;
      if (x > W || x + w < PLK.TW || y > H || y + hh < PLK.RH) continue;
      const muted = tracks[cl.tr] && tracks[cl.tr].mute;
      const hot = this.plHot === cl;
      c.globalAlpha = muted ? 0.35 : 1;
      c.save();
      c.beginPath(); c.roundRect(x, y, w, hh, 4); c.clip();
      c.fillStyle = hexA(pat.color, hot ? 0.3 : 0.2);
      c.fillRect(x, y, w, hh);
      c.fillStyle = hexA(pat.color, hot ? 1 : 0.85);
      c.fillRect(x, y, w, 15);
      c.fillStyle = '#0e0f12';
      if (w > 24) c.fillText(pat.name, x + 5, y + 8, w - 10);
      c.restore();
      const pv = this.patPreview(pat);
      const bodyY = y + 17, bodyH = hh - 19;
      c.save();
      c.beginPath(); c.rect(x, bodyY, w, bodyH); c.clip();
      for (let r = 0; r * pat.len < cl.l; r++) {
        const rx = x + r * pat.len * pps;
        if (r) { c.fillStyle = hexA(pat.color, 0.35); c.fillRect(rx, bodyY, 1, bodyH); }
        for (const n of pv.list) {
          if (r * pat.len + n.t >= cl.l || n.t >= pat.len) continue;
          const nx = rx + n.t * pps;
          let ny;
          if (n.drum) ny = bodyY + bodyH - 3 - (n.row % 6) * 2;
          else ny = bodyY + (1 - (n.n - pv.lo) / (pv.hi - pv.lo)) * (bodyH - 4);
          c.fillStyle = hexA(n.c, 0.85);
          c.fillRect(nx, ny, Math.max(1, Math.min(n.d, 8) * pps - 0.5), 2);
        }
      }
      c.restore();
      c.strokeStyle = hexA(pat.color, hot ? 0.9 : 0.45);
      c.lineWidth = 1;
      c.beginPath(); c.roundRect(x + 0.5, y + 0.5, w - 1, hh - 1, 4); c.stroke();
      c.globalAlpha = 1;
    }
    const pos = Engine.playing && Engine.mode === 'song' ? Engine.displayPos() : Engine.songStart;
    const px = G.x(pos);
    c.fillStyle = Engine.playing && Engine.mode === 'song' ? '#ff6b3d' : 'rgba(255,107,61,.55)';
    c.fillRect(px, PLK.RH, 1.5, H);
    c.restore();
    c.fillStyle = '#131418';
    c.fillRect(0, 0, W, PLK.RH);
    c.fillStyle = '#22232a';
    c.fillRect(0, PLK.RH - 1, W, 1);
    c.font = '500 11px "JetBrains Mono", monospace';
    for (let s = Math.floor(this.pv.sx / 16) * 16; s <= s1; s += 16) {
      const x = G.x(s);
      if (x < PLK.TW) continue;
      const step = pps * 16 < 28 ? 4 : 1;
      if ((s / 16) % step) continue;
      c.fillStyle = '#3d3f49';
      c.fillRect(x, 8, 1, PLK.RH - 8);
      c.fillStyle = '#8e909a';
      c.fillText(String(s / 16 + 1), x + 5, PLK.RH / 2 + 1);
    }
    if (xe > PLK.TW && xe < W) { c.fillStyle = '#5d5f69'; c.beginPath(); c.moveTo(xe, PLK.RH); c.lineTo(xe - 6, PLK.RH - 8); c.lineTo(xe + 6, PLK.RH - 8); c.fill(); }
    if (px >= PLK.TW && px < W) { c.fillStyle = '#ff6b3d'; c.beginPath(); c.moveTo(px - 6, 2); c.lineTo(px + 6, 2); c.lineTo(px, PLK.RH - 2); c.fill(); }
    c.fillStyle = '#131418';
    c.fillRect(0, PLK.RH, PLK.TW, H);
    c.save();
    c.beginPath(); c.rect(0, PLK.RH, PLK.TW, H); c.clip();
    for (let i = Math.floor(this.pv.sy); i < tracks.length; i++) {
      const y = G.y(i);
      if (y > H) break;
      const t = tracks[i];
      c.fillStyle = '#121317';
      c.fillRect(0, y + PLK.TRH - 1, PLK.TW, 1);
      c.beginPath(); c.arc(15, y + PLK.TRH / 2, 4.5, 0, Math.PI * 2);
      c.fillStyle = t.mute ? '#2f3039' : '#4ade80'; c.fill();
      c.fillStyle = t.mute ? '#5d5f69' : '#d4d5da';
      c.font = '500 12px Inter, sans-serif';
      c.fillText(t.name, 26, y + PLK.TRH / 2 + 1, PLK.TW - 32);
    }
    c.restore();
    c.fillStyle = '#22232a';
    c.fillRect(PLK.TW - 1, 0, 1, H);
  },

  hitClip(G, x, y) {
    const tr = G.tr(y);
    const cl = P.playlist.clips;
    for (let i = cl.length - 1; i >= 0; i--) {
      const c = cl[i];
      if (c.tr !== tr) continue;
      const cx = G.x(c.s), w = c.l * G.pps;
      if (x >= cx && x <= cx + w) return { clip: c, edge: x > cx + w - Math.min(8, w * 0.3) };
    }
    return null;
  },

  bindPlaylist(cv) {
    let op = null;
    const loc = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const snapS = s => { const q = +this.plSnap; return Math.max(0, Math.round(s / q) * q); };
    const floorS = s => { const q = +this.plSnap; return Math.max(0, Math.floor(s / q) * q); };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      const G = this.plGeo();
      const { x, y } = loc(e);
      cv.setPointerCapture(e.pointerId);
      if (y < PLK.RH && x > PLK.TW) {
        op = { kind: 'seek' };
        Engine.seek(Math.max(0, floorS(G.s(x))));
        this.drawPlaylist();
        return;
      }
      if (x < PLK.TW) {
        const i = G.tr(y), t = P.playlist.tracks[i];
        op = null;
        if (!t) return;
        if (e.button === 2) { this.trackMenu(i, e.clientX, e.clientY); return; }
        if (x < 28) { t.mute = !t.mute; History.commit('Дорожка'); this.drawPlaylist(); }
        return;
      }
      const hit = this.hitClip(G, x, y);
      if (e.button === 2) {
        op = { kind: 'erase', changed: false };
        if (hit) { P.playlist.clips = P.playlist.clips.filter(c => c !== hit.clip); op.changed = true; this.drawPlaylist(); }
        return;
      }
      if (hit) {
        let clip = hit.clip;
        if ((e.shiftKey || e.altKey) && !hit.edge) { clip = { ...clip, id: uid('k') }; P.playlist.clips.push(clip); }
        op = { kind: hit.edge ? 'resize' : 'move', clip, s0: G.s(x), os: clip.s, ol: clip.l, otr: clip.tr, changed: clip !== hit.clip };
        if (clip.p !== P.curPat && !hit.edge) { P.curPat = clip.p; this.fillPatSel(); this.renderRack(); this.renderRoll(); for (const el of $$('#vPlaylist .pick')) el.classList.remove('on'); }
        this.plHot = clip;
        this.drawPlaylist();
        return;
      }
      const pat = curPat();
      const tr = G.tr(y);
      if (!pat || tr < 0) return;
      while (tr >= P.playlist.tracks.length) P.playlist.tracks.push({ name: 'Дорожка ' + (P.playlist.tracks.length + 1), mute: false });
      const clip = { id: uid('k'), p: pat.id, tr, s: floorS(G.s(x)), l: pat.len };
      P.playlist.clips.push(clip);
      op = { kind: 'move', clip, s0: G.s(x), os: clip.s, ol: clip.l, otr: clip.tr, changed: true };
      this.plHot = clip;
      this.drawPlaylist();
    });
    cv.addEventListener('pointermove', e => {
      const G = this.plGeo();
      const { x, y } = loc(e);
      if (!op) {
        const hit = y > PLK.RH && x > PLK.TW ? this.hitClip(G, x, y) : null;
        cv.style.cursor = y < PLK.RH ? 'pointer' : x < PLK.TW ? 'default' : hit ? (hit.edge ? 'ew-resize' : 'grab') : 'copy';
        if ((hit && hit.clip) !== this.plHot) { this.plHot = hit && hit.clip; this.drawPlaylist(); }
        return;
      }
      if (op.kind === 'seek') {
        Engine.seek(Math.max(0, floorS(G.s(x))));
        this.drawPlaylist();
      } else if (op.kind === 'erase') {
        const hit = this.hitClip(G, x, y);
        if (hit) { P.playlist.clips = P.playlist.clips.filter(c => c !== hit.clip); op.changed = true; this.drawPlaylist(); }
      } else if (op.kind === 'move') {
        const ns = snapS(op.os + G.s(x) - op.s0);
        const ntr = clamp(G.tr(y), 0, P.playlist.tracks.length - 1);
        if (ns !== op.clip.s || ntr !== op.clip.tr) { op.clip.s = ns; op.clip.tr = ntr; op.changed = true; this.drawPlaylist(); }
        this.showValue('Такт ' + (Math.floor(op.clip.s / 16) + 1));
      } else if (op.kind === 'resize') {
        const q = +this.plSnap;
        const nl = Math.max(q, Math.round((op.ol + G.s(x) - op.s0) / q) * q);
        if (nl !== op.clip.l) { op.clip.l = nl; op.changed = true; this.drawPlaylist(); }
        this.showValue('Длина: ' + (op.clip.l / 16).toFixed(2) + ' такта');
      }
    });
    const end = () => {
      if (op && op.changed) History.commit('Playlist');
      op = null;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('dblclick', e => {
      const G = this.plGeo();
      const { x, y } = loc(e);
      if (x < PLK.TW && y > PLK.RH) {
        const i = G.tr(y);
        if (P.playlist.tracks[i]) this.renameTrack(i);
        return;
      }
      const hit = this.hitClip(G, x, y);
      if (hit) { this.selectPattern(hit.clip.p); this.showTab('top', 'rack'); }
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const { x } = loc(e);
      const G = this.plGeo();
      if (e.ctrlKey || e.metaKey) {
        const s = G.s(x);
        this.pv.pps = clamp(this.pv.pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1.5, 40);
        this.pv.sx = Math.max(0, s - (x - PLK.TW) / this.pv.pps);
      } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        this.pv.sx = Math.max(0, this.pv.sx + (e.deltaX || e.deltaY) / this.pv.pps);
      } else {
        this.pv.sy = clamp(this.pv.sy + (e.deltaY > 0 ? 1 : -1), 0, Math.max(0, P.playlist.tracks.length - 2));
      }
      this.drawPlaylist();
    }, { passive: false });
  },

  async renameTrack(i) {
    const t = P.playlist.tracks[i];
    const n = await this.prompt('Имя дорожки', 'Название', t.name);
    if (n) { t.name = n; History.commit('Дорожка'); this.drawPlaylist(); }
  },

  trackMenu(i, x, y) {
    const t = P.playlist.tracks[i];
    this.menu(x, y, [
      { head: t.name },
      { label: 'Переименовать…', action: () => this.renameTrack(i) },
      { label: t.mute ? 'Включить' : 'Заглушить', action: () => { t.mute = !t.mute; History.commit('Дорожка'); this.drawPlaylist(); } },
      { label: 'Очистить дорожку', action: () => { P.playlist.clips = P.playlist.clips.filter(c => c.tr !== i); History.commit('Очистить'); this.drawPlaylist(); } },
      { label: 'Удалить дорожку', disabled: P.playlist.tracks.length < 2, action: () => {
        P.playlist.clips = P.playlist.clips.filter(c => c.tr !== i).map(c => (c.tr > i ? { ...c, tr: c.tr - 1 } : c));
        P.playlist.tracks.splice(i, 1);
        History.commit('Удалить дорожку');
        this.drawPlaylist();
      } },
    ]);
  },
});
