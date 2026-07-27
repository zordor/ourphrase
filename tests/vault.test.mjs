// Backup vault: seed generation, forgiving word entry, AES-GCM round trip.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSeed, normalizeWords, encryptVault, decryptVault } from "../js/vault.js";
import { DICTIONARIES } from "../js/dictionaries.js";

test("generateSeed picks 20 in-dictionary words with fresh randomness", () => {
  const dict = DICTIONARIES.es.words;
  const a = generateSeed(dict, 20);
  const b = generateSeed(dict, 20);
  assert.equal(a.length, 20);
  for (const w of a) assert.ok(dict.includes(w), w);
  assert.notDeepEqual(a, b);
});

test("normalizeWords is case-, accent- and ñ-insensitive", () => {
  assert.equal(normalizeWords("  León,  ARAÑA \n cigüeña "), "leon arana ciguena");
  assert.equal(normalizeWords("León araña"), normalizeWords("leon arana"));
});

test("vault round-trips and tolerates accent-free typing", async () => {
  const payload = { v: 1, contacts: [{ id: "abc", name: "Familia", lang: "es", key: "k" }] };
  const words = "león dragón cabaña sol nube piñata uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce";
  const file = await encryptVault(payload, words);

  const env = JSON.parse(file);
  assert.equal(env.app, "passphrase");
  assert.ok(env.it >= 100000);

  // decrypt with sloppy re-typing: no accents, different case/spacing
  const typed = "LEON dragon cabana  sol nube pinata uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce";
  assert.deepEqual(await decryptVault(file, typed), payload);
});

test("wrong words and tampered files are rejected with distinct errors", async () => {
  const file = await encryptVault({ x: 1 }, "gato perro sol luna");
  await assert.rejects(() => decryptVault(file, "gato perro sol nube"), /bad-words/);
  await assert.rejects(() => decryptVault("not json", "gato perro sol luna"), /bad-file/);
  await assert.rejects(() => decryptVault('{"app":"other"}', "gato perro sol luna"), /bad-file/);
  const tampered = JSON.parse(file);
  tampered.data = tampered.data.slice(0, -4) + "AAAA";
  await assert.rejects(() => decryptVault(JSON.stringify(tampered), "gato perro sol luna"), /bad-words/);
});
