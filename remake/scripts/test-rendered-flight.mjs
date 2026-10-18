import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { installPilot } from './helpers/pilot.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const evidence=fileURLToPath(new URL('../../docs/evidence/refinement/',import.meta.url));
const configurations=[
  {name:'desktop-auto',viewport:{width:1280,height:900}},
  {name:'touch-landscape-auto',viewport:{width:844,height:390},isMobile:true,hasTouch:true}
];
const requested=process.argv[2];
assert.ok(!requested||configurations.some(c=>c.name===requested),'optional run name must match a configured flight');
const output=requested?`rendered-${requested}.json`:'rendered-flights.json';
await mkdir(evidence,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error'});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],runs=[];
try {
  for(const config of configurations.filter(c=>!requested||c.name===requested)) {
    const {name,...options}=config;const page=await browser.newPage(options);page.on('pageerror',e=>errors.push(e.stack));
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`);await page.locator('#begin:not([disabled])').waitFor();
    await page.locator('#begin').click();await page.waitForFunction(()=>window.__KNOTZ_GAME__.scene.isActive('mission'));
    await page.evaluate(installPilot);
    await page.evaluate(()=>{
      const g=window.__KNOTZ_GAME__,started=performance.now();let previous=started,frame=0,lastPhase='',lastTheme='',lastWidth=g.scale.width;
      const data={done:false,samples:[],segments:{},phases:[],music:[],quality:[{at:0,width:lastWidth}],progress:null,result:null};window.__renderRun=data;
      const steer=()=>{if(frame++%6===0)window.__steerPilot();};
      const render=()=>{
        const now=performance.now(),s=g.scene.getScene('mission'),delta=now-previous;previous=now;
        const phase=`${s.stage}:${s.boss?.kind??'waves'}:${s.boss?.enraged?'overload':'normal'}`;
        if(delta>0){data.samples.push(delta);(data.segments[phase]??=[]).push(delta);}
        if(phase!==lastPhase){data.phases.push({phase,at:(now-started)/1000,mission:s.clock,hull:s.hull});lastPhase=phase;}
        const score=s.audio.score.snapshot(),theme=`${score.theme}:${score.overload?'overload':'normal'}`;
        if(theme!==lastTheme){data.music.push({theme,at:(now-started)/1000,transport:score.position});lastTheme=theme;}
        if(g.scale.width!==lastWidth){lastWidth=g.scale.width;data.quality.push({at:(now-started)/1000,width:lastWidth,worldWidth:s.physics.world.bounds.width});}
        data.progress={realSeconds:(now-started)/1000,mission:s.clock,phase,hull:s.hull,canvas:lastWidth,theme};
        if(s.ending){data.done=true;data.completed=s.completed;data.stats={...s.stats};data.attacks=[...s.attackHistory];data.realSeconds=(now-started)/1000;g.events.off('poststep',steer);g.events.off('postrender',render);}
      };
      g.events.on('poststep',steer);g.events.on('postrender',render);g.events.once('mission:result',result=>data.result=result);
    });
    const progress=setInterval(async()=>{try{console.log(JSON.stringify({run:name,...await page.evaluate(()=>window.__renderRun?.progress)}));}catch{/* Page may close after final sample. */}},30000);
    try {await page.waitForFunction(()=>window.__renderRun.done,null,{timeout:360000});} finally {clearInterval(progress);}
    await page.locator('#results').waitFor({state:'visible'});
    const result=await page.evaluate(()=>{
      const data=window.__renderRun;
      const summarize=values=>{const sorted=values.slice().sort((a,b)=>a-b);return{frames:sorted.length,meanMs:values.reduce((a,b)=>a+b,0)/values.length,medianMs:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],p99Ms:sorted[Math.floor(sorted.length*.99)],worstMs:sorted.at(-1),over33ms:values.filter(v=>v>33.5).length};};
      return{...data,samples:undefined,progress:undefined,frames:summarize(data.samples),segments:Object.fromEntries(Object.entries(data.segments).map(([key,samples])=>[key,summarize(samples)]))};
    });
    runs.push({name,...result});await writeFile(`${evidence}${output}`,JSON.stringify({runs,errors,note:'Normal uncompressed real-time rendering with an input-only pilot. No health/score/damage/wave/progression edits. Headless shared-host SwiftShader and touch emulation, not physical-device or human-enjoyment validation.'},null,2));
    assert.equal(result.completed,true,`${name} real-time flight must complete`);
    for(const theme of ['breakwater','convoy','brood','foundry','warden'])assert.ok(result.music.some(m=>m.theme.startsWith(theme)),`${name} must actually play ${theme}`);
    assert.ok(result.music.some(m=>m.theme==='warden:overload'));
    assert.ok(result.quality.length<=2&&result.quality.every(q=>!q.worldWidth||q.worldWidth===1120));
    await page.locator('#results').screenshot({path:`${evidence}${name}-debrief.png`});
    console.log(JSON.stringify({run:name,complete:true,frames:result.frames,quality:result.quality,realSeconds:result.realSeconds}));await page.close();
  }
  assert.deepEqual(errors,[]);console.log(`PASS: ${runs.length} normally rendered full flight(s), all score themes and overload, bounded auto adjustment, no browser errors`);
} finally {await browser.close();await server.close();}
