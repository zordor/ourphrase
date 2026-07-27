// Dictionary quality gate: size, charset, and phonetic distinctness.
// Words are normalized to a rough phonetic form per language; any pair that is
// too close (edit distance < 2, or distance 2 for short rhyming pairs) fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DICTIONARIES } from "../js/dictionaries.js";

function stripAccents(w) {
  // ñ is a distinct phoneme — protect it before stripping combining marks
  return w
    .replace(/ñ/g, "0")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/0/g, "N");
}

// Rough Spanish phonetic normalization (seseo/yeísmo — worst-case merger)
function phoneticEs(w) {
  let s = stripAccents(w.toLowerCase());
  s = s
    .replace(/ch/g, "C")
    .replace(/ll/g, "y")
    .replace(/qu/g, "k")
    .replace(/g(?=[ei])/g, "j")
    .replace(/c(?=[ei])/g, "s")
    .replace(/c/g, "k")
    .replace(/z/g, "s")
    .replace(/v/g, "b")
    .replace(/h/g, "")
    .replace(/ü/g, "u");
  return s;
}

// Rough English phonetic normalization
function phoneticEn(w) {
  let s = w.toLowerCase();
  s = s
    .replace(/ph/g, "f")
    .replace(/wh/g, "w")
    .replace(/kn/g, "n")
    .replace(/wr/g, "r")
    .replace(/ck/g, "k")
    .replace(/gh/g, "")
    .replace(/mb$/g, "m");
  return s;
}

const NORMALIZERS = { es: phoneticEs, en: phoneticEn };

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 4; // cheap early-out cap
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[n];
}

for (const [code, dict] of Object.entries(DICTIONARIES)) {
  const norm = NORMALIZERS[code];

  test(`[${code}] size and charset`, () => {
    assert.ok(dict.words.length >= 400, `only ${dict.words.length} words`);
    for (const w of dict.words) {
      assert.ok(w.length >= 3 && w.length <= 12, `bad length: ${w}`);
      assert.match(w, /^[a-záéíóúüñ]+$/i, `bad chars: ${w}`);
    }
  });

  test(`[${code}] no duplicates (accent/case-insensitive)`, () => {
    const seen = new Map();
    for (const w of dict.words) {
      const k = stripAccents(w.toLowerCase());
      assert.ok(!seen.has(k), `duplicate: ${w} / ${seen.get(k)}`);
      seen.set(k, w);
    }
  });

  test(`[${code}] phonetic distinctness (pairwise)`, () => {
    const items = dict.words.map((w) => ({ w, p: norm(w) }));
    const bad = [];
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        const d = editDistance(a.p, b.p);
        if (d < 2) {
          bad.push(`${a.w} ~ ${b.w} (d=${d})`);
        } else if (
          d === 2 &&
          Math.max(a.p.length, b.p.length) <= 4 &&
          a.p.slice(-3) === b.p.slice(-3)
        ) {
          // very short rhyming pair, e.g. "egg"/"leg" — too easy to mishear
          bad.push(`${a.w} ~ ${b.w} (short rhyme, d=2)`);
        }
      }
    }
    assert.deepEqual(bad, [], `confusable pairs:\n${bad.join("\n")}`);
  });
}
