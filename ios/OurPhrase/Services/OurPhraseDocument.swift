import SwiftUI
import UniformTypeIdentifiers

extension UTType {
    static let ourPhraseBackup = UTType(exportedAs: "org.ourphrase.backup")
}

struct OurPhraseDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.ourPhraseBackup, .json, .plainText] }
    var data: Data

    init(data: Data = Data()) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else {
            throw CocoaError(.fileReadCorruptFile)
        }
        self.data = data
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}
