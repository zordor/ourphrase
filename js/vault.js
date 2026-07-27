// Encrypted backup ("cold wallet") — AES-GCM vault keyed by a 20-word phrase.
// The words come from the app's own phonetically-distinct dictionaries
// (~9.07 bits/word → ~181 bits of entropy for 20 words). Zero servers: the
// user keeps the encrypted file anywhere and the words on paper.
import { randomBytes, b64urlEncode, b64urlDecode } from "./crypto-engine.js";

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();
const PBKDF2_ITERATIONS = 310000;

// Forgiving normalization: case-, accent- and ñ-insensitive, any whitespace.
// The dictionaries guarantee no two words collide under this mapping.
export function normalizeWords(input) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// Uniformly pick n words (rejection sampling; repeats allowed).
export function generateSeed(dictWords, n = 20) {
  const limit = Math.floor(65536 / dictWords.length) * dictWords.length;
  const out = [];
  while (out.length < n) {
    const b = randomBytes(2);
    const v = (b[0] << 8) | b[1];
    if (v < limit) out.push(dictWords[v % dictWords.length]);
  }
  return out;
}

async function keyFromWords(wordsStr, saltBytes, iterations) {
  const base = await subtle.importKey(
    "raw", te.encode(normalizeWords(wordsStr)), "PBKDF2", false, ["deriveKey"]
  );
  return subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptVault(payload, wordsStr) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = await keyFromWords(wordsStr, salt, PBKDF2_ITERATIONS);
  const data = new Uint8Array(
    await subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(payload)))
  );
  return JSON.stringify({
    app: "passphrase",
    v: 1,
    it: PBKDF2_ITERATIONS,
    salt: b64urlEncode(salt),
    iv: b64urlEncode(iv),
    data: b64urlEncode(data),
  });
}

// Throws Error("bad-file") for malformed envelopes and Error("bad-words")
// when AES-GCM authentication fails (wrong phrase or tampered file).
export async function decryptVault(fileText, wordsStr) {
  let env;
  try {
    env = JSON.parse(fileText);
    if (env.app !== "passphrase" || env.v !== 1 || !env.salt || !env.iv || !env.data) throw 0;
  } catch {
    throw new Error("bad-file");
  }
  try {
    const key = await keyFromWords(wordsStr, b64urlDecode(env.salt), env.it);
    const plain = await subtle.decrypt(
      { name: "AES-GCM", iv: b64urlDecode(env.iv) }, key, b64urlDecode(env.data)
    );
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error("bad-words");
  }
}
