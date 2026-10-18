import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const installed = require('phaser/package.json').version;
const project = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
if (installed !== '4.2.1' || project.dependencies.phaser !== installed) {
  throw new Error(`Expected an exact Phaser 4.2.1 pin; found ${installed}. Review version-specific APIs before upgrading.`);
}
const removed = /\.(?:preFX|postFX)\b|\.setPipeline\s*\(|\.setTintFill\s*\(|\bBitmapMask\b/;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await inspect(path);
    else if (entry.name.endsWith('.ts') && removed.test(await readFile(path, 'utf8'))) {
      throw new Error(`Removed Phaser 3 rendering API in ${path.pathname}`);
    }
  }
}
await inspect(new URL('../src/', import.meta.url));
console.log(`Phaser ${installed} verified; no removed v3 rendering APIs in src/.`);
