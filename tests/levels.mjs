import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const CHROME = process.env.CHROME || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto('file://' + process.cwd() + '/dist/index.html');
await page.waitForTimeout(500);
const res = await page.evaluate(async () => {
  const out = [];
  const { P } = Bt;
  const tables = window.__tables;
  for (const [type, names] of tables) {
    for (const name of names) {
      const ctx = new OfflineAudioContext(2, 44100 * 3, 44100);
      const params = window.__presetParams(type, name);
      const midis = type === 'synth' && !/Bass|303/.test(name) ? [60, 64, 67] : [type === 'bass808' || /Bass|303/.test(name) ? 36 : 60];
      for (const m of midis) window.__INSTR[type](ctx, ctx.destination, params, 0.01, m, 0.85, 0.6, {});
      const buf = await ctx.startRendering();
      let peak = 0, sum = 0, last = 0;
      const d = buf.getChannelData(0), d2 = buf.getChannelData(1);
      for (let i = 0; i < d.length; i++) { const a = Math.max(Math.abs(d[i]), Math.abs(d2[i])); if (a > peak) peak = a; sum += d[i] * d[i]; if (a > 0.003) last = i; }
      out.push({ type, name, peak: +peak.toFixed(3), rmsDb: +(10 * Math.log10(sum / Math.max(1, last))).toFixed(1), len: +(last / 44100).toFixed(2) });
    }
  }
  return out;
});
for (const r of res) console.log(r.type.padEnd(8), r.name.padEnd(18), 'peak', String(r.peak).padEnd(6), 'rms', String(r.rmsDb).padEnd(6), 'len', r.len);
await browser.close();
