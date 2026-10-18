import type { Difficulty, Weapon } from './mission';
export interface Settings { difficulty: Difficulty; weapon: Weapon; autoFire: boolean; muted: boolean; volume: number; musicVolume: number; effectsVolume: number; reducedMotion: boolean; effects: boolean; quality: 'auto' | 'performance' | 'balanced' | 'high' }
const KEY = 'knotz-brigade-v1';
export interface Save { settings: Settings; best: Record<Difficulty, number>; rigBest: Record<Difficulty, Record<Weapon, number>>; sectorBest: Record<string, { score: number; clean: boolean }>; clears: number }
const defaults = (): Save => ({ settings: { difficulty: 'pilot', weapon: 'lance', autoFire: true, muted: false, volume: 0.55, musicVolume: 0.72, effectsVolume: 0.85, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches, effects: true, quality: 'auto' }, best: { cadet: 0, pilot: 0, ace: 0 }, rigBest: { cadet: { lance: 0, fan: 0 }, pilot: { lance: 0, fan: 0 }, ace: { lance: 0, fan: 0 } }, sectorBest: {}, clears: 0 });
export function readSave(): Save {
  const base = defaults();
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!data || typeof data !== 'object') return base;
    const s = data.settings ?? {};
    for (const key of ['autoFire', 'muted', 'reducedMotion', 'effects'] as const) if (typeof s[key] === 'boolean') base.settings[key] = s[key];
    if (['cadet', 'pilot', 'ace'].includes(s.difficulty)) base.settings.difficulty = s.difficulty;
    if (['lance', 'fan'].includes(s.weapon)) base.settings.weapon = s.weapon;
    if (['auto', 'performance', 'balanced', 'high'].includes(s.quality)) base.settings.quality = s.quality;
    for (const key of ['volume', 'musicVolume', 'effectsVolume'] as const) if (Number.isFinite(s[key])) base.settings[key] = Math.max(0, Math.min(1, s[key]));
    for (const key of ['cadet', 'pilot', 'ace'] as const) if (Number.isFinite(data.best?.[key])) base.best[key] = Math.max(0, data.best[key]);
    for (const d of ['cadet', 'pilot', 'ace'] as const) for (const w of ['lance', 'fan'] as const) if (Number.isFinite(data.rigBest?.[d]?.[w])) base.rigBest[d][w] = Math.max(0, data.rigBest[d][w]);
    if (data.sectorBest && typeof data.sectorBest === 'object') for (const [key, value] of Object.entries(data.sectorBest)) {
      const record = value as { score?: unknown; clean?: unknown };
      if (/^(cadet|pilot|ace):(lance|fan):[012]:(full|practice)$/.test(key) && record && typeof record.score === 'number' && Number.isFinite(record.score)) base.sectorBest[key] = { score: Math.max(0, record.score), clean: record.clean === true };
    }
    if (Number.isFinite(data.clears)) base.clears = Math.max(0, data.clears);
  } catch { /* Corrupt/denied storage never prevents play. */ }
  return base;
}
export function writeSave(save: Save): void { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* Continue without persistence. */ } }
export const save = readSave();
