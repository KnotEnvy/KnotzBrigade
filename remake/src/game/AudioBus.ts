import Phaser from 'phaser';
import { save } from '../core/storage';
import { MusicDirector, setSoundVolume } from './MusicDirector';
import { masterOutput } from './Mastering';

type Cue = 'warning' | 'catch' | 'counter' | 'surge' | 'part' | 'phase' | 'open' | 'victory' | 'defeat';
const CUES: Record<Cue, number[]> = { warning: [440, 440], catch: [880, 1320], counter: [220, 660], surge: [220, 330, 440, 660], part: [330, 440, 660], phase: [165, 220, 165], open: [660, 880, 1100], victory: [587.33, 698.46, 880, 1174.66], defeat: [440, 349.23, 293.66] };
export class AudioBus {
  readonly score: MusicDirector;
  readonly output: AudioNode | undefined;
  private voices = new Map<string, Phaser.Sound.BaseSound[]>();
  private lastCue = new Map<Cue, number>();
  private levels = new Map<Phaser.Sound.BaseSound, number>();
  constructor(private scene: Phaser.Scene) {
    this.output = masterOutput(scene);
    this.score = new MusicDirector(scene);
    for (const [key, count] of [['shot', 4], ['hit', 3], ['explosion', 4], ['powerup', 2], ['shield', 2]] as const) this.voices.set(key, Array.from({ length: count }, () => scene.sound.add(key)));
    if (scene.sound instanceof Phaser.Sound.WebAudioSoundManager) {
      const context = scene.sound.context;
      for (const [key, notes] of Object.entries(CUES)) {
        const cacheKey = `cue-${key}`;
        if (!scene.cache.audio.exists(cacheKey)) {
          const step = key === 'surge' ? 0.085 : key === 'victory' || key === 'defeat' ? 0.18 : 0.11, length = Math.ceil(context.sampleRate * (notes.length * step + 0.1));
          const buffer = context.createBuffer(1, length, context.sampleRate), samples = buffer.getChannelData(0);
          for (let i = 0; i < length; i++) {
            const t = i / context.sampleRate, n = Math.floor(t / step), local = t % step;
            if (n < notes.length) {
              const phase = 2 * Math.PI * notes[n] * t;
              const wave = key === 'warning' ? Math.asin(Math.sin(phase)) * 2 / Math.PI : key === 'catch' || key === 'open' ? (Math.sin(phase) + Math.sin(phase * 2.76) * 0.25) / 1.25 : key === 'counter' || key === 'phase' ? (Math.sin(phase) + Math.sin(phase * 2) * 0.3) / 1.3 : (Math.sin(phase) + Math.sin(phase * 1.5) * 0.25) / 1.25;
              samples[i] = wave * Math.min(1, local / 0.008) * Math.exp(-local * (key === 'open' ? 22 : 32)) * 0.28;
            }
          }
          scene.cache.audio.add(cacheKey, buffer);
        }
        this.voices.set(cacheKey, [scene.sound.add(cacheKey), scene.sound.add(cacheKey)]);
      }
    }
    this.apply();
  }
  get music(): Phaser.Sound.BaseSound { return this.score.music; }
  apply(): void {
    this.scene.sound.mute = save.settings.muted; this.scene.sound.volume = save.settings.volume;
    this.score.apply(); this.levels.forEach((level, sound) => setSoundVolume(sound, level * save.settings.effectsVolume));
  }
  start(): void { this.score.start(); }
  phase(stage: number, overload = false): void {
    this.score.select(stage === 0 ? 'breakwater' : stage === 1 ? 'convoy' : 'foundry', overload);
  }
  boss(final: boolean, overload = false): void { this.score.select(final ? 'warden' : 'brood', overload); }
  pause(): void { this.score.pause(); this.voices.forEach(pool => pool.forEach(sound => { if (sound.isPlaying) sound.pause(); })); }
  resume(): void { this.score.resume(); this.voices.forEach(pool => pool.forEach(sound => { if (sound.isPaused) sound.resume(); })); }
  finish(completed: boolean): void { this.score.end(); this.cue(completed ? 'victory' : 'defeat'); }
  cue(key: Cue): void {
    const now = this.scene.time.now;
    if (now - (this.lastCue.get(key) ?? -Infinity) < 80) return;
    this.lastCue.set(key, now);
    if (this.voices.has(`cue-${key}`)) this.play(`cue-${key}`, key === 'warning' ? 0.8 : 0.65); else this.play('powerup', 0.3, key === 'warning' ? 0.6 : 1.2);
    if (key === 'warning' || key === 'open' || key === 'phase' || key === 'surge') {
      this.score.duck(key === 'phase' || key === 'surge' ? 0.8 : 0.58);
    }
  }
  play(key: string, volume = 0.4, rate = 1): void {
    const pool = this.voices.get(key); if (!pool) return;
    const sound = pool.find(s => !s.isPlaying && !s.isPaused) ?? pool[0]; this.levels.set(sound, volume); sound.stop(); sound.play({ volume: volume * save.settings.effectsVolume, rate });
  }
  destroy(): void { this.score.destroy(); this.voices.forEach(pool => pool.forEach(s => s.destroy())); this.levels.clear(); }
}
