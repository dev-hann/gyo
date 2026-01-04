import UIKit
import WebKit
import GyoBridge

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
            
            // Example: Register custom bridge (developers can add their own)
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
        if message.name == "gyoBridge" {
            bridgeInterface.handleMessage(message.body)
        }
    }
    
    // MARK: - WKNavigationDelegate
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        injectGyoRuntime()
    }
}
