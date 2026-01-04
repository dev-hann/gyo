import Foundation

// MARK: - Bridge Protocol

public protocol BridgeHandler: Sendable {
    func handle(method: String, data: [String: Any]) throws -> Any?
}

// MARK: - Bridge Error

public enum BridgeError: Error {
    case unknownMethod(String)
    case unknownBridge(String)
    
    public var localizedDescription: String {
        switch self {
        case .unknownMethod(let method):
            return "Unknown method: \(method)"
        case .unknownBridge(let bridge):
            return "Unknown bridge: \(bridge)"
        }
    }
}
