const safeName = s => (s || 'beat').replace(/[\\/:*?"<>|·]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'beat';

Object.assign(UI, {
  templatesDialog() {
    const body = h('div');
    body.append(h('p', { style: { margin: '0 0 8px', color: 'var(--dim)' }, text: 'С чего начать? Текущий проект будет заменён, поэтому сначала сохрани его, если он нужен.' }));
    const list = h('div', { class: 'plist' });
    let close;
    for (const [k, n, d] of TEMPLATE_LIST) {
      const it = h('button', { class: 'pitem', style: { cursor: 'pointer', textAlign: 'left' } }, h('span', { class: 'nm', text: n }), h('small', { text: d }));
      it.addEventListener('click', async () => {
        close(null);
        const p = TEMPLATES[k]();
        await loadProjectData({ proj: p, samples: [] });
        this.toast('Проект «' + p.name + '» создан');
      });
      list.append(it);
    }
    body.append(list);
    this.modal({ title: 'Новый проект', body, buttons: [{ label: 'Отмена', value: null }], mounted: (d, c) => { close = c; } });
  },

  async saveProject(asNew) {
    if (asNew) {
      const n = await this.prompt('Сохранить как', 'Название проекта', P.name + ' 2');
      if (!n) return;
      P.id = uid('prj');
      P.name = n;
      History.commit('Имя');
      this.updateTitle();
    }
    try {
      const r = await Store.save(P);
      this.toast((Store.mode === 'cloud' ? 'Сохранено в облако: ' : 'Сохранено в браузере: ') + P.name);
      if (r.dropped) this.modal({ title: 'Сохранено без сэмплов', body: 'Аудиофайлы сэмплов слишком большие, поэтому в списке проектов сохранились только ноты и настройки. Чтобы ничего не потерять, скачай файл проекта: Файл → Скачать файл проекта.', buttons: [{ label: 'Понятно', acc: true }] });
    } catch (e) {
      this.modal({ title: 'Не получилось сохранить', body: String(e && e.message || e), buttons: [{ label: 'Скачать файл проекта', action: () => this.downloadProject() }, { label: 'OK', acc: true }] });
    }
  },

  async projectsDialog() {
    const body = h('div');
    const status = h('p', { style: { margin: '0 0 6px', color: 'var(--dim)' }, text: 'Загружаю список…' });
    const list = h('div', { class: 'plist' });
    body.append(status, list);
    let close;
    const fill = async () => {
      let items;
      const timer = new Promise(r => setTimeout(() => r('timeout'), 10000));
      try { items = await Promise.race([Store.list(), timer]); } catch (e) { items = 'error'; }
      if (items === 'timeout' || items === 'error') { status.textContent = 'Не удалось получить список проектов. Проверь интернет и попробуй ещё раз.'; return; }
      status.textContent = Store.mode === 'cloud' ? 'Проекты в твоём аккаунте:' : 'Проекты в этом браузере:';
      list.replaceChildren();
      if (!items.length) list.append(h('div', { class: 'bnote', text: 'Пока пусто. Нажми «Сохранить текущий».' }));
      for (const m of items) {
        const d = new Date(m.updated);
        const it = h('div', { class: 'pitem' }, h('span', { class: 'nm', text: m.name }), h('small', { text: (m.bpm ? m.bpm + ' BPM · ' : '') + d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) }));
        const open = h('button', { class: 'btn small', text: 'Открыть' });
        open.addEventListener('click', async () => {
          try { const data = await Store.load(m.pid); close(null); await loadProjectData(data); this.toast('Открыт «' + m.name + '»'); }
          catch (e) { this.toast('Не удалось открыть: ' + (e.message || e)); }
        });
        const del = h('button', { class: 'btn small icon', 'aria-label': 'Удалить ' + m.name, hint: 'Удалить проект' }, ico('trash'));
        del.addEventListener('click', async () => {
          close(null);
          if (await this.confirm('Удалить проект?', `«${m.name}» будет удалён без возможности восстановить.`, 'Удалить')) {
            try { await Store.remove(m.pid); this.toast('Удалено'); } catch (e) { this.toast('Ошибка удаления'); }
          }
          this.projectsDialog();
        });
        it.append(open, del);
        list.append(it);
      }
    };
    this.modal({
      title: 'Мои проекты', body,
      buttons: [{ label: 'Открыть файл…', action: () => { this.openProjectFile(); } }, { label: 'Сохранить текущий', acc: true, action: () => { this.saveProject(); } }],
      mounted: (d, c) => { close = c; fill(); },
    });
  },

  exportDialog() {
    const body = h('div');
    const what = h('select', { id: 'expWhat' });
    const hasSong = P.playlist.clips.length > 0;
    what.append(h('option', { value: 'song', text: 'Весь трек (Playlist)', selected: hasSong }), h('option', { value: 'pattern', text: 'Текущий паттерн', selected: !hasSong }));
    const loops = h('select', { id: 'expLoops' });
    for (const n of [1, 2, 4, 8]) loops.append(h('option', { value: n, text: '×' + n, selected: n === 4 }));
    const bits = h('select', { id: 'expBits' });
    bits.append(h('option', { value: 16, text: 'WAV 16 бит' }), h('option', { value: 24, text: 'WAV 24 бит' }));
    const tail = h('select', { id: 'expTail' });
    for (const [v, l] of [[0.5, 'Короткий'], [2.5, '2.5 с'], [5, '5 с']]) tail.append(h('option', { value: v, text: l, selected: v === 2.5 }));
    const norm = h('input', { type: 'checkbox', id: 'expNorm', checked: true });
    const loopsField = h('div', { class: 'field' }, h('label', { for: 'expLoops', text: 'Повторов' }), loops);
    const upd = () => { loopsField.style.display = what.value === 'pattern' ? '' : 'none'; };
    what.addEventListener('change', upd);
    upd();
    const prog = h('div', { class: 'prog', style: { display: 'none' } }, h('b'));
    const note = h('p', { style: { color: 'var(--dim)', fontSize: '14px', margin: '6px 0 0' } });
    Caps.use('downloads').then(dl => { if (dl) note.textContent = 'Здесь, в Claude, WAV скачается внутри ZIP-архива: просто распакуй его.'; });
    body.append(
      h('div', { class: 'row' }, h('div', { class: 'field' }, h('label', { for: 'expWhat', text: 'Что сохранить' }), what), loopsField),
      h('div', { class: 'row' }, h('div', { class: 'field' }, h('label', { for: 'expBits', text: 'Формат' }), bits), h('div', { class: 'field' }, h('label', { for: 'expTail', text: 'Хвост реверба' }), tail)),
      h('label', { class: 'check' }, norm, 'Нормализовать громкость'),
      prog, note);
    let busy = false;
    this.modal({
      title: 'Экспорт аудио', body, sticky: true,
      buttons: [{ label: 'Отмена', value: null }, { label: 'Рендер и скачать', acc: true, action: async () => {
        if (busy) return false;
        busy = true;
        prog.style.display = 'block';
        const bar = prog.firstChild;
        bar.style.width = '3%';
        try {
          const buf = await Engine.render({ mode: what.value, loops: +loops.value, tail: +tail.value, normalize: norm.checked, onProgress: p => { bar.style.width = Math.round(5 + p * 90) + '%'; } });
          bar.style.width = '100%';
          const wav = encodeWav(buf, +bits.value);
          const name = await saveFile(safeName(P.name) + '.wav', wav, 'audio/wav');
          if (name) this.toast('Готово: ' + name + ' (' + fmtTime(buf.duration).slice(0, -3) + ')');
        } catch (e) {
          console.error(e);
          this.toast('Экспорт не удался: ' + (e.message || e.code || e));
        }
        busy = false;
        return null;
      } }],
    });
  },

  async exportMidi() {
    const mode = P.playlist.clips.length ? 'song' : 'pattern';
    try {
      const name = await saveFile(safeName(P.name) + '.mid', makeMidi(P, mode), 'audio/midi');
      if (name) this.toast('MIDI сохранён: ' + name);
    } catch (e) { this.toast('Не удалось сохранить MIDI'); }
  },

  async downloadProject() {
    const data = JSON.stringify({ app: 'BeatOk', v: 1, proj: P, samples: Samples.used(P) });
    try {
      const name = await saveFile(safeName(P.name) + '.beatok.json', data, 'application/json');
      if (name) this.toast('Файл проекта сохранён');
    } catch (e) { this.toast('Не удалось сохранить файл'); }
  },

  openProjectFile() {
    const inp = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    inp.addEventListener('change', async () => {
      const f = inp.files[0];
      inp.remove();
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data.proj && !data.channels) throw new Error('bad');
        await loadProjectData(data);
        this.toast('Открыт «' + P.name + '»');
      } catch (e) {
        this.modal({ title: 'Не получилось открыть', body: 'Это не файл проекта BeatOk.', buttons: [{ label: 'OK', acc: true }] });
      }
    });
    document.body.append(inp);
    inp.click();
  },

  helpDialog() {
    const rows = [
      ['Пробел', 'Играть / пауза'],
      ['F5 / F6 / F7 / F9', 'Playlist / Channel Rack / Piano Roll / Микшер'],
      ['Z S X D C V … M', 'Ноты нижней октавы (как пианино)'],
      ['Q 2 W 3 E R … P', 'Ноты верхней октавы'],
      ['[  ]', 'Октава ниже / выше'],
      ['Ctrl+Z / Ctrl+Y', 'Отменить / повторить'],
      ['Ctrl+S', 'Сохранить проект'],
      ['Ctrl+O', 'Мои проекты'],
      ['Piano Roll: клик', 'Нота (тяни вправо — длина)'],
      ['Правая кнопка', 'Стереть ноту, шаг или клип'],
      ['Ctrl + тянуть', 'Выделить рамкой'],
      ['Alt / Shift + тянуть', 'Копировать ноты / клипы'],
      ['Стрелки ↑ ↓', 'Транспонировать (Shift — на октаву)'],
      ['Стрелки ← →', 'Сдвинуть по сетке'],
      ['Ctrl+C / V / X / D', 'Копировать / вставить / вырезать / дублировать'],
      ['Ctrl+A / Ctrl+Q', 'Выделить всё / квантовать'],
      ['Delete', 'Удалить выделенные ноты'],
      ['Колесо', 'Прокрутка; Ctrl — масштаб; Shift — по горизонтали'],
      ['Ручки', 'Тянуть вверх/вниз, Shift — точно, двойной клик — сброс'],
    ];
    const g = h('div', { class: 'keys' });
    for (const [k, d] of rows) g.append(h('kbd', { text: k }), h('span', { text: d }));
    this.modal({ title: 'Горячие клавиши', body: g, buttons: [{ label: 'Закрыть', acc: true }] });
  },
});
