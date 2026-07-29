# OurPhrase iOS deployment

1. Install full Xcode 26 or newer and select it with `xcode-select`.
2. Open `OurPhrase.xcodeproj`, choose the Apple Developer team and keep the
   bundle identifier `org.ourphrase.app`.
3. Replace `TEAM_ID` in
   `website/.well-known/apple-app-site-association` with that team's identifier.
4. Deploy `website/` to `https://ourphrase.org` so the association file is
   served at `/.well-known/apple-app-site-association` as
   `application/json`, without redirects or a filename extension.
5. Verify the `/invite` Universal Link on a physical device. URL fragments
   must never be included in access logs or copied into query/path parameters.
6. Create the App Store Connect record, privacy URL
   `https://ourphrase.org/privacy/`, TestFlight group, screenshots and
   the “Data Not Collected” privacy response.

The repository intentionally leaves `DEVELOPMENT_TEAM` empty. Signing and a
valid AASA application identifier cannot be completed without the owner’s
Apple Developer Team ID.
