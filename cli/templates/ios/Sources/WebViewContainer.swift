import UIKit
import WebKit

/// An origin as the web sees it: scheme, host and port, with the default
/// ports spelled out. The one place that decides what "same origin" means.
struct ServerOrigin: Equatable {
    let scheme: String
    let host: String
    let port: Int

    /// The origin of a URL; nil for what has no host, such as about:blank.
    init?(_ url: URL) {
        guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased() else { return nil }
        self.scheme = scheme
        self.host = host
        self.port = url.port ?? (scheme == "https" ? 443 : 80)
    }

    func matches(_ securityOrigin: WKSecurityOrigin) -> Bool {
        ServerOrigin(scheme: securityOrigin.protocol, host: securityOrigin.host, port: securityOrigin.port) == self
    }
}

class WebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    
    private var webView: WKWebView!
    private var serverUrl: String
    /// Where the app is served from: the one origin that may use the bridge and load here.
    private let origin: ServerOrigin?
    private var bridgeInterface: IOSBridgeInterface!
    
    override init(nibName nibNameOrNil: String?, bundle nibBundleOrNil: Bundle?) {
        // Load config before calling super.init
        let config = loadGyoConfig()
        self.serverUrl = config.serverUrl
        self.origin = URL(string: config.serverUrl).flatMap(ServerOrigin.init)
        super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)
    }
    
    required init?(coder: NSCoder) {
        let config = loadGyoConfig()
        self.serverUrl = config.serverUrl
        self.origin = URL(string: config.serverUrl).flatMap(ServerOrigin.init)
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
        
        // Security: only accept bridge calls from the origin of serverUrl.
        // Third-party pages and iframes loaded into the web view must not
        // reach native handlers.
        let sender = message.frameInfo.securityOrigin
        guard let origin = origin, origin.matches(sender) else {
            print("[GyoBridge] Rejected bridge call from another origin: \(sender.protocol)://\(sender.host):\(sender.port)")
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
        guard let target = navigationAction.request.url, target.host != nil else {
            decisionHandler(.allow)
            return
        }
        
        // Same origin as the configured server: load inside the web view
        if origin == ServerOrigin(target) {
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
    
}
