# Security policy

## Reporting a vulnerability

Please do not open a public issue for an unpatched vulnerability. Use GitHub's
**Report a vulnerability** private advisory form for this repository. Include
affected versions, impact, reproduction steps and any suggested mitigation.

We aim to acknowledge a complete report within 72 hours. We will coordinate a
fix and disclosure timeline with the reporter. Please allow a reasonable period
for remediation before publishing details.

## Supported versions

Only the latest release and the current `main` branch receive security fixes.

## Scope

Cryptography, invitation handling, QR parsing, Keychain use, backup encryption,
Universal Links, privacy leaks and build/release integrity are in scope.
Phishing or social engineering against maintainers and denial-of-service
against third-party infrastructure are out of scope.

See [docs/threat-model.md](docs/threat-model.md) for security assumptions.
