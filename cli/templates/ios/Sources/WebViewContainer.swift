import UIKit
import WebKit
import GyoBridge

class WebViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    
    private var webView: WKWebView!
    private var serverUrl: String
    private var bridgeInterface: IOSBridgeInterface!
    private var hotReloadWebSocket: URLSessionWebSocketTask?
    
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
        
        // Connect to Hot Reload WebSocket in development mode
        connectHotReload(serverUrl: serverUrl)
    }
    
    private func connectHotReload(serverUrl: String) {
        guard let serverURL = URL(string: serverUrl),
              let host = serverURL.host else {
            print("Invalid server URL for Hot Reload")
            return
        }
        
        let wsURLString = "ws://\(host):3001"
        guard let wsURL = URL(string: wsURLString) else {
            print("Invalid WebSocket URL: \(wsURLString)")
            return
        }
        
        print("Connecting to Hot Reload WebSocket: \(wsURLString)")
        
        let session = URLSession(configuration: .default)
        hotReloadWebSocket = session.webSocketTask(with: wsURL)
        hotReloadWebSocket?.resume()
        
        receiveHotReloadMessage()
    }
    
    private func receiveHotReloadMessage() {
        hotReloadWebSocket?.receive { [weak self] result in
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    print("Hot Reload message received: \(text)")
                    if text == "reload" {
                        DispatchQueue.main.async {
                            print("Reloading WebView")
                            self?.webView.reload()
                        }
                    }
                case .data(let data):
                    print("Hot Reload received data: \(data)")
                @unknown default:
                    break
                }
                // Continue listening for messages
                self?.receiveHotReloadMessage()
                
            case .failure(let error):
                print("Hot Reload WebSocket error (this is normal in production): \(error.localizedDescription)")
            }
        }
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
    
    deinit {
        hotReloadWebSocket?.cancel(with: .goingAway, reason: nil)
    }
}
