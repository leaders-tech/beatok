const STEP_OFF = ['#23242b', '#2b2c34'];

Object.assign(UI, {
  stepEls: {},
  nameEls: {},
  lastStepVel: 0.8,

  isStepMode(ch, notes) {
    return notes.every(n => Math.abs(n.t - Math.round(n.t)) < 1e-6 && n.n === ch.root && n.d <= 1.001);
  },

  renderRack() {
    const v = $('#vRack');
    const old = v.querySelector('.rack');
    const sx = old ? old.scrollLeft : 0, sy = old ? old.scrollTop : 0;
    v.replaceChildren();
    const pat = curPat();
    const rack = h('div', { class: 'rack' });
    const inner = h('div', { class: 'rackin' });
    rack.append(inner);
    v.append(rack);
    this.stepEls = {};
    this.nameEls = {};
    this.curStep = -1;
    if (!pat) return;
    const groups = Math.ceil(pat.len / 4);
    const head = h('div', { class: 'rackhead' }, h('div', { style: { width: '248px', flex: 'none' } }));
    const hs = h('div', { class: 'steps', style: { height: '18px' } });
    for (let g = 0; g < groups; g++) {
      const sg = h('div', { class: 'sgrp' });
      for (let k = 0; k < 4 && g * 4 + k < pat.len; k++) {
        const i = g * 4 + k;
        sg.append(h('span', { class: 'num' + (k === 0 ? ' beat' : ''), text: k === 0 ? String(Math.floor(i / 16) + 1) + (i % 16 ? '.' + (i % 16 / 4 + 1) : '') : '' }));
      }
      hs.append(sg);
    }
    head.append(hs);
    inner.append(head);
    if (!P.channels.length) inner.append(h('div', { class: 'bnote', text: 'Каналов пока нет. Добавь звук из браузера слева или кнопкой ниже.' }));
    for (const ch of P.channels) inner.append(this.rackRow(ch, pat, groups));
    const foot = h('div', { class: 'rackfoot' });
    const add = h('button', { class: 'btn small', hint: 'Добавить инструмент. Клик по шагу — удар, тяни — рисовать, правая кнопка — стереть, колесо над ударом — громкость' }, ico('plus'), 'Канал');
    add.addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); this.addMenu(r.left, r.bottom + 4); });
    const lenSel = optSelect([16, 32, 48, 64, 96, 128].map(n => [n, n / 16 + (n === 16 ? ' такт' : n < 80 ? ' такта' : ' тактов')]), pat.len, x => {
      pat.len = +x; History.commit('Длина паттерна'); this.renderRack(); this.renderRoll(); this.renderPlaylist();
    });
    foot.append(add, h('span', { class: 'lbl', text: 'Длина' }), lenSel);
    inner.append(foot);
    rack.scrollLeft = sx;
    rack.scrollTop = sy;
  },

  rackRow(ch, pat, groups) {
    const row = h('div', { class: 'crow' + (this.selCh === ch.id ? ' sel' : '') });
    const anySolo = P.channels.some(c => c.solo);
    const led = h('div', { class: 'led' + (!ch.mute && (!anySolo || ch.solo) ? ' on' : ''), role: 'switch', hint: 'Вкл/выкл канал. Правый клик — соло' });
    led.addEventListener('click', () => { ch.mute = !ch.mute; this.chChanged(); });
    led.addEventListener('contextmenu', e => {
      e.preventDefault();
      const was = ch.solo;
      for (const c of P.channels) c.solo = false;
      ch.solo = !was;
      ch.mute = false;
      this.chChanged();
    });
    const pan = knob({ min: -1, max: 1, value: ch.pan, def: 0, bipolar: true, size: 24, label: '', hint: 'Панорама ' + ch.name, fmt: v => v === 0 ? 'центр' : (v < 0 ? 'L ' : 'R ') + Math.round(Math.abs(v) * 100), onInput: v => { ch.pan = v; Engine.graph && Engine.graph.updateChannel(ch); }, onCommit: () => History.commit('Панорама') });
    const vol = knob({ min: 0, max: 1.25, value: ch.vol, def: 0.8, size: 24, hint: 'Громкость ' + ch.name, fmt: fmtPct, onInput: v => { ch.vol = v; Engine.graph && Engine.graph.updateChannel(ch); }, onCommit: () => History.commit('Громкость') });
    pan.querySelector('.kl')?.remove();
    vol.querySelector('.kl')?.remove();
    const insn = h('div', { class: 'insn', text: ch.mixer ? String(ch.mixer) : 'M', hint: 'Дорожка микшера. Тяни или колесо — сменить, клик — открыть в микшере' });
    let d = null;
    insn.addEventListener('pointerdown', e => { insn.setPointerCapture(e.pointerId); d = { y: e.clientY, m: ch.mixer, moved: false }; });
    insn.addEventListener('pointermove', e => {
      if (!d) return;
      const nm = clamp(d.m + Math.round((d.y - e.clientY) / 12), 0, P.mixer.length - 1);
      if (nm !== ch.mixer) { d.moved = true; ch.mixer = nm; insn.textContent = nm ? String(nm) : 'M'; Engine.graph && Engine.graph.updateChannel(ch); }
    });
    insn.addEventListener('pointerup', () => {
      if (d && d.moved) { History.commit('Маршрут'); this.renderMixer(); }
      else if (d) { this.selIns = ch.mixer; this.showTab('bot', 'mixer'); this.renderMixer(); }
      d = null;
    });
    insn.addEventListener('wheel', e => { e.preventDefault(); ch.mixer = clamp(ch.mixer + (e.deltaY < 0 ? 1 : -1), 0, P.mixer.length - 1); insn.textContent = ch.mixer ? String(ch.mixer) : 'M'; Engine.graph && Engine.graph.updateChannel(ch); this._insC = this._insC || debounce(() => { History.commit('Маршрут'); this.renderMixer(); }, 500); this._insC(); }, { passive: false });
    const nm = h('button', { class: 'cname', style: { '--c': ch.color }, text: ch.name, hint: ch.name + ' · ' + INSTR_NAMES[ch.type] + '. Клик — настройки, правый клик — меню' });
    nm.addEventListener('click', () => { this.selectChannel(ch.id); this.openInstr(ch.id); });
    nm.addEventListener('contextmenu', e => { e.preventDefault(); this.channelMenu(ch, e.clientX, e.clientY); });
    this.nameEls[ch.id] = nm;
    row.append(led, pan, vol, insn, nm);
    const notes = pat.notes[ch.id] || [];
    if (this.isStepMode(ch, notes)) row.append(this.stepRow(ch, pat, groups));
    else row.append(this.miniRoll(ch, pat, groups, notes));
    return row;
  },

  chChanged() {
    if (Engine.graph) Engine.graph.updateAllChannels();
    History.commit('Канал');
    this.renderRack();
  },

  selectChannel(id) {
    this.selCh = id;
    for (const r of $$('#vRack .crow')) r.classList.remove('sel');
    const el = this.nameEls[id];
    if (el) el.closest('.crow').classList.add('sel');
    if (this.topTab === 'roll' || this.rollCh !== id) { this.rollCh = id; this.renderRoll(); }
  },

  stepRow(ch, pat, groups) {
    const wrap = h('div', { class: 'steps' });
    const els = [];
    const notes = () => pat.notes[ch.id] || [];
    const findAt = i => notes().find(n => Math.abs(n.t - i) < 1e-6);
    const paint = (el, i) => {
      const n = findAt(i);
      el.classList.toggle('on', !!n);
      const vb = el.firstChild.firstChild;
      vb.style.width = n ? Math.round(n.v * 100) + '%' : '0';
    };
    for (let g = 0; g < groups; g++) {
      const sg = h('div', { class: 'sgrp' });
      const off = STEP_OFF[Math.floor(g) % 2];
      for (let k = 0; k < 4 && g * 4 + k < pat.len; k++) {
        const i = g * 4 + k;
        const el = h('button', { class: 'step', 'aria-label': 'Шаг ' + (i + 1), style: { '--sc': ch.color, '--sd': off } }, h('i', null, h('b')));
        el.dataset.i = i;
        paint(el, i);
        els.push(el);
        sg.append(el);
      }
      wrap.append(sg);
    }
    this.stepEls[ch.id] = els;
    const set = (i, on) => {
      const arr = pat.notes[ch.id] || (pat.notes[ch.id] = []);
      const has = arr.some(n => Math.abs(n.t - i) < 1e-6);
      if (on && !has) arr.push({ t: i, d: 1, n: ch.root, v: this.lastStepVel });
      if (!on && has) pat.notes[ch.id] = arr.filter(n => Math.abs(n.t - i) >= 1e-6);
      if (!on && !pat.notes[ch.id].length) delete pat.notes[ch.id];
      paint(els[i], i);
    };
    let mode = null, changed = false;
    wrap.addEventListener('contextmenu', e => e.preventDefault());
    wrap.addEventListener('pointerdown', e => {
      const el = e.target.closest('.step');
      if (!el) return;
      e.preventDefault();
      wrap.setPointerCapture(e.pointerId);
      const i = +el.dataset.i;
      mode = e.button === 2 ? false : !findAt(i);
      set(i, mode);
      changed = true;
      if (mode) Engine.preview(ch, ch.root, this.lastStepVel, 0.2);
    });
    wrap.addEventListener('pointermove', e => {
      if (mode === null) return;
      const t = document.elementFromPoint(e.clientX, e.clientY);
      const el = t && t.closest && t.closest('.step');
      if (el && els.includes(el)) set(+el.dataset.i, mode);
    });
    const end = () => {
      if (mode !== null && changed) { History.commit('Шаги'); this.renderRoll(); this.renderPlaylist(); }
      mode = null; changed = false;
    };
    wrap.addEventListener('pointerup', end);
    wrap.addEventListener('pointercancel', end);
    wrap.addEventListener('wheel', e => {
      const el = e.target.closest('.step');
      if (!el) return;
      const n = findAt(+el.dataset.i);
      if (!n) return;
      e.preventDefault();
      n.v = clamp(Math.round((n.v + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100, 0.05, 1);
      this.lastStepVel = n.v;
      paint(el, +el.dataset.i);
      this.showValue('Громкость удара: ' + Math.round(n.v * 100) + '%');
      this._velC = this._velC || debounce(() => { History.commit('Громкость удара'); this.renderRoll(); }, 500);
      this._velC();
    }, { passive: false });
    return wrap;
  },

  miniRoll(ch, pat, groups, notes) {
    const w = groups * 105 - 3;
    const wrap = h('div', { class: 'steps mroll', style: { width: w + 'px' }, hint: 'Здесь мелодия из Piano Roll. Клик — открыть Piano Roll' });
    const cv = h('canvas', { style: { width: w + 'px' } });
    wrap.append(cv);
    wrap.addEventListener('click', () => { this.selectChannel(ch.id); this.openRoll(ch.id); });
    wrap.addEventListener('contextmenu', e => { e.preventDefault(); this.channelMenu(ch, e.clientX, e.clientY); });
    requestAnimationFrame(() => {
      const { c, w: W, h: H } = setupCanvas(cv);
      let lo = 127, hi = 0;
      for (const n of notes) { lo = Math.min(lo, n.n); hi = Math.max(hi, n.n); }
      if (hi - lo < 6) { const m = (hi + lo) / 2; lo = m - 3; hi = m + 3; }
      c.fillStyle = 'rgba(255,255,255,.035)';
      for (let g = 0; g < groups; g += 2) c.fillRect(g * 105, 0, 102, H);
      for (const n of notes) {
        const x = n.t / pat.len * W, ww = Math.max(2, n.d / pat.len * W - 1);
        const y = 3 + (1 - (n.n - lo) / (hi - lo)) * (H - 9);
        c.fillStyle = hexA(ch.color, 0.5 + n.v * 0.5);
        c.beginPath(); c.roundRect(x, y, ww, 3, 1.5); c.fill();
      }
    });
    return wrap;
  },

  addMenu(x, y) {
    this.menu(x, y, [
      { head: 'Добавить канал' },
      { label: 'Бочка', action: () => this.addChannel('drum', 'Kick Punch') },
      { label: 'Снейр', action: () => this.addChannel('drum', 'Snare Trap') },
      { label: 'Клэп', action: () => this.addChannel('drum', 'Clap') },
      { label: 'Хэт', action: () => this.addChannel('drum', 'Hi-Hat') },
      { label: '808', action: () => this.addChannel('bass808', 'Classic 808') },
      { label: 'Синтезатор', action: () => this.addChannel('synth', 'Pluck') },
      { label: 'Сэмплер (аудиофайл)…', action: () => this.pickSamples() },
      '-',
      { label: 'Больше звуков — в браузере слева', action: () => document.body.classList.add('bopen') },
    ]);
  },

  channelMenu(ch, x, y) {
    const pat = curPat();
    const fill = n => () => {
      const arr = [];
      for (let i = 0; i < pat.len; i += n) arr.push({ t: i, d: 1, n: ch.root, v: 0.8 });
      pat.notes[ch.id] = arr;
      History.commit('Заполнить');
      this.refreshNotes();
    };
    const shift = dir => () => {
      const arr = pat.notes[ch.id] || [];
      for (const n of arr) n.t = ((n.t + dir) % pat.len + pat.len) % pat.len;
      History.commit('Сдвиг');
      this.refreshNotes();
    };
    const idx = P.channels.indexOf(ch);
    this.menu(x, y, [
      { head: ch.name },
      { label: 'Открыть в Piano Roll', kbd: 'F7', action: () => { this.selectChannel(ch.id); this.openRoll(ch.id); } },
      { label: 'Настройки инструмента', action: () => this.openInstr(ch.id) },
      { label: 'Переименовать…', action: async () => { const n = await this.prompt('Имя канала', 'Название', ch.name); if (n) { ch.name = n; History.commit('Имя'); this.renderAll(); } } },
      { swatches: PALETTE, pick: c => { ch.color = c; History.commit('Цвет'); this.renderAll(); } },
      '-',
      { label: 'Заполнить каждые 2 шага', action: fill(2) },
      { label: 'Заполнить каждые 4 шага', action: fill(4) },
      { label: 'Заполнить каждые 8 шагов', action: fill(8) },
      { label: 'Сдвинуть на шаг влево', action: shift(-1) },
      { label: 'Сдвинуть на шаг вправо', action: shift(1) },
      { label: 'Очистить в этом паттерне', action: () => { delete pat.notes[ch.id]; History.commit('Очистить'); this.refreshNotes(); } },
      '-',
      { label: 'Клонировать канал', action: () => {
        const c = deep(ch); c.id = uid('c'); c.name = ch.name + ' 2';
        P.channels.splice(idx + 1, 0, c);
        if (pat.notes[ch.id]) pat.notes[c.id] = deep(pat.notes[ch.id]);
        Engine.graph && Engine.graph.syncChannels(); History.commit('Клон'); this.renderAll();
      } },
      { label: 'Переместить вверх', disabled: idx === 0, action: () => { P.channels.splice(idx, 1); P.channels.splice(idx - 1, 0, ch); History.commit('Порядок'); this.renderRack(); } },
      { label: 'Переместить вниз', disabled: idx === P.channels.length - 1, action: () => { P.channels.splice(idx, 1); P.channels.splice(idx + 1, 0, ch); History.commit('Порядок'); this.renderRack(); } },
      { label: 'Удалить канал', action: async () => {
        if (!(await this.confirm('Удалить канал?', `«${ch.name}» и все его ноты во всех паттернах будут удалены.`, 'Удалить'))) return;
        P.channels = P.channels.filter(c => c !== ch);
        for (const p of P.patterns) delete p.notes[ch.id];
        this.closeWin('ch-' + ch.id);
        Engine.graph && Engine.graph.syncChannels();
        History.commit('Удалить канал');
        this.renderAll();
      } },
    ]);
  },

  rackFrame() {
    let cur = -1;
    if (Engine.playing && Engine.mode === 'pattern') cur = Math.floor(Engine.displayPos());
    if (cur !== this.curStep) {
      for (const id in this.stepEls) {
        const els = this.stepEls[id];
        if (els[this.curStep]) els[this.curStep].classList.remove('cur');
        if (els[cur]) els[cur].classList.add('cur');
      }
      this.curStep = cur;
    }
    if (!Engine.ctx) return;
    const now = Engine.ctx.currentTime;
    const hits = Engine.hits;
    let k = 0;
    while (k < hits.length && hits[k].t <= now) k++;
    if (k) {
      for (let i = 0; i < k; i++) {
        const el = this.nameEls[hits[i].id];
        if (el) { el.classList.add('hit'); clearTimeout(el._ht); el._ht = setTimeout(() => el.classList.remove('hit'), 90); }
      }
      hits.splice(0, k);
    }
  },
});
