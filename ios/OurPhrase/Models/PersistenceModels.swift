import Foundation
import SwiftData

@Model
final class Connection {
    @Attribute(.unique) var pairingID: String
    var alias: String
    var languageCode: String
    var keyReference: String
    var inviteData: Data
    var hue: Int
    var createdAt: Date

    init(
        pairingID: String,
        alias: String,
        languageCode: String,
        keyReference: String,
        inviteData: Data,
        hue: Int,
        createdAt: Date = .now
    ) {
        self.pairingID = pairingID
        self.alias = alias
        self.languageCode = languageCode
        self.keyReference = keyReference
        self.inviteData = inviteData
        self.hue = hue
        self.createdAt = createdAt
    }

    var language: WordLanguage { WordLanguage(rawValue: languageCode) ?? .es }
    var invite: InvitePayload? {
        try? JSONDecoder.passPhrase.decode(InvitePayload.self, from: inviteData)
    }
}
