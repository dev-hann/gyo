// Main application logic

function testNative() {
  const result = document.getElementById('result');
  
  // Check if running in gyo native environment
  if (window.gyo && window.gyo.platform) {
    result.textContent = `Running on ${window.gyo.platform} via gyo runtime!`;
    result.className = 'show';
  } else {
    result.textContent = 'Running in web browser (not in gyo native shell)';
    result.className = 'show';
  }
  
  // Example: Call native function if available
  if (window.gyo && window.gyo.callNative) {
    window.gyo.callNative('test', { message: 'Hello from web!' })
      .then(response => {
        console.log('Native response:', response);
      })
      .catch(error => {
        console.error('Native call failed:', error);
      });
  }
}

// Listen for messages from native layer
if (window.gyo && window.gyo.onMessage) {
  window.gyo.onMessage((message) => {
    console.log('Message from native:', message);
  });
}

// Hot reload support for development
if (module.hot) {
  module.hot.accept();
}

console.log('gyo web app initialized');
