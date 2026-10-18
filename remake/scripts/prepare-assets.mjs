import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { PNG } from 'pngjs';
const archive = new URL('../../archives/legacy-canvas/', import.meta.url);
const output = new URL('../public/assets/legacy/', import.meta.url);
await mkdir(output, { recursive: true });
for (const name of ['layer1', 'layer2', 'layer3', 'layer4', 'projectile', 'gears']) await copyFile(new URL(`images/${name}.png`, archive), new URL(`${name}.png`, output));
for (const name of ['powerup.wav', 'explosion.wav', 'shot.wav', 'hit.wav', 'shield.wav']) await copyFile(new URL(`sounds/${name}`, archive), new URL(name, output));
for (const name of ['boss_v2.mp3', 'powerdown.wav']) await rm(new URL(name, output), { force: true });
// Pixel-preserving conversion, with extruded gutters. Enemies use their first verified row.
const sheets = [
  ['player', 120, 190, 78, 39, 12], ['drone', 115, 95, 38, 39],
  ['razorfin', 187, 149, 38, 39], ['angler1', 228, 169, 38, 39],
  ['angler2', 213, 165, 38, 39], ['stalker', 243, 123, 38, 39],
  ['hivewhale', 400, 227, 38, 39], ['bulbwhale', 270, 219, 38, 39],
  ['moonfish', 227, 240, 38, 39], ['lucky', 99, 95, 38, 39],
  ['fireExplosion', 200, 200, 8, 8]
];
for (const [name, width, height, count, sourceColumns, requestedColumns] of sheets) {
  const input = PNG.sync.read(await readFile(new URL(`images/${name}.png`, archive)));
  if (input.width < width * sourceColumns || input.height < Math.ceil(count / sourceColumns) * height) throw new Error(`${name}: source dimensions changed.`);
  const columns = requestedColumns ?? Math.min(count, Math.floor(2048 / (width + 4)));
  const atlas = new PNG({ width: columns * (width + 4), height: Math.ceil(count / columns) * (height + 4) });
  if (atlas.width > 2048 || atlas.height > 2048) throw new Error(`${name}: texture budget exceeded.`);
  const frames = {};
  for (let index = 0; index < count; index++) {
    const sx = index % sourceColumns * width, sy = Math.floor(index / sourceColumns) * height;
    const dx = index % columns * (width + 4) + 2, dy = Math.floor(index / columns) * (height + 4) + 2;
    for (let y = -2; y < height + 2; y++) for (let x = -2; x < width + 2; x++) {
      const from = ((sy + Math.max(0, Math.min(height - 1, y))) * input.width + sx + Math.max(0, Math.min(width - 1, x))) * 4;
      const to = ((dy + y) * atlas.width + dx + x) * 4;
      input.data.copy(atlas.data, to, from, from + 4);
    }
    frames[`${name}-${index}`] = { frame: { x: dx, y: dy, w: width, h: height }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: width, h: height }, sourceSize: { w: width, h: height } };
  }
  await writeFile(new URL(`${name}-atlas.png`, output), PNG.sync.write(atlas));
  await writeFile(new URL(`${name}-atlas.json`, output), JSON.stringify({ frames, meta: { image: `${name}-atlas.png`, format: 'RGBA8888', size: { w: atlas.width, h: atlas.height }, scale: '1' } }));
}
console.log('Prepared 11 bounded atlases, 6 images and 5 legacy effects; archive unchanged.');
await import('./compose-score.mjs');
