import Foundation

// MARK: - Bridge Protocol

protocol BridgeHandler: Sendable {
    func handle(method: String, data: [String: Any]) throws -> Any?
}

// MARK: - Bridge Error

enum BridgeError: Error {
    case unknownMethod(String)
    case unknownBridge(String)
    
    var localizedDescription: String {
        switch self {
        case .unknownMethod(let method):
            return "Unknown method: \(method)"
        case .unknownBridge(let bridge):
            return "Unknown bridge: \(bridge)"
        }
    }
}
