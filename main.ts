// Duskhold: Lightkeeper — entry program for best-game-01.
// Node 22 standard library only. Copies game/ and screenshots/ from this
// repository into /output (or $MAKEFUN_OUTPUT_DIR) and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Deterministic: two runs write the same bytes.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function copyTree(name: string): void {
  const src = join(repoRoot, name);
  if (!existsSync(src)) throw new Error('missing ' + name + ' in repository');
  cpSync(src, join(outDir, name), { recursive: true });
}

mkdirSync(outDir, { recursive: true });
for (const entry of readdirSync(outDir)) rmSync(join(outDir, entry), { recursive: true, force: true });
copyTree('game');
copyTree('screenshots');
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('wrote ' + outDir + '/dossier.json (' + dossier.length + ' bytes)');
