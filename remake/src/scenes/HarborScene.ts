import Phaser from 'phaser';
import { OceanScene } from './OceanScene';
import type { RunOptions } from '../core/mission';

export class HarborScene extends OceanScene {
  constructor() { super('harbor'); }
  create(): void {
    this.createOcean(); this.setOceanPhase(0);
    const player = this.add.sprite(870, 355, 'player', 'player-0').setScale(0.85).setDepth(25).play('pilot-idle');
    this.tweens.add({ targets: player, y: 340, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const start = (options: RunOptions): void => { this.scene.start('mission', options); };
    this.game.events.on('mission:start', start);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('mission:start', start));
    this.game.events.emit('mission:harbor');
  }
  update(_time: number, delta: number): void { this.updateOcean(Math.min(delta, 100) / 1000, 0.7); }
}
