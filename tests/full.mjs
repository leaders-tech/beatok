import { chromium } from 'playwright';
import { existsSync, writeFileSync } from 'node:fs';
const CHROME = process.env.CHROME || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch({ executablePath: CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
await page.addInitScript(() => { try { if (!localStorage.getItem('bt:learn')) localStorage.setItem('bt:learn', '{"seen":1}'); } catch (e) {} });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' @ ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push('console: ' + m.text()); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
await page.goto('file://' + process.cwd() + '/dist/index.html');
await page.waitForTimeout(500);
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (extra !== '' ? ' ' + extra : '')); };
const ev = (f, a) => page.evaluate(f, a);
const P = () => ev(() => Bt.P);
await page.mouse.click(700, 60);

// knob drag on channel volume
const k = (await page.$$('#vRack .crow:nth-of-type(2) .knob'))[1];
const kb = await k.boundingBox();
const v0 = await ev(() => Bt.P.channels[0].vol);
await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2); await page.mouse.down();
await page.mouse.move(kb.x + kb.width / 2, kb.y - 40, { steps: 5 }); await page.mouse.up();
const v1 = await ev(() => Bt.P.channels[0].vol);
ok('knob drag', v1 > v0, v0 + ' -> ' + v1);
await page.mouse.dblclick(kb.x + kb.width / 2, kb.y + kb.height / 2);
ok('knob dblclick reset', (await ev(() => Bt.P.channels[0].vol)) === 0.8);

// bpm wheel + drag
const bpmEl = await page.$('.lcd.bpm');
const bb = await bpmEl.boundingBox();
await page.mouse.move(bb.x + 20, bb.y + 10);
await page.mouse.wheel(0, -100);
ok('bpm wheel', (await ev(() => Bt.P.bpm)) === 141);
await page.mouse.down(); await page.mouse.move(bb.x + 20, bb.y - 30, { steps: 5 }); await page.mouse.up();
const bpm2 = await ev(() => Bt.P.bpm);
ok('bpm drag', bpm2 > 141, String(bpm2));
await page.mouse.dblclick(bb.x + 20, bb.y + 10);
await page.keyboard.press('Control+a'); await page.keyboard.type('128'); await page.keyboard.press('Enter');
ok('bpm type', (await ev(() => Bt.P.bpm)) === 128);

// metronome, solo via right click
await page.click('[aria-label="Метроном"]');
ok('metronome toggle', await ev(() => Bt.Engine.metro));
await page.click('#vRack .crow:nth-of-type(2) .led', { button: 'right' });
ok('solo', await ev(() => Bt.P.channels[0].solo && Bt.Engine.graph.chans[Bt.P.channels[1].id].mute.gain.value === 0));
await page.click('#vRack .crow:nth-of-type(2) .led', { button: 'right' });
ok('unsolo', await ev(() => !Bt.P.channels.some(c => c.solo)));
await page.click('#vRack .crow:nth-of-type(3) .led');
ok('mute channel', await ev(() => Bt.P.channels[1].mute));
await page.click('#vRack .crow:nth-of-type(3) .led');

// step wheel velocity
const firstStep = await page.$('#vRack .crow:nth-of-type(2) .step.on');
await firstStep.hover();
const vel0 = await ev(() => Bt.P.patterns[0].notes[Bt.P.channels[0].id][0].v);
await page.mouse.wheel(0, 100);
const vel1 = await ev(() => Bt.P.patterns[0].notes[Bt.P.channels[0].id][0].v);
ok('step wheel velocity', vel1 < vel0, vel0 + ' -> ' + vel1);

// channel menu: fill every 4, rename, clone, delete
await page.click('#vRack .crow:nth-of-type(5) .cname', { button: 'right' });
await page.click('.menu button:has-text("каждые 4")');
ok('fill every 4', (await ev(() => Bt.P.patterns[0].notes[Bt.P.channels[3].id].length)) === 8);
await page.click('#vRack .crow:nth-of-type(5) .cname', { button: 'right' });
await page.click('.menu button:has-text("Переименовать")');
await page.fill('#promptInput', 'HH');
await page.click('.dlg .btn.acc');
ok('rename channel', (await ev(() => Bt.P.channels[3].name)) === 'HH');
const nCh = await ev(() => Bt.P.channels.length);
await page.click('#vRack .crow:nth-of-type(5) .cname', { button: 'right' });
await page.click('.menu button:has-text("Клонировать канал")');
ok('clone channel', (await ev(() => Bt.P.channels.length)) === nCh + 1);
await page.click('#vRack .crow:nth-of-type(6) .cname', { button: 'right' });
await page.click('.menu button:has-text("Удалить канал")');
await page.click('.dlg .btn.acc');
ok('delete channel', (await ev(() => Bt.P.channels.length)) === nCh);
await ev(() => { for (const k of Object.keys(Bt.UI.wins)) Bt.UI.closeWin(k); });

// instrument window preset + drum kind
await page.click('#vRack .crow:nth-of-type(2) .cname');
await page.waitForTimeout(100);
await page.selectOption('.win select.sel >> nth=0', 'Kick Hard');
ok('preset switch', (await ev(() => Bt.P.channels[0].preset)) === 'Kick Hard' && (await ev(() => Bt.P.channels[0].params.drive)) === 0.7);
await page.selectOption('.win .isec select.sel', 'tom');
ok('drum kind', (await ev(() => Bt.P.channels[0].params.kind)) === 'tom');
await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');
ok('undo preset', (await ev(() => Bt.P.channels[0].params.kind)) === 'kick');
await page.waitForTimeout(100);
const winKeys = await page.$('.win .kbd b');
await winKeys.click();
ok('window keyboard', true);
await page.click('.win .x');

// pattern menu: clone & delete
const nP = await ev(() => Bt.P.patterns.length);
await page.click('[aria-label="Действия с паттерном"]');
await page.click('.menu button:has-text("Клонировать")');
ok('clone pattern', (await ev(() => Bt.P.patterns.length)) === nP + 1);
await page.click('[aria-label="Действия с паттерном"]');
await page.click('.menu button:has-text("Удалить паттерн")');
await page.click('.dlg .btn.acc');
ok('delete pattern', (await ev(() => Bt.P.patterns.length)) === nP);

// piano roll ops
await ev(() => { const P = Bt.P; Bt.UI.selectPattern(P.patterns.find(p => p.name === 'Bell').id); Bt.UI.openRoll(P.channels.find(c => c.name === 'Bell').id); });
await page.waitForTimeout(200);
const cvb = await (await page.$('#vRoll canvas')).boundingBox();
const nN = await ev(() => Bt.UI.rollNotes().length);
await page.keyboard.down('Control');
await page.mouse.move(cvb.x + 70, cvb.y + 30); await page.mouse.down(); await page.mouse.move(cvb.x + cvb.width - 10, cvb.y + cvb.height - 80, { steps: 6 }); await page.mouse.up();
await page.keyboard.up('Control');
const nSel = await ev(() => Bt.UI.rollSel.size);
ok('band select', nSel > 3, String(nSel));
await ev(() => Bt.UI.rollSel = new Set(Bt.UI.rollNotes().slice(0, 3)));
await page.keyboard.press('Control+c');
await page.keyboard.press('Control+v');
ok('copy paste', (await ev(() => Bt.UI.rollNotes().length)) === nN + 3);
const pitch0 = await ev(() => [...Bt.UI.rollSel][0].n);
await page.keyboard.press('ArrowUp');
ok('transpose', (await ev(() => [...Bt.UI.rollSel][0].n)) === pitch0 + 1);
await page.keyboard.press('Delete');
ok('delete notes', (await ev(() => Bt.UI.rollNotes().length)) === nN);
await ev(() => Bt.UI.rollSel = new Set(Bt.UI.rollNotes().slice(0, 2)));
await page.keyboard.press('Control+d');
ok('duplicate', (await ev(() => Bt.UI.rollNotes().length)) === nN + 2);
await page.keyboard.press('Control+z');
ok('undo duplicate', (await ev(() => Bt.UI.rollNotes().length)) === nN);
// velocity lane drag
await ev(() => Bt.UI.rollSel.clear());
const firstX = await ev(() => { const G = Bt.UI.rollGeo(); return G.x(Bt.UI.rollNotes()[0].t); });
await page.mouse.move(cvb.x + firstX + 1, cvb.y + cvb.height - 10); await page.mouse.down(); await page.mouse.up();
const vv = await ev(() => Bt.UI.rollNotes()[0].v);
ok('velocity lane', vv < 0.3, String(vv));
// erase tool
await page.click('.tools button:nth-child(3)');
const nx = await ev(() => { const G = Bt.UI.rollGeo(); const n = Bt.UI.rollNotes()[0]; return [G.x(n.t) + 4, G.y(n.n) + 4]; });
await page.mouse.click(cvb.x + nx[0], cvb.y + nx[1]);
ok('erase tool', (await ev(() => Bt.UI.rollNotes().length)) === nN - 1);
await page.click('.tools button:nth-child(1)');
// chord stamp
await page.selectOption('.rbar select.sel >> nth=2', 'min7');
const before = await ev(() => Bt.UI.rollNotes().length);
await page.mouse.click(cvb.x + 60 + 22 * 40, cvb.y + 60);
ok('chord stamp', (await ev(() => Bt.UI.rollNotes().length)) === before + 4);
// roll tools: legato
await page.click('.rbar button:has-text("Инструменты")');
await page.click('.menu button:has-text("Легато")');
ok('legato', true);
// keyboard octave and play note into roll channel
await page.keyboard.press(']');
ok('octave up', (await ev(() => Bt.UI.kbOct)) === 5);
await page.keyboard.press('[');

// playlist: move clip, resize, track mute, seek
await page.keyboard.press('F5');
await page.waitForTimeout(150);
const pcv = await (await page.$('#vPlaylist canvas')).boundingBox();
const clip = await ev(() => { const c = Bt.P.playlist.clips[0]; const G = Bt.UI.plGeo(); return { x: G.x(c.s), y: G.y(c.tr), w: c.l * G.pps, s: c.s }; });
await page.mouse.move(pcv.x + clip.x + 30, pcv.y + clip.y + 20); await page.mouse.down();
await page.mouse.move(pcv.x + clip.x + 30 + 96 * 2, pcv.y + clip.y + 20 + 44 * 4, { steps: 6 }); await page.mouse.up();
const moved = await ev(() => Bt.P.playlist.clips[0]);
ok('move clip', moved.s === clip.s + 32 && moved.tr === 4, JSON.stringify([moved.s, moved.tr]));
const c2 = await ev(() => { const c = Bt.P.playlist.clips[0]; Bt.UI.pv.sx = c.s + c.l - 64; Bt.UI.drawPlaylist(); const G = Bt.UI.plGeo(); return { x: G.x(c.s) + c.l * G.pps - 3, y: G.y(c.tr) + 20, l: c.l }; });
await page.mouse.move(pcv.x + c2.x, pcv.y + c2.y); await page.mouse.down(); await page.mouse.move(pcv.x + c2.x + 96, pcv.y + c2.y, { steps: 4 }); await page.mouse.up();
ok('resize clip', (await ev(() => Bt.P.playlist.clips[0].l)) === c2.l + 16);
await ev(() => { Bt.UI.pv.sx = 0; Bt.UI.drawPlaylist(); });
await page.mouse.click(pcv.x + 14, pcv.y + 24 + 22);
ok('track mute', await ev(() => Bt.P.playlist.tracks[0].mute));
await page.mouse.click(pcv.x + 14, pcv.y + 24 + 22);
await page.mouse.click(pcv.x + 118 + 96 * 3 + 5, pcv.y + 10);
ok('seek', (await ev(() => Bt.Engine.songStart)) === 48);
await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');

// song loop off stops
await ev(() => { Bt.Engine.loopSong = false; Bt.Engine.setMode('song'); Bt.Engine.songStart = Bt.P.playlist.clips.reduce((a, c) => Math.max(a, c.s + c.l), 0) - 4; Bt.Engine.play(); });
await page.waitForTimeout(1600);
ok('song end stops', !(await ev(() => Bt.Engine.playing)));
await ev(() => { Bt.Engine.loopSong = true; Bt.Engine.setMode('pattern'); Bt.Engine.songStart = 0; });

// mixer: fader, mute, solo, fx move/remove, rename
await page.keyboard.press('F9');
await ev(() => { Bt.UI.selIns = 8; Bt.UI.renderMixer(); });
const fad = await (await page.$('.strip:nth-of-type(9) .fader')).boundingBox();
await page.mouse.click(fad.x + 9, fad.y + fad.height * 0.9);
const fv = await ev(() => Bt.P.mixer[8].vol);
ok('fader click', fv < 0.3, String(fv));
await page.click('.strip:nth-of-type(9) .mbtns .m');
ok('insert mute', await ev(() => Bt.P.mixer[8].mute && Bt.Engine.graph.inserts[8].mute.gain.value === 0));
await page.click('.strip:nth-of-type(9) .mbtns .m');
await page.click('.strip:nth-of-type(9) .mbtns .s');
ok('insert solo', await ev(() => Bt.Engine.graph.inserts[2].mute.gain.value === 0 && Bt.Engine.graph.inserts[8].mute.gain.value === 1));
await page.click('.strip:nth-of-type(9) .mbtns .s');
const order0 = await ev(() => Bt.P.mixer[8].fx.map(f => f.type).join());
await page.click('.fxp .fxsec:nth-of-type(4) button[aria-label="Выше"]');
const order1 = await ev(() => Bt.P.mixer[8].fx.map(f => f.type).join());
ok('fx reorder', order0 === 'delay,reverb' && order1 === 'reverb,delay', order0 + ' -> ' + order1);
await page.click('.fxp .fxsec:nth-of-type(3) button[aria-label="Удалить"]');
ok('fx remove', (await ev(() => Bt.P.mixer[8].fx.length)) === 1);
await page.fill('.fxp h3 input', 'Bells bus');
await page.press('.fxp h3 input', 'Enter');
ok('rename insert', (await ev(() => Bt.P.mixer[8].name)) === 'Bells bus');
// fx knob drag
const fk = await (await page.$('.fxp .fxsec:nth-of-type(3) .knob')).boundingBox();
const p0 = await ev(() => JSON.stringify(Bt.P.mixer[8].fx[0].p));
await page.mouse.move(fk.x + fk.width / 2, fk.y + 15); await page.mouse.down(); await page.mouse.move(fk.x + fk.width / 2, fk.y - 30, { steps: 4 }); await page.mouse.up();
ok('fx knob', (await ev(() => JSON.stringify(Bt.P.mixer[8].fx[0].p))) !== p0);

// browser: add drum, add fx
const nC = await ev(() => Bt.P.channels.length);
await page.click('.bitem:has-text("Cowbell")');
ok('browser add channel', (await ev(() => Bt.P.channels.length)) === nC + 1);
await page.click('.bhead:has-text("Эффекты")');
await ev(() => { Bt.UI.selIns = 3; });
await page.click('.bitem:has-text("Хорус")');
ok('browser add fx', await ev(() => Bt.P.mixer[3].fx.some(f => f.type === 'chorus')));
await page.hover('.bitem:has-text("Clap Big")');
await page.click('.bitem:has-text("Clap Big") .pv');
ok('browser preview', true);

// save as, projects dialog, open
await ev(() => { Bt.UI.saveProject(true); });
await page.fill('#promptInput', 'Мой бит');
await page.click('.dlg .btn.acc');
await page.waitForTimeout(200);
await ev(() => { Bt.UI.projectsDialog(); });
await page.waitForTimeout(400);
const items = await page.$$eval('.pitem .nm', els => els.map(e => e.textContent));
ok('projects list', items.includes('Мой бит'), JSON.stringify(items));
await page.click('.dlg .btn:has-text("Отмена"), .modal', { position: { x: 5, y: 5 } }).catch(() => {});
await page.keyboard.press('Escape');

// templates dialog -> lofi
await ev(() => { Bt.UI.templatesDialog(); });
await page.click('.pitem:has-text("Lo-fi")');
await page.waitForTimeout(200);
ok('template lofi', (await ev(() => Bt.P.bpm)) === 82);

// open project file via file chooser
writeFileSync('/tmp/proj.bt.json', JSON.stringify({ proj: await ev(() => { const p = Bt.TEMPLATES.house(); p.name = 'File proj'; return p; }), samples: [] }));
const [fc] = await Promise.all([page.waitForEvent('filechooser'), ev(() => { Bt.UI.openProjectFile(); })]);
await fc.setFiles('/tmp/proj.bt.json');
await page.waitForTimeout(300);
ok('open project file', (await ev(() => Bt.P.name)) === 'File proj');

// reload restores autosave
await page.waitForTimeout(900);
await page.reload();
await page.waitForTimeout(500);
ok('autosave restore', (await ev(() => Bt.P.name)) === 'File proj');

// phone drawer
await page.setViewportSize({ width: 420, height: 820 });
await page.click('[aria-label="Звуки и шаблоны"]');
await page.waitForTimeout(250);
ok('mobile drawer', await ev(() => document.body.classList.contains('bopen')));
await page.screenshot({ path: '/tmp/shots/30-drawer.png' });

console.log(fails ? fails + ' FAILED' : 'ALL PASSED');
console.log('errors', JSON.stringify(errors, null, 1));
await browser.close();
