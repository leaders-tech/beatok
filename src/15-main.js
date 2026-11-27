const KEYMAP = { z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, ',': 12, l: 13, '.': 14, ';': 15, '/': 16, q: 12, 2: 13, w: 14, 3: 15, e: 16, r: 17, 5: 18, t: 19, 6: 20, y: 21, 7: 22, u: 23, i: 24, 9: 25, o: 26, 0: 27, p: 28 };
const DEFAULT_HINT = 'Пробел — играть. Клик по шагам в Channel Rack ставит удары, Piano Roll — мелодии, Playlist — сборка трека. F1 — все клавиши.';

Object.assign(UI, {
  kbOct: 4,
  heldKeys: {},

  buildLayout() {
    const mk = (pane, tabs) => {
      const bar = $(pane === 'top' ? '#tabsTop' : '#tabsBot');
      bar.replaceChildren();
      for (const [k, label, key] of tabs) {
        const b = h('button', { class: 'tab', 'data-tab': k, hint: label + ' (' + key + ')' }, label, h('kbd', { text: key }));
        b.addEventListener('click', () => this.showTab(pane, k));
        bar.append(b);
      }
      bar.addEventListener('dblclick', e => { if (e.target === bar) this.maximize(pane); });
    };
    mk('top', [['rack', 'Channel Rack', 'F6'], ['roll', 'Piano Roll', 'F7']]);
    mk('bot', [['playlist', 'Playlist', 'F5'], ['mixer', 'Микшер', 'F9']]);
    const work = $('#work'), split = $('#split');
    let drag = false;
    split.addEventListener('pointerdown', e => { drag = true; split.setPointerCapture(e.pointerId); });
    split.addEventListener('pointermove', e => {
      if (!drag) return;
      const r = work.getBoundingClientRect();
      const pct = clamp((e.clientY - r.top) / r.height * 100, 8, 92);
      work.style.setProperty('--split', pct + '%');
    });
    split.addEventListener('pointerup', () => { drag = false; });
    split.addEventListener('dblclick', () => work.style.setProperty('--split', '46%'));
    $('#work').addEventListener('pointerdown', () => document.body.classList.remove('bopen'));
  },

  maximize(pane) {
    const work = $('#work');
    const cur = work.style.getPropertyValue('--split');
    const target = pane === 'top' ? 'calc(100% - 41px)' : '34px';
    work.style.setProperty('--split', cur === target ? '46%' : target);
  },

  showTab(pane, tab) {
    if (pane === 'top') this.topTab = tab; else this.botTab = tab;
    const map = pane === 'top' ? { rack: '#vRack', roll: '#vRoll' } : { playlist: '#vPlaylist', mixer: '#vMixer' };
    for (const k in map) $(map[k]).classList.toggle('on', k === tab);
    for (const b of $$((pane === 'top' ? '#tabsTop' : '#tabsBot') + ' .tab')) b.classList.toggle('on', b.dataset.tab === tab);
    const work = $('#work');
    const sp = work.style.getPropertyValue('--split');
    if ((pane === 'top' && sp === '34px') || (pane === 'bot' && sp === 'calc(100% - 41px)')) work.style.setProperty('--split', '46%');
    requestAnimationFrame(() => {
      if (tab === 'roll') this.drawRoll();
      if (tab === 'playlist') this.drawPlaylist();
    });
  },

  renderAll() {
    this.rollSel.clear();
    this.fillPatSel();
    this.renderRack();
    this.renderRoll();
    this.renderPlaylist();
    this.renderMixer();
    this.refreshInstrWins();
    this.updateTitle();
    if (this.kSwing) this.kSwing.set(P.swing);
    if (this.kMaster) this.kMaster.set(P.masterVol);
    if (this.showBpm) this.showBpm();
  },

  refreshNotes() {
    this.renderRack();
    this.drawRoll();
    this.drawPlaylist();
  },

  keyChannel() {
    if (this.topTab === 'roll') return this.rollChannel();
    return (this.selCh && chById(this.selCh)) || this.rollChannel();
  },

  onKeyDown(e) {
    const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT' || tg.isContentEditable)) return;
    if (document.querySelector('.modal')) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key;
    if (this._menu && k === 'Escape') { this.closeMenu(); return; }
    if (k === ' ' || e.code === 'Space') { e.preventDefault(); if (!e.repeat) Engine.toggle(); return; }
    if (k === 'F5') { e.preventDefault(); this.showTab('bot', 'playlist'); return; }
    if (k === 'F6') { e.preventDefault(); this.showTab('top', 'rack'); return; }
    if (k === 'F7') { e.preventDefault(); this.openRoll(); return; }
    if (k === 'F9') { e.preventDefault(); this.showTab('bot', 'mixer'); return; }
    if (k === 'F1') { e.preventDefault(); this.helpDialog(); return; }
    if (ctrl && !e.shiftKey && k.toLowerCase() === 'z') { e.preventDefault(); History.undo(); return; }
    if (ctrl && (k.toLowerCase() === 'y' || (e.shiftKey && k.toLowerCase() === 'z'))) { e.preventDefault(); History.redo(); return; }
    if (ctrl && k.toLowerCase() === 's') { e.preventDefault(); this.saveProject(); return; }
    if (ctrl && k.toLowerCase() === 'o') { e.preventDefault(); this.projectsDialog(); return; }
    if (this.topTab === 'roll' && $('#vRoll').classList.contains('on') && this.rollKeys(e)) { e.preventDefault(); return; }
    if (ctrl || e.altKey) return;
    if (k === '[' || k === ']') { this.kbOct = clamp(this.kbOct + (k === ']' ? 1 : -1), 1, 7); this.toast('Октава клавиатуры: C' + (this.kbOct - 1)); return; }
    const off = KEYMAP[k.toLowerCase()];
    if (off == null || e.repeat) return;
    const ch = this.keyChannel();
    if (!ch) return;
    e.preventDefault();
    const midi = clamp(this.kbOct * 12 + off, 0, 127);
    if (this.heldKeys[e.code]) return;
    this.heldKeys[e.code] = { ch, midi };
    Engine.noteOn(ch, midi, 0.85);
    this.rollKey = midi;
    if (this.topTab === 'roll') this.drawRoll();
  },

  onKeyUp(e) {
    const hk = this.heldKeys[e.code];
    if (!hk) return;
    delete this.heldKeys[e.code];
    Engine.noteOff(hk.ch, hk.midi);
    if (this.rollKey === hk.midi) { this.rollKey = null; if (this.topTab === 'roll') this.drawRoll(); }
  },
});

let _wasPlaying = false;
function frame() {
  try {
    UI.drawTime();
    UI.drawSpectrum();
    UI.rackFrame();
    UI.mixerFrame();
    if (Engine.playing) {
      if (UI.topTab === 'roll' && Engine.mode === 'pattern') UI.drawRoll();
      if (UI.botTab === 'playlist' && Engine.mode === 'song') {
        const cv = UI.plCv;
        if (cv && cv.clientWidth) {
          const pos = Engine.displayPos();
          const x = PLK.TW + (pos - UI.pv.sx) * UI.pv.pps;
          if (x > cv.clientWidth - 30 || x < PLK.TW) UI.pv.sx = Math.max(0, pos - 4);
        }
        UI.drawPlaylist();
      }
    } else if (_wasPlaying) { UI.drawRoll(); UI.drawPlaylist(); UI.onTransport(); }
    _wasPlaying = Engine.playing;
  } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}

async function start(hot) {
  UI.buildLayout();
  let data = null;
  if (hot && hot.proj) data = hot;
  else data = Store.loadAuto();
  const first = !data;
  if (!data || !data.proj) data = { proj: TEMPLATES.trap(), samples: [] };
  try { P = normalizeProject(data.proj); } catch (e) { P = TEMPLATES.trap(); }
  await Samples.restore(data.samples);
  History.reset();
  UI.buildTop();
  UI.renderBrowser();
  UI.showTab('top', 'rack');
  UI.showTab('bot', 'playlist');
  UI.renderAll();
  Store.init();
  Caps.use('downloads');
  const wake = () => Engine.init();
  document.addEventListener('pointerdown', wake, { capture: true });
  document.addEventListener('keydown', wake, { capture: true });
  document.addEventListener('keydown', e => UI.onKeyDown(e));
  document.addEventListener('keyup', e => UI.onKeyUp(e));
  window.addEventListener('blur', () => { Engine.allNotesOff && Engine.ctx && Engine.allNotesOff(); UI.heldKeys = {}; });
  document.addEventListener('pointerdown', e => { if (UI._menu && !e.target.closest('.menu')) UI.closeMenu(); }, true);
  window.addEventListener('resize', () => UI.closeMenu());
  const ht = $('#hint .ht');
  ht.textContent = DEFAULT_HINT;
  document.addEventListener('mouseover', e => {
    const el = e.target.closest && e.target.closest('[data-hint]');
    ht.textContent = el ? el.dataset.hint : DEFAULT_HINT;
  });
  document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', async e => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    e.preventDefault();
    const f = files[0];
    if (/\.json$/i.test(f.name)) {
      try { await loadProjectData(JSON.parse(await f.text())); UI.toast('Открыт «' + P.name + '»'); } catch (err) { UI.toast('Это не файл проекта Bt'); }
    } else UI.importSamples(files);
  });
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
    try { window.claude.hot.snapshot(() => ({ proj: P, samples: [] })); } catch (e) {}
  }
  requestAnimationFrame(frame);
  if (first) setTimeout(() => UI.toast('Это готовый трэп-бит. Нажми пробел, чтобы послушать', 4000), 600);
}

window.__presetParams = presetParams;
window.__INSTR = INSTR_PLAY;
window.__tables = [['drum', Object.keys(DRUM_PRESETS)], ['bass808', Object.keys(BASS_PRESETS)], ['synth', Object.keys(SYNTH_PRESETS)]];
window.__load = p => loadProjectData({ proj: p, samples: [] });
window.Bt = { Engine, UI, History, Samples, Store, TEMPLATES, encodeWav, makeMidi, get P() { return P; } };

{
  const hot = window.claude && window.claude.hot;
  if (hot && hot.ready) hot.ready(start);
  else start((hot && hot.data) || {});
}
