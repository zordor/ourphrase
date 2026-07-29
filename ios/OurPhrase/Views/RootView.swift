import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ZStack {
            if model.profileName.isEmpty {
                OnboardingView()
                    .transition(.opacity.combined(with: .scale(scale: 0.98)))
            } else {
                HomeView()
            }

            if model.isLocked {
                PrivacyShieldView()
                    .transition(.opacity)
                    .onTapGesture { Task { await model.unlock() } }
            }
        }
        .animation(.easeInOut(duration: 0.25), value: model.profileName.isEmpty)
        .alert(
            "No se pudo completar",
            isPresented: Binding(
                get: { model.presentedError != nil },
                set: { if !$0 { model.presentedError = nil } }
            )
        ) {
            Button("Aceptar", role: .cancel) { model.presentedError = nil }
        } message: {
            Text(model.presentedError ?? "")
        }
    }
}

