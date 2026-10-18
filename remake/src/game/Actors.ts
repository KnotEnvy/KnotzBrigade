import Phaser from 'phaser';
import type { EnemyKind, Wave } from '../core/mission';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  kind: EnemyKind = 'drone';
  hp = 1; maxHp = 1; age = 0; baseY = 0; fireAt = 0; flashUntil = 0;
  dead = false; boss = false; enraged = false; spawnId = 0;
  pattern: Wave['pattern'] = 'sine';
  attack = 0; attackAt = 0; targetY = 350; warned = false; dived = false;
  exposedUntil = 0; rushUntil = 0; rushPreparing = false; nodes = false;
  parentId = 0; orbit = 0; rewarded = true;
  openness = 0; armoredFlash = false;
}
export class Shot extends Phaser.Physics.Arcade.Image {
  damage = 1; expires = 0; armedAt = 0; grazed = false;
  pierce = 1; counted = false; hits = new Set<number>();
}
export class Pickup extends Phaser.Physics.Arcade.Image {
  kind: 'power' | 'repair' | 'data' | 'charge' = 'charge';
  expires = 0;
}
