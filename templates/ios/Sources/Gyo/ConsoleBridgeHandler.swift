import Foundation

// MARK: - Console Bridge Handler

final class ConsoleBridgeHandler: BridgeHandler {
    func handle(method: String, data: [String: Any]) throws -> Any? {
        switch method {
        case "log":
            let level = data["level"] as? String ?? "log"
            let args = data["args"] as? [[String: Any]] ?? []
            let _ = data["timestamp"] as? Int64 ?? 0  // timestamp not used yet
            
            let message = formatConsoleMessage(args)
            
            // Use print for cross-platform compatibility
            print("[\(level.uppercased())] \(message)")
            
            return ["success": true]
            
        default:
            throw BridgeError.unknownMethod(method)
        }
    }
    
    private func formatConsoleMessage(_ args: [[String: Any]]) -> String {
        let parts = args.map { formatArg($0) }
        return parts.joined(separator: " ")
    }
    
    private func formatArg(_ arg: [String: Any]) -> String {
        if let type = arg["__type"] as? String {
            switch type {
            case "Error":
                let name = arg["name"] as? String ?? "Error"
                let message = arg["message"] as? String ?? ""
                return "\(name): \(message)"
            case "Date":
                return arg["value"] as? String ?? ""
            default:
                return String(describing: arg)
            }
        }
        
        // Try to extract the actual value from the dictionary
        if let value = arg["value"] {
            return String(describing: value)
        }
        
        return String(describing: arg)
    }
}
