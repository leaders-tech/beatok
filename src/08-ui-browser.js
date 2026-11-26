Object.assign(UI, {
  bClosed: { tpl: false, drum: false, bass: false, synth: false, smp: false, fx: true },

  renderBrowser() {
    const B = $('#browser');
    const st = B.scrollTop;
    B.replaceChildren();
    const sec = (key, title, items) => {
      const s = h('div', { class: 'bsec' + (this.bClosed[key] ? ' closed' : '') });
      const hd = h('div', { class: 'bhead', role: 'button', tabindex: 0 }, h('span', { text: title }), ico('down'));
      hd.addEventListener('click', () => { this.bClosed[key] = !this.bClosed[key]; s.classList.toggle('closed'); });
      const list = h('div', { class: 'blist' });
      for (const it of items) list.append(it);
      s.append(hd, list);
      B.append(s);
    };
    const item = (name, color, onAdd, onPrev, hint) => {
      const el = h('div', { class: 'bitem', hint: hint || 'Клик — добавить в Channel Rack' }, h('i', { class: 'dot', style: { background: color } }), h('span', { class: 'nm', text: name }));
      if (onPrev) {
        const pv = h('button', { class: 'pv', 'aria-label': 'Прослушать ' + name, hint: 'Прослушать' }, ico('tri'));
        pv.addEventListener('click', e => { e.stopPropagation(); onPrev(); });
        el.append(pv);
      }
      el.addEventListener('click', onAdd);
      return el;
    };
    sec('tpl', 'Шаблоны битов', TEMPLATE_LIST.map(([k, n, d]) => {
      const el = h('div', { class: 'bitem tpl', hint: 'Загрузить шаблон вместо текущего проекта' }, h('b', { text: n }), h('small', { text: d }));
      el.addEventListener('click', () => this.loadTemplate(k));
      return el;
    }));
    sec('drum', 'Ударные', Object.keys(DRUM_PRESETS).map(n => item(n, TYPE_COLORS.drum, () => this.addChannel('drum', n), () => this.previewPreset('drum', n))));
    const bassSynths = ['Sub Bass', 'Reese Bass', 'Acid 303', 'Deep House Bass'];
    sec('bass', '808 и бас', [
      ...Object.keys(BASS_PRESETS).map(n => item(n, TYPE_COLORS.bass808, () => this.addChannel('bass808', n), () => this.previewPreset('bass808', n))),
      ...bassSynths.map(n => item(n, TYPE_COLORS.synth, () => this.addChannel('synth', n), () => this.previewPreset('synth', n, 36))),
    ]);
    sec('synth', 'Синтезаторы', Object.keys(SYNTH_PRESETS).filter(n => !bassSynths.includes(n)).map(n => item(n, TYPE_COLORS.synth, () => this.addChannel('synth', n), () => this.previewPreset('synth', n))));
    const smp = [];
    const drop = h('div', { class: 'drop', role: 'button', tabindex: 0, hint: 'WAV, MP3, OGG — станет каналом-сэмплером' }, 'Перетащи аудиофайл сюда или нажми, чтобы выбрать');
    drop.addEventListener('click', () => this.pickSamples());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); this.importSamples(e.dataTransfer.files); });
    smp.push(drop);
    for (const s of Samples.list()) smp.push(item(s.name, TYPE_COLORS.sampler, () => this.addSamplerChannel(s.id), () => this.previewSample(s.id)));
    sec('smp', 'Мои сэмплы', smp);
    sec('fx', 'Эффекты', Object.entries(FX_DEFS).map(([k, d]) => {
      const el = h('div', { class: 'bitem', hint: 'Добавить в выбранную дорожку микшера' }, h('i', { class: 'dot', style: { background: '#7ee081' } }), h('span', { class: 'nm', text: d.name }));
      el.addEventListener('click', () => { this.addFxTo(this.selIns, k); });
      return el;
    }));
    B.scrollTop = st;
  },

  previewPreset(type, preset, midi) {
    Engine.init();
    const params = presetParams(type, preset);
    const ctx = Engine.ctx, t = ctx.currentTime + 0.01;
    const m = midi != null ? midi : type === 'bass808' ? 36 : 60;
    const out = Engine.graph.inserts[0].input;
    const play = INSTR_PLAY[type];
    if (type === 'synth' && midi == null) {
      for (const n of [60, 64, 67]) play(ctx, out, params, t, n, 0.8, 0.7, {});
    } else play(ctx, out, params, t, m, 0.85, type === 'drum' ? 0.25 : 0.6, {});
  },

  previewSample(id) {
    Engine.init();
    const p = Object.assign(specDefaults(SAMPLER_SPEC), { sid: id });
    playSampler(Engine.ctx, Engine.graph.inserts[0].input, p, Engine.ctx.currentTime + 0.01, 60, 0.85, null);
  },

  addChannel(type, preset, extra) {
    const ch = makeChannel(P, type, preset, extra);
    P.channels.push(ch);
    if (Engine.graph) Engine.graph.syncChannels();
    this.selCh = ch.id;
    History.commit('Новый канал');
    this.renderRack();
    this.renderRoll();
    this.renderMixer();
    this.showTab('top', 'rack');
    this.toast(ch.name + ' добавлен → дорожка микшера ' + (ch.mixer || 'Master'));
    document.body.classList.remove('bopen');
    if (Engine.ctx) Engine.preview(ch);
    return ch;
  },

  addSamplerChannel(sid) {
    const s = Samples.map[sid];
    if (!s) return;
    return this.addChannel('sampler', null, { name: s.name.replace(/\.[^.]+$/, '').slice(0, 24), params: Object.assign(specDefaults(SAMPLER_SPEC), { sid }) });
  },

  pickSamples() {
    const inp = h('input', { type: 'file', accept: 'audio/*,.wav,.mp3,.ogg,.flac,.m4a,.aac', multiple: true, style: { display: 'none' } });
    inp.addEventListener('change', () => { this.importSamples(inp.files); inp.remove(); });
    document.body.append(inp);
    inp.click();
  },

  async importSamples(files) {
    const list = [...(files || [])].filter(f => /^audio\//.test(f.type) || /\.(wav|mp3|ogg|flac|m4a|aac|aif|aiff)$/i.test(f.name));
    if (!list.length) { this.toast('Это не аудиофайл'); return; }
    let last = null;
    for (const f of list) {
      if (f.size > 25 * 1024 * 1024) { this.toast(f.name + ': файл больше 25 МБ'); continue; }
      try {
        const id = await Samples.add(f.name, await f.arrayBuffer());
        last = this.addSamplerChannel(id);
      } catch (e) {
        this.toast('Не удалось прочитать ' + f.name);
      }
    }
    this.renderBrowser();
    if (last) this.openInstr(last.id);
  },

  async loadTemplate(key) {
    const hasWork = P.channels.length && P.patterns.some(p => Object.values(p.notes).some(a => a.length));
    if (hasWork && !(await this.confirm('Загрузить шаблон?', 'Текущий проект будет заменён. Если он нужен, сначала сохрани его (Файл → Сохранить).', 'Загрузить'))) return;
    const p = TEMPLATES[key]();
    await loadProjectData({ proj: p, samples: [] });
    this.selCh = null;
    document.body.classList.remove('bopen');
    this.toast('Шаблон «' + p.name + '» загружен. Жми пробел');
  },

  addFxTo(ins, type) {
    if (ins == null || !P.mixer[ins]) ins = 0;
    if (P.mixer[ins].fx.length >= 8) { this.toast('Максимум 8 эффектов на дорожку'); return; }
    addFx(P, ins, type);
    if (Engine.graph) Engine.graph.rebuildFx(ins);
    History.commit('Эффект');
    this.selIns = ins;
    this.showTab('bot', 'mixer');
    this.renderMixer();
    this.toast(FX_DEFS[type].name + ' → ' + this.insName(ins));
    document.body.classList.remove('bopen');
  },
});
