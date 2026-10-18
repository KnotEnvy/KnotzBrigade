import Phaser from 'phaser';
import { save } from '../core/storage';

export const RESOLUTIONS = { performance: [640, 360], balanced: [960, 540], high: [1280, 720] } as const;
export type RenderPreset = keyof typeof RESOLUTIONS;
export function initialPreset(): RenderPreset {
  return save.settings.quality === 'auto' ? matchMedia('(pointer: coarse)').matches ? 'performance' : 'balanced' : save.settings.quality;
}

/** Observe rendered frames only. One downgrade per flight, no physics changes. */
export class RenderGovernor {
  preset = initialPreset();
  private previous = 0;
  private samples: number[] = [];
  private warmup = 90;
  private adjusted = false;
  private active = false;
  private paused = false;
  private frame = (): void => {
    const now = performance.now(), delta = now - this.previous; this.previous = now;
    if (!this.active || this.paused || document.hidden || save.settings.quality !== 'auto' || this.adjusted || this.game.input.activePointer.isDown) { this.samples.length = 0; return; }
    if (this.warmup-- > 0 || delta > 200 || delta < 5) return;
    this.samples.push(delta);
    if (this.samples.length < 120) return;
    const mean = this.samples.reduce((total, value) => total + value, 0) / this.samples.length;
    // Consistent 23ms frames are already only ~43fps. A 25ms cutoff hid that
    // regime; allow modest jitter but react to sustained misses of 60fps.
    const late = this.samples.filter(value => value > 20).length / this.samples.length;
    this.samples.length = 0;
    if (mean > 19 && late > 0.2 && this.preset !== 'performance') { this.adjusted = true; this.setPreset('performance'); }
  };
  constructor(private game: Phaser.Game) {
    game.events.on(Phaser.Core.Events.POST_RENDER, this.frame);
    game.events.on('mission:playing', () => { this.active = true; this.paused = false; this.warmup = 90; this.adjusted = false; this.samples.length = 0; });
    game.events.on('mission:paused', (paused: boolean) => { this.paused = paused; this.previous = performance.now(); this.samples.length = 0; });
    game.events.on('mission:harbor', () => { this.active = false; });
    game.events.on('mission:result', () => { this.active = false; });
    game.events.once(Phaser.Core.Events.DESTROY, () => game.events.off(Phaser.Core.Events.POST_RENDER, this.frame));
  }
  apply(): void {
    this.adjusted = false; this.warmup = 90; this.samples.length = 0;
    this.setPreset(initialPreset());
  }
  private setPreset(preset: RenderPreset): void {
    this.preset = preset;
    const [width, height] = RESOLUTIONS[preset];
    if (this.game.scale.width !== width) this.game.scale.setGameSize(width, height);
    this.game.events.emit('mission:quality', preset, width, height);
  }
}
