// Renders art/icons.json (the icon source of truth) to PNGs. No dependencies.
//
//   node scripts/render-icons.mjs [outDir]      (default: art/export)
//
// Writes, per icon (file names are the icon name in lower case):
//   skills/<name>.png, <name>@2x.png, <name>@3x.png     16/32/48 px, transparent
//   tabs/<name>.png (+@2x, @3x)                          full color (active tab)
//   tabs/<name>-inactive.png (+@2x, @3x)                 cream/gold (inactive tab)
//   preview/<name>.png                                   64 px on the app tile, for docs
//   sheet.png                                            every icon at 4x on the app tile
// Pixels are scaled by whole numbers only, never smoothed. Rules: vault note "Art bible".
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(root, 'art', 'export');
const src = JSON.parse(readFileSync(join(root, 'art', 'icons.json'), 'utf8'));
const TILE = '#3b2e18';
const PAGE = '#1e170c';

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ── PNG encoding ─────────────────────────────────────────────────────────────
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing ──────────────────────────────────────────────────────────────────
function canvas(w, h, bg) {
  const buf = Buffer.alloc(w * h * 4);
  if (bg) { const [r, g, b] = hex(bg); for (let i = 0; i < w * h; i++) buf.set([r, g, b, 255], i * 4); }
  return { w, h, buf };
}
function blit(cv, rows, colorOf, x0, y0, scale) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = colorOf(ch);
    if (!col) return;
    const [r, g, b] = hex(col);
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const px = x0 + x * scale + dx, py = y0 + y * scale + dy;
      cv.buf.set([r, g, b, 255], (py * cv.w + px) * 4);
    }
  }));
}
const full = ch => src.palette[ch] || null;
const mono = ch => {
  if (!src.palette[ch]) return null;
  if (ch === src.tones.outline) return src.tabMono.outline;
  if (src.tones.light.includes(ch)) return src.tabMono.light;
  if (src.tones.mid.includes(ch)) return src.tabMono.mid;
  return src.tabMono.dark;
};
const save = (path, cv) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, png(cv.w, cv.h, cv.buf)); };
const slug = name => name.toLowerCase();

function writeScaled(dir, base, rows, colorOf) {
  for (const [s, suffix] of [[1, ''], [2, '@2x'], [3, '@3x']]) {
    const cv = canvas(16 * s, 16 * s);
    blit(cv, rows, colorOf, 0, 0, s);
    save(join(outDir, dir, base + suffix + '.png'), cv);
  }
  const pv = canvas(80, 80, TILE);
  blit(pv, rows, colorOf, 8, 8, 4);
  save(join(outDir, 'preview', base + '.png'), pv);
}

let count = 0;
for (const [name, rows] of Object.entries(src.skills)) { writeScaled('skills', slug(name), rows, full); count++; }
for (const [name, rows] of Object.entries(src.tabs)) {
  writeScaled('tabs', slug(name), rows, full);
  writeScaled('tabs', slug(name) + '-inactive', rows, mono);
  count++;
}

// Contact sheet: skills in app order (3 per row in the app; 6 per row here), then tabs.
const all = [...Object.values(src.skills), ...Object.values(src.tabs)];
const cols = 6, cell = 80, gap = 8;
const rowsN = Math.ceil(all.length / cols);
const sheet = canvas(cols * (cell + gap) + gap, rowsN * (cell + gap) + gap, PAGE);
all.forEach((rows, i) => {
  const cx = gap + (i % cols) * (cell + gap), cy = gap + Math.floor(i / cols) * (cell + gap);
  const [r, g, b] = hex(TILE);
  for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) sheet.buf.set([r, g, b, 255], ((cy + y) * sheet.w + cx + x) * 4);
  blit(sheet, rows, full, cx + 8, cy + 8, 4);
});
save(join(outDir, 'sheet.png'), sheet);
console.log(`Rendered ${count} icons to ${outDir}`);
