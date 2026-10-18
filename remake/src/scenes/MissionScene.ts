import Phaser from 'phaser';
import { OceanScene } from './OceanScene';
import { Enemy, Shot, Pickup } from '../game/Actors';
import { PilotInput } from '../game/PilotInput';
import { Feedback } from '../game/Feedback';
import { AudioBus } from '../game/AudioBus';
import { DIFFICULTY, ENEMIES, PARTS, WAVES, freshStats, multiplierFor, rankFor } from '../core/mission';
import type { RunOptions, RunStats, EnemyKind, Stage, Wave, SectorReport } from '../core/mission';
import { save, writeSave } from '../core/storage';

interface Laser { y: number; at: number; end: number; width: number }
interface Gate { x: number; y: number; gap: number; hit: boolean; passed: boolean }
export interface MissionHUD {
  stage: Stage; part: string; objective: string; progress: number; hull: number; maxHull: number;
  score: number; chain: number; multiplier: number; chainTime: number; charge: number;
  guard: number; guarding: boolean; surge: number; level: number; weapon: string; boss: { name: string; hp: number; max: number; enraged: boolean; status: string } | null;
}

export class MissionScene extends OceanScene {
  options!: RunOptions;
  stats!: RunStats;
  stage: Stage = 0;
  clock = 0; actTime = 0; hull = 6; maxHull = 6; charge = 0; level = 1;
  chain = 0; chainUntil = 0; guardUntil = 0; guardReady = 0; surgeUntil = 0;
  invincibleUntil = 0; ending = false; completed = false;
  player!: Phaser.Physics.Arcade.Sprite;
  enemies!: Phaser.Physics.Arcade.Group;
  friendly!: Phaser.Physics.Arcade.Group;
  hostile!: Phaser.Physics.Arcade.Group;
  pickups!: Phaser.Physics.Arcade.Group;
  inputState!: PilotInput;
  boss: Enemy | null = null;
  attackHistory: string[] = [];
  sectorReports: SectorReport[] = [];
  private sectorStart = freshStats(); private sectorAt = 0; private sectorChain = 0;
  private gates: Gate[] = []; private gateIndex = 0;
  private bossRewards = 0; private bossCatches = 0; private bossGrazes = 0;
  private feedback!: Feedback;
  private audio!: AudioBus;
  private core!: Phaser.GameObjects.Graphics;
  private warnings!: Phaser.GameObjects.Graphics;
  private light!: Phaser.GameObjects.Light;
  private waveIndex = 0; private serial = 0; private fireReady = 0; private soundReady = 0;
  private guardCaught = 0; private guardReleased = true; private nextHUD = 0;
  private transitionAt = 0; private nextStage: Stage | null = null; private lastGraze = 0;
  private lasers: Laser[] = []; private hazardIndex = 0; private dropCounter = 0;
  private onPause = (): void => this.togglePause();
  private onSettings = (): void => { this.vignette.setActive(save.settings.effects); this.player.setLighting(save.settings.effects); this.audio.apply(); };

  constructor() { super('mission'); }

  init(options: RunOptions): void {
    this.options = { difficulty: options.difficulty ?? 'pilot', weapon: options.weapon ?? 'lance', checkpoint: options.checkpoint, practice: options.practice };
    this.stage = options.checkpoint ?? 0;
    this.stats = freshStats(); this.clock = 0; this.actTime = 0;
    this.maxHull = DIFFICULTY[this.options.difficulty].hull; this.hull = this.maxHull;
    this.charge = this.stage * 15; this.level = this.stage + 1;
    this.chain = 0; this.chainUntil = 0; this.guardUntil = 0; this.guardReady = 0;
    this.surgeUntil = 0; this.invincibleUntil = 2; this.ending = false; this.completed = false;
    this.waveIndex = 0; this.serial = 0; this.fireReady = 0; this.soundReady = 0;
    this.guardCaught = 0; this.guardReleased = true; this.nextHUD = 0; this.transitionAt = 0;
    this.nextStage = null; this.lasers = []; this.hazardIndex = 0; this.dropCounter = 0; this.boss = null;
    this.attackHistory = []; this.bossRewards = 0; this.bossCatches = 0; this.bossGrazes = 0;
    this.sectorReports = []; this.sectorStart = freshStats(); this.sectorAt = 0; this.sectorChain = 0; this.gates = []; this.gateIndex = 0;
  }

  create(): void {
    this.createOcean(); this.setOceanPhase(this.stage); this.makeTextures();
    this.physics.world.setBounds(50, 90, 1120, 550);
    this.player = this.physics.add.sprite(210, 355, 'player', 'player-0').setScale(0.47).setDepth(25).setCollideWorldBounds(true).play('pilot-idle');
    this.player.setCircle(14, 46, 81);
    this.friendly = this.physics.add.group({ classType: Shot, maxSize: 180, allowGravity: false });
    this.hostile = this.physics.add.group({ classType: Shot, maxSize: 220, allowGravity: false });
    this.enemies = this.physics.add.group({ classType: Enemy, maxSize: 48, allowGravity: false });
    this.pickups = this.physics.add.group({ classType: Pickup, maxSize: 32, allowGravity: false });
    this.feedback = new Feedback(this); this.inputState = new PilotInput(this); this.audio = new AudioBus(this); this.audio.start(); this.audio.phase(this.stage);
    this.core = this.add.graphics().setDepth(60);
    this.warnings = this.add.graphics().setDepth(42);
    this.lights.enable().setAmbientColor(0xd4dce2);
    this.light = this.lights.addLight(200, 300, 350, 0x9de9ef, 0.8, 100);
    this.player.setLighting(save.settings.effects);

    this.physics.add.overlap(this.friendly, this.enemies, (shot, enemy) => this.hitEnemy(shot as Shot, enemy as Enemy));
    this.physics.add.overlap(this.player, this.hostile, (_player, shot) => {
      const bullet = shot as Shot;
      if (bullet.active && this.clock >= bullet.armedAt) { bullet.disableBody(true, true); this.damagePlayer(1); }
    });
    this.physics.add.overlap(this.player, this.enemies, (_player, target) => {
      const enemy = target as Enemy;
      if (!enemy.active || enemy.dead) return;
      if (this.clock < this.guardUntil) { if (!enemy.boss) this.damageEnemy(enemy, 15); return; }
      this.damagePlayer(enemy.boss ? 2 : 1);
    });
    this.physics.add.overlap(this.player, this.pickups, (_player, drop) => this.collect(drop as Pickup));

    this.game.events.on('mission:pause', this.onPause);
    this.game.events.on('mission:settings', this.onSettings);
    const blur = (): void => { if (!this.scene.isPaused() && !this.ending) this.togglePause(); };
    this.game.events.on(Phaser.Core.Events.BLUR, blur); this.game.events.on(Phaser.Core.Events.HIDDEN, blur);
    const abandon = (): void => { this.scene.resume(); this.scene.start('harbor'); };
    this.game.events.on('mission:abandon', abandon);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.audio.destroy(); this.game.events.off('mission:pause', this.onPause); this.game.events.off('mission:settings', this.onSettings);
      this.game.events.off(Phaser.Core.Events.BLUR, blur); this.game.events.off(Phaser.Core.Events.HIDDEN, blur); this.game.events.off('mission:abandon', abandon);
    });
    this.game.events.emit('mission:playing', { ...this.options, stage: this.stage });
    this.announcePart(); this.emitHUD();
  }

  private makeTextures(): void {
    const make = (key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void): void => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }); draw(g); g.generateTexture(key, width, height); g.destroy();
    };
    make('bolt', 36, 12, g => { g.fillStyle(0x46d8e6, 0.25).fillRoundedRect(0, 0, 36, 12, 6); g.fillStyle(0xb9ffff).fillRoundedRect(3, 4, 30, 4, 2); g.fillStyle(0xffffff).fillRect(14, 5, 17, 2); });
    make('enemy-bolt', 20, 20, g => { g.fillStyle(0x1c1423).fillCircle(10, 10, 10); g.fillStyle(0xff8f79).fillCircle(10, 10, 8); g.fillStyle(0xffe4a8).fillCircle(10, 10, 4); });
    make('counter', 72, 36, g => { g.fillStyle(0x62f7e3, 0.25).fillEllipse(36, 18, 72, 36); g.fillStyle(0xa0fff0).fillEllipse(40, 18, 56, 16); g.fillStyle(0xffffff).fillEllipse(44, 18, 36, 6); });
    make('mine', 40, 40, g => { g.lineStyle(3, 0xc695ed); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.lineBetween(20 + Math.cos(a) * 11, 20 + Math.sin(a) * 11, 20 + Math.cos(a) * 19, 20 + Math.sin(a) * 19); } g.fillStyle(0x241d41).fillCircle(20, 20, 14); g.lineStyle(2, 0xe6afff).strokeCircle(20, 20, 12); g.fillStyle(0xf4ddff).fillCircle(20, 20, 5); });
    make('conduit', 52, 52, g => { g.fillStyle(0x212f3b).fillCircle(26, 26, 24); g.lineStyle(5, 0xc19761).strokeCircle(26, 26, 20); g.lineStyle(2, 0x8ffff0).strokeCircle(26, 26, 13); g.fillStyle(0xb9fff1).fillCircle(26, 26, 7); });
    for (const [key, color] of [['power', 0x8df5df], ['repair', 0xfc9b97], ['data', 0xffdc8c], ['charge', 0x9fc1ff]] as const) {
      make(`pickup-${key}`, 32, 32, g => {
        g.fillStyle(0x092735).fillCircle(16, 16, 15); g.lineStyle(2, color).strokeCircle(16, 16, 13);
        g.fillStyle(color);
        if (key === 'repair') { g.fillRect(13, 8, 6, 16); g.fillRect(8, 13, 16, 6); }
        else if (key === 'power') { g.fillTriangle(12, 7, 24, 16, 12, 25); }
        else if (key === 'data') g.fillRect(10, 10, 12, 12);
        else g.fillCircle(16, 16, 6);
      });
    }
  }

  private announcePart(): void {
    this.game.events.emit('mission:part', { stage: this.stage, name: PARTS[this.stage].name, subtitle: PARTS[this.stage].subtitle });
    this.message(PARTS[this.stage].signal, 5);
  }

  private message(text: string, seconds = 3): void { this.game.events.emit('mission:message', { text, seconds }); }

  private spawnWave(wave: Wave): void {
    if (wave.label) this.message(wave.label, 3.2);
    for (let i = 0; i < wave.count; i++) this.spawnEnemy(wave.kind, 1330 + i * (wave.kind === 'angler1' ? 130 : 80), Phaser.Math.Clamp(wave.y + (wave.step ?? 0) * i, 135, 590), wave.pattern);
  }

  spawnEnemy(kind: EnemyKind, x: number, y: number, pattern: Wave['pattern'] = 'sine'): Enemy | null {
    const procedural = kind === 'mine' || kind === 'conduit';
    const enemy = this.enemies.get(x, y, kind, procedural ? undefined : `${kind}-0`) as Enemy | null;
    if (!enemy) return null;
    const spec = ENEMIES[kind];
    enemy.anims.stop(); enemy.setTexture(kind, procedural ? undefined : `${kind}-0`).enableBody(true, x, y, true, true);
    enemy.kind = kind; enemy.maxHp = Math.ceil(spec.health * DIFFICULTY[this.options.difficulty].health); enemy.hp = enemy.maxHp;
    enemy.age = 0; enemy.baseY = y; enemy.fireAt = 1.8; enemy.dead = false; enemy.boss = kind === 'hivewhale' || kind === 'bulbwhale';
    enemy.enraged = false; enemy.spawnId = ++this.serial; enemy.pattern = pattern; enemy.attack = 0;
    enemy.attackAt = 2.4; enemy.warned = false; enemy.dived = false; enemy.flashUntil = 0;
    enemy.exposedUntil = 0; enemy.rushUntil = 0; enemy.rushPreparing = false; enemy.nodes = false; enemy.parentId = 0; enemy.orbit = 0;
    enemy.openness = 0; enemy.armoredFlash = false;
    enemy.rewarded = !this.boss || enemy.boss || this.bossRewards++ < 20;
    enemy.setScale(spec.scale).setDepth(enemy.boss ? 27 : 22).setAlpha(1).clearTint().setAngle(0);
    if (!procedural && !enemy.boss && kind !== 'lucky') enemy.setTint(0x202935).setTintMode(Phaser.TintModes.ADD);
    enemy.setCircle(spec.radius / spec.scale, enemy.width / 2 - spec.radius / spec.scale, enemy.height / 2 - spec.radius / spec.scale);
    enemy.setVelocity(-spec.speed * DIFFICULTY[this.options.difficulty].speed, 0);
    if (!procedural) enemy.play(`${kind}-swim`);
    if (enemy.boss) {
      this.boss = enemy; enemy.setVelocity(0, 0);
      this.bossRewards = 0; this.bossCatches = 0; this.bossGrazes = 0;
      this.message(kind === 'hivewhale' ? 'BROODKEEPER · Countershots pierce armor. Strike when the brood hatch opens.' : 'FURNACE WARDEN · Break the three linked conduits to expose its heart.', 5);
      this.game.events.emit('mission:boss', kind === 'hivewhale' ? 'THE BROODKEEPER' : 'THE FURNACE WARDEN');
      this.audio.boss(kind === 'bulbwhale');
      this.audio.play('powerup', 0.5, 0.65);
    }
    return enemy;
  }

  private playerShot(angle: number, damage: number, offset = 0, counter = false): void {
    const shot = this.friendly.get(this.player.x + 30, this.player.y - 15 + offset, counter ? 'counter' : 'bolt') as Shot | null;
    if (!shot) return;
    shot.setTexture(counter ? 'counter' : 'bolt').enableBody(true, this.player.x + 30, this.player.y - 15 + offset, true, true);
    shot.setScale(counter ? 1 : 1.05).setAlpha(1).clearTint().setDepth(46).setRotation(angle);
    shot.body?.setSize(counter ? 52 : 29, counter ? 22 : 6, true);
    shot.setVelocity(Math.cos(angle) * (counter ? 940 : 1120), Math.sin(angle) * (counter ? 940 : 1120));
    shot.damage = damage; shot.expires = this.clock + 2; shot.pierce = counter ? 4 : 1; shot.counted = false; shot.hits.clear();
    this.stats.fired++;
  }

  fireEnemy(x: number, y: number, angle: number, speed: number, size = 1): void {
    if (x < 20 || x > 1285 || y < 75 || y > 655) return;
    const shot = this.hostile.get(x, y, 'enemy-bolt') as Shot | null;
    if (!shot) return;
    shot.setTexture('enemy-bolt').enableBody(true, x, y, true, true).setScale(size).setDepth(47).setAlpha(0.6).setRotation(0);
    shot.setCircle(6, 4, 4).setVelocity(Math.cos(angle) * speed * DIFFICULTY[this.options.difficulty].speed, Math.sin(angle) * speed * DIFFICULTY[this.options.difficulty].speed);
    shot.expires = this.clock + 8; shot.armedAt = this.clock + 0.18; shot.grazed = false;
  }

  private fireWeapon(): void {
    const surge = this.clock < this.surgeUntil;
    const power = surge ? 1.65 : 1;
    if (this.options.weapon === 'lance') {
      const offsets = this.level === 1 ? [0] : this.level === 2 ? [-6, 6] : [-10, 0, 10];
      for (const offset of offsets) this.playerShot(0, (this.level === 1 ? 2 : 0.98) * power, offset);
    } else {
      const angles = this.level === 1 ? [-0.13, 0, 0.13] : this.level === 2 ? [-0.18, -0.09, 0, 0.09, 0.18] : [-0.15, -0.075, 0, 0.075, 0.15];
      for (const angle of angles) this.playerShot(angle, (this.level === 3 ? 0.88 : 0.85) * power);
    }
    this.fireReady = this.clock + (surge ? 0.08 : this.options.weapon === 'lance' ? 0.12 : 0.14);
    if (this.clock > this.soundReady) { this.audio.play('shot', 0.11, surge ? 1.35 : 1); this.soundReady = this.clock + 0.12; }
    this.feedback.spark(this.player.x + 32, this.player.y - 15, 0xb5ffff, 1);
  }

  private hitEnemy(shot: Shot, enemy: Enemy): void {
    if (!shot.active || !enemy.active || enemy.dead || this.ending || shot.hits.has(enemy.spawnId)) return;
    shot.hits.add(enemy.spawnId);
    if (!shot.counted) { this.stats.hit++; shot.counted = true; }
    if (--shot.pierce <= 0) shot.disableBody(true, true);
    const armored = enemy.boss && this.clock >= enemy.exposedUntil;
    const counter = shot.texture.key === 'counter';
    enemy.armoredFlash = armored && !counter;
    this.damageEnemy(enemy, shot.damage * (enemy.armoredFlash ? enemy.kind === 'bulbwhale' ? 0.18 : 0.32 : 1));
    if (counter && enemy.boss) { this.feedback.spark(shot.x, shot.y, 0xa9ffeb, 12); this.feedback.shake(0.002, 90); }
  }

  damageEnemy(enemy: Enemy, damage: number): void {
    if (!enemy.active || enemy.dead) return;
    enemy.hp -= damage; enemy.flashUntil = this.clock + 0.045;
    enemy.setTint(enemy.armoredFlash ? 0x332615 : 0x354344).setTintMode(Phaser.TintModes.ADD);
    if (enemy.hp > 0) return;
    // Resolve the death synchronously before any later overlap callback can award it again.
    enemy.dead = true; enemy.disableBody(true, true);
    if (enemy.rewarded) { this.stats.kills++; this.chain++; this.chainUntil = this.clock + 4.5; }
    this.stats.maxChain = Math.max(this.stats.maxChain, this.chain);
    this.sectorChain = Math.max(this.sectorChain, this.chain);
    const points = enemy.rewarded ? Math.round(ENEMIES[enemy.kind].points * multiplierFor(this.chain) * DIFFICULTY[this.options.difficulty].score) : 0;
    this.stats.score += points; this.charge = Math.min(100, this.charge + (enemy.boss ? 25 : 3));
    this.feedback.burst(enemy.x, enemy.y, enemy.boss ? 1.6 : 0.4);
    this.audio.play('explosion', enemy.boss ? 0.65 : 0.24, enemy.boss ? 0.7 : 0.95 + (this.serial % 3) * 0.08);
    if (points) this.feedback.text(enemy.x, enemy.y - 32, `+${points}`);
    if (this.chain % 8 === 0) this.feedback.text(this.player.x + 30, this.player.y - 65, `CHAIN ×${multiplierFor(this.chain)}`, '#a8fff0');
    if (enemy.kind === 'lucky') { this.drop(enemy.x, enemy.y, 'data'); this.drop(enemy.x + 35, enemy.y + 25, 'power'); }
    else if (!enemy.boss && enemy.rewarded && ++this.dropCounter % 7 === 0) this.drop(enemy.x, enemy.y, this.hull < this.maxHull - 1 ? 'repair' : 'charge');
    if (!enemy.boss && enemy.rewarded && this.stats.kills % 15 === 0 && this.level < 3) this.drop(enemy.x, enemy.y, 'power');
    if (enemy.boss) {
      const quickBonus = Math.max(0, 4000 - Math.floor(enemy.age) * 65); this.stats.score += quickBonus;
      this.feedback.text(780, 290, `SWIFT CLEAR +${quickBonus}`, '#ffe3a0');
      this.boss = null; this.clearHostile(); this.lasers = [];
      this.feedback.shake(0.008, 350);
      for (const actor of this.enemies.getChildren() as Enemy[]) if (actor.active) actor.disableBody(true, true);
      if (enemy.kind === 'hivewhale') this.prepareTransition(2);
      else { this.completed = true; this.finish(true); }
    }
  }

  private drop(x: number, y: number, kind: Pickup['kind']): void {
    const drop = this.pickups.get(x, y, `pickup-${kind}`) as Pickup | null;
    if (!drop) return;
    drop.kind = kind; drop.expires = this.clock + 12;
    drop.setTexture(`pickup-${kind}`).enableBody(true, x, y, true, true).setDepth(44).setScale(1).setAlpha(1);
    drop.setCircle(13, 3, 3).setVelocity(-90, 0);
  }

  private collect(drop: Pickup): void {
    if (!drop.active || this.ending) return;
    drop.disableBody(true, true);
    if (drop.kind === 'power') { this.level = Math.min(3, this.level + 1); this.feedback.text(this.player.x, this.player.y - 50, `WEAPON LV ${this.level}`, '#a9fff0'); }
    if (drop.kind === 'repair') { this.hull = Math.min(this.maxHull, this.hull + 1); this.feedback.text(this.player.x, this.player.y - 50, '+1 HULL', '#ffbbb1'); }
    if (drop.kind === 'data') { this.stats.couriers++; this.stats.score += 1200; this.hull = Math.min(this.maxHull, this.hull + 1); this.feedback.text(this.player.x, this.player.y - 50, 'RELAY DATA +1200'); }
    this.charge = Math.min(100, this.charge + (drop.kind === 'charge' ? 18 : 10));
    this.audio.play('powerup', 0.35, 1.1); this.feedback.spark(drop.x, drop.y, 0x9affdb, 12);
  }

  damagePlayer(amount: number): void {
    if (this.ending || this.clock < this.invincibleUntil || this.clock < this.guardUntil) return;
    this.hull = Math.max(0, this.hull - amount); this.stats.damage += amount;
    this.invincibleUntil = this.clock + 1.6; this.chain = 0; this.chainUntil = 0;
    this.feedback.burst(this.player.x, this.player.y, 0.45); this.feedback.shake(0.004, 200);
    this.audio.play('hit', 0.55, 0.8);
    this.hostile.getChildren().forEach(target => { const shot = target as Shot; if (shot.active && Phaser.Math.Distance.Between(shot.x, shot.y, this.player.x, this.player.y) < 110) shot.disableBody(true, true); });
    if (this.hull <= 0) this.finish(false);
    this.emitHUD();
  }

  activateGuard(): void {
    if (this.clock < this.guardReady || this.ending) return;
    this.guardUntil = this.clock + 1.15; this.guardReady = this.clock + 5.2; this.guardCaught = 0; this.guardReleased = false;
    this.stats.guards++; this.audio.play('shield', 0.42, 1.15);
  }

  activateSurge(): void {
    if (this.charge < 100 || this.ending) return;
    this.charge = 0; this.surgeUntil = this.clock + 6; this.invincibleUntil = this.clock + 0.8; this.stats.surges++;
    this.clearHostile(); this.lasers = []; this.audio.cue('surge');
    this.feedback.shake(0.004, 180); this.feedback.text(this.player.x + 55, this.player.y - 60, 'SURGE · 6 SECONDS', '#abfff0');
    for (const enemy of this.enemies.getChildren() as Enemy[]) if (enemy.active && !enemy.dead) this.damageEnemy(enemy, enemy.boss ? 28 : 14);
    if (this.ending) return;
    this.message('SURGE · fire amplified. The water is yours.', 2.2);
  }

  private clearHostile(): void { this.hostile.getChildren().forEach(s => (s as Shot).disableBody(true, true)); }

  private prepareTransition(stage: Stage): void {
    if (this.nextStage !== null || this.ending) return;
    this.nextStage = stage; this.transitionAt = this.clock + 2.5;
    this.clearHostile(); this.lasers = []; this.gates = []; this.invincibleUntil = this.clock + 4;
    this.stats.score += 1800; this.hull = Math.min(this.maxHull, this.hull + 2); this.level = Math.max(this.level, stage + 1);
    this.sealSector(true);
    this.message('SECTOR SECURED · hull repaired +2 · checkpoint reached', 3);
    this.audio.cue('part');
  }

  private advancePart(): void {
    if (this.nextStage === null) return;
    this.stage = this.nextStage; this.nextStage = null; this.waveIndex = 0; this.actTime = -2; this.hazardIndex = 0;
    this.gateIndex = 0; this.sectorStart = { ...this.stats }; this.sectorAt = this.clock; this.sectorChain = 0;
    for (const enemy of this.enemies.getChildren() as Enemy[]) enemy.disableBody(true, true);
    this.setOceanPhase(this.stage); this.audio.phase(this.stage); this.announcePart();
    this.game.events.emit('mission:checkpoint', this.stage);
  }

  private finish(completed: boolean): void {
    if (this.ending) return;
    this.ending = true; this.completed = completed; this.player.setVelocity(0, 0); this.physics.pause(); this.clearHostile();
    if (completed) this.stats.score += this.hull * 700 + this.stats.couriers * 1000;
    this.sealSector(completed);
    const practice = this.options.practice || (this.options.checkpoint ?? 0) > 0;
    const previous = save.rigBest[this.options.difficulty][this.options.weapon];
    const record = completed && !practice && this.stats.score > previous;
    if (record) save.rigBest[this.options.difficulty][this.options.weapon] = this.stats.score;
    if (completed && !practice) save.best[this.options.difficulty] = Math.max(save.best[this.options.difficulty], this.stats.score);
    if (completed && !practice) save.clears++;
    writeSave(save); this.audio.finish(completed);
    this.time.delayedCall(completed ? 1800 : 700, () => this.game.events.emit('mission:result', {
      completed, practice, record, previous, stage: this.stage, difficulty: this.options.difficulty,
      from: this.options.checkpoint ?? 0, relayTarget: 3 - (this.options.checkpoint ?? 0),
      weapon: this.options.weapon, rank: practice ? completed ? 'CLEAR' : 'RETRY' : rankFor(this.stats.score, this.stats.damage, completed, this.stats.couriers, this.stats.absorbed), stats: { ...this.stats }, sectors: this.sectorReports.map(p => ({ ...p }))
    }));
  }

  private sealSector(passed: boolean): void {
    if (this.sectorReports.some(p => p.stage === this.stage)) return;
    const practice = this.options.practice || (this.options.checkpoint ?? 0) > 0;
    const key = `${this.options.difficulty}:${this.options.weapon}:${this.stage}:${practice ? 'practice' : 'full'}`;
    const previous = save.sectorBest[key] ?? { score: 0, clean: false };
    const damage = this.stats.damage - this.sectorStart.damage, score = this.stats.score - this.sectorStart.score;
    const report: SectorReport = { stage: this.stage, score, damage, relays: this.stats.couriers - this.sectorStart.couriers, catches: this.stats.absorbed - this.sectorStart.absorbed, chain: this.sectorChain, elapsed: this.clock - this.sectorAt, passed, best: previous.score, clean: previous.clean };
    this.sectorReports.push(report);
    if (passed) { save.sectorBest[key] = { score: Math.max(score, previous.score), clean: previous.clean || damage === 0 }; writeSave(save); }
    this.game.events.emit('mission:sector', report);
  }

  togglePause(): void {
    if (this.ending) return;
    const paused = !this.scene.isPaused();
    if (!paused && this.game.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && this.game.renderer.contextLost) return;
    if (paused) { this.audio.pause(); this.scene.pause(); }
    else { this.inputState.reset(); this.scene.resume(); this.audio.resume(); }
    this.game.events.emit('mission:paused', paused);
  }

  private emitHUD(): void {
    const boss = this.boss?.active ? { name: this.boss.kind === 'hivewhale' ? 'THE BROODKEEPER' : 'THE FURNACE WARDEN', hp: Math.max(0, this.boss.hp), max: this.boss.maxHp, enraged: this.boss.enraged, status: this.clock < this.boss.exposedUntil ? `CORE OPEN · ${(this.boss.exposedUntil - this.clock).toFixed(1)}s` : this.boss.kind === 'bulbwhale' ? `${this.linkedNodes(this.boss).length} CONDUITS · BREAK THE LINKS` : 'ARMOR · COUNTER TO PIERCE' } : null;
    const data: MissionHUD = {
      stage: this.stage, part: PARTS[this.stage].name, objective: PARTS[this.stage].subtitle,
      progress: boss ? 1 - boss.hp / boss.max : Math.min(1, Math.max(0, this.actTime) / PARTS[this.stage].duration),
      hull: this.hull, maxHull: this.maxHull, score: this.stats.score, chain: this.chain,
      multiplier: multiplierFor(this.chain), chainTime: Math.max(0, this.chainUntil - this.clock) / 4.5,
      charge: this.charge, guard: Math.max(0, this.guardReady - this.clock), guarding: this.clock < this.guardUntil,
      surge: Math.max(0, this.surgeUntil - this.clock), level: this.level, weapon: this.options.weapon, boss
    };
    this.game.events.emit('mission:hud', data);
  }

  private addLaser(y: number, delay = 0.95, width = 38): void {
    this.lasers.push({ y: Phaser.Math.Clamp(y, 130, 600), at: this.clock + delay, end: this.clock + delay + 0.38, width });
    this.audio.cue('warning');
  }

  private linkedNodes(boss: Enemy): Enemy[] {
    return (this.enemies.getChildren() as Enemy[]).filter(e => e.active && !e.dead && e.kind === 'conduit' && e.parentId === boss.spawnId);
  }

  private seedConduits(boss: Enemy): void {
    for (let i = 0; i < 3; i++) {
      const node = this.spawnEnemy('conduit', boss.x - 140, boss.y + (i - 1) * 100);
      if (node) { node.parentId = boss.spawnId; node.orbit = i * Math.PI * 2 / 3; }
    }
    boss.nodes = true; this.attackHistory.push('warden:conduits');
  }

  private updateBoss(enemy: Enemy, dt: number): void {
    enemy.age += dt;
    const final = enemy.kind === 'bulbwhale';
    enemy.openness = Phaser.Math.Linear(enemy.openness, this.clock < enemy.exposedUntil ? 1 : 0, Math.min(1, dt * 12));
    const targetX = 1020 + Math.sin(enemy.age * 0.5) * 30;
    const targetY = 355 + Math.sin(enemy.age * (final ? 0.58 : 0.5)) * (enemy.enraged ? 125 : 90);
    if (this.clock < enemy.rushUntil) enemy.setVelocity(-700, 0);
    else if (enemy.rushPreparing) enemy.setVelocity((1030 - enemy.x) * 3, (enemy.targetY - enemy.y) * 5);
    else enemy.setVelocity((targetX - enemy.x) * 2.8, (targetY - enemy.y) * 2.8);
    if (!enemy.enraged && enemy.hp < enemy.maxHp * 0.5) {
      enemy.enraged = true; this.attackHistory.push(final ? 'warden:phase2' : 'brood:phase2');
      this.message(final ? 'CORE OVERLOAD · twin vents. Break the links; find the safe water.' : 'BROOD FRENZY · faster charges. Leave the amber wake before it lunges.', 4);
      this.audio.boss(final, true); this.audio.cue('phase'); this.clearHostile();
    }
    if (final) {
      if (!enemy.nodes && this.clock >= enemy.exposedUntil) this.seedConduits(enemy);
      if (enemy.nodes && this.linkedNodes(enemy).length === 0) {
        enemy.nodes = false; enemy.exposedUntil = this.clock + 6.5;
        this.attackHistory.push('warden:core-open'); this.audio.cue('open');
        this.message(this.charge >= 100 ? 'LINKS BROKEN · core exposed. Surge now!' : 'LINKS BROKEN · core exposed. Align and fire!', 2);
      }
    }
    const cycle = enemy.attack % 3;
    if (!enemy.warned && enemy.age >= enemy.attackAt - 1.1) {
      enemy.warned = true; enemy.targetY = this.player.y;
      if (cycle === 2) {
        if (final) {
          this.addLaser(enemy.targetY, 1.1, 46);
          if (enemy.enraged) this.addLaser(enemy.targetY + (enemy.targetY > 350 ? -165 : 165), 1.1, 40);
          this.message('VENT DISCHARGE · move out of the red lanes', 1.5);
        } else {
          enemy.targetY = Phaser.Math.Clamp(enemy.targetY, 190, 520); enemy.rushPreparing = true;
          this.message('CARRIER CHARGE · leave the amber wake', 1.5); this.audio.cue('warning');
        }
      }
    }
    if (enemy.age < enemy.attackAt) return;
    enemy.attack++; enemy.attackAt = enemy.age + (enemy.enraged ? 3.4 : 4.1); enemy.warned = false;
    const aim = Phaser.Math.Angle.Between(enemy.x - 90, enemy.y, this.player.x, this.player.y);
    if (!final) {
      if (cycle === 0) {
        this.attackHistory.push('brood:volley');
        const count = enemy.enraged ? 9 : 7;
        for (let i = 0; i < count; i++) this.fireEnemy(enemy.x - 100, enemy.y, aim + (i - (count - 1) / 2) * 0.105, 245, 1.1);
      } else if (cycle === 1) {
        this.attackHistory.push('brood:release'); enemy.exposedUntil = this.clock + 3;
        this.audio.cue('open'); this.message('BROOD HATCH OPEN · strike the exposed core', 1.8);
        for (let i = 0; i < (enemy.enraged ? 4 : 3); i++) this.spawnEnemy('drone', enemy.x - 80 + i * 30, Phaser.Math.Clamp(enemy.y + (i % 2 ? 120 : -120), 140, 580), 'cross');
        for (let i = 0; i < 9; i++) this.fireEnemy(enemy.x - 100, enemy.y, Math.PI / 2 + i / 8 * Math.PI, 155);
      } else {
        this.attackHistory.push('brood:charge'); enemy.rushPreparing = false; enemy.rushUntil = this.clock + 1.05;
        enemy.exposedUntil = this.clock + 3.8;
      }
    } else if (cycle === 0) {
      this.attackHistory.push('warden:curtain');
      // A slow curtain alternates wide safe gaps; the aimed centre volley is the catch opportunity.
      for (let i = 0; i < 9; i++) if (i !== enemy.attack % 7 && i !== enemy.attack % 7 + 1) this.fireEnemy(enemy.x - 100, 145 + i * 57, Math.PI, 175);
      for (let i = -1; i <= 1; i++) this.fireEnemy(enemy.x - 100, enemy.y, aim + i * 0.12, 275);
    } else if (cycle === 1) {
      this.attackHistory.push('warden:mines');
      for (let i = 0; i < 3; i++) this.spawnEnemy('mine', enemy.x - 170 - i * 80, 200 + i * 155);
    } else this.attackHistory.push('warden:vents');
  }

  private updateEnemies(dt: number): void {
    const speedScale = DIFFICULTY[this.options.difficulty].speed;
    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (!enemy.active || enemy.dead) continue;
      if (enemy.flashUntil && this.clock > enemy.flashUntil) {
        enemy.clearTint().setTintMode(Phaser.TintModes.MULTIPLY); enemy.flashUntil = 0;
        if (!enemy.boss && !['mine', 'conduit', 'lucky'].includes(enemy.kind)) enemy.setTint(0x202935).setTintMode(Phaser.TintModes.ADD);
      }
      if (enemy.boss) { this.updateBoss(enemy, dt); continue; }
      enemy.age += dt;
      if (enemy.kind === 'conduit') {
        const parent = this.boss;
        if (!parent || parent.spawnId !== enemy.parentId) { enemy.disableBody(true, true); continue; }
        const orbit = enemy.orbit + enemy.age * (parent.enraged ? 0.85 : 0.6);
        const x = parent.x - 145 + Math.cos(orbit) * 35, y = parent.y + Math.sin(orbit) * 125;
        enemy.setVelocity((x - enemy.x) * 7, (y - enemy.y) * 7); continue;
      }
      if (enemy.kind === 'mine') {
        enemy.setAngle(enemy.age * 55);
        if (enemy.age >= 2.8) { for (let i = 0; i < 8; i++) this.fireEnemy(enemy.x, enemy.y, i / 8 * Math.PI * 2, 160); enemy.disableBody(true, true); }
        continue;
      }
      if (enemy.x < -150 || enemy.age > 17) { enemy.disableBody(true, true); continue; }
      if (enemy.kind === 'drone' || enemy.kind === 'lucky' || enemy.kind === 'stalker') {
        const cross = enemy.pattern === 'cross';
        const target = cross ? 355 + Math.sin(enemy.age * 1.35 + (enemy.baseY > 355 ? Math.PI : 0)) * 210 : enemy.baseY + Math.sin(enemy.age * 2.5) * (enemy.kind === 'lucky' ? 55 : 45);
        enemy.setVelocityY((target - enemy.y) * (enemy.kind === 'stalker' ? 4 : 3));
      }
      if (enemy.kind === 'razorfin') {
        if (enemy.age > 0.8 && !enemy.dived && enemy.x < 1150) { enemy.dived = true; enemy.targetY = this.player.y; enemy.fireAt = enemy.age + 0.7; }
        if (enemy.dived && enemy.age > enemy.fireAt) {
          const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x - 80, enemy.targetY);
          if (enemy.x > this.player.x + 100) enemy.setVelocity(Math.cos(angle) * 365 * speedScale, Math.sin(angle) * 365 * speedScale);
        }
      }
      if (enemy.kind === 'angler1') {
        if (enemy.x < 1020) enemy.setVelocityX(-55 * speedScale);
        if (enemy.age > enemy.fireAt && enemy.x < 1180 && enemy.x > this.player.x + 100) {
          const aim = Phaser.Math.Angle.Between(enemy.x - 30, enemy.y, this.player.x, this.player.y);
          for (let i = -1; i <= 1; i++) this.fireEnemy(enemy.x - 40, enemy.y, aim + i * 0.16, 215);
          enemy.fireAt = enemy.age + 2.6;
        }
      }
      if (enemy.kind === 'moonfish' && enemy.age > enemy.fireAt && enemy.x < 1170) {
        for (let i = 0; i < 3; i++) this.spawnEnemy('mine', enemy.x - 30 - i * 40, Phaser.Math.Clamp(enemy.y + (i - 1) * 90, 135, 590));
        enemy.fireAt = enemy.age + 3.4;
      }
    }
  }

  private updateProjectiles(): void {
    for (const shot of this.friendly.getChildren() as Shot[]) if (shot.active && (shot.expires < this.clock || shot.x > 1360 || shot.y < 70 || shot.y > 670)) shot.disableBody(true, true);
    for (const shot of this.hostile.getChildren() as Shot[]) {
      if (!shot.active) continue;
      if (shot.expires < this.clock || shot.x < -30 || shot.x > 1330 || shot.y < 75 || shot.y > 655) { shot.disableBody(true, true); continue; }
      shot.setAlpha(this.clock >= shot.armedAt ? 1 : 0.45);
      const distance = Phaser.Math.Distance.Between(shot.x, shot.y, this.player.x, this.player.y);
      if (this.clock < this.guardUntil && distance < 72) {
        shot.disableBody(true, true); this.guardCaught++; this.stats.absorbed++; this.charge = Math.min(100, this.charge + 6);
        if (!this.boss || this.bossCatches++ < 32) this.stats.score += 35;
        if (this.guardCaught === 1) this.audio.cue('catch');
        this.feedback.spark(shot.x, shot.y, 0x91ffed, 3);
      } else if (!shot.grazed && distance < 35 && distance > 14 && this.clock >= this.invincibleUntil && this.clock > shot.armedAt) {
        shot.grazed = true; this.stats.grazes++; this.charge = Math.min(100, this.charge + 1.2); if (!this.boss || this.bossGrazes++ < 24) this.stats.score += 20;
        if (this.clock - this.lastGraze > 0.4) { this.lastGraze = this.clock; this.feedback.text(this.player.x, this.player.y + 48, 'GRAZE +20', '#a9dbff'); }
      }
    }
    for (const drop of this.pickups.getChildren() as Pickup[]) if (drop.active) {
      if (drop.expires < this.clock || drop.x < -40) { drop.disableBody(true, true); continue; }
      drop.setAngle(Math.sin(this.clock * 4) * 7);
      if (Phaser.Math.Distance.Between(drop.x, drop.y, this.player.x, this.player.y) < 145) this.physics.moveToObject(drop, this.player, 380);
    }
  }

  private updateGates(dt: number): void {
    for (const gate of this.gates) {
      gate.x -= (this.stage === 2 ? 220 : 200) * dt;
      for (const group of [this.friendly, this.hostile]) for (const shot of group.getChildren() as Shot[]) {
        if (shot.active && Math.abs(shot.x - gate.x) < 38 && Math.abs(shot.y - gate.y) > gate.gap / 2) { shot.disableBody(true, true); this.feedback.spark(shot.x, shot.y, 0xf0cf94, 1); }
      }
      for (const enemy of this.enemies.getChildren() as Enemy[]) if (enemy.active && !enemy.boss && Math.abs(enemy.x - gate.x) < 32 + ENEMIES[enemy.kind].radius && Math.abs(enemy.y - gate.y) > gate.gap / 2 - ENEMIES[enemy.kind].radius) this.damageEnemy(enemy, 999);
      if (Math.abs(this.player.x - gate.x) < 41 && Math.abs(this.player.y - gate.y) > gate.gap / 2 - 7) {
        if (this.clock >= this.invincibleUntil && this.clock >= this.guardUntil) gate.hit = true;
        this.damagePlayer(1);
        if (this.ending) return;
      }
      if (!gate.passed && gate.x + 40 < this.player.x) {
        gate.passed = true;
        if (!gate.hit) { this.stats.score += 450; this.charge = Math.min(100, this.charge + 8); this.feedback.text(this.player.x, this.player.y - 60, 'CLEAN PASSAGE +450', '#aaffdf'); this.audio.cue('catch'); }
      }
    }
    this.gates = this.gates.filter(g => g.x > -80);
  }

  private drawGates(): void {
    for (const gate of this.gates) {
      const top = gate.y - gate.gap / 2, bottom = gate.y + gate.gap / 2, x = gate.x;
      if (x > 1270) { this.warnings.lineStyle(3, 0xa1ffdd, 0.85).lineBetween(1244, top, 1265, top).lineBetween(1265, top, 1265, bottom).lineBetween(1244, bottom, 1265, bottom); continue; }
      for (const [y, height] of [[75, top - 75], [bottom, 580 - bottom + 75]]) {
        this.warnings.fillStyle(0x0a202a, 0.98).fillRect(x - 33, y, 66, height);
        this.warnings.fillStyle(0x68523b, 0.95).fillRect(x - 29, y, 14, height);
        this.warnings.lineStyle(3, 0xbf9c64, 0.85).strokeRect(x - 32, y, 64, height);
        for (let yy = y + 12; yy < y + height - 8; yy += 32) {
          this.warnings.fillStyle(0xc49b62, 0.9).fillCircle(x + 22, yy, 3);
          this.warnings.lineStyle(3, 0x8f724b, 0.9).lineBetween(x - 8, yy, x + 10, yy + 11);
        }
      }
      this.warnings.fillStyle(0x9affe0, 0.05).fillRect(x - 38, top, 76, gate.gap);
      this.warnings.lineStyle(4, 0xa1ffdd, 0.95).lineBetween(x - 42, top, x + 40, top).lineBetween(x - 42, bottom, x + 40, bottom);
      this.warnings.lineStyle(2, 0xa1ffdd, 0.5).lineBetween(x - 48, top + 12, x - 48, top + 36).lineBetween(x - 48, bottom - 12, x - 48, bottom - 36);
    }
  }

  private drawTells(): void {
    this.core.clear(); this.warnings.clear();
    this.drawGates();
    const guarding = this.clock < this.guardUntil;
    const surge = this.clock < this.surgeUntil;
    this.core.lineStyle(guarding ? 3 : 1.5, guarding ? 0x9affdf : surge ? 0xffdf98 : 0xa0f7ff, guarding ? 0.9 : 0.4);
    if (guarding) {
      this.core.strokeCircle(this.player.x, this.player.y, 65);
      this.core.lineStyle(6, 0x8affdf, 0.12).strokeCircle(this.player.x, this.player.y, 69);
    }
    const screenScale = this.cameras.main.zoom * this.scale.displaySize.width / this.scale.width;
    const coreRadius = Math.max(3.2, 2.5 / screenScale);
    this.core.fillStyle(0x041e2b, 0.9).fillCircle(this.player.x, this.player.y, coreRadius + 2);
    this.core.fillStyle(surge ? 0xffdd8d : 0xc4ffff).fillCircle(this.player.x, this.player.y, coreRadius);
    if (this.inputState.focus) this.core.strokeCircle(this.player.x, this.player.y, 9);
    for (const laser of this.lasers) {
      const live = this.clock >= laser.at;
      this.warnings.fillStyle(live ? 0xffe6cc : 0xef7276, live ? 0.92 : 0.13 + Math.sin(this.clock * 18) * 0.04).fillRect(0, laser.y - laser.width / 2, 1280, laser.width);
      this.warnings.lineStyle(live ? 4 : 1, live ? 0xff9294 : 0xffb1a1, 0.9);
      this.warnings.lineBetween(0, laser.y - laser.width / 2, 1280, laser.y - laser.width / 2);
      this.warnings.lineBetween(0, laser.y + laser.width / 2, 1280, laser.y + laser.width / 2);
      if (!live) for (let x = 15; x < 1280; x += 60) this.warnings.lineBetween(x, laser.y - 6, x + 12, laser.y + 6);
    }
    for (const enemy of this.enemies.getChildren() as Enemy[]) if (enemy.active) {
      if (enemy.boss) {
        const open = this.clock < enemy.exposedUntil, x = enemy.x - 35, y = enemy.y, spread = enemy.openness * 32;
        // Visible mechanical shutters open away from a bright heart. Amber impact
        // arcs communicate resisted fire without blanking the creature's texture.
        this.warnings.fillStyle(open ? 0x9bffe4 : 0x061c2a, open ? 0.22 : 0.65).fillCircle(x, y, 40 + enemy.openness * 12);
        this.warnings.lineStyle(open ? 4 : 2, open ? 0xbaffed : 0xb69967, 0.9).strokeCircle(x, y, 37 + enemy.openness * 10);
        this.warnings.fillStyle(0x725b3d, 0.95).fillRoundedRect(x - 31 - spread, y - 28, 29, 56, 5).fillRoundedRect(x + 2 + spread, y - 28, 29, 56, 5);
        this.warnings.lineStyle(2, 0xe0bf81, 0.9).lineBetween(x - 14 - spread, y - 20, x - 14 - spread, y + 20).lineBetween(x + 16 + spread, y - 20, x + 16 + spread, y + 20);
        if (enemy.openness > 0.05) {
          this.warnings.fillStyle(0xbaffed, enemy.openness * 0.9).fillCircle(x, y, 14 + Math.sin(this.clock * 10) * 2);
          this.warnings.lineStyle(2, 0xa5ffe4, enemy.openness * 0.6).strokeCircle(x, y, 58 + Math.sin(this.clock * 5) * 4);
        }
        if (enemy.armoredFlash && enemy.flashUntil > this.clock) this.warnings.lineStyle(5, 0xffd18c, 0.85).strokeCircle(x - 25, y, 46);
        if (enemy.rushPreparing) {
          this.warnings.fillStyle(0xffc173, 0.12).fillRect(0, enemy.targetY - 98, enemy.x, 196);
          this.warnings.lineStyle(2, 0xffcc87, 0.8).lineBetween(0, enemy.targetY - 98, enemy.x, enemy.targetY - 98).lineBetween(0, enemy.targetY + 98, enemy.x, enemy.targetY + 98);
        }
        for (const node of this.linkedNodes(enemy)) this.warnings.lineStyle(2, 0x9bffe0, 0.35).lineBetween(enemy.x - 25, enemy.y, node.x, node.y);
      } else if (enemy.kind === 'mine') {
        this.warnings.lineStyle(2, 0xe5a5ff, 0.7).strokeCircle(enemy.x, enemy.y, 27 - enemy.age / 2.8 * 11);
      } else if (enemy.kind === 'conduit') {
        this.warnings.lineStyle(2, 0xa0ffe4, 0.6).strokeCircle(enemy.x, enemy.y, 29);
      } else if (enemy.kind === 'razorfin' && enemy.dived && enemy.age < enemy.fireAt && enemy.x > 600) {
        this.warnings.lineStyle(1.5, 0xffa697, 0.6).lineBetween(enemy.x - 30, enemy.y, this.player.x - 80, enemy.targetY);
      } else if (enemy.kind === 'angler1' && enemy.fireAt - enemy.age < 0.7 && enemy.x < 1180) {
        this.warnings.lineStyle(2, 0xffd38d, 0.8).strokeCircle(enemy.x - 35, enemy.y, 18);
      } else if (enemy.kind === 'moonfish') {
        this.warnings.lineStyle(1.5, 0xefbdff, 0.65).strokeCircle(enemy.x, enemy.y, 36 + (enemy.age % 1) * 8);
      } else if (enemy.kind === 'lucky') {
        this.warnings.lineStyle(2, 0xffe0a0, 0.8).strokeCircle(enemy.x, enemy.y, 40);
      }
    }
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 100) / 1000;
    this.updateOcean(dt, this.boss ? 0.4 : 1 + this.stage * 0.25); this.feedback.update(dt);
    if (this.ending) return;
    this.clock += dt; this.actTime += dt; this.stats.elapsed += dt;
    this.inputState.read();
    const speed = this.inputState.focus ? 175 : 365;
    this.player.setVelocity(this.inputState.x * speed, this.inputState.y * speed);
    this.player.setAngle(Phaser.Math.Linear(this.player.angle, this.inputState.y * -9, Math.min(1, dt * 14)));
    this.player.setAlpha(this.clock < this.invincibleUntil ? 0.45 + Math.sin(this.clock * 30) * 0.25 : 1);
    this.light.setPosition(this.player.x + 15, this.player.y - 30);
    if (this.inputState.guard) { this.activateGuard(); this.inputState.guard = false; }
    if (this.inputState.surge) { this.activateSurge(); this.inputState.surge = false; }
    if (this.ending) return;
    if (!this.guardReleased && this.clock >= this.guardUntil) {
      this.guardReleased = true;
      this.playerShot(0, 12 + Math.min(8, this.guardCaught) * 5, 0, true);
      this.feedback.text(this.player.x + 50, this.player.y - 48, this.guardCaught ? `RETURN FIRE ×${this.guardCaught}` : 'COUNTERSHOT', '#9affdf');
      this.audio.cue('counter');
    }
    if (this.inputState.fire && this.clock >= this.fireReady) this.fireWeapon();
    if (this.chain && this.clock > this.chainUntil && !this.boss && this.nextStage === null) this.chain = 0;

    if (this.nextStage !== null) { if (this.clock >= this.transitionAt) this.advancePart(); }
    else {
      const waves = WAVES[this.stage];
      while (this.waveIndex < waves.length && this.actTime >= waves[this.waveIndex].at) this.spawnWave(waves[this.waveIndex++]);
      if (this.actTime >= PARTS[this.stage].duration && !this.boss) {
        if (this.stage === 0) this.prepareTransition(1);
        else {
          for (const enemy of this.enemies.getChildren() as Enemy[]) if (enemy.active) enemy.disableBody(true, true);
          this.clearHostile(); this.gates = []; this.spawnEnemy(this.stage === 1 ? 'hivewhale' : 'bulbwhale', 1350, 355);
        }
      }
      const gateTimes = this.stage === 0 ? [30] : this.stage === 1 ? [12] : [10, 27];
      if (!this.boss && this.gateIndex < gateTimes.length && this.actTime > gateTimes[this.gateIndex]) {
        const gapY = this.stage === 0 ? 350 : this.stage === 1 ? 320 : [440, 250][this.gateIndex];
        this.gates.push({ x: 1500, y: gapY, gap: this.stage === 2 ? 220 : 250, hit: false, passed: false }); this.gateIndex++;
        this.message('PRESSURE GATE · fly through the mint opening. Guard can absorb a scrape.', 3.5); this.audio.cue('warning');
      }
      if (this.stage === 2 && !this.boss && this.hazardIndex < 2 && this.actTime > [13, 29][this.hazardIndex]) {
        this.hazardIndex++; this.addLaser(this.player.y, 1.2, 42); this.message('Thermal vent · leave the marked lane', 2);
      }
    }
    this.updateEnemies(dt); this.updateProjectiles(); this.updateGates(dt);
    this.lasers = this.lasers.filter(laser => {
      if (this.clock > laser.end) return false;
      if (this.clock >= laser.at && Math.abs(this.player.y - laser.y) < laser.width / 2 + 7) this.damagePlayer(1);
      return true;
    });
    this.drawTells();
    if (this.clock >= this.nextHUD) { this.nextHUD = this.clock + 0.08; this.emitHUD(); }
  }
}
