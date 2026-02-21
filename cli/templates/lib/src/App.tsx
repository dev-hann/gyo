function App() {
  return (
    <div id="app">
      <header>
        <h1>Welcome to {{PROJECT_NAME}}</h1>
        <p>Built with gyo - Bridge between web and native</p>
      </header>
      
      <main>
        <div className="card">
          <h2>Your gyo app is running!</h2>
          <p>This React application is running inside a native WebView shell.</p>
          
          <div className="features">
            <div className="feature">
              <h3>🌐 Web-First</h3>
              <p>Build with React and your favorite libraries</p>
            </div>
            <div className="feature">
              <h3>📱 Cross-Platform</h3>
              <p>Deploy to Android, iOS, and Desktop</p>
            </div>
            <div className="feature">
              <h3>🚀 Fast Iteration</h3>
              <p>Update your app without app store resubmissions</p>
            </div>
          </div>
        </div>
      </main>
      
      <footer>
        <p>Powered by gyo - The Bridge Framework</p>
      </footer>
    </div>
  );
}

export default App;
