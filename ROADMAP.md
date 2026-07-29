# OurPhrase roadmap

Last reviewed: 2026-07-29

This is the project checkpoint and the source of truth for what comes next.
Completed work belongs in the changelog; only unfinished or validation work
belongs here.

## Current checkpoint

- The fully native SwiftUI iOS/iPadOS application builds successfully.
- Pairing supports a personal profile name and private, per-device aliases:
  neither person forces their chosen contact name onto the other.
- In-person QR pairing, remote link + PIN pairing, rotating words, Keychain
  storage and encrypted backup/restore are implemented.
- The public website and invitation fallback are live at
  <https://ourphrase.org>.
- The source is public under MPL-2.0 at
  <https://github.com/zordor/ourphrase>.
- CI builds the iOS app and runs the 24 web/protocol compatibility tests.
- DNS and strict HTTPS are active. Domain email is **not configured yet**.
- The public AASA file is served correctly as JSON, but still contains the
  placeholder Apple Team ID, so Universal Links are **not ready yet**.

## Resume here

The next session should start with the following sequence:

1. Obtain the Apple Developer Team ID and select that team in Xcode signing.
2. Replace `TEAM_ID` in
   `website/.well-known/apple-app-site-association`, deploy it and verify the
   public response.
3. Install the signed app on a physical iPhone.
4. Exercise the physical-device checklist below, fixing release blockers
   before adding more features.
5. Create the App Store Connect record and distribute the first TestFlight
   build.

## Milestone 1 — Physical-device release gate

- [ ] Configure signing for `org.ourphrase.app` with the owner's Apple
      Developer team.
- [ ] Deploy the final AASA application identifier
      (`APPLE_TEAM_ID.org.ourphrase.app`).
- [ ] Confirm an invitation opened from Messages or Mail launches the app,
      while an uninstalled device receives the safe `/invite` web fallback.
- [ ] Test camera permissions and QR scanning on a real iPhone.
- [ ] Pair two physical devices and verify that each person independently
      chooses the other's alias.
- [ ] Verify matching words, five-minute rotation and previous-window clock
      skew behavior on both devices.
- [ ] Verify Keychain persistence across app restarts and upgrades.
- [ ] Export, delete and restore a native `.ourphrase` backup.
- [ ] Import a representative legacy PWA backup.
- [ ] Test VoiceOver, Dynamic Type, dark mode, reduced motion and the smallest
      supported iPhone layout.
- [ ] Run the Swift unit-test targets on a concrete simulator in CI, in
      addition to the current compile gate.

Exit criterion: no blocker in pairing, verification, persistence, recovery or
accessibility on supported iPhones.

## Milestone 2 — TestFlight and App Store readiness

- [ ] Create the App Store Connect application and identifiers.
- [ ] Configure the privacy URL as <https://ourphrase.org/privacy/> and declare
      “Data Not Collected”, subject to a final binary/privacy-manifest review.
- [ ] Prepare the icon, screenshots, subtitle, description, keywords, support
      text and review notes in Spanish and English.
- [ ] Archive and validate a release build, then publish it to an internal
      TestFlight group.
- [ ] Run a small family beta focused on setup comprehension and what users do
      when words do not match.
- [ ] Resolve beta findings and submit version 1.0 for App Review.
- [ ] Configure `support@ourphrase.org` with Cloudflare Email Routing and test
      inbound delivery before listing it as the public support address.

Exit criterion: version 1.0 approved or ready for submission, with a working
support channel.

## Milestone 3 — Security and product hardening

- [ ] Request an independent review of the protocol, cryptography, Keychain
      handling and backup format.
- [ ] Add deterministic Swift protocol vectors shared with the JavaScript
      suite and cover malformed invitations and corrupted backups.
- [ ] Add a clear in-app mismatch flow: stop, retry, and verify by another
      channel before any sensitive action.
- [ ] Add an optional local app lock using Face ID/Touch ID without making
      biometrics part of the shared identity protocol.
- [ ] Document a release/signing procedure and automate static website
      deployments.
- [ ] Triage public feedback and security reports without collecting product
      analytics.

## Milestone 4 — Native Android, after iOS 1.0

- [ ] Re-evaluate scope using iOS beta feedback.
- [ ] Build a fully native Kotlin/Jetpack Compose app—no WebView, hybrid shell
      or cross-platform UI shortcut.
- [ ] Preserve protocol and encrypted-backup compatibility with iOS and the
      legacy PWA.
- [ ] Implement Android App Links, Keystore storage, camera QR scanning,
      accessibility and Play Store release checks.

Android work starts only after the iOS interaction and protocol have proven
stable, to avoid implementing the same early mistakes twice.

## Owner-provided inputs

These are the only external inputs currently needed:

- Apple Developer membership/team access and the Apple Team ID.
- A destination mailbox for Cloudflare Email Routing.
- Access to a second physical device/person for the two-sided pairing test.

No invitation payload, master key, backup file or recovery phrase should ever
be posted in a public GitHub issue.
