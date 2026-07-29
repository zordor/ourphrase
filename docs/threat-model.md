# Threat model

OurPhrase helps two people notice impersonation during communication by
comparing words derived from a pre-shared key.

## Protects against

- An impersonator who does not possess the shared key.
- Voice or video cloning where the attacker cannot read either device.
- Accidental PIN mistakes during supported pairing flows.
- Disclosure of locally stored secrets while the device is locked, subject to
  platform Keychain guarantees.

## Does not protect against

- A compromised, unlocked or maliciously modified device.
- An attacker who observes the current words or pairing secret.
- Coercion, screen sharing, shoulder surfing or a dishonest connection peer.
- Malware, operating-system compromise or weaknesses in platform cryptography.
- Users treating matching words as legal or biometric proof of identity.

## Design boundaries

The service has no account database and cannot recover connection keys.
Invitation secrets remain in URL fragments and are not transmitted to the web
server. Remote pairing splits material between a link and an out-of-band PIN.
Words rotate every five minutes and tolerate limited clock skew. See
[protocol-v1.md](protocol-v1.md) for byte-level details.
