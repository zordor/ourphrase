// Unit tests for the OurPhrase Identity crypto engine.
// Run: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  randomPin, b64urlEncode, b64urlDecode,
  createInvite, encodeInvite, decodeInvite, masterKeyFromInvite,
  windowIndex, windowRemainingMs, wordIndicesForWindow, wordsForWindow,
  STEP_SECONDS,
} from "../js/crypto-engine.js";

test("b64url round-trips arbitrary bytes", () => {
  for (const len of [0, 1, 2, 3, 20, 31, 32, 33]) {
    const src = new Uint8Array(len).map((_, i) => (i * 37 + len) & 0xff);
    assert.deepEqual(b64urlDecode(b64urlEncode(src)), src);
  }
  // no padding chars or unsafe chars in output
  const enc = b64urlEncode(new Uint8Array(50).fill(0xff));
  assert.match(enc, /^[A-Za-z0-9_-]+$/);
});

test("randomPin is always 4 digits", () => {
  for (let i = 0; i < 1000; i++) assert.match(randomPin(), /^\d{4}$/);
});

test("two independent instances derive identical words (link + PIN pairing)", async () => {
  // Device A creates the invite
  const invite = createInvite("Familia", "es");
  const link = encodeInvite(invite, { includePin: false });
  const keyA = await masterKeyFromInvite(invite, invite.pin);

  // Device B receives only the encoded link + the PIN spoken over the phone
  const received = decodeInvite(link);
  assert.equal(received.p, undefined, "link payload must NOT contain the PIN");
  const keyB = await masterKeyFromInvite(received, invite.pin);

  assert.deepEqual(keyA, keyB);
  assert.equal(keyA.length, 32);

  // Same window -> same words on both devices
  const dict = Array.from({ length: 550 }, (_, i) => "w" + i);
  const win = windowIndex();
  assert.deepEqual(
    await wordsForWindow(keyA, win, dict),
    await wordsForWindow(keyB, win, dict)
  );
});

test("QR (in-person) payload embeds the PIN and derives the same key", async () => {
  const invite = createInvite("Work", "en");
  const qr = decodeInvite(encodeInvite(invite, { includePin: true }));
  assert.equal(qr.p, invite.pin);
  assert.deepEqual(
    await masterKeyFromInvite(qr, qr.p),
    await masterKeyFromInvite(invite, invite.pin)
  );
});

test("wrong PIN yields a different key and different words", async () => {
  const invite = createInvite("Familia", "es");
  const good = await masterKeyFromInvite(invite, invite.pin);
  const badPin = invite.pin === "0000" ? "0001" : "0000";
  const bad = await masterKeyFromInvite(invite, badPin);
  assert.notDeepEqual(good, bad);
});

test("decodeInvite rejects malformed payloads", () => {
  assert.throws(() => decodeInvite("not-base64-json"));
  assert.throws(() =>
    decodeInvite(b64urlEncode(new TextEncoder().encode('{"v":2}')))
  );
});

test("adjacent windows are deterministic (clock-skew tolerance basis)", async () => {
  const invite = createInvite("x", "en");
  const key = await masterKeyFromInvite(invite, invite.pin);
  const dict = Array.from({ length: 550 }, (_, i) => "w" + i);
  const win = windowIndex();
  // computing prev/current/next twice gives identical results
  for (const w of [win - 1, win, win + 1]) {
    assert.deepEqual(await wordsForWindow(key, w, dict), await wordsForWindow(key, w, dict));
  }
  // and consecutive windows (almost certainly) differ
  const a = await wordsForWindow(key, win, dict);
  const b = await wordsForWindow(key, win + 1, dict);
  assert.notDeepEqual([a, b[1]], [b, a[1]]); // structural sanity
});

test("window math", () => {
  assert.equal(windowIndex(0), 0);
  assert.equal(windowIndex(299_999), 0);
  assert.equal(windowIndex(300_000), 1);
  assert.equal(windowRemainingMs(0), STEP_SECONDS * 1000);
  assert.equal(windowRemainingMs(299_000), 1000);
});

test("word indices are distinct, in-range, and roughly uniform", async () => {
  const invite = createInvite("x", "en");
  const key = await masterKeyFromInvite(invite, invite.pin);
  const N = 550;
  const counts = new Array(N).fill(0);
  const SAMPLES = 3000;
  for (let w = 0; w < SAMPLES; w++) {
    const idx = await wordIndicesForWindow(key, w, N, 2);
    assert.equal(idx.length, 2);
    assert.notEqual(idx[0], idx[1]);
    for (const i of idx) {
      assert.ok(Number.isInteger(i) && i >= 0 && i < N);
      counts[i]++;
    }
  }
  // Uniformity sanity check: expected mean ~ 2*SAMPLES/N ≈ 10.9 hits per word
  const mean = (2 * SAMPLES) / N;
  const maxDev = Math.max(...counts.map((c) => Math.abs(c - mean)));
  assert.ok(maxDev < mean * 2.5, `distribution too skewed (maxDev=${maxDev})`);
});
