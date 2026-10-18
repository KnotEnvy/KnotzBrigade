import Phaser from 'phaser';
import { save } from '../core/storage';

export class PilotInput {
  x = 0; y = 0; fire = false; focus = false;
  guard = false; surge = false;
  private keys: Record<string, Phaser.Input.Keyboard.Key>;
  private stick = new Phaser.Math.Vector2();
  private drag: { id: number; x: number; y: number } | null = null;
  private lastPadGuard = false;
  private lastPadSurge = false;
  private touchFocus = false;
  constructor(private scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard!;
    this.keys = keyboard.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', w: 'W', a: 'A', s: 'S', d: 'D', fire: 'SPACE', focus: 'SHIFT' }) as typeof this.keys;
    keyboard.addCapture(['UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE', 'SHIFT']);
    const guard = (event: KeyboardEvent): void => { if (!event.repeat) this.guard = true; };
    const surge = (event: KeyboardEvent): void => { if (!event.repeat) this.surge = true; };
    keyboard.on('keydown-X', guard); keyboard.on('keydown-C', surge);
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) { this.guard = true; return; }
      this.drag = { id: p.id, x: p.x, y: p.y };
    });
    scene.input.on('pointerup', () => { this.drag = null; });
    const onStick = (x: number, y: number): void => { this.stick.set(x, y); };
    const onGuard = (): void => { this.guard = true; };
    const onSurge = (): void => { this.surge = true; };
    const onFocus = (value: boolean): void => { this.touchFocus = value; };
    scene.game.events.on('pilot:stick', onStick);
    scene.game.events.on('pilot:guard', onGuard);
    scene.game.events.on('pilot:surge', onSurge);
    scene.game.events.on('pilot:focus', onFocus);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown-X', guard); keyboard.off('keydown-C', surge);
      scene.game.events.off('pilot:stick', onStick); scene.game.events.off('pilot:guard', onGuard); scene.game.events.off('pilot:surge', onSurge);
      scene.game.events.off('pilot:focus', onFocus);
    });
  }
  reset(): void { this.stick.set(0, 0); this.drag = null; this.guard = false; this.surge = false; this.touchFocus = false; this.scene.input.keyboard?.resetKeys(); }
  read(): void {
    const k = this.keys;
    this.x = Number(k.right.isDown || k.d.isDown) - Number(k.left.isDown || k.a.isDown);
    this.y = Number(k.down.isDown || k.s.isDown) - Number(k.up.isDown || k.w.isDown);
    this.fire = save.settings.autoFire || k.fire.isDown;
    this.focus = k.focus.isDown || this.touchFocus;
    if (this.stick.lengthSq() > 0.01) { this.x = this.stick.x; this.y = this.stick.y; }
    const p = this.scene.input.activePointer;
    if (this.drag && p.isDown && p.id === this.drag.id) {
      this.x = Phaser.Math.Clamp((p.x - this.drag.x) / (65 * this.scene.cameras.main.zoom), -1, 1);
      this.y = Phaser.Math.Clamp((p.y - this.drag.y) / (65 * this.scene.cameras.main.zoom), -1, 1);
      this.fire = true;
    }
    const pad = this.scene.input.gamepad?.getPad(0);
    if (pad?.connected) {
      if (Math.abs(pad.leftStick.x) + Math.abs(pad.leftStick.y) > 0.18) { this.x = pad.leftStick.x; this.y = pad.leftStick.y; }
      if (pad.left) this.x = -1; if (pad.right) this.x = 1;
      if (pad.up) this.y = -1; if (pad.down) this.y = 1;
      this.fire ||= pad.A; this.focus ||= pad.L1 > 0.5;
      if (pad.B && !this.lastPadGuard) this.guard = true;
      if (pad.X && !this.lastPadSurge) this.surge = true;
      this.lastPadGuard = pad.B; this.lastPadSurge = pad.X;
    }
    const length = Math.hypot(this.x, this.y);
    if (length > 1) { this.x /= length; this.y /= length; }
  }
}
