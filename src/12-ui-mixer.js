Object.assign(UI, {
  meterEls: [],
  meterPk: [],

  insName(i) {
    const m = P.mixer[i];
    if (!m) return '';
    if (i === 0) return 'Master';
    if (m.name) return m.name;
    const ch = P.channels.find(c => c.mixer === i);
    return ch ? ch.name : 'Дорожка ' + i;
  },

  renderMixer() {
    const v = $('#vMixer');
    const old = v.querySelector('.strips');
    const sl = old ? old.scrollLeft : 0;
    v.replaceChildren();
    const mx = h('div', { class: 'mx' + (this.fxOpen ? ' fxopen' : '') });
    const strips = h('div', { class: 'strips' });
    this.meterEls = [];
    for (let i = 0; i < P.mixer.length; i++) strips.append(this.strip(i));
    const fxp = h('div', { class: 'fxp' });
    this.renderFxPanel(fxp);
    mx.append(strips, fxp);
    v.append(mx);
    strips.scrollLeft = sl;
  },

  strip(i) {
    const m = P.mixer[i];
    const el = h('div', { class: 'strip' + (i === 0 ? ' master' : '') + (this.selIns === i ? ' on' : ''), hint: 'Клик — эффекты этой дорожки, двойной клик по имени — переименовать' });
    el.addEventListener('click', e => {
      if (e.target.closest('.knob,.fader,button')) return;
      this.selIns = i;
      this.fxOpen = true;
      this.renderMixer();
    });
    const nm = h('div', { class: 'sn', text: this.insName(i) });
    nm.addEventListener('dblclick', async () => {
      if (i === 0) return;
      const n = await this.prompt('Имя дорожки микшера', 'Название', this.insName(i));
      if (n) { m.name = n; History.commit('Имя'); this.renderMixer(); }
    });
    const pan = knob({ min: -1, max: 1, value: m.pan, def: 0, bipolar: true, size: 28, label: 'Пан', fmt: v => v === 0 ? 'центр' : (v < 0 ? 'L ' : 'R ') + Math.round(Math.abs(v) * 100), onInput: v => { m.pan = v; Engine.graph && Engine.graph.updateInsert(i); }, onCommit: () => History.commit('Пан') });
    const fw = h('div', { class: 'fadwrap' });
    const mL = h('div', { class: 'meter' }, h('b'));
    const mR = h('div', { class: 'meter' }, h('b'));
    const fad = h('div', { class: 'fader', hint: 'Громкость дорожки. Двойной клик — сброс' }, h('b'));
    const setF = () => {
      const pct = clamp(m.vol / 1.25, 0, 1) * 100;
      fad.firstChild.style.bottom = pct + '%';
      const db = m.vol > 0 ? (20 * Math.log10(m.vol)).toFixed(1) + ' dB' : '-∞';
      fad.dataset.hint = this.insName(i) + ': ' + db + ' · двойной клик — сброс';
      return db;
    };
    setF();
    let drag = null;
    fad.addEventListener('pointerdown', e => {
      fad.setPointerCapture(e.pointerId);
      const r = fad.getBoundingClientRect();
      drag = { r };
      const v = clamp((r.bottom - e.clientY) / r.height, 0, 1) * 1.25;
      m.vol = +v.toFixed(3);
      Engine.graph && Engine.graph.updateInsert(i);
      this.showValue(this.insName(i) + ': ' + setF());
    });
    fad.addEventListener('pointermove', e => {
      if (!drag) return;
      const v = clamp((drag.r.bottom - e.clientY) / drag.r.height, 0, 1) * 1.25;
      m.vol = +v.toFixed(3);
      Engine.graph && Engine.graph.updateInsert(i);
      this.showValue(this.insName(i) + ': ' + setF());
    });
    fad.addEventListener('pointerup', () => { if (drag) History.commit('Громкость'); drag = null; });
    fad.addEventListener('dblclick', () => { m.vol = 0.8; setF(); Engine.graph && Engine.graph.updateInsert(i); History.commit('Громкость'); });
    fad.addEventListener('wheel', e => { e.preventDefault(); m.vol = clamp(m.vol + (e.deltaY < 0 ? 0.02 : -0.02), 0, 1.25); setF(); Engine.graph && Engine.graph.updateInsert(i); this._fadC = this._fadC || debounce(() => History.commit('Громкость'), 500); this._fadC(); }, { passive: false });
    fw.append(mL, fad, mR);
    this.meterEls[i] = [mL.firstChild, mR.firstChild];
    const btns = h('div', { class: 'mbtns' });
    const mb = h('button', { class: 'm' + (m.mute ? ' on' : ''), text: 'M', 'aria-label': 'Заглушить', hint: 'Заглушить' });
    mb.addEventListener('click', () => { m.mute = !m.mute; Engine.graph && Engine.graph.updateAllInserts(); History.commit('Mute'); this.renderMixer(); });
    btns.append(mb);
    if (i > 0) {
      const sb = h('button', { class: 's' + (m.solo ? ' on' : ''), text: 'S', 'aria-label': 'Соло', hint: 'Соло' });
      sb.addEventListener('click', () => { const was = m.solo; for (const x of P.mixer) x.solo = false; m.solo = !was; Engine.graph && Engine.graph.updateAllInserts(); History.commit('Solo'); this.renderMixer(); });
      btns.append(sb);
    }
    const fxc = m.fx.length ? m.fx.length + 'fx' : '';
    el.append(nm, h('div', { class: 'si', text: (i === 0 ? 'M' : String(i)) + (fxc ? ' · ' + fxc : '') }), pan, fw, btns);
    return el;
  },

  renderFxPanel(fxp) {
    const i = clamp(this.selIns || 0, 0, P.mixer.length - 1);
    const m = P.mixer[i];
    const title = h('input', { type: 'text', value: this.insName(i), 'aria-label': 'Имя дорожки', disabled: i === 0 });
    title.addEventListener('change', () => { m.name = title.value.trim(); History.commit('Имя'); this.renderMixer(); });
    title.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') title.blur(); });
    const closeB = h('button', { class: 'x mobonly', 'aria-label': 'Закрыть', onclick: () => { this.fxOpen = false; this.renderMixer(); } }, ico('x'));
    fxp.append(h('h3', null, h('span', { class: 'lbl', text: i === 0 ? 'M' : String(i) }), title, closeB));
    const routed = P.channels.filter(c => c.mixer === i);
    if (i > 0) fxp.append(h('div', { class: 'routed', text: routed.length ? 'Сюда идут: ' + routed.map(c => c.name).join(', ') : 'Сюда пока не идёт ни один канал. Номер дорожки задаётся в Channel Rack.' }));
    const eq = h('div', { class: 'fxsec' });
    const eqb = h('div', { class: 'fxbody' });
    for (const [k, l] of [['low', 'Низ'], ['mid', 'Сер.'], ['high', 'Верх']]) {
      eqb.append(knob({ label: l, min: -15, max: 15, value: m.eq[k], def: 0, bipolar: true, fmt: fmtDb, size: 34, onInput: v => { m.eq[k] = v; Engine.graph && Engine.graph.updateInsert(i); }, onCommit: () => History.commit('EQ') }));
    }
    eq.append(h('div', { class: 'fxhd' }, h('span', { class: 'nm', text: 'Быстрый EQ' })), eqb);
    fxp.append(eq);
    m.fx.forEach((slot, k) => fxp.append(this.fxSlot(i, slot, k)));
    const addSel = h('select', { class: 'sel', style: { width: '100%', maxWidth: 'none', height: '32px' }, 'aria-label': 'Добавить эффект' });
    addSel.append(h('option', { value: '', text: '+ Добавить эффект…' }));
    for (const [k, d] of Object.entries(FX_DEFS)) addSel.append(h('option', { value: k, text: d.name }));
    addSel.addEventListener('change', () => { if (addSel.value) this.addFxTo(i, addSel.value); });
    addSel.addEventListener('keydown', e => e.stopPropagation());
    fxp.append(addSel);
  },

  fxSlot(i, slot, k) {
    const m = P.mixer[i];
    const def = FX_DEFS[slot.type];
    const sec = h('div', { class: 'fxsec' + (slot.on ? '' : ' off') + (slot.fold ? ' fold' : '') });
    const pw = h('div', { class: 'pw' + (slot.on ? ' on' : ''), role: 'switch', 'aria-checked': String(slot.on), hint: 'Включить / выключить эффект' });
    pw.addEventListener('click', () => { slot.on = !slot.on; Engine.graph && Engine.graph.rebuildFx(i); History.commit('Эффект'); this.renderMixer(); });
    const nm = h('span', { class: 'nm', text: def.name, hint: 'Клик — свернуть / развернуть' });
    nm.addEventListener('click', () => { slot.fold = !slot.fold; sec.classList.toggle('fold'); });
    const mv = d => () => { const j = k + d; if (j < 0 || j >= m.fx.length) return; m.fx.splice(k, 1); m.fx.splice(j, 0, slot); Engine.graph && Engine.graph.rebuildFx(i); History.commit('Порядок'); this.renderMixer(); };
    const up = h('button', { 'aria-label': 'Выше', hint: 'Выше в цепочке', onclick: mv(-1) }, ico('up'));
    const dn = h('button', { 'aria-label': 'Ниже', hint: 'Ниже в цепочке', onclick: mv(1) }, ico('down'));
    const rm = h('button', { 'aria-label': 'Удалить', hint: 'Удалить эффект', onclick: () => { m.fx.splice(k, 1); Engine.graph && Engine.graph.rebuildFx(i); History.commit('Удалить эффект'); this.renderMixer(); } }, ico('x'));
    sec.append(h('div', { class: 'fxhd' }, pw, nm, up, dn, rm));
    const body = h('div', { class: 'fxbody' });
    for (const sp of def.params) {
      const heavy = slot.type === 'reverb' && sp.id === 'size';
      body.append(paramControl(sp, slot.p[sp.id], v => {
        slot.p[sp.id] = v;
        if (!heavy && slot.on && Engine.graph) Engine.graph.updateFx(i, slot);
      }, () => {
        if (slot.on && Engine.graph) Engine.graph.updateFx(i, slot);
        History.commit('Эффект');
      }, 34));
    }
    sec.append(body);
    return sec;
  },

  mixerFrame() {
    if (this.botTab !== 'mixer' || !Engine.graph) return;
    for (let i = 0; i < this.meterEls.length; i++) {
      const els = this.meterEls[i];
      if (!els) continue;
      const [l, r] = Engine.graph.meter(i);
      const pk = this.meterPk[i] || (this.meterPk[i] = [0, 0]);
      [l, r].forEach((v, k) => {
        const db = v > 0 ? 20 * Math.log10(v) : -90;
        const n = clamp((db + 48) / 51, 0, 1);
        pk[k] = Math.max(n, pk[k] - 0.025);
        const hgt = els[k].parentNode.clientHeight;
        els[k].style.height = (pk[k] * 100).toFixed(1) + '%';
        els[k].style.setProperty('--mh', hgt + 'px');
      });
    }
  },
});
