import { chromium } from 'playwright';
import { existsSync, statSync } from 'node:fs';
const CHROME = process.env.CHROME || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push('console: ' + m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto('file://' + process.cwd() + '/dist/index.html');
await page.waitForTimeout(500);
const ok = (name, cond, extra = '') => console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' ' + extra : ''));
const ev = f => page.evaluate(f);

// 1. recording
await page.mouse.click(700, 120);
await ev(() => { const P = Bt.P; const bell = P.channels.find(c => c.name === 'Bell'); Bt.UI.selectChannel(bell.id); Bt.Engine.recording = true; });
await page.keyboard.press('Space');
await page.waitForTimeout(300);
await page.keyboard.down('q'); await page.waitForTimeout(250); await page.keyboard.up('q');
await page.keyboard.down('e'); await page.waitForTimeout(200); await page.keyboard.up('e');
await page.keyboard.press('Space');
const rec = await ev(() => { const P = Bt.P; const bell = P.channels.find(c => c.name === 'Bell'); const pat = P.patterns.find(p => p.id === P.curPat); return (pat.notes[bell.id] || []).map(n => n.n); });
ok('record notes', rec.length === 2 && rec.includes(60) && rec.includes(64), JSON.stringify(rec));
await ev(() => { Bt.Engine.recording = false; });

// 2. sampler import
const smp = await ev(async () => {
  const sr = 44100, len = sr / 2, ab = new ArrayBuffer(44 + len * 2), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, 'RIFF'); v.setUint32(4, 36 + len * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, len * 2, true);
  for (let i = 0; i < len; i++) v.setInt16(44 + i * 2, Math.sin(i / sr * 2 * Math.PI * 261.6) * 12000 * (1 - i / len), true);
  await Bt.UI.importSamples([new File([ab], 'my vocal.wav', { type: 'audio/wav' })]);
  const ch = Bt.P.channels.find(c => c.type === 'sampler');
  return { name: ch && ch.name, sid: ch && ch.params.sid, wins: Object.keys(Bt.UI.wins) };
});
ok('sampler import', smp.name === 'my vocal' && !!smp.sid, JSON.stringify(smp));
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/shots/20-sampler.png' });
await ev(() => { for (const k of Object.keys(Bt.UI.wins)) Bt.UI.closeWin(k); });
const smpRender = await ev(async () => {
  const P = Bt.P; const ch = P.channels.find(c => c.type === 'sampler'); const pat = P.patterns.find(p => p.id === P.curPat);
  pat.notes[ch.id] = [{ t: 0, d: 4, n: 60, v: 1 }, { t: 8, d: 4, n: 67, v: 1 }];
  for (const c of P.channels) c.mute = c !== ch;
  Bt.Engine.rebuild && Bt.Engine.ctx && Bt.Engine.rebuild();
  const buf = await Bt.Engine.render({ mode: 'pattern', loops: 1, tail: 0.2 });
  let pk = 0; const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
  for (const c of P.channels) c.mute = false;
  return pk;
});
ok('sampler renders', smpRender > 0.05, 'peak ' + smpRender.toFixed(3));

// 3. save / list / load (local)
const store = await ev(async () => {
  await Bt.Store.ready;
  Bt.P.name = 'Test Save';
  await Bt.Store.save(Bt.P);
  const list = await Bt.Store.list();
  const id = Bt.P.id;
  const data = await Bt.Store.load(id);
  return { mode: Bt.Store.mode, n: list.length, name: list[0] && list[0].name, samples: data.samples.length, ch: data.proj.channels.length };
});
ok('store local', store.n >= 1 && store.name === 'Test Save' && store.samples === 1, JSON.stringify(store));

// 4. export wav via download fallback
await ev(() => { Bt.UI.exportDialog(); });
await page.selectOption('#expWhat', 'pattern');
await page.selectOption('#expLoops', '1');
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('.dlg .btn.acc')]);
const wavPath = '/tmp/export-test.wav';
await dl.saveAs(wavPath);
ok('export wav', dl.suggestedFilename().endsWith('.wav') && statSync(wavPath).size > 100000, dl.suggestedFilename() + ' ' + statSync(wavPath).size);
await page.keyboard.press('Escape');

// 5. midi
const [dl2] = await Promise.all([page.waitForEvent('download'), ev(() => { Bt.UI.exportMidi(); })]);
await dl2.saveAs('/tmp/export-test.mid');
const midSize = statSync('/tmp/export-test.mid').size;
ok('export midi', dl2.suggestedFilename().endsWith('.mid') && midSize > 100, dl2.suggestedFilename() + ' ' + midSize);

// 6. playlist interactions
await page.keyboard.press('F5');
await page.waitForTimeout(200);
const cv = await page.$('#vPlaylist canvas');
const bb = await cv.boundingBox();
const nClips0 = await ev(() => Bt.P.playlist.clips.length);
await page.mouse.click(bb.x + 118 + 6 * 16 * 3 + 10, bb.y + 24 + 44 * 4 + 20);
const nClips1 = await ev(() => Bt.P.playlist.clips.length);
await page.mouse.click(bb.x + 118 + 6 * 16 * 3 + 10, bb.y + 24 + 44 * 4 + 20, { button: 'right' });
const nClips2 = await ev(() => Bt.P.playlist.clips.length);
ok('playlist add/remove clip', nClips1 === nClips0 + 1 && nClips2 === nClips0, [nClips0, nClips1, nClips2].join(','));

// 7. mixer fx add / toggle / remove + undo
await page.keyboard.press('F9');
await ev(() => { Bt.UI.selIns = 1; Bt.UI.renderMixer(); });
const fx0 = await ev(() => Bt.P.mixer[1].fx.length);
await page.selectOption('.fxp select.sel >> nth=-1', 'dist');
const fx1 = await ev(() => Bt.P.mixer[1].fx.length);
await page.click('.fxp .fxsec:last-of-type .pw');
const fxOn = await ev(() => Bt.P.mixer[1].fx.at(-1).on);
await page.keyboard.press('Control+z');
await page.keyboard.press('Control+z');
const fx2 = await ev(() => Bt.P.mixer[1].fx.length);
ok('mixer fx + undo', fx1 === fx0 + 1 && fxOn === false && fx2 === fx0, [fx0, fx1, fxOn, fx2].join(','));

// 8. pattern ops
const pats = await ev(async () => { Bt.UI.newPattern(); return Bt.P.patterns.length; });
ok('new pattern', pats >= 5, String(pats));

// 9. song mode play + stop
await ev(() => { Bt.Engine.setMode('song'); Bt.Engine.play(); });
await page.waitForTimeout(800);
const songPos = await ev(() => Bt.Engine.displayPos());
await ev(() => Bt.Engine.stop());
ok('song play', songPos > 1, songPos.toFixed(2));

// 10. help, templates dialog
await page.keyboard.press('F1');
await page.waitForTimeout(100);
ok('help dialog', await page.$('.dlg') !== null);
await page.screenshot({ path: '/tmp/shots/21-help.png' });
await page.keyboard.press('Escape');

console.log('errors', JSON.stringify(errors, null, 1));
await browser.close();
