// QR encoder round-trip: our matrix must decode with jsQR (independent decoder).
import { test } from "node:test";
import assert from "node:assert/strict";
import jsQR from "jsqr";
import { makeQR } from "../js/qr.js";

function matrixToImage(matrix, scale = 4, quiet = 4) {
  const n = matrix.length;
  const size = (n + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!matrix[r][c]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = (c + quiet) * scale + dx;
          const y = (r + quiet) * scale + dy;
          const i = (y * size + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return { data, width: size, height: size };
}

function roundTrip(text) {
  const m = makeQR(text);
  const img = matrixToImage(m);
  const decoded = jsQR(img.data, img.width, img.height);
  assert.ok(decoded, `jsQR failed to decode (${text.length} chars, ${m.length} modules)`);
  assert.equal(decoded.data, text);
}

test("QR round-trips short text (version 1-2)", () => {
  roundTrip("hola");
  roundTrip("https://example.com/#i=abc123");
});

test("QR round-trips realistic invite URL (~250 chars, version >= 10)", () => {
  const payload = "A".repeat(200);
  roundTrip(`https://securephrase.example.net/app/index.html#i=${payload}`);
});

test("QR round-trips unicode text", () => {
  roundTrip("piña—dragón ñu 5€");
});

test("QR handles many sizes", () => {
  for (let len = 10; len <= 400; len += 37) {
    roundTrip("x".repeat(len));
  }
});

test("QR rejects oversized payload", () => {
  assert.throws(() => makeQR("z".repeat(2000)));
});
