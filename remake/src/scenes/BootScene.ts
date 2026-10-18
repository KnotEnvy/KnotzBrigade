import Phaser from 'phaser';
import { SCORE_KEYS } from '../game/MusicDirector';

export class BootScene extends Phaser.Scene {
  private failed = false;
  constructor() { super('boot'); }

  preload(): void {
    this.failed = false;
    const path = `${import.meta.env.BASE_URL}assets/legacy/`;
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.failed = true;
      this.game.events.emit('mission:error', `Could not load ${file.key}. Reload to retry.`);
    });
    for (let i = 1; i <= 4; i++) this.load.image(`layer${i}`, `${path}layer${i}.png`);
    this.load.on('progress', (progress: number) => this.game.events.emit('mission:loading', progress));
    for (const key of ['player', 'drone', 'razorfin', 'angler1', 'stalker', 'hivewhale', 'bulbwhale', 'moonfish', 'lucky', 'fireExplosion']) {
      this.load.atlas(key, `${path}${key}-atlas.png`, `${path}${key}-atlas.json`);
    }
    for (const key of ['shot', 'hit', 'explosion', 'powerup', 'shield']) this.load.audio(key, `${path}${key}.wav`);
    const score = `${import.meta.env.BASE_URL}assets/score/`;
    this.load.json('score-manifest', `${score}score.json`);
    for (const key of SCORE_KEYS) this.load.audio(`score-${key}`, `${score}${key}.wav`);
    this.load.image('engine-room', `${import.meta.env.BASE_URL}assets/worlds/engine-chamber.png`);
  }

  create(): void {
    const required = ['player', 'drone', 'razorfin', 'angler1', 'stalker', 'moonfish', 'lucky', 'hivewhale', 'bulbwhale', 'fireExplosion', 'engine-room', 'layer1', 'layer2', 'layer3', 'layer4'];
    if (this.failed || !required.every(key => this.textures.exists(key))) return;
    this.anims.create({ key: 'pilot-idle', frames: this.anims.generateFrameNames('player', { prefix: 'player-', start: 0, end: 37 }), frameRate: 30, repeat: -1 });
    for (const key of ['drone', 'razorfin', 'angler1', 'stalker', 'hivewhale', 'bulbwhale', 'moonfish', 'lucky']) {
      this.anims.create({ key: `${key}-swim`, frames: this.anims.generateFrameNames(key, { prefix: `${key}-`, start: 0, end: 37 }), frameRate: key === 'drone' ? 36 : 24, repeat: -1 });
    }
    this.anims.create({ key: 'explosion', frames: this.anims.generateFrameNames('fireExplosion', { prefix: 'fireExplosion-', start: 0, end: 7 }), frameRate: 24, repeat: 0 });
    this.game.events.emit('mission:ready');
    this.scene.start('harbor');
  }
}
