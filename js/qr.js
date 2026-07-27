// Minimal QR encoder (byte mode, ECC level M, versions 1–16, mask 0).
// Self-contained — no external libraries. Returns a boolean matrix.
// Verified against the jsQR decoder in tests/qr.test.mjs.

// [ecCodewordsPerBlock, [count, dataCodewords], [count, dataCodewords]] per version (M level)
const EC_M = [
  null,
  [10, [1, 16]],
  [16, [1, 28]],
  [26, [1, 44]],
  [18, [2, 32]],
  [24, [2, 43]],
  [16, [4, 27]],
  [18, [4, 31]],
  [22, [2, 38], [2, 39]],
  [22, [3, 36], [2, 37]],
  [26, [4, 43], [1, 44]],
  [30, [1, 50], [4, 51]],
  [22, [6, 36], [2, 37]],
  [22, [8, 37], [1, 38]],
  [24, [4, 40], [5, 41]],
  [24, [5, 41], [5, 42]],
  [28, [7, 45], [3, 46]],
];

const ALIGN = [
  null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
  [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
  [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74],
];

// ---- GF(256) arithmetic for Reed-Solomon ----
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

function rsGeneratorPoly(deg) {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= poly[j] ? EXP[(LOG[poly[j]] + i) % 255] : 0;
    }
    // multiply poly by (x - a^i): next[j] = poly[j] + poly[j-1]*a^i
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Uint8Array(data.length + ecLen);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const factor = res[i];
    if (factor === 0) continue;
    const lf = LOG[factor];
    for (let j = 1; j < gen.length; j++) {
      if (gen[j]) res[i + j] ^= EXP[(LOG[gen[j]] + lf) % 255];
    }
  }
  return res.slice(data.length);
}

// ---- bit buffer ----
class BitBuf {
  constructor() { this.bits = []; }
  push(val, len) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1);
  }
  get length() { return this.bits.length; }
  toBytes() {
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    this.bits.forEach((b, i) => { if (b) out[i >> 3] |= 0x80 >> (i & 7); });
    return out;
  }
}

function totalDataCodewords(version) {
  const spec = EC_M[version];
  let n = 0;
  for (let i = 1; i < spec.length; i++) n += spec[i][0] * spec[i][1];
  return n;
}

function pickVersion(byteLen) {
  for (let v = 1; v <= 16; v++) {
    const cci = v <= 9 ? 8 : 16; // byte-mode char count indicator bits
    const capacityBits = totalDataCodewords(v) * 8;
    if (4 + cci + byteLen * 8 <= capacityBits) return v;
  }
  throw new Error("QR payload too long");
}

function bch(value, poly, polyDeg, totalDeg) {
  let v = value << polyDeg;
  for (let i = totalDeg - 1; i >= polyDeg; i--) {
    if (v & (1 << i)) v ^= poly << (i - polyDeg);
  }
  return (value << polyDeg) | v;
}

function formatBits(mask) {
  // ECC M = 00
  const data = (0b00 << 3) | mask;
  return bch(data, 0b10100110111, 10, 15) ^ 0b101010000010010;
}

function versionBits(version) {
  return bch(version, 0b1111100100101, 12, 18);
}

export function makeQR(text) {
  const bytes = new TextEncoder().encode(text);
  const version = pickVersion(bytes.length);
  const size = 17 + version * 4;
  const dataCw = totalDataCodewords(version);

  // encode data bits
  const buf = new BitBuf();
  buf.push(0b0100, 4); // byte mode
  buf.push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) buf.push(b, 8);
  buf.push(0, Math.min(4, dataCw * 8 - buf.length)); // terminator
  while (buf.length % 8) buf.push(0, 1);
  const data = new Uint8Array(dataCw);
  data.set(buf.toBytes());
  for (let i = buf.length / 8, pad = 0xec; i < dataCw; i++, pad ^= 0xfd) {
    data[i] = pad; // alternating 0xEC / 0x11
  }

  // split into blocks, compute EC, interleave
  const spec = EC_M[version];
  const ecLen = spec[0];
  const blocks = [];
  let off = 0;
  for (let g = 1; g < spec.length; g++) {
    const [count, dlen] = spec[g];
    for (let b = 0; b < count; b++) {
      const d = data.slice(off, off + dlen);
      off += dlen;
      blocks.push({ d, e: rsEncode(d, ecLen) });
    }
  }
  const maxD = Math.max(...blocks.map((b) => b.d.length));
  const seq = [];
  for (let i = 0; i < maxD; i++)
    for (const b of blocks) if (i < b.d.length) seq.push(b.d[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) seq.push(b.e[i]);

  // build matrix
  const M = Array.from({ length: size }, () => new Array(size).fill(null));
  const setFn = (r, c, v) => { M[r][c] = v ? 1 : 0; };

  const finder = (r, c) => {
    for (let dr = -1; dr <= 7; dr++) for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
        (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      setFn(rr, cc, on);
    }
  };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

  // timing
  for (let i = 8; i < size - 8; i++) {
    if (M[6][i] === null) setFn(6, i, i % 2 === 0);
    if (M[i][6] === null) setFn(i, 6, i % 2 === 0);
  }

  // alignment patterns
  const ap = ALIGN[version];
  for (const r of ap) for (const c of ap) {
    // skip only the three corners that collide with finder patterns;
    // centers on the timing lines are legitimate and overwrite them
    const nearFinder = (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
    if (nearFinder) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      setFn(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }
  }

  // reserve format areas (filled later)
  for (let i = 0; i < 9; i++) {
    if (M[8][i] === null) M[8][i] = 0;
    if (M[i][8] === null) M[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    M[8][size - 1 - i] = 0;
    M[size - 1 - i][8] = 0;
  }
  setFn(size - 8, 8, 1); // dark module

  // version info (v >= 7)
  if (version >= 7) {
    const vb = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (vb >> i) & 1;
      setFn(Math.floor(i / 3), size - 11 + (i % 3), bit);
      setFn(size - 11 + (i % 3), Math.floor(i / 3), bit);
    }
  }

  // place data (zigzag), mask 0: (r + c) % 2 === 0
  let bitIdx = 0;
  const totalBits = seq.length * 8;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < 2; j++) {
        const c = col - j;
        const upward = ((size - 1 - col) & 2) === 0;
        const r = upward ? size - 1 - i : i;
        if (M[r][c] !== null) continue;
        let bit = 0;
        if (bitIdx < totalBits) {
          bit = (seq[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
        }
        bitIdx++;
        if ((r + c) % 2 === 0) bit ^= 1; // mask 0
        M[r][c] = bit;
      }
    }
  }

  // format info (mask 0)
  const fb = formatBits(0);
  for (let i = 0; i < 15; i++) {
    const bit = (fb >> (14 - i)) & 1; // MSB-first along the placement path
    // around top-left finder
    if (i < 6) setFn(8, i, bit);
    else if (i < 8) setFn(8, i + 1, bit);
    else if (i === 8) setFn(7, 8, bit);
    else setFn(14 - i, 8, bit);
    // split copy: bottom-left column + top-right row
    if (i < 8) setFn(size - 1 - i, 8, bit);
    else setFn(8, size - 15 + i, bit);
  }
  setFn(size - 8, 8, 1); // dark module (format copy above touches this cell)

  return M.map((row) => row.map((v) => v === 1));
}
