import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
const CHROME = process.env.CHROME || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const SHOTS = process.argv[2];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push('console: ' + m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto('file://' + process.cwd() + '/dist/index.html');
await page.waitForTimeout(600);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : '')); };
const ev = f => page.evaluate(f);
const shot = async n => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };
const state = () => ev(() => ({ c: Bt.UI.lc, s: Bt.UI.ls, pass: Bt.UI.lPass, msg: Bt.UI.lMsg, stat: document.querySelector('.lstat') && document.querySelector('.lstat').textContent, spots: document.querySelectorAll('.lspot').length }));
const tick = () => page.waitForTimeout(350);
const next = async () => { await page.click('.lfoot .btn:last-child'); await tick(); };
const demo = async () => { await page.click('.lbtns .btn:has-text("Сделай за меня")'); await tick(); };

ok('panel auto-opens first time', await ev(() => document.body.classList.contains('learn') && !!document.querySelector('#learn .lcard')));
ok('three courses', (await page.$$('#learn .lcard')).length === 3);
await shot('01-home');
await page.click('#learn summary');
await page.waitForTimeout(200);
await shot('02-refs');
await page.click('#learn summary');

await page.click('#learn .lcard:nth-of-type(1) .btn.acc');
await tick();
let st = await state();
ok('intro starts', st.c === 'intro' && st.s === 0 && !st.pass && st.spots >= 1, JSON.stringify(st));
await page.mouse.click(700, 300);
await page.keyboard.press('Space');
await tick();
ok('intro play passes', (await state()).pass);
await page.keyboard.press('Space');
await next();
const stepBox = await page.$('#vRack .crow .step:nth-child(3)');
await stepBox.click();
await tick();
ok('intro rack click passes', (await state()).pass);
await next();
await page.keyboard.press('F7');
await tick();
ok('intro roll passes', (await state()).pass);
await next();
await page.click('[data-learn="mode"] button:has-text("Трек")');
await tick();
ok('intro song mode passes', (await state()).pass);
await next();
await page.keyboard.press('F9');
await tick();
ok('intro mixer passes', (await state()).pass);
await next();
await next();
ok('intro finished', await ev(() => !Bt.UI.lc && JSON.parse(localStorage.getItem('bt:learn')).intro.done === 1));
await ev(() => Bt.Engine.setMode('pattern'));

await page.click('#learn .lcard:nth-of-type(2) .btn.acc');
await page.waitForTimeout(300);
await page.click('.modal .btn.acc');
await page.waitForTimeout(500);
st = await state();
ok('jerk loads starter', st.c === 'jerk' && st.s === 0 && (await ev(() => Bt.P.learn)) === 'jerk', JSON.stringify(st));
ok('jerk step1 not passed', !st.pass);
await shot('03-jerk-tempo');
const bpm = await page.$('.lcd.bpm');
await bpm.dblclick();
await page.keyboard.press('Control+A');
await page.keyboard.type('121');
await page.keyboard.press('Enter');
await tick();
ok('jerk tempo by hand', (await state()).pass, String(await ev(() => Bt.P.bpm)));
await next();
st = await state();
ok('jerk key step opens roll', st.s === 1 && (await ev(() => Bt.UI.topTab)) === 'roll' && st.spots >= 2, JSON.stringify(st));
await page.selectOption('[data-learn="key"]', '9');
await page.selectOption('[data-learn="scale"]', 'minor');
await tick();
ok('jerk key by hand', (await state()).pass);
await next();
await shot('04-jerk-808-steps');
st = await state();
ok('808 step highlights 4 steps', st.spots === 4 && !st.pass, JSON.stringify(st));
const stepEl = i => page.evaluateHandle(i => { const id = Bt.P.channels.find(c => c.role === '808').id; return Bt.UI.stepEls[id][i]; }, i);
for (const i of [0, 4, 8]) await (await stepEl(i)).click();
await tick();
st = await state();
ok('808 check waits for all 4', !st.pass && /13/.test(st.stat), st.stat);
await (await stepEl(12)).click();
await tick();
ok('808 by hand passes', (await state()).pass);
await next();
await shot('05-jerk-bassline');
ok('bassline not passed yet', !(await state()).pass);
await demo();
ok('bassline demo passes', (await state()).pass);
await next();
await demo();
ok('glide demo passes', (await state()).pass);
await next();
for (let i = 6; i <= 13; i++) {
  st = await state();
  if (i < 13) ok(`jerk step ${i} pending before demo`, !st.pass || i === 13, JSON.stringify(st));
  await demo();
  st = await state();
  ok(`jerk step ${i} demo passes`, st.pass, JSON.stringify(st));
  if (i === 9) await shot('06-jerk-melody');
  if (i === 12) await shot('07-jerk-arrange');
  await next();
}
st = await state();
ok('jerk last step', st.s === 13, JSON.stringify(st));
await shot('08-jerk-done');
const undoOk = await ev(() => { const n = Bt.P.mixer[0].fx.length; Bt.History.undo(); const m = Bt.P.mixer[0].fx.length; Bt.History.redo(); return n > m; });
ok('demo is undoable', undoOk);
await next();
ok('jerk finished', await ev(() => !Bt.UI.lc && JSON.parse(localStorage.getItem('bt:learn')).jerk.done === 1));

const jerkRender = await ev(async () => {
  const buf = await Bt.Engine.render({ mode: 'song', tail: 1 });
  const d = buf.getChannelData(0); let pk = 0, s = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; s += d[i] * d[i]; }
  return { sec: +(buf.length / buf.sampleRate).toFixed(1), peak: +pk.toFixed(3), rms: +(10 * Math.log10(s / d.length)).toFixed(1) };
});
ok('jerk song renders', jerkRender.sec > 80 && jerkRender.peak > 0.5 && jerkRender.peak <= 1.0 && jerkRender.rms > -20, JSON.stringify(jerkRender));

await page.click('#learn .lcard:nth-of-type(3) .btn.acc');
await page.waitForTimeout(300);
if (await page.$('.modal')) await page.click('.modal .btn.acc');
await page.waitForTimeout(500);
st = await state();
ok('plugg starts', st.c === 'plugg' && st.s === 0, JSON.stringify(st));
const nP = await ev(() => Bt.UI.lc && 10);
for (let i = 0; i < nP; i++) {
  st = await state();
  const s = await ev(() => { const c = Bt.UI.lc; return c; });
  const hasDemo = await page.$('.lbtns .btn:has-text("Сделай за меня")');
  if (hasDemo) {
    ok(`plugg step ${i} pending`, !st.pass, JSON.stringify(st));
    await demo();
    st = await state();
    ok(`plugg step ${i} demo passes`, st.pass, JSON.stringify(st));
  }
  if (i === 2) await shot('09-plugg-chords');
  if (i === 6) await shot('10-plugg-triplets');
  await next();
}
ok('plugg finished', await ev(() => !Bt.UI.lc && JSON.parse(localStorage.getItem('bt:learn')).plugg.done === 1));
const pr = await ev(async () => {
  const buf = await Bt.Engine.render({ mode: 'song', tail: 1 });
  const d = buf.getChannelData(0); let pk = 0, s = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; s += d[i] * d[i]; }
  return { sec: +(buf.length / buf.sampleRate).toFixed(1), peak: +pk.toFixed(3), rms: +(10 * Math.log10(s / d.length)).toFixed(1) };
});
ok('plugg song renders', pr.sec > 40 && pr.peak > 0.3 && pr.peak <= 1.0, JSON.stringify(pr));

const tpl = await ev(async () => {
  const out = {};
  for (const k of ['jerk', 'plugg']) {
    const p = Bt.TEMPLATES[k]();
    await window.__load(p);
    out[k] = { name: p.name, pats: p.patterns.length, clips: p.playlist.clips.length, learn: p.learn || null };
  }
  return out;
});
ok('templates from courses', tpl.jerk.clips >= 9 && tpl.plugg.clips === 5 && !tpl.jerk.learn, JSON.stringify(tpl));
ok('templates listed in browser', await ev(() => [...document.querySelectorAll('#browser .bitem.tpl b')].map(b => b.textContent).join(',').includes('Джерк')));

await ctx.close();
const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mp = await mob.newPage();
await mp.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await mp.goto('file://' + process.cwd() + '/dist/index.html');
await mp.waitForTimeout(500);
await mp.evaluate(() => Bt.UI.toggleLearn(true));
await mp.waitForTimeout(300);
const mw = await mp.evaluate(() => { const r = document.querySelector('#learn').getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top }; });
ok('mobile bottom sheet', mw.w === 390 && mw.h < 844 * 0.55 && mw.top > 400, JSON.stringify(mw));
if (SHOTS) await mp.screenshot({ path: `${SHOTS}/11-mobile.png` });
await browser.close();
console.log('errors', errors);
console.log(fails ? `FAILED ${fails}` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
