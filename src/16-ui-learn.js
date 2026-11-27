const LX = {
  ch: (p, r) => p.channels.find(c => c.role === r) || null,
  pat: (p, r) => p.patterns.find(x => x.role === r) || null,
  notes: (pat, ch) => (pat && ch && pat.notes[ch.id]) || [],
  set: (pat, ch, arr) => { if (pat && ch) pat.notes[ch.id] = arr; },
  minorish: s => ['minor', 'harm', 'phryg', 'penmin', 'dorian', 'blues'].includes(s),
  r808: p => { let r = 24 + p.key; if (r < 28) r += 12; return r; },
  rMel: p => { let r = 60 + p.key; if (r < 64) r += 12; return r; },
  rKeys: p => { let r = 48 + p.key; if (r < 52) r += 12; return r; },
  inScale: (p, n) => { const sc = (SCALES[p.scale] || SCALES.minor)[1]; return !sc.length || sc.includes(((n - p.key) % 12 + 12) % 12); },
  glide: arr => {
    const s = [...arr].sort((a, b) => a.t - b.t);
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length && s[j].t < s[i].t + s[i].d - 1e-6; j++) if (s[j].t > s[i].t + 1e-6 && s[j].n !== s[i].n) return true;
    return false;
  },
  chords: arr => {
    const gs = [];
    for (const n of [...arr].sort((a, b) => a.t - b.t)) {
      const g = gs[gs.length - 1];
      if (g && n.t - g[0].t <= 0.5) g.push(n); else gs.push([n]);
    }
    return gs.filter(g => new Set(g.map(n => n.n)).size >= 3);
  },
  others: (p, role) => p.patterns.filter(x => x.role !== role),
  mkPat: (p, role, name, len) => {
    let x = LX.pat(p, role);
    if (!x) { x = makePattern(p, name); x.role = role; p.patterns.push(x); }
    x.len = len || x.len;
    return x;
  },
  fx: (p, ins, type, over) => { if (ins != null && p.mixer[ins] && !p.mixer[ins].fx.some(f => f.type === type)) addFx(p, ins, type, over); },
  hasFx: (p, ins, types) => ins != null && p.mixer[ins] && p.mixer[ins].fx.some(f => types.includes(f.type)),
  steps: (role, idx) => () => {
    const ch = LX.ch(P, role);
    const els = ch && UI.stepEls && UI.stepEls[ch.id];
    if (!els) return [];
    return idx.map(i => els[i]).filter(Boolean);
  },
  sel: s => () => [...document.querySelectorAll(s)].filter(e => e.offsetParent !== null),
  strip: role => () => { const ch = LX.ch(P, role); return ch ? LX.sel('.strip[data-ins="' + ch.mixer + '"]')() : []; },
};

function learnChannel(p, type, preset, role, extra) {
  const c = makeChannel(p, type, preset, extra);
  c.role = role;
  p.channels.push(c);
  return c;
}

function jerkStart() {
  const p = emptyProject('Мой джерк');
  p.learn = 'jerk';
  p.bpm = 140; p.key = 0; p.scale = 'major';
  learnChannel(p, 'bass808', '808 Jerk', '808', { name: '808', vol: 0.58 });
  learnChannel(p, 'drum', 'Clap Dry', 'clap', { name: 'Clap', vol: 1 });
  learnChannel(p, 'drum', 'Hat Soft', 'hat', { name: 'Hat', vol: 1.25, pan: 0.12 });
  learnChannel(p, 'drum', 'Open Hat', 'ohat', { name: 'Open Hat', vol: 0.6, pan: -0.12 });
  const bell = learnChannel(p, 'synth', 'Glass Bell', 'bell', { name: 'Bell', vol: 1 });
  p.mixer[bell.mixer].vol = 1.1;
  const beat = p.patterns[0];
  beat.name = 'Бит'; beat.role = 'beat';
  return p;
}

function pluggStart() {
  const p = emptyProject('Мой плаг');
  p.learn = 'plugg';
  p.bpm = 140; p.key = 0; p.scale = 'major';
  learnChannel(p, 'bass808', '808 Dark Slide', '808', { name: '808', vol: 0.6 });
  learnChannel(p, 'drum', 'Clap Dry', 'clap', { name: 'Clap', vol: 1.2 });
  learnChannel(p, 'drum', 'Rimshot', 'rim', { name: 'Rim', vol: 1, pan: 0.2 });
  learnChannel(p, 'drum', 'Hat Soft', 'hat', { name: 'Hat', vol: 1.25, pan: -0.1 });
  const keys = learnChannel(p, 'synth', 'Plugg Keys', 'keys', { name: 'Keys', vol: 1.1 });
  p.mixer[keys.mixer].vol = 1;
  const beat = p.patterns[0];
  beat.name = 'Бит'; beat.role = 'beat'; beat.len = 32;
  const b8 = makePattern(p, '808'); b8.role = 'b808'; b8.len = 64; p.patterns.push(b8);
  const ch = makePattern(p, 'Аккорды'); ch.role = 'chords'; ch.len = 64; p.patterns.push(ch);
  p.curPat = ch.id;
  return p;
}

const LEARN_REFS = [
  { who: 'tewiq', what: 'попал', rows: [['Темп', '122 BPM'], ['Тональность', 'ля минор'], ['808', 'бьёт на каждую долю, нота меняется раз в полтакта'], ['Ударные', 'бочки нет, её делает 808; хлопки редкие; есть «стопы»'], ['Мелодия', 'яркие клавиши и колокольчик'], ['Громкость', '−8.9 LUFS, 1:46']] },
  { who: 'greyrock, tewiq, madk1d', what: '', rows: [['Темп', '116 BPM'], ['Тональность', 'соль-диез минор'], ['808', 'главный звук, на 10 дБ громче всего; длинные ноты съезжают глайдом вниз'], ['Ударные', 'тихие, почти фон'], ['Мелодия', 'почти нет'], ['Громкость', '−8.8 LUFS, 2:00']] },
  { who: 'shvdowkilla, soulrin', what: 'mode: stussy', rows: [['Темп', '92 BPM (или 184 вдвое)'], ['Тональность', 'фа минор'], ['808', 'короткие и неровные, глайды — пятая часть времени'], ['Ударные', 'редкие, хэты кучками по 3'], ['Мелодия', 'тёмная и мягкая'], ['Громкость', '−12.3 LUFS (тише остальных), 2:16']] },
  { who: 'Кащенко, whyfall, Крайп, ФОРТИ', what: '', rows: [['Темп', '106 BPM'], ['Тональность', 'до-диез минор'], ['808', 'с ударом на каждую долю'], ['Ударные', 'хлопки и хэты по восьмым'], ['Мелодия', 'почти нет'], ['Громкость', '−10.4 LUFS, 1:37']] },
];

const LEARN_SUMMARY = [
  'Темп 106–122 BPM, у плага около 92.',
  'Всегда минор.',
  '808 — главный инструмент. Он же бочка и бас. Громче всего в миксе и с перегрузом.',
  'Ударных мало, никакой трэп-дроби хэтов. Пустота — часть стиля, в неё ложится читка.',
  'Мелодия — простой луп из 4–6 нот или её нет вообще.',
  'Треки короткие: до двух минут, без долгих вступлений.',
];

const COURSES = {
  intro: {
    title: 'Как устроен Bt',
    sub: '5 минут: где что нажимать',
    steps: [
      { title: 'Запусти звук', text: 'Нажми <kbd>Пробел</kbd> или зелёную кнопку ▶ наверху. Ещё раз — пауза.',
        target: LX.sel('#top .btn.play'), check: () => UI._learnPlayed || Engine.playing },
      { title: 'Поставь удар', text: 'Это <b>Channel Rack</b>. Каждая строка — инструмент, каждый квадрат — шестнадцатая доля. Кликни по серому квадрату — появится удар. Правой кнопкой — стереть.',
        prepare: () => { UI.showTab('top', 'rack'); UI._learnNotes = noteCount(); },
        target: LX.sel('#vRack .crow .steps'), check: () => noteCount() !== UI._learnNotes },
      { title: 'Открой Piano Roll', text: 'Мелодии и 808 пишутся в <b>Piano Roll</b>: слева клавиши, справа ноты. Открой его вкладкой сверху или клавишей <kbd>F7</kbd>.',
        target: LX.sel('#tabsTop .tab[data-tab="roll"]'), check: () => UI.topTab === 'roll' },
      { title: 'Режим «Трек»', text: 'Кнопка «Паттерн» играет то, что ты сейчас пишешь. «Трек» играет весь трек из <b>Playlist</b> внизу: там паттерны расставлены по времени.',
        target: LX.sel('[data-learn="mode"]'), check: () => Engine.mode === 'song' },
      { title: 'Микшер', text: 'У каждого инструмента своя дорожка микшера с громкостью и эффектами. Открой <b>Микшер</b> (<kbd>F9</kbd>).',
        target: LX.sel('#tabsBot .tab[data-tab="mixer"]'), check: () => UI.botTab === 'mixer' },
      { title: 'Готово', text: 'Это всё, что нужно для начала. <kbd>Ctrl+Z</kbd> отменяет любое действие, <kbd>Ctrl+S</kbd> сохраняет проект. Теперь бери урок «Джерк-бит».' },
    ],
  },

  jerk: {
    title: 'Джерк-бит',
    sub: 'как у tewiq: 808 на каждую долю, минимум звуков',
    start: jerkStart,
    steps: [
      { title: 'Темп', text: 'Поставь темп около <b>120</b>. Тяни число BPM наверху вверх-вниз или кликни по нему дважды и впиши.',
        why: 'В присланных треках 106, 116 и 122 BPM.',
        target: LX.sel('.lcd.bpm'), check: p => p.bpm >= 110 && p.bpm <= 128 || 'Нужно от 110 до 128',
        demo: p => { p.bpm = 120; } },
      { title: 'Тональность', text: 'Над Piano Roll выбери тональность <b>A</b> и лад <b>Минор</b>. Ноты лада подсветятся, и мимо будет сложно промахнуться.',
        why: 'Все четыре трека в миноре: ля, соль-диез, фа и до-диез.',
        prepare: () => UI.openRoll(chId('808')),
        target: LX.sel('[data-learn="key"],[data-learn="scale"]'), check: p => LX.minorish(p.scale) || 'Выбери минорный лад',
        demo: p => { p.key = 9; p.scale = 'minor'; } },
      { title: '808 на каждую долю', text: 'В Channel Rack в строке <b>808</b> поставь удары на 1, 5, 9 и 13 шаг — на каждую долю. Это главный приём джерка: 808 работает и бочкой, и басом.',
        why: 'У tewiq и в треке Кащенко/whyfall 808 бьёт ровно на каждую долю.',
        prepare: () => { UI.showTab('top', 'rack'); selRole('beat'); },
        target: LX.steps('808', [0, 4, 8, 12]),
        check: p => { const t = LX.notes(LX.pat(p, 'beat'), LX.ch(p, '808')).map(n => n.t); return [0, 4, 8, 12].every(x => t.some(y => Math.abs(y - x) < 0.01)) || 'Нужны удары 808 на шагах 1, 5, 9 и 13'; },
        demo: p => { const r = LX.r808(p); LX.set(LX.pat(p, 'beat'), LX.ch(p, '808'), [0, 4, 8, 12].map(t => N(t, r, 4, t ? 0.85 : 0.95))); } },
      { title: 'Басовая линия', text: 'Сделай паттерн длиной <b>2 такта</b> (справа над Piano Roll). Потом двигай ноты 808 вверх-вниз, чтобы нота менялась раз в полтакта. Например A, A, F, F, C, C, G, G.',
        why: 'В треке tewiq нота 808 держится полтакта и идёт по аккордам.',
        prepare: () => { selRole('beat'); UI.openRoll(chId('808')); },
        target: LX.sel('[data-learn="rlen"],[data-learn="rollcv"]'),
        check: p => {
          const pat = LX.pat(p, 'beat'), ns = LX.notes(pat, LX.ch(p, '808'));
          if (!pat || pat.len < 32) return 'Сначала поставь длину 2 такта';
          if (ns.length < 8) return 'Нужно 8 ударов 808 — по одному на каждую долю двух тактов';
          return new Set(ns.map(n => n.n % 12)).size >= 3 || 'Используй хотя бы 3 разные ноты';
        },
        demo: p => {
          const pat = LX.pat(p, 'beat'), r = LX.r808(p);
          pat.len = Math.max(pat.len, 32);
          LX.set(pat, LX.ch(p, '808'), [0, 0, -4, -4, 3, 3, -2, -2].map((o, i) => N(i * 4, r + o, 4, i % 2 ? 0.85 : 0.95)));
        } },
      { title: 'Глайд', text: 'Поставь короткую ноту на октаву выше так, чтобы она <b>заходила</b> на соседнюю. Когда ноты 808 перекрываются, звук плавно съезжает с одной на другую. Попробуй на 15-м шаге.',
        why: 'В трёх треках из четырёх 808 скользит 10–20% времени.',
        prepare: () => { selRole('beat'); UI.openRoll(chId('808')); },
        target: LX.sel('[data-learn="rollcv"]'),
        check: p => LX.glide(LX.notes(LX.pat(p, 'beat'), LX.ch(p, '808'))) || 'Нужно, чтобы одна нота 808 заходила на другую',
        demo: p => {
          const pat = LX.pat(p, 'beat'), ch = LX.ch(p, '808'), r = LX.r808(p);
          const ns = LX.notes(pat, ch).filter(n => Math.abs(n.t - 14) > 0.01 && Math.abs(n.t - 30) > 0.01);
          ns.push(N(14, r + 12, 3, 0.8), N(30, r + 12, 3, 0.75));
          LX.set(pat, ch, ns.sort((a, b) => a.t - b.t));
        } },
      { title: 'Хлопок', text: 'В строке <b>Clap</b> поставь хлопки на 5 и 13 шаг первого такта и на 21 и 28 второго. Последний сдвинут на шестнадцатую раньше — от этого ритм подпрыгивает.',
        why: 'Хлопки в этих треках редкие и не всегда ровно на 2 и 4.',
        prepare: () => { UI.showTab('top', 'rack'); selRole('beat'); },
        target: LX.steps('clap', [4, 12, 20, 27]),
        check: p => { const ns = LX.notes(LX.pat(p, 'beat'), LX.ch(p, 'clap')); if (ns.length < 2) return 'Поставь хотя бы два хлопка'; if (ns.length > 10) return 'Слишком много — тут хлопков мало'; return true; },
        demo: p => { LX.set(LX.pat(p, 'beat'), LX.ch(p, 'clap'), hits([4, 12, 20, 27], 0.9)); } },
      { title: 'Хэты 3+3+2', text: 'Хэтов мало, и стоят они группами: 1, 4, 7 шаг, потом 9, 12, 15 и так далее. Получается «раз-два-три, раз-два-три, раз-два» вместо ровной трэп-дроби.',
        why: 'У soulrin хэты идут кучками по три шага.',
        prepare: () => { UI.showTab('top', 'rack'); selRole('beat'); },
        target: LX.steps('hat', [0, 3, 6, 8, 11, 14]),
        check: p => { const ns = LX.notes(LX.pat(p, 'beat'), LX.ch(p, 'hat')); if (ns.length < 3) return 'Поставь хотя бы три хэта'; if (ns.length > 20) return 'Слишком густо — оставь половину'; return true; },
        demo: p => {
          const pat = LX.pat(p, 'beat');
          LX.set(pat, LX.ch(p, 'hat'), [0, 3, 6, 8, 11, 14, 16, 19, 22, 24, 27].map(t => N(t, 60, 0.5, t % 8 === 0 ? 0.9 : 0.7)));
          LX.set(pat, LX.ch(p, 'ohat'), hits([30], 0.6));
        } },
      { title: 'Новый паттерн', text: 'Мелодию пишут в отдельном паттерне, чтобы потом включать её отдельно от бита. Нажми <b>+</b> рядом с названием паттерна наверху.',
        target: LX.sel('[data-learn="patsel"]'),
        check: p => p.patterns.length >= 2 || 'Создай второй паттерн',
        demo: p => { const m = LX.mkPat(p, 'mel', 'Мелодия', 32); p.curPat = m.id; } },
      { title: 'Мелодия', text: 'Открой Piano Roll на канале <b>Bell</b> и напиши 4–6 нот в подсвеченном ладу, высоко, на два такта. Простой луп, который хочется повторять. Сложное тут не нужно.',
        why: 'У tewiq мелодия — короткий яркий луп. В двух треках мелодии почти нет.',
        prepare: () => { const m = melPat(P); if (m) UI.selectPattern(m.id); UI.openRoll(chId('bell')); },
        target: LX.sel('[data-learn="rollcv"]'),
        check: p => { const m = melPat(p); const ns = LX.notes(m, LX.ch(p, 'bell')); if (ns.length < 4) return 'Нужно хотя бы 4 ноты Bell в новом паттерне'; return ns.filter(n => LX.inScale(p, n.n)).length >= ns.length * 0.75 || 'Почти все ноты должны быть в ладу (подсвеченные строки)'; },
        demo: p => {
          const m = LX.mkPat(p, 'mel', 'Мелодия', 32), r = LX.rMel(p);
          p.curPat = m.id;
          const mot = [[0, 7, 2.5, 0.9], [3, 10, 2.5, 0.7], [6, 7, 2, 0.75], [8, 3, 3, 0.85], [11, 5, 2.5, 0.7], [16, 7, 2.5, 0.9], [19, 10, 2.5, 0.7], [22, 12, 2, 0.8], [24, 10, 3, 0.85], [27, 7, 2.5, 0.7], [30, 5, 2, 0.6]];
          LX.set(m, LX.ch(p, 'bell'), mot.map(([t, o, d, v]) => N(t, r + o, d, v)));
        } },
      { title: 'Эхо на колокольчик', text: 'Открой <b>Микшер</b>, кликни по дорожке <b>Bell</b> и добавь <b>Дилей</b> и <b>Реверб</b>. Колокольчик отойдёт назад и не будет мешать голосу.',
        prepare: () => { const c = LX.ch(P, 'bell'); if (c) UI.selIns = c.mixer; UI.fxOpen = true; UI.showTab('bot', 'mixer'); UI.renderMixer(); },
        target: () => [...LX.strip('bell')(), ...LX.sel('[data-learn="addfx"]')()],
        check: p => { const c = LX.ch(p, 'bell'); return (c && LX.hasFx(p, c.mixer, ['reverb', 'delay'])) || 'Добавь на дорожку Bell реверб или дилей'; },
        demo: p => { const c = LX.ch(p, 'bell'); LX.fx(p, c.mixer, 'delay', { time: '0.75', fb: 0.3, mix: 0.2 }); LX.fx(p, c.mixer, 'reverb', { size: 2.4, mix: 0.25 }); } },
      { title: 'Стоп', text: 'Через меню паттерна (☰ наверху) <b>клонируй</b> «Бит». В копии сотри всё на последней доле, шаги 29–32. В треке перед новой фразой всё замолкает, и следующий удар бьёт сильнее.',
        why: 'В треке tewiq бит на пару долей пропадает целиком.',
        prepare: () => { UI.showTab('top', 'rack'); },
        target: LX.sel('[data-learn="patsel"]'),
        check: p => !!stopPat(p) || 'Нужен паттерн с битом, где последняя доля пустая',
        demo: p => {
          const b = LX.pat(p, 'beat');
          const s = LX.mkPat(p, 'stop', 'Бит стоп', b.len);
          s.notes = {};
          for (const id in b.notes) s.notes[id] = deep(b.notes[id]).filter(n => n.t < b.len - 4).map(n => { if (n.t + n.d > b.len - 4) n.d = b.len - 4 - n.t; return n; });
        } },
      { title: 'Собери трек', text: 'Внизу <b>Playlist</b>. Выбери паттерн слева и кликай по дорожкам, чтобы ставить его. Простая схема: 4 такта одна мелодия, потом бит с мелодией, раз в 8 тактов — «стоп». В середине 4 такта без бита. Всего тактов 40.',
        why: 'Треки короткие: 1:37–2:16, без долгих вступлений.',
        prepare: () => { UI.showTab('bot', 'playlist'); },
        target: LX.sel('[data-learn="picker"],[data-learn="plcv"]'),
        check: p => { const used = new Set(p.playlist.clips.map(c => c.p)); if (used.size < 2) return 'Поставь в Playlist хотя бы бит и мелодию'; return songLength(p) >= 16 * 16 || 'Сделай трек хотя бы на 16 тактов'; },
        demo: p => {
          const b = LX.pat(p, 'beat'), m = melPat(p) || LX.mkPat(p, 'mel', 'Мелодия', 32), s = stopPat(p);
          const tr = p.playlist.tracks;
          tr[0].name = 'Мелодия'; tr[1].name = 'Бит';
          const k = (pid, t, st, l) => ({ id: uid('k'), p: pid, tr: t, s: st * 16, l: l * 16 });
          p.playlist.clips = [k(m.id, 0, 0, 44)];
          for (const v0 of [4, 24]) {
            for (const a of [0, 8]) {
              p.playlist.clips.push(k(b.id, 1, v0 + a, 6));
              p.playlist.clips.push(k((s || b).id, 1, v0 + a + 6, 2));
            }
          }
        } },
      { title: 'Громко и с перегрузом', text: 'В микшере на дорожку <b>808</b> добавь <b>Дисторшн</b>: без него 808 не слышно в телефоне. На <b>Master</b> поставь <b>Эквалайзер</b> («Верх» +3 дБ — больше воздуха) и после него <b>Лимитер</b>. «Вход» лимитера подними на 1–2 дБ: громче станет, а перегруза не будет.',
        why: 'Треки сведены громко, −9…−10 LUFS. 808 с перегрузом.',
        prepare: () => { const c = LX.ch(P, '808'); if (c) UI.selIns = c.mixer; UI.fxOpen = true; UI.showTab('bot', 'mixer'); UI.renderMixer(); },
        target: () => [...LX.strip('808')(), ...LX.sel('.strip[data-ins="0"]')()],
        check: p => { const c = LX.ch(p, '808'); if (!c || !LX.hasFx(p, c.mixer, ['dist'])) return 'Добавь Дисторшн на дорожку 808'; return LX.hasFx(p, 0, ['limiter']) || 'Теперь Лимитер на Master'; },
        demo: p => { const c = LX.ch(p, '808'); LX.fx(p, c.mixer, 'dist', { mode: 'soft', drive: 0.35, tone: 7000, out: -5 }); LX.fx(p, 0, 'eq', { lowcut: 25, highG: 3, highF: 9000 }); LX.fx(p, 0, 'limiter', { gain: 1.5, ceil: -0.5 }); } },
      { title: 'Готово', text: 'Включи «Трек» и послушай целиком. Если нравится — <b>Экспорт</b> → WAV. Дальше пробуй своё: другая тональность, другой рисунок 808, свой колокольчик.',
        target: LX.sel('[data-learn="mode"],[data-learn="export"]') },
    ],
  },

  plugg: {
    title: 'Плаг и тёмный 808',
    sub: 'как у soulrin и greyrock: неровный 808, длинные глайды, триоли',
    start: pluggStart,
    steps: [
      { title: 'Темп', text: 'Поставь темп около <b>92</b>. Плаг медленнее джерка, но хэты и 808 играют мельче, поэтому трек всё равно звучит быстро.',
        why: 'Трек shvdowkilla и soulrin около 92 BPM.',
        target: LX.sel('.lcd.bpm'), check: p => p.bpm >= 85 && p.bpm <= 100 || 'Нужно от 85 до 100',
        demo: p => { p.bpm = 92; } },
      { title: 'Тональность', text: 'Выбери <b>F</b> и <b>Минор</b> над Piano Roll.',
        why: 'soulrin — фа минор, greyrock/tewiq/madk1d — соль-диез минор.',
        prepare: () => { selRole('chords'); UI.openRoll(chId('keys')); },
        target: LX.sel('[data-learn="key"],[data-learn="scale"]'), check: p => LX.minorish(p.scale) || 'Выбери минорный лад',
        demo: p => { p.key = 5; p.scale = 'minor'; } },
      { title: 'Аккорды штампом', text: 'Паттерн «Аккорды», канал <b>Keys</b>. В списке штампов выбери <b>Min7</b> и кликни в начало каждого такта: один клик ставит весь аккорд. Растяни аккорды на такт. Четыре такта — четыре разных аккорда.',
        why: 'Мягкие аккорды под тёмным 808 — основа плага.',
        prepare: () => { selRole('chords'); UI.openRoll(chId('keys')); },
        target: LX.sel('[data-learn="chord"],[data-learn="rollcv"]'),
        check: p => { const g = LX.chords(LX.notes(LX.pat(p, 'chords'), LX.ch(p, 'keys'))); if (g.length < 2) return 'Поставь хотя бы 2 аккорда (по 3+ ноты)'; return new Set(g.map(x => Math.min(...x.map(n => n.n)) % 12)).size >= 2 || 'Аккорды должны отличаться'; },
        demo: p => {
          const r = LX.rKeys(p), pat = LX.pat(p, 'chords');
          const prog = [[0, 3, 7, 10, 14], [-4, 0, 3, 7], [5, 8, 12, 15], [7, 11, 14, 17]];
          const ns = [];
          prog.forEach((c, b) => c.forEach((o, i) => ns.push(N(b * 16 + i * 0.08, r + o, 15.5, 0.7 - i * 0.03))));
          LX.set(pat, LX.ch(p, 'keys'), ns);
        } },
      { title: 'Неровный 808', text: 'Паттерн «808». Ставь удары <b>не на доли</b>: 1, 4, 7, 11 и 15 шаг каждого такта. Нота — та, с которой начинается аккорд этого такта.',
        why: 'У soulrin 808 короткие и неровные, как будто спотыкаются.',
        prepare: () => { selRole('b808'); UI.openRoll(chId('808')); },
        target: LX.sel('[data-learn="rollcv"]'),
        check: p => { const ns = LX.notes(LX.pat(p, 'b808'), LX.ch(p, '808')); if (ns.length < 6) return 'Нужно хотя бы 6 нот 808'; return ns.filter(n => Math.abs(n.t % 4) > 0.01).length >= 2 || 'Сдвинь пару ударов с долей'; },
        demo: p => {
          const r = LX.r808(p), roots = [0, -4, 5, 7];
          const ns = [];
          roots.forEach((o, b) => [[0, 3], [3, 3], [6, 4], [10, 2], [14, 2]].forEach(([t, d], i) => ns.push(N(b * 16 + t, r + o, d, i ? 0.8 : 0.95))));
          LX.set(LX.pat(p, 'b808'), LX.ch(p, '808'), ns);
        } },
      { title: 'Длинный глайд', text: 'В последнем такте сделай одну <b>длинную</b> ноту 808 (полтакта и больше). Поверх её конца поставь ноту ниже: 808 медленно съедет вниз. Это тёмный приём.',
        why: 'В треке greyrock/tewiq/madk1d 808 держится по два такта и сползает через несколько нот.',
        prepare: () => { selRole('b808'); UI.openRoll(chId('808')); },
        target: LX.sel('[data-learn="rollcv"]'),
        check: p => { const ns = LX.notes(LX.pat(p, 'b808'), LX.ch(p, '808')); if (!ns.some(n => n.d >= 6)) return 'Нужна нота 808 длиной от 6 шагов'; return LX.glide(ns) || 'Поставь ноту так, чтобы она заходила на длинную'; },
        demo: p => {
          const pat = LX.pat(p, 'b808'), ch = LX.ch(p, '808'), r = LX.r808(p) + 7;
          const ns = LX.notes(pat, ch).filter(n => n.t < 48);
          ns.push(N(48, r, 10, 0.95), N(56, r - 5, 6, 0.85), N(62, r + 5, 2, 0.7));
          LX.set(pat, ch, ns);
        } },
      { title: 'Хлопок и римшот', text: 'Паттерн «Бит». <b>Clap</b> — на 9 и 25 шаг: при 92 BPM это ощущается как медленный трэп. <b>Rim</b> — пару раз между ними, неровно.',
        why: 'У soulrin хлопки редкие и сдвинутые.',
        prepare: () => { UI.showTab('top', 'rack'); selRole('beat'); },
        target: () => [...LX.steps('clap', [8, 24])(), ...LX.steps('rim', [3, 6, 19, 22])()],
        check: p => { const ns = LX.notes(LX.pat(p, 'beat'), LX.ch(p, 'clap')); if (ns.length < 2) return 'Поставь хотя бы два хлопка'; return ns.length <= 8 || 'Хлопков слишком много'; },
        demo: p => { const b = LX.pat(p, 'beat'); LX.set(b, LX.ch(p, 'clap'), hits([8, 24], 0.9)); LX.set(b, LX.ch(p, 'rim'), hits([[3, 0.6], [6, 0.45], [19, 0.6], [22, 0.45], [30, 0.5]])); } },
      { title: 'Триоли на хэтах', text: 'Открой Piano Roll на канале <b>Hat</b> и поставь сетку <b>1/8 T</b>. Это триоли: три удара там, где обычно два. Сделай одну-две доли триолями, остальное — обычными восьмыми.',
        why: 'Триоли дают плагу «покачивание».',
        prepare: () => { selRole('beat'); UI.openRoll(chId('hat')); },
        target: LX.sel('[data-learn="snap"],[data-learn="rollcv"]'),
        check: p => LX.notes(LX.pat(p, 'beat'), LX.ch(p, 'hat')).filter(n => Math.abs(n.t - Math.round(n.t)) > 0.1).length >= 2 || 'Нужно хотя бы 2 хэта не на сетке шестнадцатых (триоли)',
        demo: p => {
          const t3 = 2 / 3, ts = [0, 2, 4, 6, 8, 8 + t3, 8 + 2 * t3, 10, 10 + t3, 10 + 2 * t3, 12, 14, 16, 18, 20, 22, 24, 26, 28, 28 + t3 / 2, 28 + t3, 28 + 1.5 * t3, 29 + t3, 29 + 1.5 * t3, 30];
          LX.set(LX.pat(p, 'beat'), LX.ch(p, 'hat'), ts.map(t => N(t, 60, 0.4, Math.abs(t % 4) < 0.01 ? 0.75 : 0.5)));
        } },
      { title: 'Собери трек', text: 'В <b>Playlist</b> расставь: аккорды с самого начала, через 4 такта — 808 и бит. В середине уберите бит на 4 такта. Всего 20–24 такта.',
        why: 'Трек soulrin — 2:16, у плага медленный темп, тактов меньше.',
        prepare: () => { UI.showTab('bot', 'playlist'); },
        target: LX.sel('[data-learn="picker"],[data-learn="plcv"]'),
        check: p => { const used = new Set(p.playlist.clips.map(c => c.p)); if (used.size < 3) return 'Поставь аккорды, 808 и бит'; return songLength(p) >= 12 * 16 || 'Сделай трек хотя бы на 12 тактов'; },
        demo: p => {
          const b = LX.pat(p, 'beat'), c = LX.pat(p, 'chords'), e = LX.pat(p, 'b808');
          const tr = p.playlist.tracks;
          tr[0].name = 'Аккорды'; tr[1].name = '808'; tr[2].name = 'Бит';
          const k = (pid, t, st, l) => ({ id: uid('k'), p: pid, tr: t, s: st * 16, l: l * 16 });
          p.playlist.clips = [k(c.id, 0, 0, 24), k(e.id, 1, 4, 8), k(b.id, 2, 4, 8), k(e.id, 1, 16, 8), k(b.id, 2, 16, 8)];
        } },
      { title: 'Тёмный звук', text: 'На дорожку <b>Keys</b> добавь <b>Lo-Fi</b> (немного винила) и <b>Реверб</b>. На <b>808</b> — <b>Дисторшн</b>. На <b>Master</b> — <b>Лимитер</b>, «Вход» почти не трогай: 0–1 дБ.',
        why: 'Трек soulrin тише остальных, −12 LUFS: в плаге больше воздуха.',
        prepare: () => { const c = LX.ch(P, 'keys'); if (c) UI.selIns = c.mixer; UI.fxOpen = true; UI.showTab('bot', 'mixer'); UI.renderMixer(); },
        target: () => [...LX.strip('keys')(), ...LX.strip('808')(), ...LX.sel('.strip[data-ins="0"]')()],
        check: p => { const k = LX.ch(p, 'keys'), b = LX.ch(p, '808'); if (!k || !LX.hasFx(p, k.mixer, ['reverb', 'lofi'])) return 'Добавь на Keys Lo-Fi или Реверб'; if (!b || !LX.hasFx(p, b.mixer, ['dist'])) return 'Добавь Дисторшн на 808'; return LX.hasFx(p, 0, ['limiter']) || 'Теперь Лимитер на Master'; },
        demo: p => {
          const k = LX.ch(p, 'keys'), b = LX.ch(p, '808');
          LX.fx(p, k.mixer, 'lofi', { bits: 12, tone: 7500, wow: 0.3, crackle: 0.45, mix: 1 });
          LX.fx(p, k.mixer, 'reverb', { size: 3.2, mix: 0.35 });
          LX.fx(p, b.mixer, 'dist', { mode: 'soft', drive: 0.3, tone: 5000, out: -4 });
          LX.fx(p, 0, 'limiter', { gain: 0.5, ceil: -0.8 });
        } },
      { title: 'Готово', text: 'Включи «Трек» и послушай. Дальше меняй аккорды (попробуй Min9 в штампе), двигай удары 808, ищи свой глайд.',
        target: LX.sel('[data-learn="mode"],[data-learn="export"]') },
    ],
  },
};

function noteCount() { const p = curPat(); return p ? Object.values(p.notes).reduce((a, x) => a + x.length, 0) : 0; }
function chId(role) { const c = LX.ch(P, role); return c ? c.id : null; }
function selRole(role) { const x = LX.pat(P, role); if (x && P.curPat !== x.id) UI.selectPattern(x.id); }
function melPat(p) {
  const bell = LX.ch(p, 'bell');
  return LX.pat(p, 'mel') || p.patterns.find(x => x.role !== 'beat' && x.role !== 'stop' && LX.notes(x, bell).length) || p.patterns.find(x => x.role !== 'beat' && x.role !== 'stop' && !Object.values(x.notes).some(a => a.length)) || null;
}
function stopPat(p) {
  const beat = LX.pat(p, 'beat');
  return p.patterns.find(x => {
    if (x === beat || x.role === 'mel') return false;
    const all = Object.values(x.notes).flat();
    const b808 = LX.notes(x, LX.ch(p, '808'));
    return b808.length >= 2 && all.every(n => n.t < x.len - 4 - 1e-6);
  }) || null;
}

function learnTemplate(key) {
  const c = COURSES[key];
  const p = c.start();
  for (const s of c.steps) if (s.demo) s.demo(p);
  p.name = key === 'jerk' ? 'Джерк · пример' : 'Плаг · пример';
  delete p.learn;
  const first = LX.pat(p, 'beat');
  if (first) p.curPat = first.id;
  return p;
}
TEMPLATES.jerk = () => learnTemplate('jerk');
TEMPLATES.plugg = () => learnTemplate('plugg');
TEMPLATE_LIST.splice(1, 0, ['jerk', 'Джерк', '120 BPM, 808 на каждую долю, глайды'], ['plugg', 'Плаг', '92 BPM, неровный 808, триоли']);

Object.assign(UI, {
  learnOpen: false,
  lc: null,
  ls: 0,
  lPass: false,
  lMsg: '',
  lSpots: [],
  lTick: 0,
  lVer: -1,

  learnProg() { try { return JSON.parse(Store.lsGet('bt:learn') || '{}'); } catch (e) { return {}; } },
  learnSave(o) { Store.lsSet('bt:learn', JSON.stringify(o)); },

  toggleLearn(on) {
    this.learnOpen = on == null ? !this.learnOpen : on;
    document.body.classList.toggle('learn', this.learnOpen);
    if (this.bLearn) this.bLearn.classList.toggle('on', this.learnOpen);
    const pr = this.learnProg();
    pr.seen = 1;
    this.learnSave(pr);
    if (this.learnOpen) this.renderLearn();
    else this.clearSpots();
    requestAnimationFrame(() => { this.drawRoll(); this.drawPlaylist(); });
  },

  renderLearn() {
    const A = $('#learn');
    if (!A) return;
    A.replaceChildren();
    if (this.lc) return this.renderStep(A);
    const head = h('div', { class: 'lhead' }, h('b', { text: 'Обучение' }), h('button', { class: 'btn icon small ghost', 'aria-label': 'Закрыть', onclick: () => this.toggleLearn(false) }, ico('x')));
    const body = h('div', { class: 'lbody' });
    body.append(h('p', { class: 'lintro', text: 'Уроки по джерку и плагу — музыке как у tewiq, madk1d, greyrock и soulrin. Делаешь бит сам, по шагам, прямо здесь. Нужное место подсвечивается, а если не получается, жми «Сделай за меня».' }));
    const pr = this.learnProg();
    for (const key of ['intro', 'jerk', 'plugg']) {
      const c = COURSES[key];
      const st = pr[key] || {};
      const n = c.steps.length;
      const at = Math.min(st.step || 0, n);
      const card = h('div', { class: 'lcard' + (st.done ? ' done' : '') });
      const bar = h('div', { class: 'lprog' }, h('i', { style: { width: (st.done ? 100 : at / n * 100) + '%' } }));
      const btns = h('div', { class: 'lbtns' });
      const go = h('button', { class: 'btn small acc', text: st.done ? 'Пройти снова' : at > 0 ? 'Продолжить' : 'Начать' });
      go.addEventListener('click', () => this.startCourse(key, st.done ? 0 : at));
      btns.append(go);
      if (TEMPLATES[key]) btns.append(h('button', { class: 'btn small', text: 'Послушать пример', hint: 'Загрузить готовый результат урока', onclick: () => this.loadTemplate(key) }));
      card.append(h('div', { class: 'lct' }, h('b', { text: c.title }), h('small', { text: st.done ? 'пройден' : n + ' шагов' })), h('p', { text: c.sub }), bar, btns);
      body.append(card);
    }
    const refs = h('details', { class: 'lrefs' });
    refs.append(h('summary', { text: 'Разбор твоих треков' }));
    const ul = h('ul', { class: 'lsum' });
    for (const s of LEARN_SUMMARY) ul.append(h('li', { text: s }));
    refs.append(ul);
    for (const r of LEARN_REFS) {
      const box = h('div', { class: 'lref' }, h('b', { text: r.who + (r.what ? ' — ' + r.what : '') }));
      const dl = h('div', { class: 'lkv' });
      for (const [k, v] of r.rows) dl.append(h('span', { text: k }), h('span', { text: v }));
      box.append(dl);
      refs.append(box);
    }
    refs.append(h('p', { class: 'lnote', text: 'Как разбирали: голос, ударные, 808 и мелодию разделили нейросетью, потом в каждой части измерили темп, ноты, ритм и громкость. Мелодии из песен в уроки не копировали, все примеры свои.' }));
    body.append(refs);
    A.append(head, body);
  },

  async startCourse(key, from) {
    const c = COURSES[key];
    if (c.start && P.learn !== key) {
      const hasWork = P.channels.length && P.patterns.some(p => Object.values(p.notes).some(a => a.length)) && !P.learn;
      if (hasWork) {
        if (!(await this.confirm('Начать урок?', 'Откроется учебный проект. Текущий сохраню в «Мои проекты», чтобы он не потерялся.', 'Начать'))) return;
        try { await Store.save(P); } catch (e) {}
      }
      const p = c.start();
      for (let i = 0; i < from && i < c.steps.length; i++) if (c.steps[i].demo) c.steps[i].demo(p);
      await loadProjectData({ proj: p, samples: [] });
      if (from) this.toast('Шаги 1–' + from + ' сделаны автоматически');
    } else if (!c.start && !P.channels.length) {
      await loadProjectData({ proj: TEMPLATES.trap(), samples: [] });
    }
    this.lc = key;
    this.goStep(from || 0);
  },

  goStep(i) {
    const c = COURSES[this.lc];
    this.ls = clamp(i, 0, c.steps.length - 1);
    this.lPass = false;
    this.lMsg = '';
    this.lVer = UI.ver || 0;
    this._learnPlayed = false;
    const pr = this.learnProg();
    pr[this.lc] = Object.assign(pr[this.lc] || {}, { step: this.ls });
    this.learnSave(pr);
    const s = c.steps[this.ls];
    if (s.prepare) { try { s.prepare(P); } catch (e) { console.error(e); } }
    this.renderLearn();
    this.learnCheck(true);
  },

  renderStep(A) {
    const c = COURSES[this.lc], s = c.steps[this.ls], n = c.steps.length;
    const back = h('button', { class: 'btn small ghost', onclick: () => { this.lc = null; this.clearSpots(); this.renderLearn(); } }, '← Уроки');
    const head = h('div', { class: 'lhead' }, back, h('span', { class: 'lcnt', text: (this.ls + 1) + ' / ' + n }), h('button', { class: 'btn icon small ghost', 'aria-label': 'Закрыть', onclick: () => this.toggleLearn(false) }, ico('x')));
    const dots = h('div', { class: 'ldots' });
    for (let i = 0; i < n; i++) dots.append(h('i', { class: i < this.ls ? 'd' : i === this.ls ? 'c' : '' }));
    const body = h('div', { class: 'lbody' });
    const text = h('div', { class: 'ltext' });
    text.innerHTML = s.text;
    body.append(h('div', { class: 'lcname', text: c.title }), dots, h('h3', { text: s.title }), text);
    if (s.why) body.append(h('div', { class: 'lwhy' }, h('span', { text: 'В треках' }), h('p', { text: s.why })));
    this.lStat = h('div', { class: 'lstat' });
    body.append(this.lStat);
    const tools = h('div', { class: 'lbtns' });
    if (s.target) tools.append(h('button', { class: 'btn small', text: 'Где это?', onclick: () => { if (s.prepare) s.prepare(P); this.lFlash = performance.now(); } }));
    if (s.demo) tools.append(h('button', { class: 'btn small', text: 'Сделай за меня', hint: 'Bt сделает этот шаг сам. Отменить — Ctrl+Z', onclick: () => this.runDemo(s) }));
    tools.append(h('button', { class: 'btn small ghost', 'aria-label': 'Играть', hint: 'Играть / пауза', onclick: () => Engine.toggle() }, ico('play')));
    body.append(tools);
    const foot = h('div', { class: 'lfoot' });
    foot.append(h('button', { class: 'btn small ghost', text: '← Назад', disabled: this.ls === 0 ? '' : null, onclick: () => this.goStep(this.ls - 1) }));
    this.lNext = h('button', { class: 'btn small', onclick: () => this.nextStep() });
    foot.append(this.lNext);
    A.append(head, body, foot);
    this.paintStat();
  },

  paintStat() {
    const s = COURSES[this.lc] && COURSES[this.lc].steps[this.ls];
    if (!s || !this.lStat) return;
    const last = this.ls === COURSES[this.lc].steps.length - 1;
    const free = !s.check;
    this.lStat.className = 'lstat' + (this.lPass && !free ? ' ok' : '');
    this.lStat.textContent = free ? '' : this.lPass ? '✓ Получилось' : (this.lMsg && (UI.ver || 0) !== this.lVer ? this.lMsg : '');
    this.lNext.textContent = last ? 'Завершить' : (this.lPass || free) ? 'Дальше →' : 'Пропустить';
    this.lNext.className = 'btn small' + ((this.lPass || free) ? ' acc' : ' ghost');
  },

  nextStep() {
    const c = COURSES[this.lc];
    if (this.ls >= c.steps.length - 1) {
      const pr = this.learnProg();
      pr[this.lc] = { step: c.steps.length, done: 1 };
      this.learnSave(pr);
      this.toast('Урок «' + c.title + '» пройден');
      this.lc = null;
      this.clearSpots();
      this.renderLearn();
      return;
    }
    this.goStep(this.ls + 1);
  },

  runDemo(s) {
    try { s.demo(P); } catch (e) { console.error(e); this.toast('Не получилось: в проекте нет нужного канала. Начни урок заново'); return; }
    if (Engine.ctx) Engine.rebuild();
    Engine.setBpm(P.bpm);
    History.commit('Урок: ' + s.title);
    this.renderAll();
    if (s.prepare) { try { s.prepare(P); } catch (e) {} }
    this.learnCheck(true);
  },

  learnCheck(force) {
    if (!this.lc) return;
    const s = COURSES[this.lc].steps[this.ls];
    if (!s) return;
    if (Engine.playing) this._learnPlayed = true;
    let r = true;
    if (s.check) { try { r = s.check(P); } catch (e) { r = false; } }
    const pass = r === true;
    const msg = typeof r === 'string' ? r : '';
    if (force || pass !== this.lPass || msg !== this.lMsg || this._lv !== UI.ver) {
      const was = this.lPass;
      this.lPass = pass; this.lMsg = msg; this._lv = UI.ver;
      this.paintStat();
      if (pass && !was && !force && s.check) this.lStat.classList.add('pop');
    }
  },

  clearSpots() { for (const e of this.lSpots) e.remove(); this.lSpots = []; },

  learnFrame() {
    if (!this.learnOpen || !this.lc) { if (this.lSpots.length) this.clearSpots(); return; }
    const now = performance.now();
    if (now - this.lTick > 250) { this.lTick = now; this.learnCheck(false); }
    const s = COURSES[this.lc].steps[this.ls];
    const flash = this.lFlash && now - this.lFlash < 2500;
    let els = [];
    if (s && s.target && (!this.lPass || flash || !s.check) && !document.querySelector('.modal,.menu')) { try { els = s.target() || []; } catch (e) { els = []; } }
    const rects = els.map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    while (this.lSpots.length < rects.length) { const d = h('div', { class: 'lspot' }); document.body.append(d); this.lSpots.push(d); }
    while (this.lSpots.length > rects.length) this.lSpots.pop().remove();
    rects.forEach((r, i) => {
      const d = this.lSpots[i];
      d.style.left = (r.left - 3) + 'px'; d.style.top = (r.top - 3) + 'px';
      d.style.width = (r.width + 6) + 'px'; d.style.height = (r.height + 6) + 'px';
    });
  },
});
