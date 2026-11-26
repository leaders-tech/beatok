const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
let _uidN = 0;
const uid = (p = 'i') => p + Date.now().toString(36).slice(-5) + (_uidN++).toString(36) + Math.floor(Math.random() * 1296).toString(36);
const deep = o => JSON.parse(JSON.stringify(o));
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteName = m => NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
const isBlack = m => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const sk in v) sk.startsWith('--') ? e.style.setProperty(sk, v[sk]) : (e.style[sk] = v[sk]); }
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else if (k === 'hint') e.dataset.hint = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

function svgEl(tag, attrs) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function fmtTime(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), cs = Math.floor((sec * 100) % 100);
  return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function setupCanvas(cv) {
  const dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, hh = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hh * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(hh * dpr);
  }
  const c = cv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, w, h: hh };
}

function b64FromBuf(buf) {
  const u8 = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function bufFromB64(b64) {
  const s = atob(b64);
  const u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return u8.buffer;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = x => clamp(Math.round(f < 0 ? x * (1 + f) : x + (255 - x) * f), 0, 255);
  return '#' + [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)].map(x => x.toString(16).padStart(2, '0')).join('');
}

const UI = {};

const PALETTE = ['#ff5d6c', '#ff8a4c', '#ffc145', '#7ee081', '#3dd6c3', '#5cc8ff', '#7c9cff', '#b48cff', '#f472b6', '#c4c6cf'];
const OLD_COLORS = { '#e0402f': '#ff5d6c', '#f07a22': '#ff8a4c', '#f2c230': '#ffc145', '#ece4cf': '#c4c6cf', '#7fc46a': '#7ee081', '#4fb3c9': '#5cc8ff', '#6f8df0': '#7c9cff', '#b07ae8': '#b48cff', '#e86fb0': '#f472b6', '#c9a27a': '#c4c6cf' };
