import Foundation
import WebKit

/**
 * iOS Bridge Interface for gyo-bridge system
 * Routes messages to registered bridge handlers via BridgeRegistry
 */
@MainActor
public class IOSBridgeInterface: NSObject, WKScriptMessageHandler {
    private weak var webView: WKWebView?

    public init(webView: WKWebView) {
        self.webView = webView
        super.init()
    }

    /**
     * WKScriptMessageHandler protocol method
     * This is called when JavaScript sends a message via window.webkit.messageHandlers
     */
    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        handleMessage(message.body)
    }

    /**
     * Main entry point from JavaScript
     * Routes requests to registered bridge handlers
     */
    public func handleMessage(_ body: Any) {
        guard let request = body as? [String: Any],
              let bridgeName = request["bridgeName"] as? String,
              let methodName = request["methodName"] as? String,
              let callbackId = request["callbackId"] as? String else {
            print("Invalid bridge message format")
            return
        }

        let data = request["data"] as? [String: Any] ?? [:]

        print("Bridge received: bridge=\(bridgeName), method=\(methodName)")

        // Get handler from registry
        guard let handler = BridgeRegistry.shared.get(bridgeName) else {
            self.rejectCallback(callbackId, error: "Bridge '\(bridgeName)' not found")
            return
        }
        
        // Execute handler
        do {
            let result = try handler.handle(method: methodName, data: data)
            self.resolveCallback(callbackId, result: result)
        } catch {
            self.rejectCallback(callbackId, error: error.localizedDescription)
        }
    }

    /**
     * Resolve a promise on the web side
     */
    private func resolveCallback(_ callbackId: String, result: Any?) {
        guard let webView = self.webView else { return }

        let resultJson: String
        if let result = result {
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: result, options: [])
                resultJson = String(data: jsonData, encoding: .utf8) ?? "null"
            } catch {
                print("Error serializing result to JSON: \(error)")
                resultJson = "null"
            }
        } else {
            resultJson = "null"
        }

        let encodedCallbackId: String
        if let data = try? JSONSerialization.data(withJSONObject: callbackId, options: []),
           let str = String(data: data, encoding: .utf8) {
            encodedCallbackId = str
        } else {
            encodedCallbackId = "''"
        }

        let script = "window.gyoBridge.resolve(\(encodedCallbackId), \(resultJson));"
        webView.evaluateJavaScript(script) { _, error in
            if let error = error {
                print("Error resolving callback: \(error)")
            }
        }
    }

    /**
     * Reject a promise on the web side
     */
    private func rejectCallback(_ callbackId: String, error: String) {
        guard let webView = self.webView else { return }

        let encodedCallbackId: String
        if let data = try? JSONSerialization.data(withJSONObject: callbackId, options: []),
           let str = String(data: data, encoding: .utf8) {
            encodedCallbackId = str
        } else {
            encodedCallbackId = "''"
        }

        let encodedError: String
        if let data = try? JSONSerialization.data(withJSONObject: error, options: []),
           let str = String(data: data, encoding: .utf8) {
            encodedError = str
        } else {
            encodedError = "'Unknown error'"
        }

        let script = "window.gyoBridge.reject(\(encodedCallbackId), \(encodedError));"
        webView.evaluateJavaScript(script) { _, err in
            if let err = err {
                print("Error rejecting callback: \(err)")
            }
        }
    }

    /**
     * Publish an event to web listeners
     */
    public func publishEvent(bridgeName: String, data: Any?) {
        guard let webView = self.webView else { return }

        let dataJson: String
        if let data = data {
            do {
                let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
                dataJson = String(data: jsonData, encoding: .utf8) ?? "null"
            } catch {
                print("Error serializing event data to JSON: \(error)")
                dataJson = "null"
            }
        } else {
            dataJson = "null"
        }

        let encodedName: String
        if let nameData = try? JSONSerialization.data(withJSONObject: bridgeName, options: []),
           let nameStr = String(data: nameData, encoding: .utf8) {
            encodedName = nameStr
        } else {
            encodedName = "''"
        }

        let script = "window.gyoBridge.publish(\(encodedName), \(dataJson));"
        webView.evaluateJavaScript(script) { _, error in
            if let error = error {
                print("Error publishing event: \(error)")
            }
        }
    }
}
