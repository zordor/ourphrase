import CryptoKit
import Foundation
import Security

enum OurPhraseCryptoError: LocalizedError, Equatable {
    case invalidInvite
    case invalidPIN
    case missingDictionary
    case malformedBackup
    case wrongRecoveryPhrase

    var errorDescription: String? {
        switch self {
        case .invalidInvite: "La invitación no es válida."
        case .invalidPIN: "El PIN no coincide."
        case .missingDictionary: "No se pudo cargar el diccionario."
        case .malformedBackup: "El archivo no es una copia válida de OurPhrase."
        case .wrongRecoveryPhrase: "Las palabras no abren esta copia."
        }
    }
}

enum Base64URL {
    static func encode(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    static func decode(_ value: String) throws -> Data {
        var base64 = value.replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        base64 += String(repeating: "=", count: (4 - base64.count % 4) % 4)
        guard let data = Data(base64Encoded: base64) else { throw OurPhraseCryptoError.invalidInvite }
        return data
    }
}

final class CryptoEngine: @unchecked Sendable {
    static let shared = CryptoEngine()
    static let stepSeconds: TimeInterval = 300

    private let encoder: JSONEncoder = {
        let value = JSONEncoder()
        value.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return value
    }()

    func createInvite(profileName: String, language: WordLanguage) throws -> (InvitePayload, String) {
        let pin = securePIN()
        let invite = InvitePayload(
            v: 1,
            n: profileName,
            l: language.rawValue,
            s1: Base64URL.encode(randomData(count: 20)),
            sa: Base64URL.encode(randomData(count: 16)),
            no: Base64URL.encode(randomData(count: 12)),
            c: nil,
            p: nil,
            pin: nil
        )
        return (invite, pin)
    }

    func encodeInvite(_ invite: InvitePayload, pin: String?) throws -> String {
        var encoded = invite
        encoded.pin = nil
        encoded.p = pin
        return Base64URL.encode(try encoder.encode(encoded))
    }

    func decodeInvite(_ encoded: String) throws -> InvitePayload {
        let invite = try JSONDecoder().decode(InvitePayload.self, from: Base64URL.decode(encoded))
        guard invite.v == 1,
              ["es", "en"].contains(invite.l),
              !invite.s1.isEmpty, !invite.sa.isEmpty, !invite.no.isEmpty
        else { throw OurPhraseCryptoError.invalidInvite }
        return invite
    }

    func masterKey(for invite: InvitePayload, pin: String) throws -> Data {
        guard pin.range(of: #"^\d{4}$"#, options: .regularExpression) != nil else {
            throw OurPhraseCryptoError.invalidPIN
        }
        let part1 = try Base64URL.decode(invite.s1)
        let salt = try Base64URL.decode(invite.sa)
        let nonce = try Base64URL.decode(invite.no)
        var message = Data("PPID-pair-v1|".utf8)
        message.append(salt)
        message.append(Data("|".utf8))
        message.append(nonce)
        message.append(Data("|\(pin)".utf8))
        return Data(HMAC<SHA256>.authenticationCode(for: message, using: SymmetricKey(data: part1)))
    }

    func checkByte(for masterKey: Data) -> Int {
        let mac = HMAC<SHA256>.authenticationCode(
            for: Data("PPID-check-v1".utf8),
            using: SymmetricKey(data: masterKey)
        )
        return Int(Array(mac)[0])
    }

    func words(masterKey: Data, date: Date = .now, language: WordLanguage) throws -> [String] {
        let window = Int(floor(date.timeIntervalSince1970 / Self.stepSeconds))
        return try words(masterKey: masterKey, window: window, language: language)
    }

    func previousWords(masterKey: Data, date: Date = .now, language: WordLanguage) throws -> [String] {
        let window = Int(floor(date.timeIntervalSince1970 / Self.stepSeconds)) - 1
        return try words(masterKey: masterKey, window: window, language: language)
    }

    func remaining(at date: Date = .now) -> TimeInterval {
        Self.stepSeconds - date.timeIntervalSince1970.truncatingRemainder(dividingBy: Self.stepSeconds)
    }

    func words(masterKey: Data, window: Int, language: WordLanguage) throws -> [String] {
        let dictionary = try WordDictionaries.words(for: language)
        let indices = wordIndices(masterKey: masterKey, window: window, dictionarySize: dictionary.count)
        return indices.map { dictionary[$0] }
    }

    private func wordIndices(masterKey: Data, window: Int, dictionarySize: Int) -> [Int] {
        let limit = (65_536 / dictionarySize) * dictionarySize
        var selected: [Int] = []
        for block in 0..<16 where selected.count < 2 {
            var message = Data("PPID-words-v1|".utf8)
            var counter = UInt64(window).bigEndian
            Swift.withUnsafeBytes(of: &counter) { message.append(contentsOf: $0) }
            message.append(UInt8(block))
            let mac = Array(HMAC<SHA256>.authenticationCode(
                for: message,
                using: SymmetricKey(data: masterKey)
            ))
            for index in stride(from: 0, to: mac.count - 1, by: 2) where selected.count < 2 {
                let value = Int(mac[index]) << 8 | Int(mac[index + 1])
                guard value < limit else { continue }
                let candidate = value % dictionarySize
                if !selected.contains(candidate) { selected.append(candidate) }
            }
        }
        return selected
    }

    private func securePIN() -> String {
        var value: UInt32 = 0
        let limit = UInt32.max - UInt32.max % 10_000
        repeat { value = UInt32.random(in: .min ... .max) } while value >= limit
        return String(format: "%04d", value % 10_000)
    }

    private func randomData(count: Int) -> Data {
        var bytes = [UInt8](repeating: 0, count: count)
        _ = SecRandomCopyBytes(kSecRandomDefault, count, &bytes)
        return Data(bytes)
    }
}

enum WordDictionaries {
    private static let values: [String: [String]] = {
        guard let url = Bundle.main.url(forResource: "dictionaries", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: [String]].self, from: data)
        else { return [:] }
        return decoded
    }()

    static func words(for language: WordLanguage) throws -> [String] {
        guard let words = values[language.rawValue], !words.isEmpty else {
            throw OurPhraseCryptoError.missingDictionary
        }
        return words
    }
}
