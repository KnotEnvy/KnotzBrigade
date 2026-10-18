import { chromium } from 'playwright';
import { createServer } from 'vite';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../',import.meta.url));
const evidence=fileURLToPath(new URL('../../docs/evidence/refinement/',import.meta.url));
await mkdir(evidence,{recursive:true});
const server=await createServer({root,server:{host:'127.0.0.1',port:0},logLevel:'error',plugins:[{name:'reference-only',configureServer(server){
  server.middlewares.use('/__legacy_music_reference',async(_req,res)=>{res.setHeader('Content-Type','audio/mpeg');res.end(await readFile(new URL('../../archives/legacy-canvas/sounds/boss_v2.mp3',import.meta.url)));});
}}]});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const checks=[],errors=[];const pass=name=>{checks.push(name);console.log(`PASS: ${name}`);};
try {
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.stack));
  const url=`http://127.0.0.1:${server.httpServer.address().port}/`;
  await page.goto(url);await page.locator('#begin:not([disabled])').waitFor();await page.locator('#auto-fire').uncheck();await page.locator('#begin').click();
  await page.waitForFunction(()=>window.__KNOTZ_GAME__.scene.isActive('mission'));
  await page.evaluate(()=>{window.__KNOTZ_GAME__.scene.getScene('mission').actTime=-1000;});
  const assets=await page.evaluate(async()=>{
    const g=window.__KNOTZ_GAME__,s=g.scene.getScene('mission'),manifest=g.cache.json.get('score-manifest');
    const clips=manifest.themes.map(t=>{const b=g.cache.audio.get(`score-${t.key}`);return{key:t.key,duration:b.duration,channels:b.numberOfChannels,samples:b.length,decodedBytes:b.length*b.numberOfChannels*4,rate:s.audio.score.tracks.get(t.key).rate};});
    const legacy=await g.sound.context.decodeAudioData(await(await fetch('/__legacy_music_reference')).arrayBuffer());
    return{clips,legacy:{duration:legacy.duration,decodedBytes:legacy.length*legacy.numberOfChannels*4},manifest};
  });
  assert.equal(assets.clips.length,6);assert.ok(assets.clips.every(c=>c.rate===1&&Math.abs(c.duration-120/7)<0.001));
  assert.ok(assets.manifest.themes.every(t=>t.peak<0.71&&t.seamDelta<0.003));
  assert.ok(assets.clips.reduce((sum,c)=>sum+c.decodedBytes,0)<assets.legacy.decodedBytes);
  pass('five distinct themes plus overload decode, loop at fixed pitch, have headroom and use less decoded memory than the old track');
  const transitions=[];
  for(const[key,action]of[['convoy',0],['brood',1],['foundry',2],['warden',3]]) {
    await page.evaluate(action=>{const b=window.__KNOTZ_GAME__.scene.getScene('mission').audio;if(action===0)b.phase(1);if(action===1)b.boss(false);if(action===2)b.phase(2);if(action===3)b.boss(true,true);},action);
    await page.waitForFunction(key=>window.__KNOTZ_GAME__.scene.getScene('mission').audio.score.snapshot().theme===key,key);
    transitions.push(await page.evaluate(()=>window.__KNOTZ_GAME__.scene.getScene('mission').audio.score.snapshot()));
  }
  assert.equal(transitions.at(-1).overload,true);pass('bar-aligned sector/boss transitions and overload layer work in real audio time');
  await page.evaluate(()=>window.__KNOTZ_GAME__.scene.getScene('mission').audio.cue('warning'));
  await page.waitForFunction(()=>window.__KNOTZ_GAME__.scene.getScene('mission').audio.score.snapshot().duck<0.5);
  await page.waitForFunction(()=>window.__KNOTZ_GAME__.scene.getScene('mission').audio.score.snapshot().duck>0.98);
  pass('warning ducks music and the full music level recovers');
  const beforePause=await page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');s.audio.play('shield');s.togglePause();return{position:s.audio.score.snapshot().position,clock:s.clock};});
  await page.waitForTimeout(250);
  const paused=await page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');return{position:s.audio.score.snapshot().position,clock:s.clock,music:[...s.audio.score.tracks.values()].every(t=>t.isPaused),voices:[...s.audio.voices.values()].flat().every(t=>!t.isPlaying)};});
  assert.equal(paused.position,beforePause.position);assert.equal(paused.clock,beforePause.clock);assert.ok(paused.music&&paused.voices);
  await page.locator('#resume').click();pass('actual scene pause holds all music, active effects and their transport');
  await page.locator('#settings-open').click();
  async function slider(id,value){await page.locator(id).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));},value);}
  await slider('#music-volume',0);
  // Paused Web Audio nodes may report their last rendered AudioParam value;
  // verify the requested config, then verify audible-node gain after resume.
  assert.equal(await page.evaluate(()=>[...window.__KNOTZ_GAME__.scene.getScene('mission').audio.score.tracks.values()].every(t=>t.currentConfig.volume===0)),true);
  await page.getByRole('button',{name:'Back to flight'}).click();
  await page.waitForFunction(()=>[...window.__KNOTZ_GAME__.scene.getScene('mission').audio.score.tracks.values()].every(t=>t.volume===0));
  await page.locator('#settings-open').click();
  await slider('#music-volume',80);await slider('#effects-volume',0);
  assert.equal(await page.evaluate(()=>[...window.__KNOTZ_GAME__.scene.getScene('mission').audio.voices.values()].flat().every(t=>!t.isPlaying||t.volume===0)),true);
  await slider('#effects-volume',85);await page.getByRole('button',{name:'Back to flight'}).click();
  const preferences=await page.evaluate(()=>JSON.parse(localStorage.getItem('knotz-brigade-v1')).settings);
  assert.equal(preferences.musicVolume,0.8);assert.equal(preferences.effectsVolume,0.85);pass('independent live music/effects controls persist without muting the other bus');
  await page.locator('#settings-open').click();
  await slider('#volume',100);await slider('#music-volume',100);await slider('#effects-volume',100);
  await page.getByRole('button',{name:'Back to flight'}).click();
  await page.waitForFunction(()=>window.__KNOTZ_GAME__.sound.volume>0.99);
  const signal=await page.evaluate(async()=>{
    const g=window.__KNOTZ_GAME__,s=g.scene.getScene('mission'),ctx=g.sound.context;
    const module=URL.createObjectURL(new Blob([`class Capture extends AudioWorkletProcessor{process(inputs){let peak=0,power=0,count=0;for(const c of inputs[0]??[])for(const x of c){peak=Math.max(peak,Math.abs(x));power+=x*x;count++;}this.port.postMessage({peak,power,count});return true;}}registerProcessor('capture',Capture);`],{type:'text/javascript'}));
    await ctx.audioWorklet.addModule(module);URL.revokeObjectURL(module);
    const node=new AudioWorkletNode(ctx,'capture'),windows=[];node.port.onmessage=e=>windows.push(e.data);
    s.audio.output.connect(node);node.connect(ctx.destination);
    for(const key of ['warning','catch','counter','surge','open','phase'])s.audio.cue(key);
    for(let i=0;i<4;i++)s.audio.play('explosion',0.65);
    for(let i=0;i<4;i++)s.audio.play('shot',0.3);
    await new Promise(r=>setTimeout(r,650));s.audio.output.disconnect(node);node.disconnect();node.port.close();
    return{peak:Math.max(...windows.map(w=>w.peak)),rms:Math.sqrt(windows.reduce((n,w)=>n+w.power,0)/windows.reduce((n,w)=>n+w.count,0)),frames:windows.reduce((n,w)=>n+w.count,0)};
  });
  assert.ok(signal.frames>16000&&signal.peak>0.02&&signal.peak<0.98);pass('continuous post-master sampling of overlapping warnings, firing and explosions stays below clipping with all sliders at maximum');
  // Controlled missed-frame fixture for the governor, not a hardware benchmark.
  const quality=await page.evaluate(()=>{
    const g=window.__KNOTZ_GAME__,r=window.__KNOTZ_RENDER__,s=g.scene.getScene('mission');
    r.apply();const before={x:s.player.x,y:s.player.y,hp:s.hull,bounds:s.physics.world.bounds.width};r.warmup=0;r.samples=Array(119).fill(23.3);r.previous=performance.now()-23.3;r.frame();
    return{preset:r.preset,canvas:[g.scale.width,g.scale.height],zoom:s.cameras.main.zoom,position:[s.player.x,s.player.y],hp:s.hull,bounds:s.physics.world.bounds.width,before};
  });
  assert.equal(quality.preset,'performance');assert.deepEqual(quality.canvas,[640,360]);assert.equal(quality.zoom,0.5);
  assert.deepEqual(quality.position,[quality.before.x,quality.before.y]);assert.equal(quality.hp,quality.before.hp);assert.equal(quality.bounds,quality.before.bounds);
  pass('sustained 23ms frames trigger automatic reduction while preserving player state and world geometry');
  await page.locator('#settings-open').click();await page.locator('#quality').selectOption('high');await page.getByRole('button',{name:'Back to flight'}).click();
  await page.evaluate(()=>{const r=window.__KNOTZ_RENDER__;r.warmup=0;r.samples=Array(119).fill(33.3);r.previous=performance.now()-33.3;r.frame();});
  assert.equal(await page.locator('canvas').evaluate(c=>c.width),1280);pass('manual render quality stays under player control');
  await page.evaluate(()=>{const g=window.__KNOTZ_GAME__;window.__lostExtension=g.renderer.gl.getExtension('WEBGL_lose_context');window.__lostExtension.loseContext();});
  await page.locator('#graphics-status').waitFor({state:'visible'});
  await page.waitForFunction(()=>window.__KNOTZ_GAME__.scene.isPaused('mission'));
  const held=await page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');return{clock:s.clock,x:s.player.x,y:s.player.y,hull:s.hull};});
  assert.equal(await page.locator('#resume').isDisabled(),true);
  await page.keyboard.press('p');await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>{const s=window.__KNOTZ_GAME__.scene.getScene('mission');return{clock:s.clock,x:s.player.x,y:s.player.y,hull:s.hull};}),held);
  await page.evaluate(()=>window.__lostExtension.restoreContext());
  await page.locator('#graphics-status').waitFor({state:'hidden'});assert.equal(await page.locator('#resume').isDisabled(),false);
  assert.equal(await page.evaluate(()=>window.__KNOTZ_GAME__.scene.isPaused('mission')),true);
  await page.screenshot({path:`${evidence}context-restored.png`});await page.locator('#resume').click();
  await page.waitForFunction(clock=>window.__KNOTZ_GAME__.scene.getScene('mission').clock>clock,held.clock);
  pass('actual WebGL loss holds gameplay and blocks blind resume; restored renderer permits an explicit unchanged-state resume');
  await page.close();
  const missing=await browser.newPage();missing.on('pageerror',e=>errors.push(e.stack));await missing.route('**/score/warden.wav',r=>r.abort());await missing.goto(url);
  await missing.locator('#error').waitFor({state:'visible'});await missing.waitForTimeout(300);assert.equal(await missing.locator('#begin').isDisabled(),true);await missing.close();
  pass('a missing score asset leaves launch disabled instead of failing later in combat');
  assert.deepEqual(errors,[]);
  await writeFile(`${evidence}delivery-results.json`,JSON.stringify({checks,assets,transitions,signal,preferences,quality,errors,note:'Controlled browser audio/governor fixtures; electrical signal, not a listening assessment or physical-device benchmark.'},null,2));
  console.log(`All ${checks.length} delivery checks passed.`);
} finally {await browser.close();await server.close();}
