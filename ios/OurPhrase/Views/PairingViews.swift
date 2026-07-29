import SwiftUI

struct CreateConnectionView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var language: WordLanguage = .es

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 24) {
                Text("La otra persona escaneará tu código y cada uno decidirá en privado cómo guardar la conexión.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                    .lineSpacing(4)

                Picker("Idioma de las palabras", selection: $language) {
                    ForEach(WordLanguage.allCases) { language in
                        Text(language.label).tag(language)
                    }
                }
                .pickerStyle(.segmented)

                Spacer()

                Button("Crear código") {
                    dismiss()
                    Task { await model.beginCreating(language: language) }
                }
                .buttonStyle(PrimaryButtonStyle())
            }
            .padding(24)
            .background(OurPhraseTheme.background)
            .navigationTitle("Nueva conexión")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

struct PairingCodeView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let outbound: OutboundInvite

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 22) {
                    Text("Que abra OurPhrase y escanee este código")
                        .font(.title2.bold())
                        .multilineTextAlignment(.center)

                    if let qr = QRCodeGenerator.image(for: outbound.qrURL.absoluteString) {
                        qr
                            .interpolation(.none)
                            .resizable()
                            .scaledToFit()
                            .padding(18)
                            .background(.white, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
                            .shadow(color: .black.opacity(0.08), radius: 24, y: 10)
                            .frame(maxWidth: 360)
                            .accessibilityLabel("Código QR de conexión")
                    }

                    Text("El código contiene el secreto necesario para conectar. Muéstralo solo a la persona adecuada.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 380)

                    PremiumCard {
                        VStack(spacing: 14) {
                            Text("¿No estáis juntos?")
                                .font(.headline)
                            ShareLink(item: outbound.remoteURL) {
                                Label("Enviar invitación", systemImage: "square.and.arrow.up")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            Text(outbound.pin)
                                .font(.system(size: 42, weight: .bold, design: .rounded))
                                .tracking(10)
                                .accessibilityLabel("PIN \(outbound.pin.map(String.init).joined(separator: " "))")
                            Text("Dile este PIN por voz. No lo envíes en el mismo mensaje.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        .frame(maxWidth: .infinity)
                    }

                    Button("Ya lo ha escaneado") {
                        dismiss()
                        model.finishOutboundPairing()
                    }
                    .buttonStyle(PrimaryButtonStyle())
                }
                .frame(maxWidth: 560)
                .padding(24)
                .frame(maxWidth: .infinity)
            }
            .background(OurPhraseTheme.background)
            .navigationTitle("Conectar")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
    }
}

struct AliasView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let pending: PendingConnection
    @State private var alias = ""

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 18) {
                if let identity = pending.invite.n, !identity.isEmpty {
                    Text("\(identity) quiere conectar contigo.")
                        .font(.title2.bold())
                }
                Text("¿Cómo quieres guardar esta conexión?")
                    .font(.headline)
                    .foregroundStyle(.secondary)
                TextField("Nombre privado", text: $alias)
                    .font(.title2.weight(.semibold))
                    .padding(18)
                    .background(.background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .textInputAutocapitalization(.words)
                    .submitLabel(.done)
                Text("Este nombre solo se guarda en tu dispositivo.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Guardar y conectar") {
                    Task {
                        await model.savePending(alias: alias)
                        dismiss()
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(alias.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
            .padding(24)
            .background(OurPhraseTheme.background)
            .navigationTitle("Guardar conexión")
            .navigationBarTitleDisplayMode(.inline)
        }
        .interactiveDismissDisabled()
        .onAppear { alias = pending.suggestedAlias }
        .presentationDetents([.medium])
    }
}

struct RemotePINView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let invite: InvitePayload
    @State private var pin = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 22) {
                Text("\(invite.n ?? "Alguien") quiere conectar contigo")
                    .font(.title2.bold())
                    .multilineTextAlignment(.center)
                Text("Escribe el PIN de cuatro cifras que te ha dicho por voz.")
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                TextField("0000", text: $pin)
                    .keyboardType(.numberPad)
                    .font(.system(size: 46, weight: .bold, design: .rounded))
                    .multilineTextAlignment(.center)
                    .tracking(12)
                    .onChange(of: pin) { _, value in
                        pin = String(value.filter(\.isNumber).prefix(4))
                    }
                Spacer()
                Button("Conectar") {
                    Task {
                        await model.submitRemotePIN(pin)
                        if model.remoteInviteAwaitingPIN == nil { dismiss() }
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .disabled(pin.count != 4)
            }
            .padding(24)
            .background(OurPhraseTheme.background)
            .navigationTitle("Introducir PIN")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") {
                        model.remoteInviteAwaitingPIN = nil
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

