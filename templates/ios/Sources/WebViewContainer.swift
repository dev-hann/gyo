import UIKit
import WebKit

class WebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    
    private var webView: WKWebView!
    private var serverUrl: String
    
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
        loadApp()
    }
    
    private func setupWebView() {
        let contentController = WKUserContentController()
        contentController.add(self, name: "GyoIOS")
        
        let config = WKWebViewConfiguration()
        config.userContentController = contentController
        
        // JavaScript is enabled by default in iOS 14+
        if #available(iOS 14.0, *) {
            let preferences = WKWebpagePreferences()
            preferences.allowsContentJavaScript = true
            config.defaultWebpagePreferences = preferences
        } else {
            config.preferences.javaScriptEnabled = true
        }
        
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
                callNative: function(method, params) {
                    return new Promise(function(resolve, reject) {
                        try {
                            window.webkit.messageHandlers.GyoIOS.postMessage({
                                method: method,
                                params: params || {},
                                callbackId: Date.now()
                            });
                            resolve({ success: true, message: 'iOS call initiated' });
                        } catch (e) {
                            reject(e);
                        }
                    });
                },
                onMessage: function(callback) {
                    window.gyoMessageCallback = callback;
                }
            };
            console.log('gyo runtime initialized on iOS');
        })();
        """
        
        webView.evaluateJavaScript(script, completionHandler: nil)
    }
    
    // MARK: - WKScriptMessageHandler
    
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "GyoIOS",
              let body = message.body as? [String: Any],
              let method = body["method"] as? String else {
            return
        }
        
        let params = body["params"] as? [String: Any] ?? [:]
        handleNativeCall(method: method, params: params)
    }
    
    private func handleNativeCall(method: String, params: [String: Any]) {
        switch method {
        case "test":
            print("Native test called from web with params: \\(params)")
        default:
            print("Unknown method: \\(method)")
        }
    }
    
    // MARK: - WKNavigationDelegate
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        injectGyoRuntime()
    }
}
