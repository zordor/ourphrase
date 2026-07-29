import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var editedName = ""
    @State private var showBackup = false

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            Form {
                Section("Mi identidad") {
                    TextField("Nombre", text: $editedName)
                        .textContentType(.name)
                        .onSubmit(saveName)
                    Text("Este nombre se muestra al crear una invitación. Los alias de tus conexiones son privados.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section("Seguridad") {
                    Toggle("Proteger con Face ID", isOn: $model.biometricLockEnabled)
                    Text("Las claves siempre se guardan en el Keychain, aunque el bloqueo adicional esté desactivado.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                Section {
                    Button {
                        showBackup = true
                    } label: {
                        Label("Copia y recuperación", systemImage: "externaldrive.badge.icloud")
                    }
                } footer: {
                    if model.backupIsStale {
                        Label("Hay cambios sin copiar", systemImage: "exclamationmark.circle.fill")
                            .foregroundStyle(.orange)
                    }
                }

                Section("Privacidad") {
                    LabeledContent("Cuenta", value: "No necesaria")
                    LabeledContent("Datos recopilados", value: "Ninguno")
                    LabeledContent("Sincronización", value: "Desactivada")
                }

                Section {
                    Link(destination: URL(string: "https://ourphrase.org/privacy/")!) {
                        Label("Política de privacidad", systemImage: "hand.raised")
                    }
                    LabeledContent("Versión", value: appVersion)
                }
            }
            .navigationTitle("Ajustes")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Listo") {
                        saveName()
                        dismiss()
                    }
                }
            }
            .onAppear { editedName = model.profileName }
            .sheet(isPresented: $showBackup) { BackupView() }
        }
    }

    private var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
    }

    private func saveName() {
        let clean = editedName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !clean.isEmpty { model.profileName = clean }
    }
}

struct BackupView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var recoveryPhrase = ""
    @State private var typedPhrase = ""
    @State private var importedDocument: OurPhraseDocument?
    @State private var exportDocument: OurPhraseDocument?
    @State private var showImporter = false
    @State private var showExporter = false
    @State private var showPhrase = false
    @State private var showImportPhrase = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    PremiumCard {
                        VStack(alignment: .leading, spacing: 14) {
                            Label("Tus 20 palabras", systemImage: "key.horizontal.fill")
                                .font(.headline)
                            Text("Son la única forma de abrir una copia. Apúntalas en papel, en orden, y guárdalas lejos del iPhone.")
                                .foregroundStyle(.secondary)
                            Button(showPhrase ? "Ocultar palabras" : "Mostrar palabras") {
                                withAnimation(.easeInOut(duration: 0.2)) { showPhrase.toggle() }
                            }
                            .buttonStyle(.bordered)
                            if showPhrase {
                                RecoveryPhraseGrid(phrase: recoveryPhrase)
                                    .transition(.opacity.combined(with: .move(edge: .top)))
                            }
                        }
                    }

                    PremiumCard {
                        VStack(alignment: .leading, spacing: 14) {
                            Label("Crear copia cifrada", systemImage: "square.and.arrow.up")
                                .font(.headline)
                            Text("Incluye todas tus conexiones y alias. El archivo no se puede abrir sin las 20 palabras.")
                                .foregroundStyle(.secondary)
                            Button("Exportar copia") {
                                Task {
                                    if let data = await model.exportBackup() {
                                        exportDocument = OurPhraseDocument(data: data)
                                        showExporter = true
                                    }
                                }
                            }
                            .buttonStyle(PrimaryButtonStyle())
                        }
                    }

                    PremiumCard {
                        VStack(alignment: .leading, spacing: 14) {
                            Label("Recuperar una copia", systemImage: "arrow.down.doc")
                                .font(.headline)
                            Text("Acepta copias de la PWA y copias nativas de OurPhrase.")
                                .foregroundStyle(.secondary)
                            Button("Elegir archivo") { showImporter = true }
                                .buttonStyle(.bordered)
                        }
                    }
                }
                .frame(maxWidth: 680)
                .padding(20)
                .frame(maxWidth: .infinity)
            }
            .background(OurPhraseTheme.background)
            .navigationTitle("Copia y recuperación")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Listo") { dismiss() }
                }
            }
        }
        .task {
            recoveryPhrase = (try? await model.recoveryPhrase()) ?? ""
        }
        .fileExporter(
            isPresented: $showExporter,
            document: exportDocument,
            contentType: .ourPhraseBackup,
            defaultFilename: "ourphrase-backup.ourphrase"
        ) { _ in exportDocument = nil }
        .fileImporter(
            isPresented: $showImporter,
            allowedContentTypes: OurPhraseDocument.readableContentTypes,
            allowsMultipleSelection: false
        ) { result in
            guard case let .success(urls) = result, let url = urls.first else { return }
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            if let data = try? Data(contentsOf: url) {
                importedDocument = OurPhraseDocument(data: data)
                showImportPhrase = true
            }
        }
        .sheet(isPresented: $showImportPhrase) {
            NavigationStack {
                VStack(alignment: .leading, spacing: 18) {
                    Text("Escribe las 20 palabras de la copia, en orden.")
                        .font(.title2.bold())
                    TextEditor(text: $typedPhrase)
                        .frame(minHeight: 140)
                        .padding(12)
                        .background(.background, in: RoundedRectangle(cornerRadius: 18))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Spacer()
                    Button("Recuperar conexiones") {
                        guard let data = importedDocument?.data else { return }
                        Task {
                            await model.importBackup(file: data, phrase: typedPhrase)
                            if model.presentedError == nil {
                                showImportPhrase = false
                                importedDocument = nil
                                typedPhrase = ""
                            }
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle())
                    .disabled(typedPhrase.split(whereSeparator: \.isWhitespace).isEmpty)
                }
                .padding(24)
                .background(OurPhraseTheme.background)
                .navigationTitle("Abrir copia")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancelar") { showImportPhrase = false }
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
        .overlay {
            if model.isBusy {
                ZStack {
                    Color.black.opacity(0.18).ignoresSafeArea()
                    ProgressView("Protegiendo tus datos…")
                        .padding(24)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
                }
            }
        }
    }
}

private struct RecoveryPhraseGrid: View {
    let phrase: String
    var words: [String] { phrase.split(separator: " ").map(String.init) }

    var body: some View {
        LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 10) {
            ForEach(Array(words.enumerated()), id: \.offset) { index, word in
                HStack {
                    Text("\(index + 1).")
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                    Text(word).fontWeight(.semibold)
                    Spacer()
                }
            }
        }
        .padding(16)
        .background(OurPhraseTheme.blue.opacity(0.08), in: RoundedRectangle(cornerRadius: 18))
        .privacySensitive()
        .accessibilityElement(children: .combine)
    }
}
