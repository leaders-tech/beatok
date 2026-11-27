const ICONS = {
  play: '<path d="M4 2.5v11l9.5-5.5z"/>',
  stop: '<path d="M3.5 3.5h9v9h-9z"/>',
  rec: '<circle cx="8" cy="8" r="5"/>',
  metro: '<path d="M6.2 1.5h3.6l3.4 13H2.8zM8 4.2 6.9 9h2.2zM9.6 9l3.2-5 1 .7-3 4.3z"/>',
  loop: '<path d="M3 6.5A3.5 3.5 0 0 1 6.5 3H11V1l3 3-3 3V5H6.5A1.5 1.5 0 0 0 5 6.5V8H3zm10 3A3.5 3.5 0 0 1 9.5 13H5v2l-3-3 3-3v2h4.5A1.5 1.5 0 0 0 11 9.5V8h2z"/>',
  undo: '<path d="M5 3 1 7l4 4V8h5a3 3 0 0 1 0 6H7v2h3a5 5 0 0 0 0-10H5z"/>',
  redo: '<path d="m11 3 4 4-4 4V8H6a3 3 0 0 0 0 6h3v2H6A5 5 0 0 1 6 6h5z"/>',
  plus: '<path d="M7 2h2v5h5v2H9v5H7V9H2V7h5z"/>',
  x: '<path d="m3.4 2 4.6 4.6L12.6 2 14 3.4 9.4 8l4.6 4.6-1.4 1.4L8 9.4 3.4 14 2 12.6 6.6 8 2 3.4z"/>',
  up: '<path d="M8 3l6 7H2z"/>',
  down: '<path d="M8 13 2 6h12z"/>',
  tri: '<path d="M4 3l8 5-8 5z"/>',
  pen: '<path d="M11.3 1.3 14.7 4.7 5.4 14H2v-3.4zM10 4.4 4 10.4V12h1.6l6-6z"/>',
  sel: '<path d="M2 2h3v2H4v1H2zm5 0h3v2H7zm5 0h2v3h-2V4h0zM2 7h2v3H2zm10 0h2v3h-2zM2 12h2v1h1v2H2zm5 1h3v2H7zm5-1h2v3h-3v-2h1z"/>',
  erase: '<path d="m9.2 1.6 5.2 5.2-7.3 7.3H3.7L1.6 12l7.6-7.6zM5 9.4 3.6 10.8l1 1h1.6l1.2-1.2z"/>',
  slice: '<path d="M7 1h2v14H7zM2 5h3v6H2zm9 0h3v6h-3z"/>',
  menu: '<path d="M2 3h12v2H2zm0 4h12v2H2zm0 4h12v2H2z"/>',
  dl: '<path d="M7 1h2v7l2.5-2.5L13 7l-5 5-5-5 1.5-1.5L7 8zM2 13h12v2H2z"/>',
  gear: '<path d="M7 1h2l.4 2a5 5 0 0 1 1.4.6l1.7-1.2 1.4 1.4-1.2 1.7c.3.4.5.9.6 1.4l2 .4v2l-2 .4a5 5 0 0 1-.6 1.4l1.2 1.7-1.4 1.4-1.7-1.2a5 5 0 0 1-1.4.6L9 15H7l-.4-2a5 5 0 0 1-1.4-.6l-1.7 1.2-1.4-1.4 1.2-1.7A5 5 0 0 1 2.7 9L1 8.6v-2l2-.4c.1-.5.3-1 .6-1.4L2.3 3.1l1.4-1.4 1.7 1.2A5 5 0 0 1 6.8 2.3zM8 5.5A2.5 2.5 0 1 0 8 10.5 2.5 2.5 0 0 0 8 5.5z"/>',
  piano: '<path d="M1 2h14v12H1zm2 2v8h1.5V8.5H5V4zm3 0v4.5h.5V12H8V4zm3 0v8h1.5V8.5H12V4z"/>',
  trash: '<path d="M5 1h6v2h4v2H1V3h4zM3 6h10l-1 9H4z"/>',
  help: '<path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm-.9 10v2h1.8v-2zM8 3.5c-1.7 0-3 1.1-3 2.8h1.8c0-.7.5-1.1 1.2-1.1s1.1.4 1.1 1c0 1.2-2 1.2-2 3.3h1.8c0-1.4 2-1.5 2-3.4 0-1.6-1.3-2.6-2.9-2.6z"/>',
  learn: '<path d="M8 2 .5 5.8 8 9.6l5.5-2.8v3.7H15V6zM3.4 8.4v2.9C3.4 12.6 5.5 14 8 14s4.6-1.4 4.6-2.7V8.4L8 10.8z"/>',
  folder: '<path d="M1 3h5l2 2h7v9H1z"/>',
};
const ico = (n, cls) => { const s = svgEl('svg', { viewBox: '0 0 16 16', class: cls || '' }); s.innerHTML = ICONS[n]; return s; };

function toNorm(o, v) {
  if (o.curve === 'log') return Math.log(v / o.min) / Math.log(o.max / o.min);
  return (v - o.min) / (o.max - o.min);
}
function fromNorm(o, n) {
  n = clamp(n, 0, 1);
  let v = o.curve === 'log' ? o.min * Math.pow(o.max / o.min, n) : o.min + (o.max - o.min) * n;
  if (o.step) v = Math.round(v / o.step) * o.step;
  return +v.toFixed(6);
}

function arcPath(a0, a1, r) {
  const p = a => [20 + r * Math.cos(a), 20 + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function knob(o) {
  const size = o.size || 32;
  const el = h('div', { class: 'knob' });
  const svg = svgEl('svg', { width: size, height: size, viewBox: '0 0 40 40' });
  const A0 = Math.PI * 0.75, A1 = Math.PI * 2.25;
  svg.append(svgEl('path', { d: arcPath(A0, A1, 17), stroke: '#2f3039', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }));
  const val = svgEl('path', { d: '', stroke: o.color || '#ff6b3d', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' });
  svg.append(val);
  svg.append(svgEl('circle', { cx: 20, cy: 20, r: 12, fill: '#26272e' }));
  const ptr = svgEl('line', { x1: 20, y1: 20, x2: 20, y2: 10, stroke: '#ececef', 'stroke-width': 2.4, 'stroke-linecap': 'round' });
  svg.append(ptr);
  el.append(svg);
  if (o.label) el.append(h('span', { class: 'kl', text: o.label }));
  let kv = null;
  if (o.showVal) { kv = h('span', { class: 'kv' }); el.append(kv); }
  let v = o.value;
  const fmt = o.fmt || (x => x.toFixed(2));
  const desc = () => (o.label ? o.label + ': ' : '') + fmt(v);
  const draw = () => {
    const n = clamp(toNorm(o, v), 0, 1);
    const a = A0 + (A1 - A0) * n;
    const mid = A0 + (A1 - A0) * clamp(toNorm(o, o.bipolar ? (o.min + o.max) / 2 : o.min), 0, 1);
    if (Math.abs(a - mid) < 0.01) val.setAttribute('d', '');
    else val.setAttribute('d', a > mid ? arcPath(mid, a, 17) : arcPath(a, mid, 17));
    ptr.setAttribute('x1', (20 + 4 * Math.cos(a)).toFixed(2));
    ptr.setAttribute('y1', (20 + 4 * Math.sin(a)).toFixed(2));
    ptr.setAttribute('x2', (20 + 9.5 * Math.cos(a)).toFixed(2));
    ptr.setAttribute('y2', (20 + 9.5 * Math.sin(a)).toFixed(2));
    if (kv) kv.textContent = fmt(v);
    el.dataset.hint = (o.hint ? o.hint + ' · ' : '') + desc() + ' · тяни вверх/вниз, двойной клик — сброс';
  };
  const setV = (nv, commit) => {
    if (nv === v && !commit) return;
    v = nv;
    draw();
    if (o.onInput) o.onInput(v);
    UI.showValue(desc());
    if (commit && o.onCommit) o.onCommit(v);
  };
  let drag = null;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    drag = { y: e.clientY, n: toNorm(o, v), moved: false };
  });
  el.addEventListener('pointermove', e => {
    if (!drag) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 1) drag.moved = true;
    setV(fromNorm(o, drag.n + dy / (e.shiftKey ? 700 : 170)));
  });
  const end = () => { if (drag) { if (drag.moved && o.onCommit) o.onCommit(v); drag = null; } };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', () => setV(o.def != null ? o.def : o.min, true));
  const commitLater = debounce(() => o.onCommit && o.onCommit(v), 400);
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const st = o.step ? (o.step / (o.max - o.min)) : (e.shiftKey ? 0.005 : 0.02);
    setV(fromNorm(o, toNorm(o, v) + (e.deltaY < 0 ? st : -st)));
    commitLater();
  }, { passive: false });
  el.set = nv => { v = nv; draw(); };
  draw();
  return el;
}

function optSelect(options, value, onChange, cls) {
  const s = h('select', { class: cls || 'sel' });
  for (const [v, l] of options) {
    const op = h('option', { value: v, text: l });
    if (String(v) === String(value)) op.selected = true;
    s.append(op);
  }
  s.addEventListener('change', () => onChange(s.value));
  s.addEventListener('keydown', e => e.stopPropagation());
  return s;
}

function paramControl(spec, value, onInput, onCommit, size) {
  if (spec.options) {
    const wrap = h('div', { class: 'optk', hint: spec.hint || spec.label });
    const isNum = typeof spec.def === 'number';
    wrap.append(optSelect(spec.options, value, x => { const nv = isNum ? +x : x; onInput(nv); onCommit(nv); }));
    wrap.append(h('span', { class: 'kl', text: spec.label }));
    return wrap;
  }
  return knob({ label: spec.label, min: spec.min, max: spec.max, value, def: spec.def, curve: spec.curve, step: spec.step, fmt: spec.fmt, bipolar: spec.bipolar, hint: spec.hint, size: size || 34, onInput, onCommit });
}

Object.assign(UI, {
  showValue(text) {
    const hv = $('#hint .hv');
    if (hv) hv.textContent = text;
    clearTimeout(this._hvT);
    this._hvT = setTimeout(() => { if (hv) hv.textContent = ''; }, 1600);
  },

  toast(msg, ms = 1800) {
    let t = $('#toast');
    if (!t) { t = h('div', { id: 'toast' }); document.body.append(t); }
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(this._tt);
    this._tt = setTimeout(() => t.classList.remove('on'), ms);
  },

  closeMenu() {
    if (this._menu) { this._menu.remove(); this._menu = null; }
  },

  menu(x, y, items) {
    this.closeMenu();
    const m = h('div', { class: 'menu', role: 'menu' });
    for (const it of items) {
      if (!it) continue;
      if (it === '-') { m.append(h('hr')); continue; }
      if (it.head) { m.append(h('div', { class: 'mh', text: it.head })); continue; }
      if (it.swatches) {
        const sw = h('div', { class: 'sw' });
        for (const c of it.swatches) sw.append(h('i', { style: { background: c }, onclick: () => { this.closeMenu(); it.pick(c); } }));
        m.append(sw);
        continue;
      }
      const b = h('button', { role: 'menuitem', disabled: it.disabled }, h('span', { text: it.label }), it.kbd ? h('small', { text: it.kbd }) : null);
      b.addEventListener('click', () => { this.closeMenu(); it.action && it.action(); });
      m.append(b);
    }
    document.body.append(m);
    const r = m.getBoundingClientRect();
    m.style.left = clamp(x, 4, innerWidth - r.width - 4) + 'px';
    m.style.top = (y + r.height > innerHeight - 4 ? Math.max(4, y - r.height) : y) + 'px';
    this._menu = m;
    const first = m.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  },

  modal(o) {
    return new Promise(res => {
      const wrap = h('div', { class: 'modal' });
      const dlg = h('div', { class: 'dlg', role: 'dialog', 'aria-modal': 'true' });
      dlg.append(h('h2', { text: o.title }));
      const body = h('div', { class: 'dlgb' });
      if (typeof o.body === 'string') body.append(h('p', { text: o.body, style: { margin: '4px 0' } }));
      else if (o.body) body.append(o.body);
      dlg.append(body);
      const foot = h('div', { class: 'dlgf' });
      const close = val => { wrap.remove(); document.removeEventListener('keydown', key, true); res(val); };
      for (const b of o.buttons || [{ label: 'Закрыть', value: null }]) {
        const btn = h('button', { class: 'btn' + (b.acc ? ' acc' : ''), text: b.label });
        btn.addEventListener('click', async () => {
          if (b.action) { const r = await b.action(); if (r === false) return; close(r === undefined ? b.value : r); }
          else close(b.value);
        });
        foot.append(btn);
      }
      if ((o.buttons || []).length) dlg.append(foot);
      wrap.append(dlg);
      wrap.addEventListener('pointerdown', e => { if (e.target === wrap && !o.sticky) close(null); });
      const key = e => {
        if (e.key === 'Escape') { e.stopPropagation(); close(null); }
        else if (e.key === 'Enter' && o.enter !== false && e.target.tagName !== 'BUTTON') {
          const acc = foot.querySelector('.acc');
          if (acc) { e.preventDefault(); e.stopPropagation(); acc.click(); }
        } else e.stopPropagation();
      };
      document.addEventListener('keydown', key, true);
      document.body.append(wrap);
      const inp = dlg.querySelector('input,select');
      (inp || foot.querySelector('.acc') || foot.querySelector('button'))?.focus();
      if (inp && inp.select) inp.select();
      if (o.mounted) o.mounted(dlg, close);
    });
  },

  confirm(title, text, ok = 'Да') {
    return this.modal({ title, body: text, buttons: [{ label: 'Отмена', value: false }, { label: ok, acc: true, value: true }] }).then(Boolean);
  },

  prompt(title, label, value) {
    const inp = h('input', { type: 'text', value: value || '', maxlength: 60, id: 'promptInput' });
    const body = h('div', { class: 'field' }, h('label', { for: 'promptInput', text: label }), inp);
    return this.modal({ title, body, buttons: [{ label: 'Отмена', value: null }, { label: 'OK', acc: true, action: () => inp.value.trim() || null }] });
  },

  wins: {},
  _z: 10,
  win(id, o) {
    let W = this.wins[id];
    if (!W) {
      const el = h('div', { class: 'win' });
      const head = h('div', { class: 'winh' });
      const body = h('div', { class: 'winb' });
      el.append(head, body);
      $('#layer').append(el);
      W = this.wins[id] = { el, head, body, o };
      const w = Math.min(o.w || 560, innerWidth - 16);
      el.style.width = w + 'px';
      const n = Object.keys(this.wins).length - 1;
      el.style.left = clamp((o.x != null ? o.x : innerWidth - w - 30 - n * 24), 8, innerWidth - w - 8) + 'px';
      el.style.top = clamp((o.y != null ? o.y : 70 + n * 24), 8, innerHeight - 120) + 'px';
      el.addEventListener('pointerdown', () => { el.style.zIndex = ++this._z; });
      let drag = null;
      head.addEventListener('pointerdown', e => {
        if (e.target.closest('button,input,select')) return;
        head.setPointerCapture(e.pointerId);
        drag = { x: e.clientX - el.offsetLeft, y: e.clientY - el.offsetTop };
      });
      head.addEventListener('pointermove', e => {
        if (!drag) return;
        el.style.left = clamp(e.clientX - drag.x, -el.offsetWidth + 80, innerWidth - 80) + 'px';
        el.style.top = clamp(e.clientY - drag.y, 0, innerHeight - 40) + 'px';
      });
      head.addEventListener('pointerup', () => { drag = null; });
    }
    W.o = o;
    W.el.style.zIndex = ++this._z;
    this.renderWin(id);
    return W;
  },
  renderWin(id) {
    const W = this.wins[id];
    if (!W) return;
    const o = W.o;
    W.head.replaceChildren();
    if (o.color) W.head.append(h('i', { class: 'cdot', style: { background: o.color } }));
    W.head.append(h('span', { class: 'ttl', text: o.title }));
    if (o.headExtra) W.head.append(o.headExtra());
    W.head.append(h('button', { class: 'x', 'aria-label': 'Закрыть', onclick: () => this.closeWin(id) }, ico('x')));
    const st = W.body.scrollTop;
    W.body.replaceChildren();
    o.render(W.body);
    W.body.scrollTop = st;
  },
  closeWin(id) {
    const W = this.wins[id];
    if (!W) return;
    if (W.o.onClose) W.o.onClose();
    W.el.remove();
    delete this.wins[id];
  },
});

function pianoKeys(octaves, base, onDown, onUp) {
  const kb = h('div', { class: 'kbd' });
  const whites = [];
  for (let m = base; m < base + octaves * 12 + 1; m++) if (!isBlack(m)) whites.push(m);
  const ww = 100 / whites.length;
  const keys = {};
  whites.forEach((m, i) => {
    const b = h('b', { style: { left: i * ww + '%', width: ww + '%' } });
    if (m % 12 === 0) b.append(h('span', { text: noteName(m) }));
    b.dataset.m = m;
    kb.append(b);
    keys[m] = b;
  });
  for (let m = base; m < base + octaves * 12; m++) {
    if (!isBlack(m)) continue;
    const wi = whites.indexOf(m - 1);
    const b = h('b', { class: 'k', style: { left: (wi + 1) * ww - ww * 0.3 + '%', width: ww * 0.6 + '%' } });
    b.dataset.m = m;
    kb.append(b);
    keys[m] = b;
  }
  let cur = null;
  const down = m => { if (cur === m) return; if (cur != null) up(); cur = m; keys[m] && keys[m].classList.add('down'); onDown(m); };
  const up = () => { if (cur == null) return; keys[cur] && keys[cur].classList.remove('down'); onUp(cur); cur = null; };
  kb.addEventListener('pointerdown', e => { const b = e.target.closest('b'); if (!b) return; kb.setPointerCapture(e.pointerId); down(+b.dataset.m); });
  kb.addEventListener('pointermove', e => {
    if (cur == null) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const b = el && el.closest && el.closest('.kbd b');
    if (b && b.parentNode === kb) down(+b.dataset.m);
  });
  kb.addEventListener('pointerup', up);
  kb.addEventListener('pointercancel', up);
  return kb;
}
