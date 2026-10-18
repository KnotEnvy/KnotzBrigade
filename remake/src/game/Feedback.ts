import Phaser from 'phaser';
import { save } from '../core/storage';

interface Floater { text: Phaser.GameObjects.Text; life: number }
export class Feedback {
  private particles: Phaser.GameObjects.Particles.ParticleEmitter;
  private bursts: Phaser.GameObjects.Group;
  private floaters: Floater[] = [];
  constructor(private scene: Phaser.Scene) {
    this.particles = scene.add.particles(0, 0, 'spark', {
      emitting: false, lifespan: { min: 170, max: 450 }, speed: { min: 45, max: 230 },
      scale: { start: 1.1, end: 0 }, alpha: { start: 0.9, end: 0 },
      blendMode: Phaser.BlendModes.ADD, maxParticles: 240
    }).setDepth(55);
    this.bursts = scene.add.group({ classType: Phaser.GameObjects.Sprite, maxSize: 16 });
    for (let i = 0; i < 18; i++) this.floaters.push({ text: scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold', stroke: '#071b27', strokeThickness: 4 }).setOrigin(0.5).setDepth(65).setVisible(false), life: 0 });
  }
  spark(x: number, y: number, color = 0xffce83, count = 5): void {
    this.particles.setParticleTint(color);
    this.particles.emitParticleAt(x, y, save.settings.reducedMotion ? Math.ceil(count / 2) : count);
  }
  burst(x: number, y: number, scale = 0.55): void {
    const sprite = this.bursts.get(x, y, 'fireExplosion', 'fireExplosion-0') as Phaser.GameObjects.Sprite | null;
    if (sprite) {
      sprite.setActive(true).setVisible(true).setScale(scale).setDepth(50).play('explosion');
      sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.setActive(false).setVisible(false));
    }
    this.spark(x, y, 0xffcf80, 14);
  }
  text(x: number, y: number, text: string, color = '#f3d793'): void {
    const item = this.floaters.find(f => f.life <= 0) ?? this.floaters[0];
    item.life = 0.85;
    item.text.setPosition(x, y).setText(text).setColor(color).setAlpha(1).setVisible(true);
  }
  shake(intensity = 0.003, duration = 130): void {
    if (!save.settings.reducedMotion) this.scene.cameras.main.shake(duration, intensity);
  }
  update(dt: number): void {
    for (const item of this.floaters) if (item.life > 0) {
      item.life -= dt; item.text.y -= 30 * dt;
      item.text.setAlpha(Math.min(1, item.life * 3));
      if (item.life <= 0) item.text.setVisible(false);
    }
  }
}
