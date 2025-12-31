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
            return config
        }
    }
    
    // Fallback - this should not happen in normal usage
    return GyoConfig(serverUrl: "about:blank")
}
