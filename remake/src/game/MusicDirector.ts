import Phaser from 'phaser';
import { save } from '../core/storage';

export const SCORE_KEYS = ['breakwater', 'convoy', 'foundry', 'brood', 'warden', 'overload'] as const;
type Theme = typeof SCORE_KEYS[number];
export function setSoundVolume(sound: Phaser.Sound.BaseSound, value: number): void {
  if ((sound instanceof Phaser.Sound.WebAudioSound || sound instanceof Phaser.Sound.HTML5AudioSound) && ((value === 0 && sound.volume !== 0) || Math.abs(sound.volume - value) > 0.00001)) sound.setVolume(value);
}

/** All loops share a transport. Scene pause freezes the score and its envelopes. */
export class MusicDirector {
  private tracks = new Map<Theme, Phaser.Sound.BaseSound>();
  private weights = new Map<Theme, number>();
  private target: Theme = 'breakwater';
  private queued: { theme: Theme; at: number } | null = null;
  private transport = 0;
  private barSeconds: number;
  private duckUntil = 0;
  private duckGain = 1;
  private overload = false;
  private paused = false;
  private ending = false;
  private previousSeek = 0;
  private loopSeconds: number;
  private onUpdate = (_time: number, delta: number): void => this.update(delta / 1000);

  constructor(private scene: Phaser.Scene) {
    const manifest = scene.cache.json.get('score-manifest') as { bpm: number; themes: { seconds: number }[] };
    this.barSeconds = 240 / manifest.bpm;
    this.loopSeconds = manifest.themes[0].seconds;
    for (const key of SCORE_KEYS) { this.tracks.set(key, scene.sound.add(`score-${key}`)); this.weights.set(key, 0); }
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
  }
  get music(): Phaser.Sound.BaseSound { return this.tracks.get(this.target)!; }
  start(): void {
    for (const sound of this.tracks.values()) sound.play({ loop: true, volume: 0 });
    this.weights.set(this.target, 1); this.apply();
  }
  select(theme: Exclude<Theme, 'overload'>, overload = false): void {
    this.overload = overload;
    if (theme === this.target) { this.queued = null; return; }
    if (this.transport < 0.08) { this.target = theme; this.queued = null; this.weights.forEach((_value, key) => this.weights.set(key, key === theme ? 1 : 0)); this.apply(); }
    else if (this.queued?.theme !== theme) this.queued = { theme, at: Math.ceil(this.transport / this.barSeconds) * this.barSeconds };
  }
  duck(seconds: number): void { this.duckUntil = Math.max(this.duckUntil, this.transport + seconds); }
  apply(): void {
    for (const [key, sound] of this.tracks) setSoundVolume(sound, (this.weights.get(key) ?? 0) * 0.28 * save.settings.musicVolume * this.duckGain);
  }
  private update(dt: number): void {
    if (this.paused) return;
    dt = Math.min(dt, 0.1);
    const reference = this.tracks.get('breakwater');
    if ((reference instanceof Phaser.Sound.WebAudioSound || reference instanceof Phaser.Sound.HTML5AudioSound) && reference.isPlaying) {
      const seek = reference.seek;
      this.transport += (seek - this.previousSeek + this.loopSeconds) % this.loopSeconds; this.previousSeek = seek;
    } else this.transport += dt;
    if (this.queued && this.transport >= this.queued.at) { this.target = this.queued.theme; this.queued = null; }
    const fade = 1 - Math.exp(-dt / 0.32);
    for (const key of SCORE_KEYS) {
      const goal = this.ending ? 0 : key === this.target ? 1 : key === 'overload' && this.overload ? 0.36 : 0;
      this.weights.set(key, Phaser.Math.Linear(this.weights.get(key) ?? 0, goal, fade));
    }
    const duck = this.transport < this.duckUntil ? 0.34 : 1;
    this.duckGain = Phaser.Math.Linear(this.duckGain, duck, 1 - Math.exp(-dt / (duck < this.duckGain ? 0.035 : 0.3)));
    this.apply();
    if (this.ending && [...this.weights.values()].every(weight => weight < 0.0001)) { this.tracks.forEach(sound => sound.stop()); this.paused = true; }
  }
  end(): void { this.ending = true; this.queued = null; }
  pause(): void { this.paused = true; this.tracks.forEach(sound => sound.pause()); }
  resume(): void { this.paused = false; this.tracks.forEach(sound => sound.resume()); }
  snapshot(): { theme: Theme; queued: Theme | null; overload: boolean; position: number; duck: number; paused: boolean } {
    return { theme: this.target, queued: this.queued?.theme ?? null, overload: this.overload, position: this.transport, duck: this.duckGain, paused: this.paused };
  }
  destroy(): void { this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate); this.tracks.forEach(sound => sound.destroy()); }
}
