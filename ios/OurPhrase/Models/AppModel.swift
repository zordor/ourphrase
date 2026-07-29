import Foundation
import LocalAuthentication
import Observation
import SwiftData
import SwiftUI

struct OutboundInvite: Identifiable {
    let id = UUID()
    let invite: InvitePayload
    let pin: String
    let masterKey: Data
    let qrURL: URL
    let remoteURL: URL
}

@MainActor
@Observable
final class AppModel {
    var connections: [Connection] = []
    var selectedConnection: Connection?
    var outboundInvite: OutboundInvite?
    var pendingConnection: PendingConnection?
    var remoteInviteAwaitingPIN: InvitePayload?
    var presentedError: String?
    var isLocked = false
    var isBusy = false
    var backupIsStale = false

    var profileName: String {
        didSet { UserDefaults.standard.set(profileName, forKey: "profileName") }
    }

    var biometricLockEnabled: Bool {
        didSet { UserDefaults.standard.set(biometricLockEnabled, forKey: "biometricLockEnabled") }
    }

    private var context: ModelContext?
    private var backgroundedAt: Date?

    init() {
        profileName = UserDefaults.standard.string(forKey: "profileName") ?? ""
        biometricLockEnabled = UserDefaults.standard.bool(forKey: "biometricLockEnabled")
    }

    func configure(context: ModelContext) {
        guard self.context == nil else { return }
        self.context = context
        reload()
    }

    func reload() {
        guard let context else { return }
        let descriptor = FetchDescriptor<Connection>(
            sortBy: [SortDescriptor(\.createdAt, order: .reverse)]
        )
        connections = (try? context.fetch(descriptor)) ?? []
    }

    func beginCreating(language: WordLanguage) async {
        guard !profileName.isEmpty else { return }
        do {
            var (invite, pin) = try await CryptoEngine.shared.createInvite(
                profileName: profileName,
                language: language
            )
            let masterKey = try await CryptoEngine.shared.masterKey(for: invite, pin: pin)
            invite.c = await CryptoEngine.shared.checkByte(for: masterKey)
            let full = try await CryptoEngine.shared.encodeInvite(invite, pin: pin)
            let remote = try await CryptoEngine.shared.encodeInvite(invite, pin: nil)
            guard let qrURL = URL(string: "https://ourphrase.org/invite#i=\(full)"),
                  let remoteURL = URL(string: "https://ourphrase.org/invite#i=\(remote)")
            else { throw OurPhraseCryptoError.invalidInvite }
            outboundInvite = OutboundInvite(
                invite: invite,
                pin: pin,
                masterKey: masterKey,
                qrURL: qrURL,
                remoteURL: remoteURL
            )
        } catch {
            presentedError = error.localizedDescription
        }
    }

    func finishOutboundPairing() {
        guard let outboundInvite else { return }
        var storedInvite = outboundInvite.invite
        storedInvite.p = outboundInvite.pin
        pendingConnection = PendingConnection(
            invite: storedInvite,
            masterKey: outboundInvite.masterKey,
            suggestedAlias: ""
        )
        self.outboundInvite = nil
    }

    func beginResharing(_ connection: Connection) async {
        guard var invite = connection.invite,
              let pin = invite.p ?? invite.pin,
              let masterKey = await masterKey(for: connection)
        else {
            presentedError = String(localized: "Esta conexión antigua no conserva su PIN. Crea una conexión nueva.")
            return
        }
        do {
            invite.n = profileName
            let full = try await CryptoEngine.shared.encodeInvite(invite, pin: pin)
            let remote = try await CryptoEngine.shared.encodeInvite(invite, pin: nil)
            guard let qrURL = URL(string: "https://ourphrase.org/invite#i=\(full)"),
                  let remoteURL = URL(string: "https://ourphrase.org/invite#i=\(remote)")
            else { throw OurPhraseCryptoError.invalidInvite }
            outboundInvite = OutboundInvite(
                invite: invite,
                pin: pin,
                masterKey: masterKey,
                qrURL: qrURL,
                remoteURL: remoteURL
            )
            selectedConnection = nil
        } catch {
            presentedError = error.localizedDescription
        }
    }

    func receive(scannedValue: String) async {
        do {
            let invite = try await decodeInvite(from: scannedValue)
            if connections.contains(where: { $0.pairingID == pairingID(for: invite) }) {
                presentedError = String(localized: "Esta conexión ya existe.")
                return
            }
            if let pin = invite.p {
                try await preparePending(invite: invite, pin: pin)
            } else {
                remoteInviteAwaitingPIN = invite
            }
        } catch {
            presentedError = error.localizedDescription
        }
    }

    func submitRemotePIN(_ pin: String) async {
        guard let invite = remoteInviteAwaitingPIN else { return }
        do {
            try await preparePending(invite: invite, pin: pin)
            remoteInviteAwaitingPIN = nil
        } catch {
            presentedError = error.localizedDescription
        }
    }

    func savePending(alias: String) async {
        guard let pendingConnection, let context else { return }
        let cleanAlias = alias.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanAlias.isEmpty else { return }
        let reference = "connection.\(pairingID(for: pendingConnection.invite))"
        do {
            try await KeychainStore.shared.save(pendingConnection.masterKey, account: reference)
            let data = try JSONEncoder.passPhrase.encode(pendingConnection.invite)
            let hue = hue(for: pendingConnection.masterKey)
            let connection = Connection(
                pairingID: pairingID(for: pendingConnection.invite),
                alias: cleanAlias,
                languageCode: pendingConnection.invite.l,
                keyReference: reference,
                inviteData: data,
                hue: hue
            )
            context.insert(connection)
            try context.save()
            backupIsStale = true
            self.pendingConnection = nil
            reload()
            selectedConnection = connection
        } catch {
            try? await KeychainStore.shared.delete(account: reference)
            presentedError = error.localizedDescription
        }
    }

    func delete(_ connection: Connection) async {
        guard let context else { return }
        do {
            context.delete(connection)
            try context.save()
            try? await KeychainStore.shared.delete(account: connection.keyReference)
            selectedConnection = nil
            backupIsStale = true
            reload()
        } catch {
            presentedError = error.localizedDescription
        }
    }

    func masterKey(for connection: Connection) async -> Data? {
        do { return try await KeychainStore.shared.read(account: connection.keyReference) }
        catch {
            presentedError = error.localizedDescription
            return nil
        }
    }

    func exportBackup() async -> Data? {
        isBusy = true
        defer { isBusy = false }
        do {
            let phrase = try await recoveryPhrase()
            var records: [BackupConnectionV2] = []
            for connection in connections {
                guard let key = try await KeychainStore.shared.read(account: connection.keyReference),
                      let invite = connection.invite
                else { continue }
                records.append(BackupConnectionV2(
                    pairingID: connection.pairingID,
                    alias: connection.alias,
                    language: connection.languageCode,
                    key: Base64URL.encode(key),
                    invite: invite,
                    hue: connection.hue,
                    createdAt: connection.createdAt
                ))
            }
            let payload = BackupPayloadV2(
                v: 2,
                exportedAt: .now,
                profileName: profileName,
                connections: records
            )
            let file = try await VaultService.shared.encrypt(payload, recoveryPhrase: phrase)
            backupIsStale = false
            return file
        } catch {
            presentedError = error.localizedDescription
            return nil
        }
    }

    func importBackup(file: Data, phrase: String) async {
        guard let context else { return }
        isBusy = true
        defer { isBusy = false }
        var writtenReferences: [String] = []
        do {
            let (envelope, plaintext) = try await VaultService.shared.decryptPayload(
                file,
                recoveryPhrase: phrase
            )
            var candidates: [BackupConnectionV2]
            var importedProfile: String?
            if envelope.v == 1 {
                let legacy = try JSONDecoder.passPhrase.decode(BackupPayloadV1.self, from: plaintext)
                candidates = legacy.contacts.map {
                    var normalizedInvite = $0.invite
                    normalizedInvite.p = normalizedInvite.p ?? normalizedInvite.pin
                    normalizedInvite.pin = nil
                    return BackupConnectionV2(
                        pairingID: $0.invite.s1.prefix(12).description,
                        alias: $0.name,
                        language: $0.lang,
                        key: $0.key,
                        invite: normalizedInvite,
                        hue: $0.hue ?? 210,
                        createdAt: $0.created.map { Date(timeIntervalSince1970: $0 / 1000) } ?? .now
                    )
                }
            } else {
                let native = try JSONDecoder.passPhrase.decode(BackupPayloadV2.self, from: plaintext)
                candidates = native.connections
                importedProfile = native.profileName
            }

            let existing = Set(connections.map(\.pairingID))
            let additions = candidates.filter { !existing.contains($0.pairingID) }
            for record in additions {
                _ = try Base64URL.decode(record.key)
                _ = try JSONEncoder.passPhrase.encode(record.invite)
            }
            for record in additions {
                let reference = "connection.\(record.pairingID)"
                try await KeychainStore.shared.save(try Base64URL.decode(record.key), account: reference)
                writtenReferences.append(reference)
                context.insert(Connection(
                    pairingID: record.pairingID,
                    alias: record.alias,
                    languageCode: record.language,
                    keyReference: reference,
                    inviteData: try JSONEncoder.passPhrase.encode(record.invite),
                    hue: record.hue,
                    createdAt: record.createdAt
                ))
            }
            if profileName.isEmpty, let importedProfile, !importedProfile.isEmpty {
                profileName = importedProfile
            }
            try context.save()
            try await KeychainStore.shared.save(Data(phrase.utf8), account: "recoveryPhrase")
            reload()
            backupIsStale = false
        } catch {
            context.rollback()
            for reference in writtenReferences {
                try? await KeychainStore.shared.delete(account: reference)
            }
            presentedError = error.localizedDescription
        }
    }

    func recoveryPhrase() async throws -> String {
        if let stored = try await KeychainStore.shared.read(account: "recoveryPhrase"),
           let phrase = String(data: stored, encoding: .utf8) {
            return phrase
        }
        let phrase = try await VaultService.shared.generateRecoveryPhrase(language: .es)
        try await KeychainStore.shared.save(Data(phrase.utf8), account: "recoveryPhrase")
        return phrase
    }

    func sceneDidBackground() {
        backgroundedAt = .now
        if biometricLockEnabled { isLocked = true }
    }

    func sceneDidActivate() async {
        guard biometricLockEnabled, isLocked else { return }
        if let backgroundedAt, Date().timeIntervalSince(backgroundedAt) < 30 {
            isLocked = false
            return
        }
        await unlock()
    }

    func unlock() async {
        let context = LAContext()
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: String(localized: "Desbloquear tus conexiones de OurPhrase")
            )
            isLocked = !success
        } catch {
            isLocked = true
        }
    }

    private func decodeInvite(from value: String) async throws -> InvitePayload {
        let raw: String
        if let marker = value.range(of: "#i=") {
            raw = String(value[marker.upperBound...])
        } else {
            raw = value
        }
        return try await CryptoEngine.shared.decodeInvite(raw)
    }

    private func preparePending(invite: InvitePayload, pin: String) async throws {
        let key = try await CryptoEngine.shared.masterKey(for: invite, pin: pin)
        if let expected = invite.c,
           await CryptoEngine.shared.checkByte(for: key) != expected {
            throw OurPhraseCryptoError.invalidPIN
        }
        var storedInvite = invite
        storedInvite.p = pin
        pendingConnection = PendingConnection(
            invite: storedInvite,
            masterKey: key,
            suggestedAlias: invite.n ?? ""
        )
    }

    private func pairingID(for invite: InvitePayload) -> String {
        String(invite.s1.prefix(12))
    }

    private func hue(for key: Data) -> Int {
        guard key.count > 1 else { return 210 }
        return (Int(key[key.startIndex]) << 8 | Int(key[key.index(after: key.startIndex)])) % 360
    }
}
