import SwiftData
import SwiftUI

@main
struct OurPhraseApp: App {
    @State private var appModel = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    private let container: ModelContainer = {
        let schema = Schema([Connection.self])
        let configuration = ModelConfiguration(
            "OurPhrase",
            schema: schema,
            isStoredInMemoryOnly: false,
            allowsSave: true,
            cloudKitDatabase: .none
        )
        do {
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("Unable to create OurPhrase store: \(error)")
        }
    }()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appModel)
                .modelContainer(container)
                .task { appModel.configure(context: container.mainContext) }
                .onOpenURL { url in
                    Task { await appModel.receive(scannedValue: url.absoluteString) }
                }
                .onContinueUserActivity(NSUserActivityTypeBrowsingWeb) { activity in
                    guard let url = activity.webpageURL else { return }
                    Task { await appModel.receive(scannedValue: url.absoluteString) }
                }
                .onChange(of: scenePhase) { _, phase in
                    switch phase {
                    case .background: appModel.sceneDidBackground()
                    case .active: Task { await appModel.sceneDidActivate() }
                    default: break
                    }
                }
        }
    }
}

