#!/usr/bin/env node
/**
 * Generates game art through the Codex CLI's built-in image generation, on the
 * owner's ChatGPT subscription (vault: "HabitScape - Art bible (illustrated)" §9).
 *
 *   node scripts/generate-art.mjs art/game/specs/anchors.json [assetId ...]
 *
 * For each asset in the spec it makes a fresh work folder with the reference images,
 * asks Codex to generate one image and save it, copies the result to the asset's
 * `out` path (keeping any previous version as `<name>.prev.png`), and appends an
 * entry to art/game/prompts.json. Windows only (the CLI ships inside the Codex app).
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const repo = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const [specPath, ...only] = process.argv.slice(2);
if (!specPath) {
  console.error('Usage: node scripts/generate-art.mjs <spec.json> [assetId ...]');
  process.exit(1);
}

/** The newest codex.exe the Codex app has unpacked (its folder name changes on updates). */
function findCodex() {
  const binRoot = join(process.env.LOCALAPPDATA ?? '', 'OpenAI', 'Codex', 'bin');
  const found = existsSync(binRoot)
    ? readdirSync(binRoot).map((d) => join(binRoot, d, 'codex.exe')).filter(existsSync)
    : [];
  if (!found.length) throw new Error('Codex CLI not found: open the Codex app once so it unpacks its tools.');
  return found.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
}

const spec = JSON.parse(readFileSync(resolve(repo, specPath), 'utf8'));
const codex = findCodex();
const logPath = join(repo, 'art', 'game', 'prompts.json');
/** Re-read before each append so two runs in parallel don't drop each other's entries. */
const readLog = () => (existsSync(logPath) ? JSON.parse(readFileSync(logPath, 'utf8')) : []);

for (const asset of spec.assets) {
  if (only.length && !only.includes(asset.id)) continue;
  const work = join(tmpdir(), `habitscape-art-${asset.id}-${Date.now()}`);
  mkdirSync(work, { recursive: true });
  const refNames = (asset.refs ?? []).map((r, i) => {
    const name = `reference-${i + 1}.png`;
    copyFileSync(join(repo, r), join(work, name));
    return name;
  });
  const imagePrompt = `${spec.masterStyle}\n${asset.prompt}\nImage size: ${asset.size}.`;
  const instruction = [
    'Use your built-in image generation tool to create ONE image, then save the final PNG file as output.png in the current working directory.',
    asset.transparent ? 'The background must be transparent (alpha), not white or checkered.' : 'The image has an opaque background.',
    `Make the saved file exactly ${asset.size} pixels.`,
    'Do not write any other files and do not modify the reference images.',
    refNames.length ? `Style references in this folder: ${refNames.join(', ')}. Match their art style only; do not copy their content, layout or any text.` : '',
    '',
    'Image prompt:',
    imagePrompt,
  ].join('\n');

  console.log(`\n=== ${asset.id}: generating...`);
  const started = Date.now();
  const res = spawnSync(codex, ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-C', work, instruction], {
    cwd: work, encoding: 'utf8', timeout: 15 * 60 * 1000, windowsHide: true,
  });
  const produced = join(work, 'output.png');
  if (res.status !== 0 || !existsSync(produced)) {
    console.error(`${asset.id}: failed (exit ${res.status}).`, (res.stderr || res.stdout || '').slice(-800));
    continue;
  }
  const out = join(repo, asset.out);
  mkdirSync(dirname(out), { recursive: true });
  if (existsSync(out)) renameSync(out, out.replace(/\.png$/, '.prev.png'));
  copyFileSync(produced, out);
  const log = readLog();
  log.push({
    id: asset.id, file: asset.out, generatedAt: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000),
    tool: `codex-cli ${spawnSync(codex, ['--version'], { encoding: 'utf8' }).stdout.trim()} (built-in image generation)`,
    refs: asset.refs ?? [], prompt: imagePrompt, approved: false,
  });
  writeFileSync(logPath, JSON.stringify(log, null, 2) + '\n');
  rmSync(work, { recursive: true, force: true });
  console.log(`${asset.id}: saved ${asset.out} (${basename(out)})`);
}
