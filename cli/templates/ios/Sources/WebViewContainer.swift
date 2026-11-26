import UIKit
import WebKit

class WebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    
    private var webView: WKWebView!
    private var serverUrl: String
    private var bridgeInterface: IOSBridgeInterface!
    
    override init(nibName nibNameOrNil: String?, bundle nibBundleOrNil: Bundle?) {
        // Load config before calling super.init
        let config = loadGyoConfig()
        self.serverUrl = config.serverUrl
        super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)
    }
    
    required init?(coder: NSCoder) {
        let config = loadGyoConfig()
        self.serverUrl = config.serverUrl
        super.init(coder: coder)
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupWebView()
        
        // Initialize bridge interface after webview is setup
        bridgeInterface = IOSBridgeInterface(webView: webView)
        
        // Initialize BridgeRegistry
        Task { @MainActor in
            await BridgeRegistry.shared.initialize()
            
            // Example: Register custom bridges here
            // await BridgeRegistry.shared.register("my-custom-bridge", handler: MyCustomBridgeHandler())
        }
        
        loadApp()
    }
    
    private func setupWebView() {
        let contentController = WKUserContentController()
        contentController.add(self, name: "gyoBridge")
        
        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.navigationDelegate = self
        
        view.addSubview(webView)
    }
    
    private func loadApp() {
        guard let url = URL(string: serverUrl) else { return }
        let request = URLRequest(url: url)
        webView.load(request)
    }
    
    private func injectGyoRuntime() {
        let script = """
        (function() {
            window.gyo = {
                platform: 'ios',
                
                __bridge: {
                    postMessage: function(message) {
                        if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.gyoBridge) {
                            window.webkit.messageHandlers.gyoBridge.postMessage(message);
                        }
                    }
                }
            };
            console.log('gyo runtime initialized on iOS');
        })();
        """
        
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
    
    // MARK: - WKScriptMessageHandler
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "gyoBridge" else { return }
        
        // Security: only accept bridge calls from the origin (host) of serverUrl.
        // Third-party pages loaded into the web view must not reach native handlers.
        let originHost = message.frameInfo.securityOrigin.host
        if originHost.isEmpty || originHost.caseInsensitiveCompare(allowedHost ?? "") != .orderedSame {
            print("[GyoBridge] Rejected bridge call from unauthorized origin: '\(originHost)'")
            return
        }
        
        bridgeInterface.handleMessage(message.body)
    }
    
    // MARK: - WKNavigationDelegate
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        injectGyoRuntime()
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let targetHost = navigationAction.request.url?.host else {
            decisionHandler(.allow)
            return
        }
        
        // Same origin as the configured server: load inside the web view
        if let allowed = allowedHost, targetHost.caseInsensitiveCompare(allowed) == .orderedSame {
            decisionHandler(.allow)
            return
        }
        
        // External origin: never load inside the web view — the native bridge
        // must not be reachable from third-party pages. Open externally.
        if navigationAction.navigationType == .linkActivated || navigationAction.targetFrame == nil,
           let url = navigationAction.request.url {
            UIApplication.shared.open(url)
        }
        decisionHandler(.cancel)
    }
    
    // MARK: - Helpers
    
    private var allowedHost: String? {
        URL(string: serverUrl)?.host
    }

}
