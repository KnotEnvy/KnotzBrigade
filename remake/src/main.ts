import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HarborScene } from './scenes/HarborScene';
import { MissionScene } from './scenes/MissionScene';
import type { MissionHUD } from './scenes/MissionScene';
import type { Difficulty, Weapon, RunOptions, RunStats, Stage, SectorReport } from './core/mission';
import { save, writeSave } from './core/storage';
import { RenderGovernor, RESOLUTIONS, initialPreset } from './game/RenderGovernor';
import { installGraphicsRecovery } from './game/GraphicsRecovery';
import './style.css';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const node = document.getElementById(id); if (!node) throw new Error(`Missing interface element ${id}`); return node as T;
};
const text = (id: string, value: string): void => { const node = $(id); if (node.textContent !== value) node.textContent = value; };
const hidden = (id: string, value: boolean): void => { $(id).hidden = value; };
const percent = (id: string, value: number): void => { $(id).style.width = `${Math.max(0, Math.min(100, value))}%`; };
const begin = $<HTMLButtonElement>('begin'), weapon = $<HTMLSelectElement>('weapon'), difficulty = $<HTMLSelectElement>('difficulty');
const settings = $<HTMLDialogElement>('settings-dialog'), manual = $<HTMLDialogElement>('how-dialog');
let ready = false, playing = false, paused = false, resumeAfterDialog = false;
let radioTimer: Phaser.Time.TimerEvent | undefined, bannerTimer: Phaser.Time.TimerEvent | undefined;
const resolutions = RESOLUTIONS;
interface Result { completed: boolean; practice: boolean; from: Stage; relayTarget: number; record: boolean; previous: number; stage: Stage; difficulty: Difficulty; weapon: Weapon; rank: string; stats: RunStats; sectors: SectorReport[] }
let lastResult: Result | null = null;

weapon.value = save.settings.weapon; difficulty.value = save.settings.difficulty;
$<HTMLInputElement>('auto-fire').checked = save.settings.autoFire;
$<HTMLInputElement>('effects').checked = save.settings.effects;
$<HTMLInputElement>('reduced-motion').checked = save.settings.reducedMotion;
$<HTMLInputElement>('volume').value = String(Math.round(save.settings.volume * 100));
$<HTMLInputElement>('music-volume').value = String(Math.round(save.settings.musicVolume * 100));
$<HTMLInputElement>('effects-volume').value = String(Math.round(save.settings.effectsVolume * 100));
$<HTMLSelectElement>('quality').value = save.settings.quality;
function best(): void { text('best-score', save.rigBest[difficulty.value as Difficulty][weapon.value as Weapon].toLocaleString().padStart(6, '0')); }
best();
function error(message: string): void { text('error', message); hidden('error', false); begin.disabled = true; text('begin', 'Expedition unavailable'); }

const probe = document.createElement('canvas');
const gl = probe.getContext('webgl2') ?? probe.getContext('webgl');
if (!gl) error('This game needs WebGL. Enable browser hardware acceleration and reload.');
else if (gl.getParameter(gl.MAX_TEXTURE_SIZE) < 2048) error('This game needs support for 2048-pixel textures. Try another browser or device.');
else { gl.getExtension('WEBGL_lose_context')?.loseContext(); startGame(); }

function startGame(): void {
  let graphicsLost = false;
  if (Phaser.VERSION !== '4.2.1') throw new Error('The mission requires the verified Phaser 4.2.1 engine.');
  const game = new Phaser.Game({
    type: Phaser.WEBGL, title: 'Knotz Brigade · The Drowned Foundry', parent: 'game', width: resolutions[initialPreset()][0], height: resolutions[initialPreset()][1],
    backgroundColor: '#103143', disableContextMenu: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, fullscreenTarget: 'game-shell' },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 0 }, debug: false, fps: 60 } },
    input: { activePointers: 3, gamepad: true }, render: { antialias: true, maxLights: 3 },
    scene: [BootScene, HarborScene, MissionScene]
  });
  const governor = new RenderGovernor(game);
  const qualityLabel = (_preset: string, width: number, height: number): void => text('quality-readout', `Current rendering: ${width} × ${height}${save.settings.quality === 'auto' ? ' · automatic' : ''}`);
  game.events.on('mission:quality', qualityLabel);
  const [initialWidth, initialHeight] = RESOLUTIONS[governor.preset];
  qualityLabel(governor.preset, initialWidth, initialHeight);
  const apply = (): void => { writeSave(save); game.events.emit('mission:settings'); game.sound.mute = save.settings.muted; game.sound.volume = save.settings.volume; updateMute(); };
  const bindGraphics = (): void => {
    const renderer = game.renderer;
    if (renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) installGraphicsRecovery(renderer);
    const lost = (): void => {
      graphicsLost = true;
      if (playing && !paused) game.events.emit('mission:pause');
      for (const id of ['resume', 'pause-button', 'quick-pause', 'begin', 'quality', 'effects']) $<HTMLButtonElement>(id).disabled = true;
      hidden('graphics-status', false);
    };
    const restored = (): void => {
      graphicsLost = false; hidden('graphics-status', true);
      for (const id of ['quality', 'effects']) $<HTMLButtonElement>(id).disabled = false;
      for (const id of ['resume', 'pause-button', 'quick-pause']) $<HTMLButtonElement>(id).disabled = !playing;
      begin.disabled = !ready; text('pause-copy', 'Graphics restored. Resume when ready.');
    };
    renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, lost); renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, restored);
    game.events.once(Phaser.Core.Events.DESTROY, () => { renderer.off(Phaser.Renderer.Events.LOSE_WEBGL, lost); renderer.off(Phaser.Renderer.Events.RESTORE_WEBGL, restored); });
  };
  if (game.renderer) bindGraphics(); else game.events.once(Phaser.Core.Events.READY, bindGraphics);
  $('reload-graphics').addEventListener('click', () => location.reload());
  function updateMute(): void { $('mute').setAttribute('aria-label', save.settings.muted ? 'Unmute audio' : 'Mute audio'); $('mute').setAttribute('aria-pressed', String(save.settings.muted)); text('mute', save.settings.muted ? '♫̸' : '♪'); }
  updateMute();
  function play(options?: RunOptions): void {
    if (!ready || graphicsLost) return;
    radioTimer?.remove(); bannerTimer?.remove();
    hidden('part-banner', true); hidden('radio', true); hidden('results', true); hidden('pause-panel', true); hidden('boss-bar', true);
    const selected = options ?? { difficulty: difficulty.value as Difficulty, weapon: weapon.value as Weapon };
    if (game.sound instanceof Phaser.Sound.WebAudioSoundManager) void game.sound.context.resume().catch(() => undefined);
    if (game.scene.isActive('harbor')) game.events.emit('mission:start', selected);
    else { game.scene.stop('mission'); game.scene.start('mission', selected); }
    $('playfield').focus({ preventScroll: true });
  }
  game.events.on('mission:error', error);
  game.events.on('mission:loading', (progress: number) => text('begin', `Preparing expedition · ${Math.floor(progress * 100)}%`));
  game.events.on('mission:ready', () => {
    ready = true; begin.disabled = graphicsLost; text('begin', 'Launch expedition  →');
    text('launch-note', 'Auto-fire on · steer with WASD / arrows · X to catch enemy fire');
    document.documentElement.dataset.engine = Phaser.VERSION;
  });
  game.events.on('mission:harbor', () => {
    playing = false; paused = false; hidden('harbor', false); hidden('hud', true); hidden('boss-bar', true); hidden('pause-panel', true); hidden('results', true); hidden('radio', true); hidden('part-banner', true);
    $<HTMLButtonElement>('pause-button').disabled = true; text('pause-button', 'Pause · P'); hidden('quick-pause', true); hidden('touch-controls', true); best();
  });
  game.events.on('mission:playing', () => {
    playing = true; paused = false; hidden('harbor', true); hidden('hud', false); hidden('results', true);
    text('quick-pause', 'Ⅱ'); $('quick-pause').setAttribute('aria-label', 'Pause flight');
    $<HTMLButtonElement>('pause-button').disabled = false; text('pause-button', 'Pause · P'); hidden('quick-pause', false); hidden('touch-controls', false);
  });
  game.events.on('mission:paused', (value: boolean) => { paused = value; if (value && !graphicsLost) text('pause-copy', 'The tide can wait.'); hidden('pause-panel', !value); hidden('touch-controls', value); text('quick-pause', value ? '▶' : 'Ⅱ'); $('quick-pause').setAttribute('aria-label', value ? 'Resume flight' : 'Pause flight'); text('pause-button', value ? 'Resume · P' : 'Pause · P'); if (value) $('resume').focus({ preventScroll: true }); });
  game.events.on('mission:part', (part: { stage: number; name: string; subtitle: string }) => {
    bannerTimer?.remove(); text('banner-number', `PART 0${part.stage + 1} / 03`); text('banner-name', part.name); text('banner-subtitle', part.subtitle); hidden('part-banner', false);
    bannerTimer = game.scene.getScene('mission').time.delayedCall(2500, () => hidden('part-banner', true));
  });
  game.events.on('mission:message', ({ text: content, seconds }: { text: string; seconds: number }) => { radioTimer?.remove(); text('radio-text', content); hidden('radio', false); radioTimer = game.scene.getScene('mission').time.delayedCall(seconds * 1000, () => hidden('radio', true)); });
  game.events.on('mission:hud', (hud: MissionHUD) => {
    text('part-label', `0${hud.stage + 1} / 03 · ${hud.part}`); text('objective', hud.objective); percent('part-progress', hud.progress * 100);
    text('hull-label', `${hud.hull} / ${hud.maxHull}`);
    const hullKey = `${hud.hull}-${hud.maxHull}`;
    if ($('hull').dataset.value !== hullKey) { $('hull').dataset.value = hullKey; $('hull').innerHTML = Array.from({ length: hud.maxHull }, (_, i) => `<i class="${i < hud.hull ? 'live' : ''}"></i>`).join(''); }
    $('hull').classList.toggle('critical', hud.hull <= 2);
    text('score', Math.round(hud.score).toLocaleString().padStart(6, '0')); text('multiplier', `×${hud.multiplier}`);
    text('chain-label', hud.chain ? `${hud.chain} CHAIN` : 'BUILD YOUR CHAIN'); percent('chain-progress', hud.chainTime * 100);
    text('weapon-label', `${hud.weapon.toUpperCase()} · LV ${hud.level}`);
    text('touch-guard-status', hud.guarding ? 'CATCHING' : hud.guard > 0 ? `${hud.guard.toFixed(1)}s` : 'READY');
    text('touch-surge-status', hud.surge > 0 ? `${hud.surge.toFixed(1)}s` : hud.charge >= 100 ? 'READY' : `${Math.floor(hud.charge)}%`);
    text('guard-status', hud.guarding ? 'CATCHING' : hud.guard > 0 ? `${hud.guard.toFixed(1)}s` : 'READY');
    $('guard').classList.toggle('ready', hud.guard <= 0); $('guard').setAttribute('aria-label', `Tideguard ${hud.guard > 0 ? `recharging ${hud.guard.toFixed(1)} seconds` : 'ready'}`);
    text('surge-status', hud.surge > 0 ? `${hud.surge.toFixed(1)}s ACTIVE` : hud.charge >= 100 ? 'READY · C' : `${Math.floor(hud.charge)}%`);
    $('surge').classList.toggle('ready', hud.charge >= 100 || hud.surge > 0); percent('charge-progress', hud.charge);
    $('touch-surge').classList.toggle('ready', hud.charge >= 100);
    hidden('boss-bar', !hud.boss);
    if (hud.boss) { text('boss-name', hud.boss.name); text('boss-phase', hud.boss.status); percent('boss-progress', hud.boss.hp / hud.boss.max * 100); }
  });
  game.events.on('mission:result', (result: Result) => {
    lastResult = result; playing = false; hidden('touch-controls', true); hidden('quick-pause', true); hidden('hud', true); hidden('boss-bar', true); hidden('radio', true); hidden('part-banner', true); hidden('results', false);
    $<HTMLButtonElement>('pause-button').disabled = true;
    text('result-label', result.completed ? (result.practice ? 'CHECKPOINT PRACTICE CLEAR' : 'MISSION COMPLETE') : `FLIGHT LOST · PART 0${result.stage + 1}`);
    text('result-title', result.completed ? result.practice ? 'ROUTE SECURED.' : 'THE HEART IS QUIET.' : 'THE TIDE ISN’T DONE.');
    text('result-copy', result.completed ? result.practice ? 'Practice route cleared. Full-flight records stay unchanged.' : 'The foundry is silent. The brigade is coming home.' : 'You know the water now. Take another run.');
    text('rank', result.rank); $('rank').classList.toggle('failed', !result.completed); $('rank').classList.toggle('practice-grade', result.practice);
    text('final-score', result.stats.score.toLocaleString());
    text('record-label', result.practice ? 'PRACTICE · FULL-RUN RECORD UNCHANGED' : result.record ? 'NEW PERSONAL BEST' : `${result.difficulty.toUpperCase()} / ${result.weapon.toUpperCase()} · MISSION SCORE`);
    text('stat-kills', String(result.stats.kills)); text('stat-chain', String(result.stats.maxChain)); text('stat-absorbed', String(result.stats.absorbed)); text('stat-data', `${result.stats.couriers} / ${result.relayTarget}`);
    text('stat-accuracy', `${result.stats.fired ? Math.min(100, Math.round(result.stats.hit / result.stats.fired * 100)) : 0}%`);
    text('stat-time', `${Math.floor(result.stats.elapsed / 60)}:${String(Math.floor(result.stats.elapsed % 60)).padStart(2, '0')}`);
    text('result-challenge', result.practice ? result.stats.damage > 0 ? 'PRACTICE GOAL: Clear this route without hull damage. Compare each part below.' : result.stats.couriers < result.relayTarget ? `PRACTICE GOAL: Recover this route’s ${result.relayTarget} relay${result.relayTarget === 1 ? '' : 's'} while keeping a clean hull.` : 'CLEAN PRACTICE ROUTE · chase your part best, or fly the full mission for S+.' : result.completed ? result.stats.couriers < 3 ? 'NEXT FLIGHT: Recover all three courier relays for the rescue bonus.' : result.stats.absorbed < 12 ? 'S+ MASTERY: Catch 12 shots, recover 3 relays, finish clean and score 65,000.' : result.stats.damage > 0 ? 'NEXT FLIGHT: Keep your hull pristine for S+ mastery.' : 'A flawless return. Chase 65,000 or take on Ace flight.' : 'TIDEGUARD TIP: Catch a volley with X, then align your countershot with the core.');
    $('sector-results').innerHTML = result.sectors.map(p => `<div class="sector-result"><div><b>0${p.stage + 1} · ${p.passed ? p.damage === 0 ? 'CLEAN' : 'SECURED' : 'IN PROGRESS'}</b><span>${p.damage} hull lost · ${p.relays}/1 relay · ${p.catches} catches · ${p.chain} chain</span><small>${p.score.toLocaleString()} pts${p.best ? ` · ${p.score > p.best && p.passed ? 'NEW PART BEST' : `best ${p.best.toLocaleString()}`}` : p.passed ? ' · FIRST PART CLEAR' : ''}</small></div><button data-stage="${p.stage}">Practice from 0${p.stage + 1}</button></div>`).join('');
    text('replay', result.practice ? 'Retry practice  →' : result.completed ? 'Fly again  →' : 'Restart mission  →'); hidden('checkpoint', result.completed || result.stage === 0);
    $('replay').focus({ preventScroll: true }); best();
  });
  $('sector-results').addEventListener('click', event => { const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-stage]'); if (target && lastResult) play({ difficulty: lastResult.difficulty, weapon: lastResult.weapon, checkpoint: Number(target.dataset.stage) as Stage, practice: true }); });
  begin.addEventListener('click', () => play());
  $('replay').addEventListener('click', () => play(lastResult ? { difficulty: lastResult.difficulty, weapon: lastResult.weapon, ...(lastResult.practice ? { checkpoint: lastResult.from, practice: true } : {}) } : undefined));
  $('checkpoint').addEventListener('click', () => { if (lastResult) play({ difficulty: lastResult.difficulty, weapon: lastResult.weapon, checkpoint: lastResult.stage, practice: true }); });
  for (const id of ['result-harbor', 'abandon']) $(id).addEventListener('click', () => game.events.emit('mission:abandon'));
  for (const id of ['resume', 'pause-button', 'quick-pause']) $(id).addEventListener('click', () => game.events.emit('mission:pause'));
  for (const [ids, action] of [[['guard', 'touch-guard'], 'pilot:guard'], [['surge', 'touch-surge'], 'pilot:surge']] as const) for (const id of ids) {
    $(id).addEventListener('pointerdown', e => { e.preventDefault(); game.events.emit(action); });
    $(id).addEventListener('click', e => { if (e.detail === 0) game.events.emit(action); });
  }
  const touchFocus = $('touch-focus');
  touchFocus.addEventListener('pointerdown', e => { touchFocus.setPointerCapture(e.pointerId); touchFocus.classList.add('ready'); game.events.emit('pilot:focus', true); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) touchFocus.addEventListener(event, () => { touchFocus.classList.remove('ready'); game.events.emit('pilot:focus', false); });
  $('mute').addEventListener('click', () => { save.settings.muted = !save.settings.muted; apply(); });
  $('fullscreen').addEventListener('click', () => { if (game.scale.isFullscreen) game.scale.stopFullscreen(); else game.scale.startFullscreen(); });
  for (const select of [weapon, difficulty]) select.addEventListener('change', () => { save.settings.weapon = weapon.value as Weapon; save.settings.difficulty = difficulty.value as Difficulty; writeSave(save); best(); });
  $('auto-fire').addEventListener('change', () => { save.settings.autoFire = $<HTMLInputElement>('auto-fire').checked; apply(); if (playing && !paused) $('playfield').focus({ preventScroll: true }); });
  $('effects').addEventListener('change', () => { save.settings.effects = $<HTMLInputElement>('effects').checked; apply(); });
  $('reduced-motion').addEventListener('change', () => { save.settings.reducedMotion = $<HTMLInputElement>('reduced-motion').checked; apply(); });
  $('quality').addEventListener('change', () => { save.settings.quality = $<HTMLSelectElement>('quality').value as typeof save.settings.quality; governor.apply(); apply(); });
  for (const [id, key] of [['music-volume', 'musicVolume'], ['effects-volume', 'effectsVolume']] as const) $(id).addEventListener('input', () => { save.settings[key] = Number($<HTMLInputElement>(id).value) / 100; apply(); });
  $('volume').addEventListener('input', () => { save.settings.volume = Number($<HTMLInputElement>('volume').value) / 100; apply(); });

  function openDialog(dialog: HTMLDialogElement): void {
    resumeAfterDialog = playing && !paused;
    if (resumeAfterDialog) game.events.emit('mission:pause');
    if (game.input.keyboard) game.input.keyboard.enabled = false;
    dialog.showModal();
  }
  for (const id of ['settings-open', 'pause-settings']) $(id).addEventListener('click', () => openDialog(settings));
  $('how-open').addEventListener('click', () => openDialog(manual));
  for (const dialog of [settings, manual]) dialog.addEventListener('close', () => { if (game.input.keyboard) game.input.keyboard.enabled = true; if (resumeAfterDialog && playing && paused) game.events.emit('mission:pause'); resumeAfterDialog = false; });
  const keyboard = (event: KeyboardEvent): void => {
    if (graphicsLost || settings.open || manual.open || ((event.target instanceof HTMLInputElement && !['checkbox', 'range'].includes(event.target.type)) || ['SELECT', 'TEXTAREA'].includes((event.target as HTMLElement)?.tagName) || (event.target as HTMLElement)?.isContentEditable)) return;
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if ((key === 'p' || key === 'escape') && playing) { event.preventDefault(); game.events.emit('mission:pause'); }
    if (key === 'm') { save.settings.muted = !save.settings.muted; apply(); }
    if (key === 'f') $('fullscreen').click();
    if (key === 'enter' && !playing && document.activeElement?.tagName !== 'BUTTON') play();
  };
  window.addEventListener('keydown', keyboard);

  const stick = $('joystick');
  let stickId = -1;
  function moveStick(event: PointerEvent): void {
    if (event.pointerId !== stickId) return;
    const box = stick.getBoundingClientRect(); let x = (event.clientX - box.left - box.width / 2) / (box.width * 0.35), y = (event.clientY - box.top - box.height / 2) / (box.height * 0.35);
    const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
    $('stick-thumb').style.transform = `translate(${x * 25}px, ${y * 25}px)`;
    stick.setAttribute('aria-valuenow', String(Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360)));
    game.events.emit('pilot:stick', x, y);
  }
  stick.addEventListener('pointerdown', event => { stickId = event.pointerId; stick.setPointerCapture(event.pointerId); moveStick(event); });
  stick.addEventListener('pointermove', moveStick);
  const release = (): void => { stickId = -1; $('stick-thumb').style.transform = ''; game.events.emit('pilot:stick', 0, 0); };
  stick.addEventListener('pointerup', release); stick.addEventListener('pointercancel', release);

  if (import.meta.env.DEV) {
    Object.assign(window, { __KNOTZ_GAME__: game, __KNOTZ_RENDER__: governor });
    import.meta.hot?.dispose(() => { window.removeEventListener('keydown', keyboard); game.destroy(true); });
  }
}
