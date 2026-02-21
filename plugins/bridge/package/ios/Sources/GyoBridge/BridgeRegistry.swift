import Foundation

// MARK: - Bridge Registry

@MainActor
public class BridgeRegistry {
    public static let shared = BridgeRegistry()
    
    private var handlers: [String: BridgeHandler] = [:]
    
    private init() {}
    
    public func initialize() {
        handlers.removeAll()
    }
    
    public func register(_ bridgeName: String, handler: BridgeHandler) {
        handlers[bridgeName] = handler
        print("BridgeRegistry: Registered bridge: \(bridgeName)")
    }
    
    public func unregister(_ bridgeName: String) {
        handlers.removeValue(forKey: bridgeName)
        print("BridgeRegistry: Unregistered bridge: \(bridgeName)")
    }
    
    public func get(_ bridgeName: String) -> BridgeHandler? {
        return handlers[bridgeName]
    }
}
