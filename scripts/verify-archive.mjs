import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../archives/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('legacy-canvas.manifest.json', root), 'utf8'));
for (const entry of manifest.files) {
  const bytes = await readFile(new URL(`legacy-canvas/${entry.path}`, root));
  if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
    throw new Error(`Archive differs from its original working-tree snapshot: ${entry.path}`);
  }
}
console.log(`Verified all ${manifest.files.length} original files against their SHA-256 snapshot.`);
