import Foundation

// MARK: - Bridge Registry

@MainActor
class BridgeRegistry {
    static let shared = BridgeRegistry()
    
    private var handlers: [String: BridgeHandler] = [:]
    
    private init() {}
    
    func initialize() {
        handlers.removeAll()
    }
    
    func register(_ bridgeName: String, handler: BridgeHandler) {
        handlers[bridgeName] = handler
        print("BridgeRegistry: Registered bridge: \(bridgeName)")
    }
    
    func unregister(_ bridgeName: String) {
        handlers.removeValue(forKey: bridgeName)
        print("BridgeRegistry: Unregistered bridge: \(bridgeName)")
    }
    
    func get(_ bridgeName: String) -> BridgeHandler? {
        return handlers[bridgeName]
    }
}
