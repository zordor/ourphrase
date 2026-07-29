import SwiftUI

enum OurPhraseTheme {
    static let blue = Color(red: 0.09, green: 0.36, blue: 0.96)
    static let background = Color(uiColor: .systemGroupedBackground)

    static func accent(hue: Int) -> Color {
        Color(hue: Double(hue) / 360, saturation: 0.74, brightness: 0.82)
    }
}

struct PremiumCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.background, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(.primary.opacity(0.05), lineWidth: 0.5)
            }
            .shadow(color: .black.opacity(0.035), radius: 18, y: 8)
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity)
            .frame(minHeight: 56)
            .foregroundStyle(.white)
            .background(OurPhraseTheme.blue.opacity(configuration.isPressed ? 0.78 : 1))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

struct EmptyArtwork: View {
    @State private var animate = false

    var body: some View {
        ZStack {
            Circle()
                .fill(OurPhraseTheme.blue.opacity(0.09))
                .frame(width: 164, height: 164)
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(OurPhraseTheme.blue.opacity(0.22))
                .frame(width: 105, height: 34)
                .offset(x: -24, y: -16)
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(OurPhraseTheme.blue)
                .frame(width: 76, height: 34)
                .offset(x: 30, y: 23)
        }
        .scaleEffect(animate ? 1 : 0.94)
        .opacity(animate ? 1 : 0)
        .onAppear {
            withAnimation(.spring(response: 0.7, dampingFraction: 0.75)) { animate = true }
        }
        .accessibilityHidden(true)
    }
}

struct PrivacyShieldView: View {
    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground).ignoresSafeArea()
            VStack(spacing: 16) {
                Image(systemName: "checkmark.shield.fill")
                    .font(.system(size: 54))
                    .foregroundStyle(OurPhraseTheme.blue)
                Text("OurPhrase")
                    .font(.largeTitle.bold())
            }
        }
        .privacySensitive()
    }
}

