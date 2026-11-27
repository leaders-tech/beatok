import { chromium } from 'playwright';
import { existsSync } from 'node:fs';
const CHROME = process.env.CHROME || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const out = process.argv[2] || '/tmp/shots';
const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push('console: ' + m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto('file://' + process.cwd() + '/dist/index.html');
await page.waitForTimeout(600);
// piano roll for 808
await page.evaluate(() => { Bt.UI.selectPattern(Bt.P.patterns[1].id); Bt.UI.openRoll(Bt.P.channels.find(c => c.name === '808').id); });
await page.waitForTimeout(300);
const cv = await page.$('#vRoll canvas');
const bb = await cv.boundingBox();
const before = await page.evaluate(() => Bt.P.patterns[1].notes[Bt.P.channels.find(c => c.name === '808').id].length);
await page.mouse.move(bb.x + 58 + 22 * 33 + 5, bb.y + 22 + 15 * 6 + 5);
await page.mouse.down(); await page.mouse.move(bb.x + 58 + 22 * 36, bb.y + 22 + 15 * 6 + 5, { steps: 4 }); await page.mouse.up();
const after = await page.evaluate(() => Bt.P.patterns[1].notes[Bt.P.channels.find(c => c.name === '808').id].length);
console.log('roll notes', before, '->', after);
await page.screenshot({ path: out + '/10-roll.png' });
// undo
await page.keyboard.press('Control+z');
console.log('after undo', await page.evaluate(() => Bt.P.patterns[1].notes[Bt.P.channels.find(c => c.name === '808').id].length));
// instrument window
await page.evaluate(() => Bt.UI.openInstr(Bt.P.channels.find(c => c.name === 'Bell').id));
await page.waitForTimeout(300);
await page.screenshot({ path: out + '/11-instr.png' });
await page.evaluate(() => { for (const k of Object.keys(Bt.UI.wins)) Bt.UI.closeWin(k); });
// mixer
await page.keyboard.press('F9');
await page.evaluate(() => { Bt.UI.selIns = 7; Bt.UI.renderMixer(); });
await page.keyboard.press('Space');
await page.waitForTimeout(1200);
await page.screenshot({ path: out + '/12-mixer.png' });
await page.keyboard.press('Space');
// step toggle via click
await page.keyboard.press('F6');
const step = await page.$$('#vRack .crow:nth-of-type(2) .step');
const s0 = await page.evaluate(() => JSON.stringify(Bt.P.patterns.find(p => p.id === Bt.P.curPat).notes[Bt.P.channels[0].id]?.length));
await step[2].click();
const s1 = await page.evaluate(() => JSON.stringify(Bt.P.patterns.find(p => p.id === Bt.P.curPat).notes[Bt.P.channels[0].id]?.length));
console.log('step click', s0, s1);
// export dialog
await page.evaluate(() => { Bt.UI.exportDialog(); });
await page.waitForTimeout(200);
await page.screenshot({ path: out + '/13-export.png' });
await page.keyboard.press('Escape');
// file menu
await page.click('#btnFile');
await page.waitForTimeout(150);
await page.screenshot({ path: out + '/14-menu.png' });
await page.keyboard.press('Escape');
// templates load house + song mode play
await page.evaluate(() => { Bt.UI.loadTemplate('house'); });
await page.waitForTimeout(200);
await page.click('.dlg .btn.acc');
await page.waitForTimeout(400);
await page.click('text=Трек');
await page.keyboard.press('Space');
await page.waitForTimeout(1500);
await page.screenshot({ path: out + '/15-house-song.png' });
await page.keyboard.press('Space');
// narrow
for (const [w, hgt, n] of [[720, 800, '16-720'], [400, 820, '17-400']]) {
  await page.setViewportSize({ width: w, height: hgt });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/' + n + '.png' });
  const sw = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log(n, 'scrollWidth', sw);
}
console.log('errors', JSON.stringify(errors, null, 1));
await browser.close();
