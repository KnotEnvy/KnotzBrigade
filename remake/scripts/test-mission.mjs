import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { installPilot } from './helpers/pilot.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const evidence = fileURLToPath(new URL('../../docs/evidence/mission/', import.meta.url));
await mkdir(evidence, { recursive: true });
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}/`;
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const errors = [], checks = [], runs = [];
const pass = name => { checks.push(name); console.log(`PASS: ${name}`); };

async function open(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, ...options });
  page.on('pageerror', e => errors.push(e.stack));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.engine === '4.2.1');
  return page;
}
async function start(page, difficulty = 'pilot', weapon = 'lance') {
  await page.locator('#difficulty').selectOption(difficulty);
  await page.locator('#weapon').selectOption(weapon);
  await page.locator('#begin').click();
  await page.waitForFunction(() => window.__KNOTZ_GAME__.scene.isActive('mission'));
  await page.evaluate(() => {
    const game = window.__KNOTZ_GAME__;
    game.loop.stop();
    window.__testTime = game.loop.now;
    window.__step = (frames = 1) => {
      for (let i = 0; i < frames; i++) {
        window.__testTime += 1000 / 60;
        // The same public scene-manager update used by Game.step, with rendering
        // omitted between snapshots. This is simulation validation, not an fps test.
        game.events.emit('prestep', window.__testTime, 1000 / 60);
        game.events.emit('step', window.__testTime, 1000 / 60);
        game.scene.update(window.__testTime, 1000 / 60);
        game.events.emit('poststep', window.__testTime, 1000 / 60);
        game.scene.isProcessing = false;
      }
    };
    window.__render = () => game.step(window.__testTime + 0.01, 0);
  });
}

try {
  const page = await open();
  await page.screenshot({ path: `${evidence}harbor.png` });
  await page.getByRole('button', { name: 'Flight manual' }).click();
  assert.equal(await page.locator('#how-dialog').evaluate(e => e.open), true);
  await page.getByRole('button', { name: 'Understood' }).click();
  await page.locator('#auto-fire').uncheck();
  await start(page);
  const mechanics = await page.evaluate(() => {
    const s = window.__KNOTZ_GAME__.scene.getScene('mission');
    // Controlled fixtures exercise actual Arcade overlap/death resolution.
    const first = s.spawnEnemy('drone', 600, 350), second = s.spawnEnemy('drone', 600, 350);
    s.playerShot(0, 99);
    const shot = s.friendly.getChildren().find(s => s.active);
    shot.enableBody(true, 600, 350, true, true); shot.setVelocity(0, 0);
    window.__step(2);
    const overlap = { kills: s.stats.kills, active: Number(first.active) + Number(second.active), hit: s.stats.hit, fired: s.stats.fired };
    const score = s.stats.score;
    s.damageEnemy(first.dead ? first : second, 999);
    const duplicate = s.stats.score === score;
    for(const e of s.enemies.getChildren()) e.disableBody(true,true);
    s.activateGuard();
    s.fireEnemy(s.player.x + 48, s.player.y, Math.PI, 0);
    window.__step(1);
    const caught = s.stats.absorbed;
    const cooldown = s.guardReady; s.activateGuard();
    const noRetrigger = cooldown === s.guardReady;
    window.__step(72);
    const counter = s.friendly.getChildren().some(s => s.active && s.texture.key === 'counter');
    s.clock = 3;
    const hull = s.hull; s.damagePlayer(1); s.damagePlayer(1);
    const invulnerability = s.hull === hull - 1;
    s.togglePause(); const time = s.clock, x = s.player.x;
    window.__step(60);
    const pause = s.clock === time && s.player.x === x;
    s.togglePause(); window.__step(2);
    const resume = s.clock > time;
    return { overlap, duplicate, caught, noRetrigger, counter, invulnerability, pause, resume };
  });
  assert.equal(mechanics.overlap.kills, 1); assert.equal(mechanics.overlap.active, 1);
  assert.equal(mechanics.overlap.hit, 1); assert.equal(mechanics.duplicate, true);
  assert.equal(mechanics.caught, 1); assert.equal(mechanics.noRetrigger, true); assert.equal(mechanics.counter, true);
  assert.equal(mechanics.invulnerability, true); assert.equal(mechanics.pause, true); assert.equal(mechanics.resume, true);
  pass('one projectile resolves one hit/kill; duplicate death awards nothing');
  pass('Tideguard catches shots, respects cooldown, and releases a countershot');
  pass('post-hit invulnerability and real scene pause/resume');
  await page.locator('#auto-fire').check();
  await page.keyboard.press('p');
  await page.evaluate(() => window.__step(2));
  assert.equal(await page.locator('#pause-panel').isVisible(), true, 'pause shortcut after auto-fire interaction');
  await page.locator('#abandon').click();
  await page.evaluate(() => window.__step(2));
  assert.equal(await page.locator('#harbor').isVisible(), true);
  await page.locator('#begin').click();
  await page.evaluate(() => window.__step(2));
  assert.match(await page.locator('#pause-button').textContent(), /^Pause/, 'fresh runs reset pause labels');
  pass('auto-fire focus preserves pause shortcut; harbor return resets pause label');
  const gateFixture = await page.evaluate(() => {
    const s=window.__KNOTZ_GAME__.scene.getScene('mission');
    for(const group of [s.friendly,s.hostile,s.enemies]) for(const e of group.getChildren()) e.disableBody(true,true);
    s.gates=[{x:620,y:350,gap:250,hit:false,passed:false}];s.player.setPosition(620,350);
    const hull=s.hull;s.playerShot(0,1);const friendly=s.friendly.getChildren().find(e=>e.active);friendly.setPosition(620,140);
    s.fireEnemy(620,140,Math.PI,0);s.updateGates(0);
    const blocks=!friendly.active&&!s.hostile.getChildren().some(e=>e.active), safe=s.hull===hull;
    s.player.setPosition(620,140);s.clock=10;s.guardUntil=0;s.invincibleUntil=0;s.updateGates(0);const scrape=s.hull===hull-1;
    s.gates=[{x:500,y:350,gap:250,hit:false,passed:false}];const score=s.stats.score;s.updateGates(0);s.updateGates(0);const once=s.stats.score-score===450;
    s.gates=[];s.player.setPosition(210,355);return{blocks,safe,scrape,once};
  });
  assert.deepEqual(gateFixture,{blocks:true,safe:true,scrape:true,once:true});
  pass('pressure gate blocks fire; opening is safe; scrape protection and one-time clean-passage reward work');
  const bounded = await page.evaluate(() => {
    const g = window.__KNOTZ_GAME__, s = g.scene.getScene('mission');
    for (const e of s.enemies.getChildren()) e.disableBody(true,true);
    s.spawnEnemy('hivewhale', 1050, 350);
    const before = s.stats.kills;
    for (let i=0;i<30;i++) { const e = s.spawnEnemy('mine', 800, 200); s.damageEnemy(e, 999); }
    const rewarded = s.stats.kills-before;
    s.activateGuard(); const score = s.stats.score;
    for(let i=0;i<45;i++) { s.fireEnemy(s.player.x+48,s.player.y,Math.PI,0); s.updateProjectiles(); }
    return {rewarded, catchScore:s.stats.score-score, absorbed:s.stats.absorbed};
  });
  assert.equal(bounded.rewarded,20); assert.equal(bounded.catchScore,32*35);
  pass('boss reinforcements and defensive scoring have finite reward budgets');
  const lifecycle = await page.evaluate(() => {
    const g=window.__KNOTZ_GAME__, counts=[];
    for(let i=0;i<6;i++) {
      g.scene.stop('mission'); g.scene.start('mission',{difficulty:'pilot',weapon:i%2?'fan':'lance'}); window.__step(3);
      counts.push({pause:g.events.listenerCount('mission:pause'),abandon:g.events.listenerCount('mission:abandon'),sounds:g.sound.sounds.length});
    }
    const previous=JSON.parse(localStorage.getItem('knotz-brigade-v1'));
    g.scene.stop('mission');g.scene.start('mission',{difficulty:'pilot',weapon:'lance',checkpoint:1});window.__step(2);
    let result;g.events.once('mission:result',r=>result=r);
    const s=g.scene.getScene('mission');s.stats.score=1234567;s.finish(true);window.__step(130);
    return {counts,result,previous,after:JSON.parse(localStorage.getItem('knotz-brigade-v1')),canvases:document.querySelectorAll('canvas').length};
  });
  assert.ok(lifecycle.counts.every(c=>c.pause===1&&c.abandon===1));
  assert.equal(new Set(lifecycle.counts.map(c=>c.sounds)).size,1);
  assert.equal(lifecycle.result.practice,true);assert.equal(lifecycle.result.record,false);
  assert.deepEqual(lifecycle.after.best,lifecycle.previous.best);assert.deepEqual(lifecycle.after.rigBest,lifecycle.previous.rigBest);
  assert.equal(lifecycle.after.clears,lifecycle.previous.clears);assert.equal(lifecycle.canvases,1);
  pass('six restarts retain one handler, stable sound pool, one canvas; practice cannot change full-run records');
  const surgeFinish = await page.evaluate(() => {
    const g=window.__KNOTZ_GAME__;g.scene.stop('mission');g.scene.start('mission',{difficulty:'pilot',weapon:'lance',checkpoint:2});window.__step(2);
    const s=g.scene.getScene('mission');s.actTime=44;const boss=s.spawnEnemy('bulbwhale',1000,350);boss.hp=1;s.charge=100;s.inputState.surge=true;window.__step(1);
    return {completed:s.completed,boss:s.boss?.kind,activeBosses:s.enemies.getChildren().filter(e=>e.active&&e.boss).length};
  });
  assert.deepEqual(surgeFinish,{completed:true,boss:undefined,activeBosses:0});
  pass('Surge finishing the guardian stops the director in the same frame; no replacement boss spawns');
  await page.evaluate(()=>{window.__step(130);window.__render();});
  assert.equal(await page.locator('#rank').textContent(),'CLEAR');
  assert.equal(await page.locator('#stat-data').textContent(),'0 / 1');
  assert.match(await page.locator('#result-challenge').textContent(),/1 relay/);
  await page.locator('#replay').click();await page.evaluate(()=>window.__step(3));
  const entry=await page.evaluate(()=>window.__KNOTZ_GAME__.scene.getScene('mission').options);
  assert.equal(entry.checkpoint,2);assert.equal(entry.practice,true);
  pass('part-03 practice uses CLEAR, one attainable relay, scoped advice, and replays the same route');
  await page.close();

  // Input-only bot: no health, damage, wave, progression or score changes. It uses
  // real keys and ability requests. These runs verify reachability, not human fun.
  for (const [difficulty, weapon] of [['pilot', 'lance'], ['pilot', 'fan'], ['ace', 'lance']]) {
    const p = await open(); await start(p, difficulty, weapon);
    await p.evaluate(installPilot);
    await p.evaluate(() => {
      window.__observed = [];
      window.__bot = frames => {
        const game = window.__KNOTZ_GAME__, s = game.scene.getScene('mission');
        for (let i = 0; i < frames; i++) {
          if (s.ending) { window.__step(120); break; }
          if (i % 6 === 0) {
            window.__steerPilot();
          }
          const key = `${s.stage}:${s.boss?.kind ?? 'waves'}:${s.boss?.enraged ?? false}`;
          if(window.__observed.at(-1)?.key !== key) window.__observed.push({key,clock:s.clock,hull:s.hull,score:s.stats.score});
          window.__step(1);
        }
        window.__render();
        return {clock:s.clock,stage:s.stage,boss:s.boss?.kind,enraged:s.boss?.enraged,hull:s.hull,ending:s.ending,completed:s.completed,stats:{...s.stats},sectors:s.sectorReports.map(p=>({...p})),observed:window.__observed, attacks:[...s.attackHistory]};
      };
    });
    let result;
    const captured = new Set();
    for (let batch = 0; batch < 160; batch++) {
      result = await p.evaluate(() => window.__bot(240));
      const key = result.boss ? `${result.boss}${result.enraged ? '-phase2' : ''}` : `part${result.stage+1}`;
      if (!captured.has(key) && (result.clock > 4 || result.stage>0)) { captured.add(key); await p.locator('#playfield').screenshot({ path: `${evidence}${difficulty}-${weapon}-${key}.png` }); }
      if(result.ending) break;
    }
    runs.push({difficulty,weapon,...result});
    console.log(JSON.stringify({run:difficulty,weapon,...result}));
    assert.equal(result.completed, true, `${difficulty}/${weapon} input-only run should be completable`);
    assert.equal(result.stage, 2); assert.equal(result.boss,undefined,'completed mission must not spawn another guardian');
    assert.equal(result.sectors.length,3);assert.ok(result.sectors.every(p=>p.passed));
    assert.ok(result.observed.some(e => e.key.startsWith('1:hivewhale')), 'miniboss must be encountered');
    assert.ok(result.observed.some(e => e.key.startsWith('2:bulbwhale')), 'final guardian must be encountered');
    for (const attack of ['brood:volley','brood:release','brood:charge','brood:phase2','warden:conduits','warden:core-open','warden:curtain','warden:mines','warden:vents','warden:phase2']) assert.ok(result.attacks.includes(attack), `must witness ${attack}`);
    assert.ok(result.stats.hit <= result.stats.fired, 'accuracy counts projectiles, including counters');
    await p.locator('#results').screenshot({path:`${evidence}${difficulty}-${weapon}-debrief.png`});
    assert.equal(await p.locator('.sector-result').count(),3);
    if(difficulty==='pilot'&&weapon==='lance') {
      const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('knotz-brigade-v1')));
      await p.locator('#sector-results button[data-stage="0"]').click();await p.evaluate(()=>window.__step(3));
      const practice=await p.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');const flag=s.options.practice;s.stats.score=900000;s.finish(true);window.__step(130);return{flag,after:JSON.parse(localStorage.getItem('knotz-brigade-v1'))};});
      assert.equal(practice.flag,true);assert.deepEqual(practice.after.rigBest,before.rigBest);assert.equal(practice.after.clears,before.clears);
      assert.ok(practice.after.sectorBest['pilot:lance:0:practice'].score>0);assert.ok(practice.after.sectorBest['pilot:lance:0:full'].score>0);
      pass('debrief reports all three parts; practice from part 01 keeps separate sector records and cannot set a full-run best');
    }
    await p.close();
    pass(`${difficulty}/${weapon}: full three-part mission clear using input only`);
  }

  const mobile = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.screenshot({path:`${evidence}mobile-harbor.png`});
  await mobile.locator('#begin').tap();
  await mobile.waitForFunction(() => window.__KNOTZ_GAME__.scene.isActive('mission'));
  await mobile.locator('#touch-guard').tap();
  await mobile.waitForFunction(() => window.__KNOTZ_GAME__.scene.getScene('mission').stats.guards > 0);
  await mobile.locator('#pause-button').tap();
  assert.equal(await mobile.locator('#pause-panel').isVisible(), true);
  await mobile.locator('#resume').tap();
  await mobile.screenshot({path:`${evidence}mobile-flight.png`});
  await mobile.close(); pass('390px layout, touch launch/guard/pause/resume');
  const landscape = await open({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const fit = await landscape.evaluate(() => {
    const launch = document.querySelector('#begin').getBoundingClientRect(), field = document.querySelector('#playfield').getBoundingClientRect();
    return { launchVisible: launch.top >= field.top && launch.bottom <= field.bottom, controlsHidden: document.querySelector('#touch-controls').hidden, noOverflow: document.documentElement.scrollWidth <= innerWidth };
  });
  assert.equal(fit.launchVisible, true); assert.equal(fit.controlsHidden, true); assert.equal(fit.noOverflow, true);
  await landscape.screenshot({path:`${evidence}landscape-harbor.png`});
  await landscape.locator('#begin').tap();
  await landscape.waitForFunction(() => window.__KNOTZ_GAME__.scene.isActive('mission'));
  const focusBox = await landscape.locator('#touch-focus').boundingBox();
  await landscape.mouse.move(focusBox.x + focusBox.width/2, focusBox.y + focusBox.height/2); await landscape.mouse.down();
  await landscape.waitForFunction(() => window.__KNOTZ_GAME__.scene.getScene('mission').inputState.focus);
  await landscape.mouse.up();
  await landscape.locator('#quick-pause').tap();
  assert.equal(await landscape.locator('#pause-panel').isVisible(), true);
  await landscape.locator('#resume').tap();
  await landscape.screenshot({path:`${evidence}landscape-flight.png`});
  await landscape.close(); pass('844×390 landscape launch fits; touch controls hide in harbor; focus and header pause work');
  assert.deepEqual(errors, [], 'uncaught browser errors');
  await writeFile(`${evidence}test-results.json`, JSON.stringify({ checks, errors, runs, note: 'Input-only deterministic simulations are not human playtests or performance benchmarks.' }, null, 2));
  console.log(`All ${checks.length} checks passed; evidence: ${evidence}`);
} finally { await browser.close(); await server.close(); }
