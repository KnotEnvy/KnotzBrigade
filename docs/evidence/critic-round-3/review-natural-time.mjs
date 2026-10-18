import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const out='/home/knotz2/code/KnotzBrigade/docs/evidence/critic-round-3';
const b=await chromium.launch({headless:true,executablePath:'/home/knotz2/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:960}}),results=[],errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto('http://127.0.0.1:5197');await p.waitForFunction(()=>document.documentElement.dataset.engine==='4.2.1');await p.locator('#auto-fire').uncheck();await p.locator('#begin').click();await p.waitForTimeout(200);
for(const stage of [1,2]){
 await p.evaluate(stage=>{const g=window.__KNOTZ_GAME__;g.scene.stop('mission');g.scene.start('mission',{difficulty:'pilot',weapon:'lance',checkpoint:stage,practice:true});},stage);
 await p.waitForFunction(()=>window.__KNOTZ_GAME__.scene.getScene('mission').clock>=15,{},{timeout:60000});
 await p.screenshot({path:`${out}/part${stage+1}-natural-time-checkpoint.png`});
 results.push(await p.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');return{clock:s.clock,actTime:s.actTime,stage:s.stage,hull:s.hull,stats:s.stats,gates:s.gates,enemies:s.enemies.getChildren().filter(e=>e.active).map(e=>({kind:e.kind,x:e.x,y:e.y,age:e.age})),lasers:s.lasers};}));
}
await writeFile(`${out}/natural-time-checkpoints.json`,JSON.stringify({results,errors,note:'Only direct checkpoint scene start; ordinary rendered real-time updates, auto-fire off, no clock, hull, damage, wave or score changes and no steering.'},null,2));await b.close();console.log('Natural-time checkpoint captures complete; page errors:',errors.length);
