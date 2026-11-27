import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const CHROME = process.env.CHROME || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = 'file://' + join(root, 'dist', 'index.html');
const out = process.argv[2] || '/tmp/shots';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto(url);
await page.waitForTimeout(800);
await page.screenshot({ path: out + '/01-load.png' });
await page.mouse.click(700, 300);
await page.keyboard.press('Space');
await page.waitForTimeout(1800);
const st = await page.evaluate(() => ({ playing: Bt.Engine.playing, pos: Bt.Engine.displayPos(), voices: Bt.Engine.graph.voices.length, state: Bt.Engine.ctx.state }));
console.log('play state', JSON.stringify(st));
await page.screenshot({ path: out + '/02-playing.png' });
await page.keyboard.press('Space');
const renders = await page.evaluate(async () => {
  const res = {};
  for (const k of ['trap', 'house', 'lofi']) {
    const p = Bt.TEMPLATES[k]();
    await window.__load(p);
    const t0 = performance.now();
    const buf = await Bt.Engine.render({ mode: 'song', tail: 1, normalize: false });
    const ms = performance.now() - t0;
    let peak = 0, sum = 0, n = 0, clip = 0;
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 3) { const a = Math.abs(d[i]); if (a > peak) peak = a; if (a > 0.99) clip++; sum += d[i] * d[i]; n++; } }
    res[k] = { dur: buf.duration.toFixed(1), renderMs: Math.round(ms), peak: peak.toFixed(3), rmsDb: (10 * Math.log10(sum / n)).toFixed(1), clip };
  }
  return res;
});
console.log('renders', JSON.stringify(renders, null, 1));
console.log('errors', JSON.stringify(errors, null, 1));
await browser.close();
