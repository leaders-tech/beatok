Object.assign(UI, {
  topTab: 'rack',
  botTab: 'playlist',
  selCh: null,
  selIns: 1,
  snap: '1',
  timeMode: 0,

  buildTop() {
    const top = $('#top');
    top.replaceChildren();
    const logo = h('div', { class: 'logo', hint: 'Bt Studio' }, h('i', null, ico('play')), h('span', { text: 'Bt' }));
    const bt = h('button', { class: 'btn icon mobonly', 'aria-label': 'Звуки и шаблоны', hint: 'Открыть браузер звуков', onclick: () => document.body.classList.toggle('bopen') }, ico('menu'));
    const file = h('button', { class: 'btn ghost', id: 'btnFile', hint: 'Проекты, шаблоны, экспорт' }, 'Файл');
    file.addEventListener('click', () => { const r = file.getBoundingClientRect(); this.fileMenu(r.left, r.bottom + 4); });
    this.bLearn = h('button', { class: 'btn ghost' + (this.learnOpen ? ' on' : ''), id: 'btnLearn', hint: 'Пошаговые уроки: джерк, плаг и как устроен Bt', onclick: () => this.toggleLearn() }, ico('learn'), h('span', { class: 'hide-s', text: 'Обучение' }));
    this.bUndo = h('button', { class: 'btn icon ghost', 'aria-label': 'Отменить', hint: 'Отменить (Ctrl+Z)', onclick: () => History.undo() }, ico('undo'));
    this.bRedo = h('button', { class: 'btn icon ghost', 'aria-label': 'Повторить', hint: 'Повторить (Ctrl+Y)', onclick: () => History.redo() }, ico('redo'));
    const seg = h('div', { class: 'seg', 'data-learn': 'mode', hint: 'Что играет: только текущий паттерн или весь трек из Playlist' });
    this.bPat = h('button', { text: 'Паттерн', onclick: () => Engine.setMode('pattern') });
    this.bSong = h('button', { text: 'Трек', onclick: () => Engine.setMode('song') });
    seg.append(this.bPat, this.bSong);
    this.bPlay = h('button', { class: 'btn icon play', 'aria-label': 'Играть', hint: 'Играть / пауза (пробел)', onclick: () => Engine.toggle() }, ico('play'));
    const bStop = h('button', { class: 'btn icon', 'aria-label': 'Стоп', hint: 'Стоп и в начало', onclick: () => Engine.stop() }, ico('stop'));
    this.bRec = h('button', { class: 'btn icon rec', 'aria-label': 'Запись', hint: 'Запись нот с клавиатуры в текущий паттерн (выбранный канал)', onclick: () => { Engine.recording = !Engine.recording; this.onTransport(); if (Engine.recording && !Engine.playing) this.toast('Включи воспроизведение и играй на клавишах Z…M / Q…P'); } }, ico('rec'));
    this.bMetro = h('button', { class: 'btn icon hide-s', 'aria-label': 'Метроном', hint: 'Метроном', onclick: () => { Engine.metro = !Engine.metro; this.onTransport(); } }, ico('metro'));
    this.bLoop = h('button', { class: 'btn icon', 'aria-label': 'Повтор трека', hint: 'Зациклить трек в режиме «Трек»', onclick: () => { Engine.loopSong = !Engine.loopSong; this.onTransport(); } }, ico('loop'));
    this.lcdTime = h('div', { class: 'lcd time', hint: 'Позиция: такт.доля и время. Клик — сменить вид', onclick: () => { this.timeMode ^= 1; } });
    this.lcdBpm = h('div', { class: 'lcd bpm', hint: 'Темп: тяни вверх/вниз, колесо, двойной клик — ввести число' });
    this.setupBpm();
    this.kSwing = knob({ min: 0, max: 100, value: P.swing, def: 0, step: 1, fmt: v => Math.round(v) + '%', size: 26, hint: 'Свинг: сдвигает чётные шестнадцатые', onInput: v => { P.swing = v; }, onCommit: () => History.commit('Свинг') });
    const pg = h('div', { class: 'grp', 'data-learn': 'patsel', hint: 'Текущий паттерн' });
    this.patSel = h('select', { class: 'sel', 'aria-label': 'Паттерн' });
    this.patSel.addEventListener('change', () => { this.selectPattern(this.patSel.value); });
    this.patSel.addEventListener('keydown', e => e.stopPropagation());
    pg.append(this.patSel,
      h('button', { class: 'btn icon small ghost', 'aria-label': 'Новый паттерн', hint: 'Новый пустой паттерн', onclick: () => this.newPattern() }, ico('plus')),
      h('button', { class: 'btn icon small ghost', 'aria-label': 'Действия с паттерном', hint: 'Переименовать, клонировать, удалить', onclick: e => { const r = e.currentTarget.getBoundingClientRect(); this.patternMenu(curPat(), r.left, r.bottom + 4); } }, ico('menu')));
    this.kMaster = knob({ min: 0, max: 1.2, value: P.masterVol, def: 0.85, fmt: fmtPct, size: 26, hint: 'Громкость мастера', onInput: v => { P.masterVol = v; Engine.graph && Engine.graph.setMaster(); }, onCommit: () => History.commit('Мастер') });
    this.spec = h('canvas', { id: 'spec', hint: 'Спектр мастер-выхода' });
    const exp = h('button', { class: 'btn acc', 'data-learn': 'export', hint: 'Сохранить бит в WAV или MIDI', onclick: () => this.exportDialog() }, ico('dl'), h('span', { class: 'hide-s', text: 'Экспорт' }));
    this.storeBadge = $('#hint .store') || h('div', { class: 'store', hint: '' }, h('i'), h('span'));
    top.append(bt, logo, file, this.bLearn, h('div', { class: 'grp' }, this.bUndo, this.bRedo), h('div', { class: 'sep hide-s' }),
      seg, h('div', { class: 'grp' }, this.bPlay, bStop, this.bRec, this.bMetro, this.bLoop), this.lcdTime, this.lcdBpm, h('div', { class: 'tk', 'data-learn': 'swing' }, h('span', { text: 'Свинг' }), this.kSwing),
      h('div', { class: 'sep hide-s' }), pg, h('div', { class: 'grow' }), h('div', { class: 'tk' }, h('span', { text: 'Мастер' }), this.kMaster), this.spec, exp);
    $('#hint').append(this.storeBadge);
    this.onTransport();
    this.updateUndo();
    this.updateStoreBadge();
  },

  setupBpm() {
    const el = this.lcdBpm;
    const show = () => { if (!el.querySelector('input')) el.replaceChildren(h('span', { text: P.bpm.toFixed(1) }), h('small', { text: 'BPM' })); };
    this.showBpm = show;
    show();
    let drag = null;
    el.addEventListener('pointerdown', e => {
      if (el.querySelector('input')) return;
      el.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, b: P.bpm, moved: false };
    });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      const dy = drag.y - e.clientY;
      if (Math.abs(dy) > 2) drag.moved = true;
      if (!drag.moved) return;
      Engine.setBpm(e.shiftKey ? drag.b + dy * 0.1 : Math.round(drag.b + dy * 0.5));
      show();
    });
    el.addEventListener('pointerup', () => { if (drag && drag.moved) History.commit('Темп'); drag = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); Engine.setBpm(P.bpm + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 0.1 : 1)); show(); this._bpmC = this._bpmC || debounce(() => History.commit('Темп'), 500); this._bpmC(); }, { passive: false });
    el.addEventListener('dblclick', () => {
      const inp = h('input', { type: 'number', value: P.bpm, min: 30, max: 300, step: 0.1, 'aria-label': 'Темп' });
      el.replaceChildren(inp, h('small', { text: 'BPM' }));
      inp.focus();
      inp.select();
      const done = ok => { const v = parseFloat(inp.value); el.replaceChildren(); if (ok && v > 0) { Engine.setBpm(v); History.commit('Темп'); } show(); };
      inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
      inp.addEventListener('blur', () => done(true));
    });
  },

  onTransport() {
    if (!this.bPlay) return;
    this.bPlay.classList.toggle('on', Engine.playing);
    this.bPlay.replaceChildren(ico(Engine.playing ? 'stop' : 'play'));
    this.bPlay.firstChild.innerHTML = Engine.playing ? '<path d="M4 2.5h3v11H4zm5 0h3v11H9z"/>' : ICONS.play;
    this.bRec.classList.toggle('on', Engine.recording);
    this.bMetro.classList.toggle('on', Engine.metro);
    this.bLoop.classList.toggle('on', Engine.loopSong);
    this.bPat.classList.toggle('on', Engine.mode === 'pattern');
    this.bSong.classList.toggle('on', Engine.mode === 'song');
  },

  updateUndo() {
    if (!this.bUndo) return;
    this.bUndo.disabled = History.idx <= 0;
    this.bRedo.disabled = History.idx >= History.stack.length - 1;
  },

  updateStoreBadge() {
    if (!this.storeBadge) return;
    const cloud = Store.mode === 'cloud';
    this.storeBadge.classList.toggle('cloud', cloud);
    this.storeBadge.lastChild.textContent = cloud ? 'Облако' : 'В браузере';
    this.storeBadge.dataset.hint = cloud ? 'Проекты сохраняются в твоём аккаунте Claude и доступны с любого устройства' : 'Проекты сохраняются в этом браузере. Для переноса используй «Файл → Скачать файл проекта»';
  },

  fillPatSel() {
    if (!this.patSel) return;
    this.patSel.replaceChildren();
    for (const p of P.patterns) {
      const o = h('option', { value: p.id, text: p.name });
      if (p.id === P.curPat) o.selected = true;
      this.patSel.append(o);
    }
  },

  selectPattern(id) {
    P.curPat = id;
    this.fillPatSel();
    this.renderRack();
    this.renderRoll();
    this.renderPlaylist();
  },

  newPattern() {
    const p = makePattern(P);
    P.patterns.push(p);
    P.curPat = p.id;
    History.commit('Новый паттерн');
    this.fillPatSel();
    this.renderRack();
    this.renderRoll();
    this.renderPlaylist();
    this.toast(p.name + ' создан');
  },

  patternMenu(pat, x, y) {
    if (!pat) return;
    this.menu(x, y, [
      { head: pat.name },
      { label: 'Переименовать…', action: async () => { const n = await this.prompt('Имя паттерна', 'Название', pat.name); if (n) { pat.name = n; History.commit('Имя'); this.renderAll(); } } },
      { label: 'Клонировать', action: () => {
        const c = deep(pat); delete c.role; c.id = uid('p'); c.name = pat.name + ' (копия)'; c.color = PALETTE[P.patterns.length % PALETTE.length];
        P.patterns.splice(P.patterns.indexOf(pat) + 1, 0, c); P.curPat = c.id; History.commit('Клон'); this.renderAll();
      } },
      { label: 'Очистить ноты', action: () => { pat.notes = {}; History.commit('Очистить'); this.renderAll(); } },
      { swatches: PALETTE, pick: c => { pat.color = c; History.commit('Цвет'); this.renderAll(); } },
      '-',
      { label: 'Удалить паттерн', disabled: P.patterns.length < 2, action: async () => {
        if (!(await this.confirm('Удалить паттерн?', `«${pat.name}» и все его клипы в Playlist будут удалены.`, 'Удалить'))) return;
        P.patterns = P.patterns.filter(p => p !== pat);
        P.playlist.clips = P.playlist.clips.filter(c => c.p !== pat.id);
        if (P.curPat === pat.id) P.curPat = P.patterns[0].id;
        History.commit('Удалить паттерн');
        this.renderAll();
      } },
    ]);
  },

  fileMenu(x, y) {
    this.menu(x, y, [
      { label: 'Новый проект…', action: () => this.templatesDialog() },
      { label: 'Мои проекты…', kbd: 'Ctrl+O', action: () => this.projectsDialog() },
      { label: 'Сохранить', kbd: 'Ctrl+S', action: () => this.saveProject() },
      { label: 'Сохранить как…', action: () => this.saveProject(true) },
      { label: 'Переименовать проект…', action: async () => { const n = await this.prompt('Название проекта', 'Название', P.name); if (n) { P.name = n; History.commit('Имя'); this.updateTitle(); } } },
      '-',
      { label: 'Экспорт аудио (WAV)…', action: () => this.exportDialog() },
      { label: 'Экспорт MIDI', action: () => this.exportMidi() },
      { label: 'Скачать файл проекта (.json)', action: () => this.downloadProject() },
      { label: 'Открыть файл проекта…', action: () => this.openProjectFile() },
      '-',
      { label: 'Горячие клавиши', kbd: 'F1', action: () => this.helpDialog() },
    ]);
  },

  updateTitle() {
    document.title = (P.name ? P.name + ' · ' : '') + 'Bt Studio';
  },

  drawSpectrum() {
    const cv = this.spec;
    if (!cv || !cv.offsetWidth) return;
    const { c, w, h: hh } = setupCanvas(cv);
    c.clearRect(0, 0, w, hh);
    const an = Engine.graph && Engine.graph.analyser;
    const n = 28;
    const bw = w / n;
    if (!an) {
      c.fillStyle = '#2f3039';
      for (let i = 0; i < n; i++) c.fillRect(i * bw + 1, hh - 6, bw - 2, 2);
      return;
    }
    if (!this._fd || this._fd.length !== an.frequencyBinCount) this._fd = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(this._fd);
    const sr = Engine.ctx.sampleRate, bins = this._fd.length;
    for (let i = 0; i < n; i++) {
      const f0 = 30 * Math.pow(18000 / 30, i / n), f1 = 30 * Math.pow(18000 / 30, (i + 1) / n);
      const b0 = Math.floor(f0 / (sr / 2) * bins), b1 = Math.max(b0 + 1, Math.floor(f1 / (sr / 2) * bins));
      let m = 0;
      for (let b = b0; b < b1 && b < bins; b++) m = Math.max(m, this._fd[b]);
      const v = m / 255;
      const bh = Math.max(2, v * (hh - 10));
      c.fillStyle = v > 0.88 ? '#ff5d6c' : hexA('#ff6b3d', 0.35 + v * 0.65);
      c.fillRect(i * bw + 1, hh - bh - 5, bw - 2, bh);
    }
  },

  drawTime() {
    if (!this.lcdTime) return;
    const pos = Engine.displayPos();
    const sd = 60 / P.bpm / 4;
    const bar = Math.floor(pos / 16) + 1, beat = Math.floor((pos % 16) / 4) + 1, st = Math.floor(pos % 4) + 1;
    const txt = this.timeMode ? fmtTime(pos * sd) : `${bar}.${beat}.${st}`;
    const sub = this.timeMode ? `${bar}.${beat}` : fmtTime(pos * sd).slice(0, -3);
    if (this._lt !== txt + sub) {
      this._lt = txt + sub;
      this.lcdTime.replaceChildren(h('span', { text: txt }), h('small', { text: sub }));
    }
  },
});
