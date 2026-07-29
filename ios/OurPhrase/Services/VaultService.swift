import CryptoKit
import Foundation
import Security

struct VaultEnvelope: Codable {
    let app: String
    let v: Int
    let it: Int
    let salt: String
    let iv: String
    let data: String
}

actor VaultService {
    static let shared = VaultService()
    static let iterations = 310_000

    func encrypt<T: Encodable>(_ payload: T, recoveryPhrase: String, version: Int = 2) throws -> Data {
        let salt = randomData(count: 16)
        let nonceData = randomData(count: 12)
        let key = SymmetricKey(data: pbkdf2(
            password: Data(normalize(recoveryPhrase).utf8),
            salt: salt,
            iterations: Self.iterations,
            keyLength: 32
        ))
        let nonce = try AES.GCM.Nonce(data: nonceData)
        let plaintext = try JSONEncoder.passPhrase.encode(payload)
        let box = try AES.GCM.seal(plaintext, using: key, nonce: nonce)
        var encrypted = box.ciphertext
        encrypted.append(box.tag)
        let envelope = VaultEnvelope(
            app: "passphrase",
            v: version,
            it: Self.iterations,
            salt: Base64URL.encode(salt),
            iv: Base64URL.encode(nonceData),
            data: Base64URL.encode(encrypted)
        )
        return try JSONEncoder.passPhrase.encode(envelope)
    }

    func decryptPayload(_ file: Data, recoveryPhrase: String) throws -> (VaultEnvelope, Data) {
        guard let envelope = try? JSONDecoder.passPhrase.decode(VaultEnvelope.self, from: file),
              envelope.app == "passphrase",
              [1, 2].contains(envelope.v),
              envelope.it >= 100_000
        else { throw OurPhraseCryptoError.malformedBackup }

        do {
            let salt = try Base64URL.decode(envelope.salt)
            let nonceData = try Base64URL.decode(envelope.iv)
            let combined = try Base64URL.decode(envelope.data)
            guard combined.count > 16 else { throw OurPhraseCryptoError.malformedBackup }
            let ciphertext = combined.dropLast(16)
            let tag = combined.suffix(16)
            let key = SymmetricKey(data: pbkdf2(
                password: Data(normalize(recoveryPhrase).utf8),
                salt: salt,
                iterations: envelope.it,
                keyLength: 32
            ))
            let box = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: nonceData),
                ciphertext: ciphertext,
                tag: tag
            )
            return (envelope, try AES.GCM.open(box, using: key))
        } catch let error as OurPhraseCryptoError {
            throw error
        } catch {
            throw OurPhraseCryptoError.wrongRecoveryPhrase
        }
    }

    func generateRecoveryPhrase(language: WordLanguage, count: Int = 20) throws -> String {
        let words = try WordDictionaries.words(for: language)
        return (0..<count).map { _ in words.randomElement()! }.joined(separator: " ")
    }

    func normalize(_ value: String) -> String {
        value.lowercased()
            .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "en_US_POSIX"))
            .components(separatedBy: CharacterSet.letters.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }

    private func pbkdf2(password: Data, salt: Data, iterations: Int, keyLength: Int) -> Data {
        let blockCount = Int(ceil(Double(keyLength) / Double(SHA256.Digest.byteCount)))
        var output = Data()
        let key = SymmetricKey(data: password)
        for block in 1...blockCount {
            var input = salt
            var bigEndian = UInt32(block).bigEndian
            Swift.withUnsafeBytes(of: &bigEndian) { input.append(contentsOf: $0) }
            var u = Data(HMAC<SHA256>.authenticationCode(for: input, using: key))
            var accumulator = u
            if iterations > 1 {
                for _ in 2...iterations {
                    u = Data(HMAC<SHA256>.authenticationCode(for: u, using: key))
                    for index in accumulator.indices { accumulator[index] ^= u[index] }
                }
            }
            output.append(accumulator)
        }
        return output.prefix(keyLength)
    }

    private func randomData(count: Int) -> Data {
        var bytes = [UInt8](repeating: 0, count: count)
        _ = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        return Data(bytes)
    }
}

extension JSONEncoder {
    static let passPhrase: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return encoder
    }()
}

extension JSONDecoder {
    static let passPhrase: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()
}
