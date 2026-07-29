import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var showCreate = false
    @State private var showScanner = false
    @State private var showSettings = false

    var body: some View {
        @Bindable var model = model
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    if model.connections.isEmpty {
                        emptyState
                    } else {
                        connectionList
                    }
                }
                .frame(maxWidth: 680)
                .padding(.horizontal, 20)
                .padding(.bottom, 120)
                .frame(maxWidth: .infinity)
            }
            .background(OurPhraseTheme.background)
            .navigationTitle("OurPhrase")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showSettings = true } label: {
                        Image(systemName: "person.crop.circle")
                    }
                    .accessibilityLabel("Perfil y ajustes")
                }
            }
            .safeAreaInset(edge: .bottom) {
                HStack(spacing: 12) {
                    Button { showCreate = true } label: {
                        Label("Mi código", systemImage: "qrcode")
                    }
                    .buttonStyle(PrimaryButtonStyle())

                    Button { showScanner = true } label: {
                        Image(systemName: "qrcode.viewfinder")
                            .font(.title2.weight(.semibold))
                            .frame(width: 58, height: 56)
                            .background(.background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    }
                    .accessibilityLabel("Escanear código")
                }
                .frame(maxWidth: 680)
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(.ultraThinMaterial)
            }
        }
        .sheet(isPresented: $showCreate) { CreateConnectionView() }
        .fullScreenCover(isPresented: $showScanner) {
            ScannerView(onScan: { value in
                showScanner = false
                Task { await model.receive(scannedValue: value) }
            })
        }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .sheet(item: $model.outboundInvite) { PairingCodeView(outbound: $0) }
        .sheet(item: $model.pendingConnection) { AliasView(pending: $0) }
        .sheet(item: $model.remoteInviteAwaitingPIN) { RemotePINView(invite: $0) }
        .fullScreenCover(item: $model.selectedConnection) { VerifyView(connection: $0) }
    }

    private var emptyState: some View {
        VStack(spacing: 22) {
            Spacer(minLength: 70)
            EmptyArtwork()
            Text("Palabras secretas compartidas")
                .font(.system(size: 26, weight: .bold, design: .rounded))
                .multilineTextAlignment(.center)
            Text("Conecta con alguien de confianza. Si vuestras palabras coinciden, sabéis que sois vosotros.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .lineSpacing(3)
                .frame(maxWidth: 360)
            Spacer()
        }
    }

    private var connectionList: some View {
        LazyVStack(spacing: 12) {
            ForEach(model.connections) { connection in
                Button { model.selectedConnection = connection } label: {
                    HStack(spacing: 16) {
                        Circle()
                            .fill(OurPhraseTheme.accent(hue: connection.hue))
                            .frame(width: 14, height: 14)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(connection.alias)
                                .font(.title3.weight(.semibold))
                                .foregroundStyle(.primary)
                            Text(connection.language.label)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(18)
                    .background(.background, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityHint("Muestra las palabras compartidas")
            }
        }
    }
}

extension InvitePayload: Identifiable {
    var id: String { s1 }
}
