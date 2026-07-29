import XCTest
@testable import OurPhrase

final class VaultCompatibilityTests: XCTestCase {
    func testImportsPWAEnvelopeV1() async throws {
        let legacy = #"{"app":"passphrase","v":1,"it":310000,"salt":"cJavXXxdcYcCR9gSDvzvFg","iv":"AjNdgrMSE0sX_RB5","data":"UBxqKcWUc7PjUmYAshyKkN0KUIJEM_pn6n1958FYZkQ0S6-TzEVrt4xVpw8x5pF-Li8"}"#
        let phrase = "gato perro sol luna nube casa barco tren mesa silla reloj libro flor queso pan cafe taza llave piedra bosque"
        let (envelope, plaintext) = try await VaultService.shared.decryptPayload(
            Data(legacy.utf8),
            recoveryPhrase: phrase
        )
        XCTAssertEqual(envelope.v, 1)
        let payload = try JSONDecoder.passPhrase.decode(BackupPayloadV1.self, from: plaintext)
        XCTAssertTrue(payload.contacts.isEmpty)
    }

    func testRejectsWrongRecoveryPhrase() async throws {
        let data = try await VaultService.shared.encrypt(
            BackupPayloadV2(v: 2, exportedAt: .now, profileName: "Ro", connections: []),
            recoveryPhrase: "gato perro sol luna"
        )
        do {
            _ = try await VaultService.shared.decryptPayload(data, recoveryPhrase: "gato perro sol nube")
            XCTFail("Expected authenticated decryption to fail")
        } catch {
            XCTAssertEqual(error as? OurPhraseCryptoError, .wrongRecoveryPhrase)
        }
    }
}

