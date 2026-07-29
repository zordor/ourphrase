import Foundation

enum WordLanguage: String, Codable, CaseIterable, Identifiable {
    case es, en
    var id: String { rawValue }
    var label: String { self == .es ? "Español" : "English" }
}

struct InvitePayload: Codable, Equatable, Sendable {
    let v: Int
    var n: String?
    let l: String
    let s1: String
    let sa: String
    let no: String
    var c: Int?
    var p: String?
    var pin: String? = nil

    enum CodingKeys: String, CodingKey {
        case v, n, l, s1, sa, no, c, p, pin
    }
}

struct PendingConnection: Identifiable, Sendable {
    let id = UUID()
    let invite: InvitePayload
    let masterKey: Data
    let suggestedAlias: String
}


struct LegacyContact: Codable {
    let id: String?
    let name: String
    let lang: String
    let key: String
    let invite: InvitePayload
    let hue: Int?
    let created: Double?
}

struct BackupPayloadV1: Codable {
    let v: Int
    let exported: Double?
    let contacts: [LegacyContact]
}

struct BackupConnectionV2: Codable {
    let pairingID: String
    let alias: String
    let language: String
    let key: String
    let invite: InvitePayload
    let hue: Int
    let createdAt: Date
}

struct BackupPayloadV2: Codable {
    let v: Int
    let exportedAt: Date
    let profileName: String
    let connections: [BackupConnectionV2]
}
