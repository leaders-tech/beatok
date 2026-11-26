Object.assign(UI, {
  openInstr(id) {
    const ch = chById(id);
    if (!ch) return;
    this.selCh = id;
    this.win('ch-' + id, {
      title: ch.name + ' · ' + INSTR_NAMES[ch.type],
      color: ch.color,
      w: ch.type === 'synth' ? 760 : 580,
      render: body => this.renderInstr(body, id),
    });
  },

  refreshInstrWins() {
    for (const id of Object.keys(this.wins)) {
      if (!id.startsWith('ch-')) continue;
      const ch = chById(id.slice(3));
      if (!ch) this.closeWin(id);
      else { this.wins[id].o.title = ch.name + ' · ' + INSTR_NAMES[ch.type]; this.wins[id].o.color = ch.color; this.renderWin(id); }
    }
  },

  renderInstr(body, id) {
    const ch = chById(id);
    if (!ch) return;
    const table = ch.type === 'synth' ? SYNTH_PRESETS : ch.type === 'bass808' ? BASS_PRESETS : ch.type === 'drum' ? DRUM_PRESETS : null;
    const top = h('div', { class: 'irow' });
    if (table) {
      const opts = Object.keys(table).map(k => [k, k]);
      if (!table[ch.preset]) opts.unshift([ch.preset || '', ch.preset ? ch.preset + ' (изменён)' : 'Свой звук']);
      const ps = optSelect(opts, ch.preset || '', name => {
        if (!table[name]) return;
        ch.params = presetParams(ch.type, name);
        ch.preset = name;
        if (ch.type === 'synth') ch.mono = ch.params.glide > 0;
        if (ch.type === 'drum') ch.cut = ch.params.kind === 'hat' || ch.params.kind === 'ohat' ? 1 : 0;
        History.commit('Пресет');
        this.renderWin('ch-' + id);
        Engine.preview(ch, null, 0.85, 0.5);
      });
      ps.style.maxWidth = '200px';
      ps.dataset.hint = 'Пресет звука';
      top.append(h('span', { class: 'lbl', text: 'Пресет' }), ps);
    }
    const ins = optSelect(P.mixer.map((m, i) => [i, (i === 0 ? 'Master' : i + ' · ' + this.insName(i))]), ch.mixer, v => { ch.mixer = +v; Engine.graph && Engine.graph.updateChannel(ch); History.commit('Маршрут'); this.renderRack(); this.renderMixer(); });
    ins.dataset.hint = 'В какую дорожку микшера идёт звук';
    top.append(h('span', { class: 'lbl', text: 'Микшер' }), ins);
    const monoB = h('button', { class: 'btn small' + (ch.mono ? ' on' : ''), text: 'Моно', hint: 'Новая нота обрывает предыдущую; при перекрытии нот — глайд' });
    monoB.addEventListener('click', () => { ch.mono = !ch.mono; monoB.classList.toggle('on', ch.mono); History.commit('Моно'); });
    top.append(monoB);
    if (ch.type === 'drum' || ch.type === 'sampler') {
      const cut = optSelect([[0, 'Нет'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], ch.cut, v => { ch.cut = +v; History.commit('Группа'); });
      cut.dataset.hint = 'Группа глушения: звуки одной группы обрывают друг друга (закрытый хэт глушит открытый)';
      top.append(h('span', { class: 'lbl', text: 'Глушение' }), cut);
    }
    top.append(h('button', { class: 'btn small', hint: 'Ноты этого канала в Piano Roll', onclick: () => { this.selectChannel(ch.id); this.openRoll(ch.id); } }, ico('piano'), 'Piano Roll'));
    top.append(h('button', { class: 'btn small', hint: 'Переименовать канал', onclick: async () => { const n = await this.prompt('Имя канала', 'Название', ch.name); if (n) { ch.name = n; History.commit('Имя'); this.renderAll(); } } }, 'Имя'));
    body.append(top);
    const common = h('div', { class: 'irow knobs' });
    common.append(
      knob({ label: 'Громк.', min: 0, max: 1.25, value: ch.vol, def: 0.8, fmt: fmtPct, size: 34, onInput: v => { ch.vol = v; Engine.graph && Engine.graph.updateChannel(ch); }, onCommit: () => { History.commit('Громкость'); this.renderRack(); } }),
      knob({ label: 'Пан', min: -1, max: 1, value: ch.pan, def: 0, bipolar: true, size: 34, fmt: v => v === 0 ? 'центр' : (v < 0 ? 'L ' : 'R ') + Math.round(Math.abs(v) * 100), onInput: v => { ch.pan = v; Engine.graph && Engine.graph.updateChannel(ch); }, onCommit: () => { History.commit('Панорама'); this.renderRack(); } }),
      knob({ label: 'Нота шагов', min: 12, max: 108, value: ch.root, def: ch.type === 'bass808' ? 36 : 60, step: 1, size: 34, fmt: noteName, hint: 'Какой нотой звучат шаги в Channel Rack', onInput: v => {
        const pat = curPat(); const old = ch.root;
        ch.root = v;
        for (const p of P.patterns) for (const n of p.notes[ch.id] || []) if (n.n === old && Math.abs(n.t - Math.round(n.t)) < 1e-6 && n.d <= 1.001) n.n = v;
        void pat;
      }, onCommit: () => { History.commit('Нота шагов'); this.renderRack(); Engine.preview(ch, ch.root, 0.85, 0.3); } }),
    );
    body.append(common);
    if (ch.type === 'sampler') body.append(this.samplerBox(ch));
    const grid = h('div', { class: 'igrid' });
    const spec = INSTR_SPECS[ch.type];
    for (const g of spec) {
      const sec = h('div', { class: 'isec' });
      sec.append(h('h4', { text: g.group }));
      const ks = h('div', { class: 'ks' });
      let envCv = null;
      const redrawEnv = () => envCv && this.drawEnv(envCv, ch.params, g.env);
      for (const sp of g.params) {
        ks.append(paramControl(sp, ch.params[sp.id], v => { ch.params[sp.id] = v; redrawEnv(); if (sp.id === 'kind') { ch.cut = v === 'hat' || v === 'ohat' ? 1 : 0; } }, () => { History.commit('Звук'); if (ch.type === 'sampler') this.renderWin('ch-' + id); else if (sp.options) Engine.preview(ch, null, 0.85, 0.4); }, 36));
      }
      sec.append(ks);
      if (g.env) { envCv = h('canvas', { class: 'envcv' }); sec.append(envCv); requestAnimationFrame(redrawEnv); }
      grid.append(sec);
    }
    body.append(grid);
    const base = ch.type === 'bass808' ? 24 : ch.type === 'drum' ? 48 : 48;
    body.append(pianoKeys(ch.type === 'drum' ? 2 : 3, base, m => Engine.noteOn(ch, m, 0.85), m => Engine.noteOff(ch, m)));
    body.append(h('div', { class: 'lbl', style: { marginTop: '6px' }, text: 'Играть можно и с клавиатуры компьютера: Z…M и Q…P, октава — [ и ]' }));
  },

  drawEnv(cv, p, kind) {
    if (!cv.isConnected) return;
    const { c, w: W, h: H } = setupCanvas(cv);
    const a = kind === 'f' ? p.fa : p.a, d = kind === 'f' ? p.fd : p.d, s = kind === 'f' ? p.fs : p.s, r = kind === 'f' ? p.fr : p.r;
    const hold = Math.max(0.15, (a + d + r) * 0.25);
    const tot = a + d + hold + r;
    const X = t => 4 + (t / tot) * (W - 8), Y = v => H - 4 - v * (H - 10);
    c.clearRect(0, 0, W, H);
    c.beginPath();
    c.moveTo(X(0), Y(0));
    c.lineTo(X(a), Y(1));
    for (let i = 1; i <= 20; i++) { const t = i / 20; c.lineTo(X(a + d * t), Y(1 + (s - 1) * (1 - Math.pow(1 - t, 3)))); }
    c.lineTo(X(a + d + hold), Y(s));
    for (let i = 1; i <= 20; i++) { const t = i / 20; c.lineTo(X(a + d + hold + r * t), Y(s * Math.pow(1 - t, 3))); }
    c.strokeStyle = '#ff6b3d';
    c.lineWidth = 1.5;
    c.stroke();
    c.lineTo(X(tot), Y(0));
    c.lineTo(X(0), Y(0));
    c.fillStyle = 'rgba(255,107,61,.12)';
    c.fill();
  },

  samplerBox(ch) {
    const sec = h('div', { class: 'isec', style: { marginBottom: '8px' } });
    const row = h('div', { class: 'irow', style: { marginBottom: '0' } });
    const list = Samples.list();
    const sel = optSelect([['', list.length ? 'Выбери сэмпл' : 'Сэмплов пока нет'], ...list.map(s => [s.id, s.name])], ch.params.sid || '', v => { ch.params.sid = v; History.commit('Сэмпл'); this.renderWin('ch-' + ch.id); Engine.preview(ch, ch.params.root, 0.85, 0.6); });
    sel.style.maxWidth = '260px';
    const load = h('button', { class: 'btn small', onclick: () => {
      const inp = h('input', { type: 'file', accept: 'audio/*', style: { display: 'none' } });
      inp.addEventListener('change', async () => {
        const f = inp.files[0];
        inp.remove();
        if (!f) return;
        try {
          const id = await Samples.add(f.name, await f.arrayBuffer());
          ch.params.sid = id;
          if (/^(Сэмплер|Sampler)/.test(ch.name)) ch.name = f.name.replace(/\.[^.]+$/, '').slice(0, 24);
          History.commit('Сэмпл');
          this.renderBrowser();
          this.renderRack();
          this.renderWin('ch-' + ch.id);
        } catch (e) { this.toast('Не удалось прочитать файл'); }
      });
      document.body.append(inp);
      inp.click();
    } }, ico('folder'), 'Загрузить аудио');
    row.append(h('span', { class: 'lbl', text: 'Сэмпл' }), sel, load);
    sec.append(h('h4', { text: 'Аудио' }), row);
    const cv = h('canvas', { class: 'wavecv' });
    sec.append(cv);
    requestAnimationFrame(() => {
      if (!cv.isConnected) return;
      const { c, w: W, h: H } = setupCanvas(cv);
      const pk = Samples.peaks(ch.params.sid, Math.floor(W));
      c.fillStyle = '#16171b';
      c.fillRect(0, 0, W, H);
      if (!pk) {
        c.fillStyle = '#5d5f69';
        c.font = '500 13px Inter, sans-serif';
        c.fillText(Samples.map[ch.params.sid] ? '' : 'Загрузи WAV/MP3 или перетащи файл в окно', 12, H / 2);
        return;
      }
      const s0 = ch.params.start * W, s1 = ch.params.end * W;
      c.fillStyle = 'rgba(180,140,255,.08)';
      c.fillRect(s0, 0, s1 - s0, H);
      for (let x = 0; x < pk.length; x++) {
        const v = pk[x] * (H / 2 - 6);
        c.fillStyle = x >= s0 && x <= s1 ? ch.color : '#3a3c45';
        c.fillRect(x, H / 2 - v, 1, v * 2 + 1);
      }
      c.fillStyle = '#ececef';
      c.fillRect(s0, 0, 2, H);
      c.fillRect(s1 - 2, 0, 2, H);
    });
    return sec;
  },
});
