// Generates the PWA icons (flat blue field, two rounded "word" bars).
// Pure Node — hand-rolled PNG writer over zlib, no image libraries.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function roundedRectHit(x, y, rx, ry, w, h, rad) {
  if (x < rx || x >= rx + w || y < ry || y >= ry + h) return false;
  const cx = Math.max(rx + rad, Math.min(x, rx + w - rad));
  const cy = Math.max(ry + rad, Math.min(y, ry + h - rad));
  return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad ||
    (x >= rx + rad && x < rx + w - rad) || (y >= ry + rad && y < ry + h - rad);
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = [26, 76, 214], bar = [255, 255, 255];
  const u = size / 512; // design units on a 512 grid
  const bars = [
    { x: 116, y: 196, w: 280, h: 56, r: 28 },
    { x: 156, y: 292, w: 200, h: 56, r: 28 },
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let [r, g, b] = bg;
      for (const bx of bars) {
        if (roundedRectHit(x, y, bx.x * u, bx.y * u, bx.w * u, bx.h * u, bx.r * u)) {
          [r, g, b] = bar;
          break;
        }
      }
      const i = (y * size + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
  return png(size, size, rgba);
}

mkdirSync(new URL("../icons/", import.meta.url), { recursive: true });
for (const [file, size] of [["icon-192.png", 192], ["icon-512.png", 512], ["apple-touch-icon.png", 180]]) {
  writeFileSync(new URL(`../icons/${file}`, import.meta.url), drawIcon(size));
  console.log("wrote icons/" + file);
}
