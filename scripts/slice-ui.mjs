#!/usr/bin/env node
/**
 * Cuts the generated UI frame textures (art/game/ui/*.png) into nine stretchable pieces
 * for the app's NineSlice component (vault PROD-024), and writes src/game-ui/frames.ts.
 *
 *   node scripts/slice-ui.mjs
 *
 * Config: art/game/specs/ui-slices.json. Per frame: `src`, `crop` (optional
 * [x, y, w, h] in source pixels; default = the opaque bounding box), `insetPx` (border
 * thickness in the cropped source, {top,right,bottom,left}) and `insetDp` (how thick the
 * border draws in the app). Pieces are saved at 3 px per dp so they stay sharp on
 * high-density screens.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { PNG } from 'pngjs';

const repo = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const cfg = JSON.parse(readFileSync(join(repo, 'art/game/specs/ui-slices.json'), 'utf8'));
const PX_PER_DP = 3;
const EDGE_LEN = 24; // stretched direction of edge pieces and the centre, in output px

function load(path) { return PNG.sync.read(readFileSync(path)); }

function opaqueBox(img) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    if (img.data[(y * img.width + x) * 4 + 3] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

/** Area-average resample of the source rect [sx, sy, sw, sh] to w × h (premultiplied alpha). */
function resample(img, sx, sy, sw, sh, w, h) {
  const out = new PNG({ width: w, height: h });
  for (let oy = 0; oy < h; oy++) for (let ox = 0; ox < w; ox++) {
    const fx0 = sx + (ox * sw) / w, fx1 = sx + ((ox + 1) * sw) / w;
    const fy0 = sy + (oy * sh) / h, fy1 = sy + ((oy + 1) * sh) / h;
    let r = 0, g = 0, b = 0, a = 0, wsum = 0;
    for (let y = Math.floor(fy0); y < Math.ceil(fy1); y++) {
      const wy = Math.min(y + 1, fy1) - Math.max(y, fy0);
      if (wy <= 0) continue;
      for (let x = Math.floor(fx0); x < Math.ceil(fx1); x++) {
        const wx = Math.min(x + 1, fx1) - Math.max(x, fx0);
        if (wx <= 0) continue;
        const i = (y * img.width + x) * 4, wt = wx * wy, al = img.data[i + 3] / 255;
        r += img.data[i] * al * wt; g += img.data[i + 1] * al * wt; b += img.data[i + 2] * al * wt; a += al * wt; wsum += wt;
      }
    }
    const o = (oy * w + ox) * 4;
    out.data[o] = a ? Math.round(r / a) : 0; out.data[o + 1] = a ? Math.round(g / a) : 0; out.data[o + 2] = a ? Math.round(b / a) : 0;
    out.data[o + 3] = wsum ? Math.round((a / wsum) * 255) : 0;
  }
  return out;
}

const outRoot = join(repo, 'assets', 'game-ui');
// Overwrite in place (deleting the folder first races a running Metro bundler).
mkdirSync(outRoot, { recursive: true });
const entries = [];
for (const [name, f] of Object.entries(cfg.frames)) {
  const img = load(join(repo, f.src));
  const [cx, cy, cw, ch] = f.crop ?? opaqueBox(img);
  const ip = f.insetPx, id = f.insetDp;
  const xs = [cx, cx + ip.left, cx + cw - ip.right, cx + cw];
  const ys = [cy, cy + ip.top, cy + ch - ip.bottom, cy + ch];
  const outW = [id.left * PX_PER_DP, EDGE_LEN, id.right * PX_PER_DP];
  const outH = [id.top * PX_PER_DP, EDGE_LEN, id.bottom * PX_PER_DP];
  const names = [['tl', 't', 'tr'], ['l', 'c', 'r'], ['bl', 'b', 'br']];
  const dir = join(outRoot, name);
  mkdirSync(dir, { recursive: true });
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const piece = resample(img, xs[c], ys[r], xs[c + 1] - xs[c], ys[r + 1] - ys[r], Math.max(1, outW[c]), Math.max(1, outH[r]));
    writeFileSync(join(dir, `${names[r][c]}.png`), PNG.sync.write(piece));
  }
  entries.push({ name, id });
  console.log(`${name}: crop ${cx},${cy} ${cw}x${ch}, inset px ${JSON.stringify(ip)} -> dp ${JSON.stringify(id)}`);
}

// Plain images the kit shows whole (region scenes), resized for the app.
for (const [name, im] of Object.entries(cfg.images ?? {})) {
  const img = load(join(repo, im.src));
  const h = Math.round((img.height * im.width) / img.width);
  const out = join(outRoot, `${name}.png`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, PNG.sync.write(resample(img, 0, 0, img.width, img.height, im.width, h)));
  console.log(`${name}: ${im.width}x${h}`);
}

// Icon sets: every PNG in a folder (except *.prev.png), trimmed to the object and centred
// in a square with a small margin, so all icons in a set line up at the same size.
const iconSets = {};
for (const [exportName, set] of Object.entries(cfg.iconSets ?? {})) {
  const srcDir = join(repo, set.src);
  const files = existsSync(srcDir) ? readdirSync(srcDir).filter((f) => f.endsWith('.png') && !f.endsWith('.prev.png')).sort() : [];
  iconSets[exportName] = [];
  for (const file of files) {
    const img = load(join(srcDir, file));
    const [bx, by, bw, bh] = opaqueBox(img);
    const side = Math.max(bw, bh) / (1 - 2 * (set.margin ?? 0.06));
    const sx = bx + bw / 2 - side / 2, sy = by + bh / 2 - side / 2;
    // Pad a copy so the square window may reach past the image edge (transparent there).
    const pad = Math.ceil(side);
    const padded = new PNG({ width: img.width + 2 * pad, height: img.height + 2 * pad });
    PNG.bitblt(img, padded, 0, 0, img.width, img.height, pad, pad);
    const out = join(outRoot, set.out, file);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, PNG.sync.write(resample(padded, sx + pad, sy + pad, side, side, set.size, set.size)));
    iconSets[exportName].push({ id: file.replace(/\.png$/, ''), path: `${set.out}/${file}` });
  }
  console.log(`${exportName}: ${iconSets[exportName].length} icons`);
}
const iconsTs = `// Generated by scripts/slice-ui.mjs from art/game/specs/ui-slices.json. Do not edit by hand.
import { ImageSourcePropType } from 'react-native';
${Object.entries(iconSets).map(([name, list]) => `
export const ${name}: Record<string, ImageSourcePropType> = {
${list.map(({ id, path }) => `  ${id}: require('../../assets/game-ui/${path}'),`).join('\n')}
};`).join('\n')}
`;
writeFileSync(join(repo, 'src', 'game-ui', 'icons.ts'), iconsTs);

const pieceNames =['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br'];
const ts = `// Generated by scripts/slice-ui.mjs from art/game/specs/ui-slices.json. Do not edit by hand.
import { ImageSourcePropType } from 'react-native';

export type FramePiece = ${pieceNames.map((p) => `'${p}'`).join(' | ')};
export type FrameDef = {
  inset: { top: number; right: number; bottom: number; left: number };
  pieces: Record<FramePiece, ImageSourcePropType>;
};

export const FRAMES = {
${entries.map(({ name, id }) => `  ${name}: {
    inset: { top: ${id.top}, right: ${id.right}, bottom: ${id.bottom}, left: ${id.left} },
    pieces: {
${pieceNames.map((p) => `      ${p}: require('../../assets/game-ui/${name}/${p}.png'),`).join('\n')}
    },
  },`).join('\n')}
} satisfies Record<string, FrameDef>;
`;
writeFileSync(join(repo, 'src', 'game-ui', 'frames.ts'), ts);
console.log('wrote src/game-ui/frames.ts');
