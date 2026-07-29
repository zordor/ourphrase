import XCTest
@testable import OurPhrase

final class CryptoCompatibilityTests: XCTestCase {
    func testPWACompatibilityVector() throws {
        let invite = InvitePayload(
            v: 1,
            n: "Hiro",
            l: "es",
            s1: "AAECAwQFBgcICQoLDA0ODxAREhM",
            sa: "EBESExQVFhcYGRobHB0eHw",
            no: "ICEiIyQlJicoKSor",
            c: nil,
            p: nil,
            pin: nil
        )
        let key = try CryptoEngine.shared.masterKey(for: invite, pin: "0427")
        XCTAssertEqual(Base64URL.encode(key), "50FDJpOAYFoQgeYLW20xktKShfVrfe-zvuNe6TmB5Bo")
        XCTAssertEqual(
            try CryptoEngine.shared.words(masterKey: key, window: 1_234_567, language: .es),
            ["gafas", "fantasma"]
        )
    }

    func testInviteRoundTripKeepsPINOutOfRemoteLink() throws {
        let (invite, pin) = try CryptoEngine.shared.createInvite(profileName: "Ro", language: .en)
        let remote = try CryptoEngine.shared.encodeInvite(invite, pin: nil)
        let nearby = try CryptoEngine.shared.encodeInvite(invite, pin: pin)
        XCTAssertNil(try CryptoEngine.shared.decodeInvite(remote).p)
        XCTAssertEqual(try CryptoEngine.shared.decodeInvite(nearby).p, pin)
    }

    func testWrongPINFailsChecksum() throws {
        var (invite, pin) = try CryptoEngine.shared.createInvite(profileName: "Ro", language: .es)
        let key = try CryptoEngine.shared.masterKey(for: invite, pin: pin)
        invite.c = CryptoEngine.shared.checkByte(for: key)
        var foundDifferentChecksum = false
        for candidate in ["0000", "0001", "0002", "0003"] where candidate != pin {
            let wrong = try CryptoEngine.shared.masterKey(for: invite, pin: candidate)
            if CryptoEngine.shared.checkByte(for: wrong) != invite.c {
                foundDifferentChecksum = true
                break
            }
        }
        XCTAssertTrue(foundDifferentChecksum)
    }
}
