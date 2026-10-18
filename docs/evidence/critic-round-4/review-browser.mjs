import { chromium } from '/tmp/knotz-review-tools/node_modules/playwright/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const out='/home/knotz2/code/KnotzBrigade/docs/evidence/critic-round-4';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/home/knotz2/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],observations={};
const page=await browser.newPage({viewport:{width:1440,height:960}});
page.on('pageerror',error=>errors.push(error.message));
const state=()=>page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');return {clock:s.clock,actTime:s.actTime,stage:s.stage,hull:s.hull,stats:{...s.stats},options:s.options,player:{x:s.player.x,y:s.player.y},enemies:s.enemies.getChildren().filter(e=>e.active).map(e=>({kind:e.kind,x:e.x,y:e.y,age:e.age,hp:e.hp})),gates:s.gates,radio:document.querySelector('#radio-text').textContent};});
const shot=name=>page.screenshot({path:`${out}/${name}.png`});
await page.goto('http://127.0.0.1:5197/');
await page.waitForFunction(()=>document.documentElement.dataset.engine==='4.2.1');
await shot('desktop-harbor');
await page.locator('#auto-fire').uncheck();
await page.locator('#begin').click();
await page.waitForTimeout(300);
// Normal rendered checkpoint: no clock/HP/damage/score/wave modification.
await page.evaluate(()=>{const g=window.__KNOTZ_GAME__;g.scene.stop('mission');g.scene.start('mission',{difficulty:'pilot',weapon:'lance',checkpoint:2,practice:true});});
await page.waitForFunction(()=>window.__KNOTZ_GAME__.scene.getScene('mission').actTime>=20,{},{timeout:90000});
await shot('part3-upper-route-20s');observations.part3At20=await state();
await page.waitForFunction(()=>window.__KNOTZ_GAME__.scene.getScene('mission').actTime>=23.5,{},{timeout:30000});
await shot('part3-courier-mine-lane');observations.part3At23=await state();
await page.waitForFunction(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');return s.actTime>=27||s.ending;},{},{timeout:30000});
await shot('part3-upper-route-last-sample');observations.part3Last=await state();
console.log('Natural-time courier and mine corridor captured.');
// Explicit synthetic completion, solely to verify debrief and replay scope.
await page.evaluate(()=>{const g=window.__KNOTZ_GAME__;g.scene.stop('mission');g.scene.start('mission',{difficulty:'pilot',weapon:'lance',checkpoint:2,practice:true});});
await page.waitForTimeout(300);
await page.evaluate(()=>window.__KNOTZ_GAME__.scene.getScene('mission').finish(true));
await page.waitForTimeout(2000);await shot('practice-debrief-synthetic');
observations.practiceDebrief=await page.locator('#results').innerText();
await page.locator('#replay').click();await page.waitForTimeout(300);
observations.practiceReplay=await state();
// Normal rendered part 02 contrast/composition sample.
await page.evaluate(()=>{const g=window.__KNOTZ_GAME__;g.scene.stop('mission');g.scene.start('mission',{difficulty:'pilot',weapon:'lance',checkpoint:1,practice:true});});
await page.waitForFunction(()=>window.__KNOTZ_GAME__.scene.getScene('mission').actTime>=15,{},{timeout:60000});
await shot('part2-normal-time-enemy-contrast');observations.part2At15=await state();
await page.keyboard.press('p');await page.waitForTimeout(300);
observations.pauseVisible=await page.locator('#pause-panel').isVisible();
await page.locator('#abandon').click();
await page.locator('#auto-fire').check();await page.locator('#begin').click();
await page.waitForTimeout(2600);
await page.keyboard.down('ArrowDown');await page.waitForTimeout(500);await page.keyboard.up('ArrowDown');
observations.normalMovement=await state();
await page.keyboard.down('Shift');await page.keyboard.down('ArrowUp');await page.waitForTimeout(500);await page.keyboard.up('ArrowUp');await page.keyboard.up('Shift');
await page.keyboard.press('x');await page.waitForTimeout(1000);await shot('keyboard-guard-input-sample');observations.inputSample=await state();
for(const [name,width,height] of [['portrait',390,844],['landscape',844,390]]){
 const p=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 p.on('pageerror',error=>errors.push(error.message));
 await p.goto('http://127.0.0.1:5197/');await p.waitForFunction(()=>document.documentElement.dataset.engine==='4.2.1');
 await p.locator('#begin').click();await p.waitForTimeout(2700);
 await p.screenshot({path:`${out}/${name}-flight.png`});
 observations[name]=await p.evaluate(()=>({width:innerWidth,bodyWidth:document.body.scrollWidth,hullFont:getComputedStyle(document.getElementById('hull-label')).fontSize,guardFont:getComputedStyle(document.getElementById('touch-guard-status')).fontSize,pause:document.getElementById('pause-toggle')?.getBoundingClientRect().toJSON(),quality:[...document.querySelectorAll('option')].filter(e=>/\d{3}/.test(e.textContent)).map(e=>e.textContent)}));
 await p.close();
}
observations.errors=errors;
observations.note='All encounter samples use normal rendered checkpoint updates, no clock, wave, score, damage or hull changes and auto-fire off. Practice debrief deliberately invokes finish(true), so it is synthetic UI verification, not a victory. Keyboard segment uses actual input with normal updates. Touch is emulation only.';
await writeFile(`${out}/observations.json`,JSON.stringify(observations,null,2));
console.log(JSON.stringify(observations,null,2));await browser.close();
