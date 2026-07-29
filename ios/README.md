# OurPhrase for iOS

Native Swift 6 and SwiftUI application for iOS/iPadOS 17 or newer. It uses
CryptoKit, SwiftData, Keychain, VisionKit, Core Image and LocalAuthentication;
there are no third-party or runtime dependencies.

## Open and run

1. Install full Xcode 26 or newer.
2. Open `OurPhrase.xcodeproj`.
3. Select an Apple Developer team under Signing & Capabilities.
4. Run the `OurPhrase` scheme on an iPhone/iPad or simulator.

Camera scanning and Universal Links must be tested on a physical device.
Deployment prerequisites are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Security and compatibility

- Connection keys use `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.
- Profile and non-secret metadata remain local; CloudKit is disabled.
- Pairing and rotating words are byte-compatible with PWA protocol v1.
- The importer accepts encrypted PWA v1 backups.
- New `.ourphrase` backups use the documented v2 payload inside the same
  PBKDF2-SHA256/AES-256-GCM authenticated envelope.
- Legacy `.passphrase` files and the original `app: "passphrase"` envelope
  identifier remain accepted for backwards compatibility.
- The URL fragment carries invite material so it is never sent to the web host.
