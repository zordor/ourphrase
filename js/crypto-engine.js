// OurPhrase Identity — cryptographic engine.
// Isomorphic ES module: runs in the browser and in Node >= 18 (globalThis.crypto).
// All primitives come from WebCrypto (SubtleCrypto); nothing leaves the device.

const subtle = globalThis.crypto.subtle;
const te = new TextEncoder();

export const STEP_SECONDS = 300; // one word-window every 5 minutes

// ---------------------------------------------------------------------------
// Random + encoding helpers
// ---------------------------------------------------------------------------

export function randomBytes(n) {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

// Unbiased 4-digit PIN ("0000".."9999")
export function randomPin() {
  const limit = Math.floor(0x100000000 / 10000) * 10000; // rejection bound
  while (true) {
    const v = new Uint32Array(1);
    globalThis.crypto.getRandomValues(v);
    if (v[0] < limit) return String(v[0] % 10000).padStart(4, "0");
  }
}

export function b64urlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(keyBytes, msgBytes) {
  const key = await subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  return new Uint8Array(await subtle.sign("HMAC", key, msgBytes));
}

function concatBytes(...parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

// ---------------------------------------------------------------------------
// Pairing: Secret_Part_1 (link) + Secret_Part_2 (4-digit PIN) -> master key
// ---------------------------------------------------------------------------

// masterKey = HMAC-SHA256(key = part1, msg = "PPID-pair-v1" | salt | nonce | pin)
export async function deriveMasterKey(part1Bytes, pin, saltBytes, nonceBytes) {
  const msg = concatBytes(
    te.encode("PPID-pair-v1|"),
    saltBytes,
    te.encode("|"),
    nonceBytes,
    te.encode("|" + pin)
  );
  return hmacSha256(part1Bytes, msg);
}

// Invite payload carried in the link fragment / QR. `pin` is present only in
// the QR (in-person) variant — the link variant travels without it on purpose.
// `name` is the inviter's own profile name. It is presentation metadata only:
// each device chooses and stores its own private alias after deriving the key.
export function createInvite(name, lang) {
  return {
    v: 1,
    n: name,
    l: lang,
    s1: b64urlEncode(randomBytes(20)),
    sa: b64urlEncode(randomBytes(16)),
    no: b64urlEncode(randomBytes(12)),
    pin: randomPin(),
  };
}

export function encodeInvite(invite, { includePin }) {
  const { pin, ...rest } = invite;
  const obj = includePin ? { ...rest, p: pin } : rest;
  return b64urlEncode(te.encode(JSON.stringify(obj)));
}

export function decodeInvite(encoded) {
  const obj = JSON.parse(new TextDecoder().decode(b64urlDecode(encoded)));
  if (obj.v !== 1 || !obj.s1 || !obj.sa || !obj.no || !obj.l) {
    throw new Error("invalid invite");
  }
  return obj;
}

// One-byte PIN checksum stored in the invite so a mistyped PIN can be caught
// at pairing time. Deliberately tiny: it narrows an intercepted link's PIN
// space but never reveals the PIN, and the PIN still travels out-of-band.
export async function checkByte(masterKey) {
  const mac = await hmacSha256(masterKey, te.encode("PPID-check-v1"));
  return mac[0];
}

export async function masterKeyFromInvite(invite, pin) {
  return deriveMasterKey(
    b64urlDecode(invite.s1),
    pin,
    b64urlDecode(invite.sa),
    b64urlDecode(invite.no)
  );
}

// ---------------------------------------------------------------------------
// TOTP -> words
// ---------------------------------------------------------------------------

export function windowIndex(nowMs = Date.now(), stepSec = STEP_SECONDS) {
  return Math.floor(nowMs / 1000 / stepSec);
}

export function windowRemainingMs(nowMs = Date.now(), stepSec = STEP_SECONDS) {
  const stepMs = stepSec * 1000;
  return stepMs - (nowMs % stepMs);
}

function windowToBytes(idx) {
  // 8-byte big-endian, same layout as RFC 6238's time counter
  const b = new Uint8Array(8);
  let v = idx;
  for (let i = 7; i >= 0; i--) { b[i] = v & 0xff; v = Math.floor(v / 256); }
  return b;
}

// Deterministically pick `count` distinct dictionary indices for a window.
// Uses rejection sampling over 16-bit values so any dictionary size is unbiased;
// extra HMAC blocks are chained in the (rare) case the first 32 bytes run out.
export async function wordIndicesForWindow(masterKey, winIdx, dictSize, count = 2) {
  const limit = Math.floor(65536 / dictSize) * dictSize;
  const picked = [];
  for (let block = 0; picked.length < count && block < 16; block++) {
    const msg = concatBytes(
      te.encode("PPID-words-v1|"),
      windowToBytes(winIdx),
      Uint8Array.of(block)
    );
    const mac = await hmacSha256(masterKey, msg);
    for (let i = 0; i + 1 < mac.length && picked.length < count; i += 2) {
      const v = (mac[i] << 8) | mac[i + 1];
      if (v >= limit) continue;            // rejection: keep it unbiased
      const idx = v % dictSize;
      if (picked.includes(idx)) continue;  // words must be distinct
      picked.push(idx);
    }
  }
  return picked;
}

export async function wordsForWindow(masterKey, winIdx, dict, count = 2) {
  const idx = await wordIndicesForWindow(masterKey, winIdx, dict.length, count);
  return idx.map((i) => dict[i]);
}
