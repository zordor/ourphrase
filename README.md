# OurPhrase

[![MPL-2.0](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](LICENSE)
[![Tests](https://github.com/zordor/ourphrase/actions/workflows/test.yml/badge.svg)](https://github.com/zordor/ourphrase/actions/workflows/test.yml)
[![Website](https://img.shields.io/badge/website-ourphrase.org-175cf5)](https://ourphrase.org)

OurPhrase is a free, open-source iOS application that gives people a pair of
**shared secret words that change every five minutes**—a human-friendly check
against impersonation, deepfakes and cloned voices over any communication
channel.

No servers, no accounts, no analytics, no network calls. Everything —
cryptography, dictionaries, QR generation — is bundled and runs locally.

The fully native SwiftUI app lives in [`ios/`](ios/README.md). The original
offline PWA remains for legacy users, encrypted-backup migration and protocol
compatibility.

> OurPhrase is a supplementary check, not proof of identity. Read the
> [disclaimer](DISCLAIMER.md) and [threat model](docs/threat-model.md) before
> relying on it in high-risk situations.

Development status and the ordered path to the first iOS release are tracked
in the [project roadmap](ROADMAP.md).

## How it works

- **Pairing (remote, two channels)**: User A creates a contact and sends an
  invitation **link** (carries a random 160-bit secret + salt + nonce, but *not*
  the PIN). A then tells B a **4-digit PIN out loud** (call / in person).
  B opens the link, types the PIN, and both derive the same master key with
  HMAC-SHA256. A 1-byte checksum catches mistyped PINs at pairing time.
- **Pairing (in person)**: one QR code containing the full secret (PIN
  included) — scan with the iOS camera and you're done.
- **Private names**: a profile says who you are when connecting, while each
  person chooses their own local alias afterwards. The inviter's profile name
  is never copied into the other person's contact list.
- **Verification**: both devices compute
  `HMAC-SHA256(masterKey, timeWindow)` → two words from the contact's
  dictionary (Spanish or English, chosen per contact). Words rotate every
  5 minutes (RFC-6238-style time windows). During the first minute the
  previous window's words are shown as a hint, tolerating device clock skew.

- **Backup ("cold wallet")**: contacts can be exported as an AES-GCM-encrypted
  file keyed by a 20-word phrase (PBKDF2-SHA256, 310k iterations; words come
  from the app's own dictionaries — ~181 bits of entropy). The user keeps the
  file anywhere (iCloud, email, USB) and the words on paper. Restore = file +
  words on any device; word entry is case/accent/ñ-insensitive. The phrase
  stays constant across re-exports; the app hints when the backup is stale.
  Still zero servers. Note: shared keys cannot be regenerated from a personal
  seed alone (they were agreed with a peer), hence file + words.

## Stack

Pure ES2022 + Web Crypto (`crypto.subtle`). No runtime dependencies except a
vendored copy of [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0, minified at
`js/vendor/jsQR.js`) that is lazy-loaded only for the in-app QR scanner.
Self-contained QR encoder (byte mode, ECC M, versions 1–16). Service worker
precaches everything for full offline / airplane-mode use. iOS standalone
install supported (`apple-touch-icon`, safe-area insets, `ui-rounded` type).

## Files

```
index.html            single-page UI (5 screens)
css/style.css         iOS-native look, light/dark, safe areas
js/app.js             controller (i18n ES/EN auto-detected)
js/crypto-engine.js   pairing + TOTP→words (isomorphic, tested in Node)
js/dict-es.js|en.js   curated dictionaries (536 ES / 459 EN concrete nouns)
js/qr.js              QR encoder (verified against jsQR + qrcode reference)
sw.js manifest.json   PWA/offline packaging
scripts/make-icons.mjs regenerates icons/ (hand-rolled PNG writer)
tests/                node --test suite (crypto, dictionaries, QR)
ios/                  native SwiftUI iOS/iPadOS application and tests
website/              public site, privacy policy and Universal Link fallback
```

## Develop / test

```sh
npm test                       # 20 tests: crypto determinism, dictionary
                               # phonetic-distinctness gate, QR round-trips
python3 -m http.server 8642    # serve locally (SW needs http://localhost or https)
```

Deploy by copying the folder to any static host **over HTTPS** (Web Crypto and
service workers require a secure context). Then on iPhone: Share → Add to Home
Screen.

## Security notes

- The PIN travels out-of-band by design; the link alone is not enough to pair.
- The 1-byte PIN checksum trades a small amount of link-interception resistance
  (10⁴ → ~39 candidate PINs offline) for catching typos — the words themselves
  would reveal the PIN to a link interceptor after one observed exchange anyway.
  Treat the invitation link with the same care as a house key.
- Keys live in `localStorage`, scoped to the app's origin. Deleting the contact
  (or the site data) destroys them.

Please report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
Do not publish real invitation payloads, keys or recovery phrases.

## Contributing and governance

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), follow
the [Code of Conduct](CODE_OF_CONDUCT.md), and review the
[governance model](GOVERNANCE.md).

## License and marks

Source code is available under the [Mozilla Public License 2.0](LICENSE).
Distributed modifications to covered files must remain available under MPL-2.0.
The **OurPhrase** name, logo and visual identity are not granted by the source
license; see [TRADEMARKS.md](TRADEMARKS.md). Third-party notices are in
[NOTICE](NOTICE).
