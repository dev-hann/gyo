import Foundation

struct GyoConfig: Codable {
    let serverUrl: String
}

func loadGyoConfig() -> GyoConfig {
    // SwiftPM puts resources in a separate bundle
    // Try module bundle first (SwiftPM), then main bundle (Xcode)
    let bundles = [Bundle.module, Bundle.main]
    
    for bundle in bundles {
        if let url = bundle.url(forResource: "gyo-config", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let config = try? JSONDecoder().decode(GyoConfig.self, from: data) {
            if config.serverUrl.isEmpty {
                fatalError("serverUrl is empty in gyo-config.json")
            }
            return config
        }
    }
    
    // If we can't find the config file, throw a fatal error
    fatalError("gyo-config.json not found. Did you run 'gyo build' or 'gyo run'?")
}
