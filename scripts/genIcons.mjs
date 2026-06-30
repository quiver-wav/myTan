// Genera le icone PNG dell'app (sole color crema su sfondo caldo) senza
// dipendenze esterne: rasterizzazione manuale + encoder PNG con zlib di Node.
// Uso: node scripts/genIcons.mjs  (dalla root del progetto)

import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const CREAM = [255, 247, 236];
const TOP = [255, 210, 122];
const BOT = [245, 166, 35];

const lerp = (a, b, t) => a + (b - a) * t;
const lerpC = (A, B, t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)];

function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function sampleColor(x, y, size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.2;
  if (Math.hypot(x - cx, y - cy) <= r) return CREAM;
  const w = size * 0.03;
  const r1 = r * 1.45;
  const r2 = r * 2.0;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const ax = cx + Math.cos(a) * r1;
    const ay = cy + Math.sin(a) * r1;
    const bx = cx + Math.cos(a) * r2;
    const by = cy + Math.sin(a) * r2;
    if (distSeg(x, y, ax, ay, bx, by) <= w) return CREAM;
  }
  return lerpC(TOP, BOT, y / size);
}

function render(size) {
  const buf = Buffer.alloc(size * size * 4);
  const N = 2; // supersampling 2x2 per bordi più morbidi
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const c = sampleColor(x + (sx + 0.5) / N, y + (sy + 0.5) / N, size);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = N * N;
      const o = (y * size + x) * 4;
      buf[o] = Math.round(r / n);
      buf[o + 1] = Math.round(g / n);
      buf[o + 2] = Math.round(b / n);
      buf[o + 3] = 255;
    }
  }
  return buf;
}

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filtro 0
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

for (const size of [180, 192, 512]) {
  const png = encodePNG(size, render(size));
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  writeFileSync(`public/${name}`, png);
  console.log(`wrote public/${name} (${png.length} bytes)`);
}
