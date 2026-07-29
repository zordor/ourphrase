import SwiftUI

struct VerifyView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    let connection: Connection
    @State private var masterKey: Data?
    @State private var showDeleteConfirmation = false

    var body: some View {
        NavigationStack {
            TimelineView(.animation(minimumInterval: 0.5, paused: masterKey == nil)) { context in
                verificationContent(at: context.date)
            }
            .background(OurPhraseTheme.background)
            .navigationTitle(connection.alias)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") {
                        model.selectedConnection = nil
                        dismiss()
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            Task {
                                dismiss()
                                await model.beginResharing(connection)
                            }
                        } label: {
                            Label("Invitar de nuevo", systemImage: "qrcode")
                        }
                        Button(role: .destructive) {
                            showDeleteConfirmation = true
                        } label: {
                            Label("Eliminar conexión", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .task { masterKey = await model.masterKey(for: connection) }
        .confirmationDialog(
            "¿Eliminar \(connection.alias)?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Eliminar conexión", role: .destructive) {
                Task {
                    await model.delete(connection)
                    dismiss()
                }
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Para verificaros otra vez tendréis que crear una conexión nueva.")
        }
    }

    @ViewBuilder
    private func verificationContent(at date: Date) -> some View {
        if let masterKey {
            let snapshot = snapshot(masterKey: masterKey, date: date)
            VStack(spacing: 30) {
                Spacer()
                VStack(spacing: 4) {
                    ForEach(snapshot.words, id: \.self) { word in
                        Text(word.uppercased())
                            .font(.system(size: 52, weight: .bold, design: .rounded))
                            .minimumScaleFactor(0.55)
                            .lineLimit(1)
                            .foregroundStyle(
                                word == snapshot.words.first
                                    ? OurPhraseTheme.accent(hue: connection.hue)
                                    : .primary
                            )
                            .contentTransition(.numericText())
                    }
                }
                .privacySensitive()
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Palabras: \(snapshot.words.joined(separator: ", "))")

                ZStack {
                    Circle().stroke(OurPhraseTheme.accent(hue: connection.hue).opacity(0.14), lineWidth: 6)
                    Circle()
                        .trim(from: 0, to: snapshot.progress)
                        .stroke(
                            OurPhraseTheme.accent(hue: connection.hue),
                            style: StrokeStyle(lineWidth: 6, lineCap: .round)
                        )
                        .rotationEffect(.degrees(-90))
                    Text(snapshot.time)
                        .font(.system(.body, design: .rounded, weight: .semibold))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                .frame(width: 84, height: 84)
                .accessibilityLabel("Cambian en \(snapshot.time)")

                if snapshot.showPrevious {
                    Text("Hace un momento: \(snapshot.previous.joined(separator: " · ").uppercased())")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .privacySensitive()
                }

                Text("Decíos las palabras. Si coinciden, sois vosotros.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Spacer()
            }
            .padding(24)
            .frame(maxWidth: 680)
            .frame(maxWidth: .infinity)
        } else {
            ProgressView("Abriendo conexión…")
        }
    }

    private func snapshot(masterKey: Data, date: Date) -> (
        words: [String], previous: [String], progress: Double, time: String, showPrevious: Bool
    ) {
        let words = (try? CryptoEngine.shared.words(
            masterKey: masterKey,
            date: date,
            language: connection.language
        )) ?? []
        let previous = (try? CryptoEngine.shared.previousWords(
            masterKey: masterKey,
            date: date,
            language: connection.language
        )) ?? []
        let remaining = CryptoEngine.shared.remaining(at: date)
        let seconds = max(0, Int(ceil(remaining)))
        return (
            words,
            previous,
            remaining / CryptoEngine.stepSeconds,
            "\(seconds / 60):\(String(format: "%02d", seconds % 60))",
            CryptoEngine.stepSeconds - remaining < 60
        )
    }
}
