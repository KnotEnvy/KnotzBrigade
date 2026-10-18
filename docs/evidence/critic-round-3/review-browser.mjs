import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out='/home/knotz2/code/KnotzBrigade/docs/evidence/critic-round-3';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/home/knotz2/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[], observations={};
const page=await browser.newPage({viewport:{width:1440,height:960}});
page.on('pageerror',e=>errors.push(e.message));
async function shot(name,p=page){await p.screenshot({path:`${out}/${name}.png`});}
async function state(){return page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');return{clock:s.clock,actTime:s.actTime,hull:s.hull,stage:s.stage,stats:s.stats,gates:s.gates,boss:s.boss?{hp:s.boss.hp,exposedUntil:s.boss.exposedUntil,openness:s.boss.openness}:null,history:s.attackHistory,radio:document.querySelector('#radio-text').textContent};});}
await page.goto('http://127.0.0.1:5197');await page.waitForFunction(()=>document.documentElement.dataset.engine==='4.2.1');
await shot('desktop-harbor');await page.locator('#begin').click();await page.waitForTimeout(3000);
await page.keyboard.down('ArrowDown');await page.waitForTimeout(430);await page.keyboard.up('ArrowDown');
observations.liveDown=await state();
await page.keyboard.down('Shift');await page.keyboard.down('ArrowUp');await page.waitForTimeout(430);await page.keyboard.up('ArrowUp');await page.keyboard.up('Shift');
await page.keyboard.press('x');await page.waitForTimeout(1200);await shot('live-early-guard-counter');
await page.waitForTimeout(6500);await shot('live-first-aimed-enemy');
await page.keyboard.down('ArrowUp');await page.waitForTimeout(400);await page.keyboard.up('ArrowUp');
await page.waitForTimeout(3500);await page.keyboard.press('x');await page.waitForTimeout(1400);
await page.keyboard.down('ArrowDown');await page.waitForTimeout(450);await page.keyboard.up('ArrowDown');
await page.waitForTimeout(7500);await shot('live-part1-waves');observations.liveSample=await state();
await page.keyboard.press('p');await page.waitForTimeout(300);observations.pauseVisible=await page.locator('#pause-panel').isVisible();await page.locator('#abandon').click();await page.waitForTimeout(300);
await page.locator('#auto-fire').uncheck();await page.locator('#begin').click();await page.waitForTimeout(300);
// Controlled clock fixture: bring forward gates and composition without changing hull or damage.
await page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');s.actTime=29.9;s.waveIndex=7;});
await page.waitForTimeout(1500);await shot('part1-gate-preview-clock-fixture');await page.waitForTimeout(2500);await shot('part1-gate-near-clock-fixture');observations.part1Gate=await state();
// Controlled checkpoint fixtures observe authored part-2/3 encounters in real rendering.
await page.evaluate(()=>{const g=window.__KNOTZ_GAME__;g.scene.stop('mission');g.scene.start('mission',{difficulty:'pilot',weapon:'lance',checkpoint:1,practice:true});});await page.waitForTimeout(3000);
await page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');s.actTime=10.7;s.waveIndex=2;});await page.waitForTimeout(4100);await shot('part2-mine-escort-gate-clock-fixture');observations.part2Composition=await state();
await page.evaluate(()=>{const g=window.__KNOTZ_GAME__;g.scene.stop('mission');g.scene.start('mission',{difficulty:'pilot',weapon:'lance',checkpoint:2,practice:true});});await page.waitForTimeout(2800);
await page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');s.actTime=9.9;s.waveIndex=2;});await page.waitForTimeout(4200);await shot('part3-low-gate-vent-clock-fixture');observations.part3Composition=await state();
// Boss fixture: direct spawn and phase change, deliberately synthetic, no claimed clear.
await page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');for(const e of s.enemies.getChildren())e.disableBody(true,true);s.gates=[];s.lasers=[];s.actTime=44;s.waveIndex=99;s.spawnEnemy('bulbwhale',1040,355);});await page.waitForTimeout(1000);await shot('warden-armored-fixture');
await page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');s.charge=37;for(const n of s.enemies.getChildren())if(n.active&&n.kind==='conduit')s.damageEnemy(n,999);});await page.waitForTimeout(350);await shot('warden-open-37charge-fixture');observations.wardenOpen=await state();
// Synthetic clear to inspect actual debrief and practice launch semantics.
await page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');s.finish(true);});await page.waitForTimeout(2100);await shot('part3-practice-debrief-synthetic');
observations.practiceDebrief=await page.locator('#results').innerText();
await page.locator('#sector-results button').click();await page.waitForTimeout(300);observations.practiceLaunch=await state();
for(const [name,width,height] of [['portrait',390,844],['landscape',844,390]]){
 const p=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:5197');await p.waitForFunction(()=>document.documentElement.dataset.engine==='4.2.1');await p.locator('#begin').click();await p.waitForTimeout(2800);await shot(`${name}-flight`,p);
 observations[name]=await p.evaluate(()=>{const ids=['hull-label','touch-guard-status','touch-surge-status','part-label','weapon-label'];return{bodyWidth:document.body.scrollWidth,width:innerWidth,fields:ids.map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return{id,text:e.textContent,font:getComputedStyle(e).fontSize,box:{x:r.x,y:r.y,width:r.width,height:r.height}}}),duplicatesVisible:getComputedStyle(document.querySelector('.hud .abilities')).display,controls:document.querySelector('#touch-controls').getBoundingClientRect().toJSON()};});
 await p.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');s.stage=2;s.actTime=44;s.waveIndex=99;s.spawnEnemy('bulbwhale',1040,355);});await p.waitForTimeout(600);await shot(`${name}-boss-fixture`,p);await p.close();
}
observations.errors=errors;
await writeFile(`${out}/observations.json`,JSON.stringify(observations,null,2));console.log(JSON.stringify(observations,null,2));await browser.close();
