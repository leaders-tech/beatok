import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const CHROME = process.env.CHROME || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage();
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto('file://' + process.cwd() + '/dist/index.html');
await page.waitForTimeout(500);
for (const k of (process.argv[2] || 'trap').split(',')) {
  const b64 = await page.evaluate(async k => {
    await window.__load(BeatOk.TEMPLATES[k]());
    const buf = await BeatOk.Engine.render({ mode: 'song', tail: 1.5 });
    const u8 = BeatOk.encodeWav(buf, 16);
    let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }, k);
  writeFileSync('/tmp/' + k + '.wav', Buffer.from(b64, 'base64'));
  console.log('wrote /tmp/' + k + '.wav');
}
await browser.close();
