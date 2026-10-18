export type Difficulty = 'cadet' | 'pilot' | 'ace';
export type Weapon = 'lance' | 'fan';
export type EnemyKind = 'drone' | 'razorfin' | 'angler1' | 'stalker' | 'moonfish' | 'lucky' | 'mine' | 'conduit' | 'hivewhale' | 'bulbwhale';
export type Stage = 0 | 1 | 2;
export interface RunOptions { difficulty: Difficulty; weapon: Weapon; checkpoint?: Stage; practice?: boolean }
export interface SectorReport { stage: Stage; score: number; damage: number; relays: number; catches: number; chain: number; elapsed: number; passed: boolean; best: number; clean: boolean }
export const DIFFICULTY = {
  cadet: { hull: 8, speed: 0.8, health: 0.8, score: 0.8, label: 'Cadet' },
  pilot: { hull: 6, speed: 1, health: 1, score: 1, label: 'Pilot' },
  ace: { hull: 5, speed: 1.2, health: 1.15, score: 1.35, label: 'Ace' }
} as const;
export const PARTS = [
  { name: 'THE BREAKWATER', subtitle: 'Reach the foundry gates', signal: 'Harbor to Brigade: the foundry is waking. Follow the relay signal.', color: 0x77c6cc, duration: 43 },
  { name: 'THE BROOD CONVOY', subtitle: 'Break the blockade', signal: 'A carrier is feeding the swarm. Catch its fire. Send it back.', color: 0xebad69, duration: 32 },
  { name: 'HEART OF THE WORKS', subtitle: 'Silence the furnace', signal: 'The heart is exposed. One last push. Bring everyone home.', color: 0xc7a0ee, duration: 43 }
] as const;
export interface Wave { at: number; kind: EnemyKind; count: number; y: number; step?: number; pattern?: 'sine' | 'dive' | 'aim' | 'cross'; label?: string }
export const WAVES: readonly Wave[][] = [
  [
    { at: 2, kind: 'drone', count: 4, y: 280, step: 40, pattern: 'sine', label: 'First contact · steer into the formation. Keep your core safe.' },
    { at: 7, kind: 'drone', count: 5, y: 470, step: -35, pattern: 'sine' },
    { at: 12, kind: 'angler1', count: 1, y: 230, pattern: 'aim', label: 'Catch amber shots · X for Tideguard' },
    { at: 15, kind: 'drone', count: 4, y: 520, step: -40 },
    { at: 20, kind: 'lucky', count: 1, y: 340, label: 'Destroy the courier, then collect its relay and upgrade.' },
    { at: 23, kind: 'razorfin', count: 3, y: 180, step: 170, pattern: 'dive' },
    { at: 29, kind: 'angler1', count: 2, y: 180, step: 350, pattern: 'aim' },
    { at: 33, kind: 'drone', count: 6, y: 190, step: 65, pattern: 'cross' },
    { at: 38, kind: 'stalker', count: 3, y: 250, step: 110, pattern: 'cross' }
  ],
  [
    { at: 2, kind: 'drone', count: 6, y: 180, step: 80, pattern: 'cross', label: 'Escort crossing · cut through the gaps.' },
    { at: 6, kind: 'angler1', count: 2, y: 200, step: 290, pattern: 'aim' },
    { at: 11, kind: 'moonfish', count: 1, y: 350, label: 'Mine layer · shoot the violet pearls before they bloom.' },
    { at: 12.5, kind: 'drone', count: 4, y: 170, step: 130, pattern: 'cross', label: 'Mine corridor · clear the pearls or thread the crossing escort.' },
    { at: 16, kind: 'razorfin', count: 2, y: 180, step: 360, pattern: 'dive' },
    { at: 19, kind: 'lucky', count: 1, y: 490 },
    { at: 22, kind: 'drone', count: 6, y: 200, step: 60, pattern: 'sine' },
    { at: 26, kind: 'moonfish', count: 2, y: 190, step: 340 }
  ],
  [
    { at: 2, kind: 'razorfin', count: 4, y: 160, step: 125, pattern: 'dive' },
    { at: 7, kind: 'moonfish', count: 2, y: 220, step: 270 },
    { at: 12, kind: 'stalker', count: 3, y: 180, step: 170, pattern: 'cross' },
    { at: 17, kind: 'angler1', count: 2, y: 200, step: 300, pattern: 'aim' },
    { at: 20, kind: 'moonfish', count: 1, y: 195, label: 'Upper mine lane · clear a path if you want the courier relay.' },
    { at: 21, kind: 'lucky', count: 1, y: 200, label: 'Optional upper relay · clear the pearls, then retrieve the data.' },
    { at: 25, kind: 'razorfin', count: 3, y: 160, step: 190, pattern: 'dive' },
    { at: 30, kind: 'moonfish', count: 1, y: 350 },
    { at: 32, kind: 'drone', count: 8, y: 150, step: 60, pattern: 'sine' },
    { at: 38, kind: 'stalker', count: 3, y: 220, step: 140, pattern: 'cross' }
  ]
];
export const ENEMIES = {
  drone: { health: 3, scale: 0.48, speed: 205, points: 100, radius: 19 },
  razorfin: { health: 7, scale: 0.46, speed: 145, points: 220, radius: 30 },
  angler1: { health: 12, scale: 0.48, speed: 110, points: 300, radius: 34 },
  stalker: { health: 6, scale: 0.44, speed: 280, points: 180, radius: 28 },
  moonfish: { health: 15, scale: 0.43, speed: 90, points: 360, radius: 35 },
  lucky: { health: 8, scale: 0.72, speed: 125, points: 600, radius: 25 },
  mine: { health: 2, scale: 1, speed: 75, points: 70, radius: 13 },
  conduit: { health: 16, scale: 1, speed: 0, points: 120, radius: 19 },
  hivewhale: { health: 430, scale: 0.9, speed: 0, points: 4500, radius: 88 },
  bulbwhale: { health: 850, scale: 1.12, speed: 0, points: 9000, radius: 98 }
} as const;
export interface RunStats { score: number; kills: number; fired: number; hit: number; absorbed: number; grazes: number; damage: number; maxChain: number; couriers: number; guards: number; surges: number; elapsed: number }
export const freshStats = (): RunStats => ({ score: 0, kills: 0, fired: 0, hit: 0, absorbed: 0, grazes: 0, damage: 0, maxChain: 0, couriers: 0, guards: 0, surges: 0, elapsed: 0 });
export const multiplierFor = (chain: number): number => Math.min(5, 1 + Math.floor(chain / 8));
export function rankFor(score: number, damage: number, completed: boolean, couriers = 0, absorbed = 0): string {
  if (!completed) return 'RETRY';
  if (damage === 0 && score >= 65000 && couriers === 3 && absorbed >= 12) return 'S+';
  if (score >= 50000 && couriers >= 2) return 'S';
  if (score >= 34000) return 'A';
  if (score >= 21000) return 'B';
  return 'C';
}
