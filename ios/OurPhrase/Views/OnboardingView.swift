import LocalAuthentication
import SwiftUI

struct OnboardingView: View {
    @Environment(AppModel.self) private var model
    @State private var page = 0
    @State private var name = ""
    @State private var useBiometrics = false

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $page) {
                welcome.tag(0)
                identity.tag(1)
                privacy.tag(2)
            }
            .tabViewStyle(.page(indexDisplayMode: .always))
            .indexViewStyle(.page(backgroundDisplayMode: .interactive))

            Button(page == 2 ? "Empezar" : "Continuar") {
                if page < 2 {
                    withAnimation { page += 1 }
                } else {
                    model.profileName = name.trimmingCharacters(in: .whitespacesAndNewlines)
                    model.biometricLockEnabled = useBiometrics
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                }
            }
            .buttonStyle(PrimaryButtonStyle())
            .disabled(page == 1 && name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .padding(.horizontal, 24)
            .padding(.bottom, 20)
        }
        .background(OurPhraseTheme.background)
    }

    private var welcome: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "person.2.wave.2.fill")
                .font(.system(size: 74))
                .symbolRenderingMode(.palette)
                .foregroundStyle(OurPhraseTheme.blue, OurPhraseTheme.blue.opacity(0.22))
            Text("Sabrás que sois vosotros")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .multilineTextAlignment(.center)
            Text("Dos palabras compartidas que cambian cada cinco minutos. Sin cuentas, sin servidores y sin rastreo.")
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .lineSpacing(4)
            Spacer()
        }
        .padding(30)
    }

    private var identity: some View {
        VStack(alignment: .leading, spacing: 24) {
            Spacer()
            Text("¿Quién eres?")
                .font(.system(size: 36, weight: .bold, design: .rounded))
            Text("Este nombre te presenta al conectar. Cada persona decidirá después cómo guardarte.")
                .font(.title3)
                .foregroundStyle(.secondary)
            TextField("Tu nombre", text: $name)
                .textContentType(.name)
                .font(.title2.weight(.semibold))
                .padding(18)
                .background(.background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .submitLabel(.continue)
                .onSubmit { if !name.isEmpty { withAnimation { page = 2 } } }
            Spacer()
        }
        .padding(30)
    }

    private var privacy: some View {
        VStack(alignment: .leading, spacing: 24) {
            Spacer()
            Image(systemName: "lock.shield.fill")
                .font(.system(size: 64))
                .foregroundStyle(OurPhraseTheme.blue)
            Text("Solo tuyo")
                .font(.system(size: 36, weight: .bold, design: .rounded))
            Text("Tus claves viven en el Keychain de este dispositivo. OurPhrase no puede verlas ni recuperarlas por internet.")
                .font(.title3)
                .foregroundStyle(.secondary)
                .lineSpacing(4)
            Toggle(isOn: $useBiometrics) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Proteger con Face ID").font(.headline)
                    Text("Puedes cambiarlo más tarde en Ajustes.").font(.subheadline).foregroundStyle(.secondary)
                }
            }
            .padding(18)
            .background(.background, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            Spacer()
        }
        .padding(30)
    }
}

