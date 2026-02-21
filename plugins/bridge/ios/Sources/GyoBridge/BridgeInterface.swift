import Foundation

/**
 * Result type for bridge callbacks
 */
public enum BridgeResult {
    case success(Any?)
    case failure(String)
}

/**
 * Callback type for bridge methods
 */
public typealias BridgeCallback = (BridgeResult) -> Void

/**
 * Protocol for all Gyo bridge implementations
 */
public protocol BridgeInterface {
    /**
     * Unique name of the bridge (e.g., "gyo-camera")
     */
    var name: String { get }
    
    /**
     * Invoke a bridge method
     * - Parameters:
     *   - method: Method name to invoke
     *   - data: Optional data payload as dictionary
     *   - callback: Callback to return result or error
     */
    func invoke(method: String, data: [String: Any]?, callback: @escaping BridgeCallback)
}
