import Phaser from 'phaser';
import { save } from '../core/storage';
import type { Stage } from '../core/mission';

export abstract class OceanScene extends Phaser.Scene {
  protected layers: Phaser.GameObjects.TileSprite[] = [];
  protected motes!: Phaser.GameObjects.SpriteGPULayer;
  protected engineRoom?: Phaser.GameObjects.Image;
  protected vignette!: Phaser.Filters.Vignette;
  protected oceanPhase: Stage = 0;
  protected createOcean(): void {
    this.layers = [];
    const fit = (): void => { this.cameras.main.setSize(this.scale.width, this.scale.height).setZoom(this.scale.width / 1280).centerOn(640, 360); };
    fit(); this.scale.on(Phaser.Scale.Events.RESIZE, fit);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, fit));
    this.cameras.main.setBackgroundColor('#113347');
    for (let i = 1; i <= 4; i++) this.layers.push(this.add.tileSprite(0, 0, 1280, 720, `layer${i}`).setOrigin(0).setTileScale(1.44).setDepth(i === 4 ? 35 : i));
    if (this.textures.exists('engine-room')) this.engineRoom = this.add.image(640, 360, 'engine-room').setDisplaySize(1280, 720).setDepth(4).setAlpha(0);
    this.add.rectangle(640, 360, 1280, 720, 0x031b2d, 0.2).setDepth(5);
    this.layers[3].setAlpha(0.22).setDepth(7);
    if (!this.textures.exists('spark')) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff, 0.15).fillCircle(8, 8, 7); g.fillStyle(0xffffff, 1).fillCircle(8, 8, 3); g.generateTexture('spark', 16, 16); g.destroy();
    }
    const random = new Phaser.Math.RandomDataGenerator(['brasswake-water']);
    this.motes = this.add.spriteGPULayer('spark', 220).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 220; i++) {
      const scale = random.realInRange(0.12, 0.35);
      this.motes.addMember({
        x: { base: random.between(0, 1500), amplitude: -1500, duration: random.between(25000, 60000), delay: -random.between(0, 60000), yoyo: false },
        y: { base: random.between(75, 650), amplitude: -60, duration: random.between(5000, 10000), ease: 'Sine.easeInOut' },
        scaleX: scale, scaleY: scale, alpha: { base: 0.1, amplitude: 0.3, duration: 3000 + i * 20 }
      });
    }
    this.vignette = this.cameras.main.filters.internal.addVignette(0.5, 0.5, 0.85, 0.22);
    this.vignette.setActive(save.settings.effects);
    this.motes.setVisible(!save.settings.reducedMotion);
    const settings = (): void => { this.vignette.setActive(save.settings.effects); this.motes.setVisible(!save.settings.reducedMotion); };
    this.game.events.on('mission:settings', settings);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off('mission:settings', settings));
  }
  protected setOceanPhase(stage: Stage): void {
    this.oceanPhase = stage;
    const tint = [0xc1e5ed, 0xffcf9c, 0xa9b1ed][stage];
    this.layers.slice(0, 3).forEach(layer => this.tweens.add({ targets: layer, alpha: stage === 2 && this.engineRoom ? 0.12 : 0.85, duration: 1600 }));
    this.layers.forEach(layer => layer.setTint(tint));
    if (this.engineRoom) this.tweens.add({ targets: this.engineRoom, alpha: stage === 2 ? 0.95 : 0, duration: 1800 });
  }
  protected updateOcean(dt: number, intensity = 1): void {
    this.layers.forEach((layer, i) => { layer.tilePositionX += [10, 22, 39, 65][i] * dt * intensity; });
  }
}
