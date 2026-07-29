# OurPhrase interoperability protocol

This document is normative for the PWA, native iOS app and future clients.
All strings are UTF-8. Multi-byte counters are unsigned, big-endian.

## Pairing invite v1

The invite is compact JSON encoded as unpadded Base64URL:

| Field | Meaning |
| --- | --- |
| `v` | Integer protocol version, currently `1` |
| `n` | Inviter profile name; presentation only, never a recipient alias |
| `l` | Word dictionary: `es` or `en` |
| `s1` | 20 random bytes, Base64URL |
| `sa` | 16 random salt bytes, Base64URL |
| `no` | 12 random nonce bytes, Base64URL |
| `c` | Optional first byte of `HMAC(masterKey, "PPID-check-v1")` |
| `p` | Four-digit PIN, present in an in-person QR and absent remotely |

Legacy stored PWA contacts may call the PIN field `pin`. Importers normalize it
to `p`. Outbound wire payloads always use `p`.

The master key is:

```text
HMAC-SHA256(
  key = decode(s1),
  message = UTF8("PPID-pair-v1|") || decode(sa) ||
            UTF8("|") || decode(no) || UTF8("|" + fourDigitPIN)
)
```

Invitations use `https://ourphrase.org/invite#i=<payload>`. Keeping the
payload in the fragment prevents it from being sent in an HTTP request.

## Rotating words

`window = floor(unixTimeSeconds / 300)`. Encode the window as eight big-endian
bytes. For block numbers starting at zero:

```text
digest = HMAC-SHA256(
  masterKey,
  UTF8("PPID-words-v1|") || windowBytes || UInt8(block)
)
```

Read digest bytes as big-endian UInt16 values. Reject values at or above
`floor(65536 / dictionarySize) * dictionarySize`; map accepted values modulo
the dictionary size and skip duplicate indices. Continue blocks until two
distinct words are selected. Dictionary order is immutable and is tested
across implementations.

## Encrypted backups

The UTF-8 JSON envelope contains:

```json
{
  "app": "passphrase",
  "v": 2,
  "it": 310000,
  "salt": "<16-byte Base64URL>",
  "iv": "<12-byte Base64URL>",
  "data": "<AES-GCM ciphertext followed by 16-byte tag, Base64URL>"
}
```

The legacy `app: "passphrase"` value is intentionally stable across the
OurPhrase rename so existing encrypted backups remain importable.

Normalize the recovery phrase by lowercasing, removing diacritics (including
the distinction between `ñ` and `n`), replacing non-letters with spaces,
trimming and collapsing whitespace. Derive 32 bytes with
PBKDF2-HMAC-SHA256, the envelope salt and `it` iterations. Encrypt the compact
payload JSON with AES-256-GCM and no additional authenticated data.

Envelope v1 payloads contain PWA contacts. Envelope v2 payloads contain:

```json
{
  "v": 2,
  "exportedAt": "<ISO-8601>",
  "profileName": "<local identity>",
  "connections": [{
    "pairingID": "<first 12 characters of s1>",
    "alias": "<private local alias>",
    "language": "es",
    "key": "<32-byte Base64URL master key>",
    "invite": {"v": 1, "...": "..."},
    "hue": 216,
    "createdAt": "<ISO-8601>"
  }]
}
```

Import is all-or-nothing. Duplicate `pairingID` values are ignored; existing
local records are never overwritten.
