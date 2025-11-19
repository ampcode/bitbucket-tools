#!/usr/bin/env node

/**
 * Browser Screencast using Chrome DevTools Protocol
 * 
 * This script connects to a Chrome instance and streams screenshots
 * to a local web server for live viewing.
 * 
 * Usage:
 *   node browser-screencast.js [--port 3000] [--cdp-port 9222] [--quality 80] [--fps 10]
 * 
 * Then open http://localhost:3000 in your browser to view the stream.
 */

const http = require('http');
const WebSocket = require('ws');

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = (name, defaultValue) => {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : defaultValue;
};

const CONFIG = {
  httpPort: parseInt(getArg('port', '3000')),
  cdpPort: parseInt(getArg('cdp-port', '9222')),
  quality: parseInt(getArg('quality', '80')),
  maxFps: parseInt(getArg('fps', '10')),
};

// HTML page for viewing the screencast
const HTML_PAGE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Browser Screencast</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: #1a1a1a;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #fff;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    h1 {
      margin: 0 0 10px 0;
      font-size: 24px;
      font-weight: 500;
    }
    .status {
      margin-bottom: 15px;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
    }
    .status.connected { background: #1e4620; }
    .status.disconnected { background: #4a1e1e; }
    .status.connecting { background: #4a3d1e; }
    .screen-container {
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    #screen {
      display: block;
      width: 100%;
      height: auto;
    }
    .controls {
      margin-top: 15px;
      display: flex;
      gap: 10px;
      align-items: center;
    }
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background: #333;
      color: #fff;
      cursor: pointer;
      font-size: 14px;
    }
    button:hover { background: #444; }
    button:active { background: #555; }
    .stats {
      margin-left: auto;
      font-size: 12px;
      color: #888;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎬 Browser Screencast</h1>
    <div id="status" class="status connecting">Connecting...</div>
    <div class="screen-container">
      <img id="screen" alt="Browser screen" />
    </div>
    <div class="controls">
      <button onclick="togglePause()">⏸ Pause</button>
      <button onclick="takeSnapshot()">📸 Snapshot</button>
      <div class="stats">
        <span id="fps">0</span> FPS | 
        <span id="frames">0</span> frames
      </div>
    </div>
  </div>
  
  <script>
    const screen = document.getElementById('screen');
    const status = document.getElementById('status');
    const fpsDisplay = document.getElementById('fps');
    const framesDisplay = document.getElementById('frames');
    
    let ws;
    let paused = false;
    let frameCount = 0;
    let lastFpsUpdate = Date.now();
    let fpsFrameCount = 0;
    
    function connect() {
      ws = new WebSocket('ws://' + location.host + '/ws');
      
      ws.onopen = () => {
        status.textContent = '🟢 Connected - Streaming';
        status.className = 'status connected';
      };
      
      ws.onmessage = (event) => {
        if (paused) return;
        
        screen.src = 'data:image/jpeg;base64,' + event.data;
        frameCount++;
        fpsFrameCount++;
        framesDisplay.textContent = frameCount;
        
        const now = Date.now();
        if (now - lastFpsUpdate >= 1000) {
          fpsDisplay.textContent = fpsFrameCount;
          fpsFrameCount = 0;
          lastFpsUpdate = now;
        }
      };
      
      ws.onclose = () => {
        status.textContent = '🔴 Disconnected - Reconnecting...';
        status.className = 'status disconnected';
        setTimeout(connect, 2000);
      };
      
      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };
    }
    
    function togglePause() {
      paused = !paused;
      event.target.textContent = paused ? '▶ Resume' : '⏸ Pause';
      status.textContent = paused ? '⏸ Paused' : '🟢 Connected - Streaming';
    }
    
    function takeSnapshot() {
      const link = document.createElement('a');
      link.download = 'screenshot-' + Date.now() + '.jpg';
      link.href = screen.src;
      link.click();
    }
    
    connect();
  </script>
</body>
</html>
`;

class BrowserScreencast {
  constructor() {
    this.clients = new Set();
    this.cdpWs = null;
    this.sessionId = null;
    this.isStreaming = false;
  }

  async start() {
    // Start HTTP server
    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HTML_PAGE);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    // Start WebSocket server for clients
    const wss = new WebSocket.Server({ server, path: '/ws' });
    
    wss.on('connection', (ws) => {
      console.log('Client connected');
      this.clients.add(ws);
      
      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
      });
    });

    server.listen(CONFIG.httpPort, () => {
      console.log(`\n🎬 Screencast server running at http://localhost:${CONFIG.httpPort}\n`);
    });

    // Connect to Chrome DevTools
    await this.connectToCDP();
  }

  async connectToCDP() {
    try {
      // Get list of debuggable targets
      const response = await fetch(`http://localhost:${CONFIG.cdpPort}/json`);
      const targets = await response.json();
      
      // Find a page target (prefer non-chrome:// URLs)
      const pageTargets = targets.filter(t => t.type === 'page');
      let pageTarget = pageTargets.find(t => !t.url.startsWith('chrome://')) || pageTargets[0];
      
      if (!pageTarget) {
        console.error('No page target found. Make sure Chrome has a page open.');
        process.exit(1);
      }

      console.log(`Connecting to: ${pageTarget.title || pageTarget.url}`);
      
      // Connect to the page's WebSocket
      this.cdpWs = new WebSocket(pageTarget.webSocketDebuggerUrl);
      
      this.cdpWs.on('open', () => {
        console.log('Connected to Chrome DevTools Protocol');
        this.startScreencast();
      });

      this.cdpWs.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleCDPMessage(message);
      });

      this.cdpWs.on('close', () => {
        console.log('CDP connection closed. Reconnecting...');
        this.isStreaming = false;
        setTimeout(() => this.connectToCDP(), 2000);
      });

      this.cdpWs.on('error', (err) => {
        console.error('CDP WebSocket error:', err.message);
      });

    } catch (err) {
      console.error(`Failed to connect to Chrome on port ${CONFIG.cdpPort}:`, err.message);
      console.log('\nMake sure Chrome is running with remote debugging enabled:');
      console.log(`  chrome --remote-debugging-port=${CONFIG.cdpPort}\n`);
      console.log('Or if using the DevTools MCP, it should already be connected.\n');
      setTimeout(() => this.connectToCDP(), 3000);
    }
  }

  sendCDP(method, params = {}) {
    if (!this.messageId) this.messageId = 1;
    const id = this.messageId++;
    this.cdpWs.send(JSON.stringify({ id, method, params }));
    return id;
  }

  startScreencast() {
    // Start the screencast
    this.sendCDP('Page.startScreencast', {
      format: 'jpeg',
      quality: CONFIG.quality,
      maxWidth: 1920,
      maxHeight: 1080,
      everyNthFrame: Math.max(1, Math.floor(60 / CONFIG.maxFps)),
    });
    
    this.isStreaming = true;
    console.log(`Screencast started (quality: ${CONFIG.quality}, max fps: ${CONFIG.maxFps})`);
  }

  handleCDPMessage(message) {
    // Log errors
    if (message.error) {
      console.error('CDP Error:', message.error);
      return;
    }
    
    // Log responses to our commands
    if (message.id && message.result) {
      console.log('CDP Response:', message.id, message.result);
    }
    
    if (message.method === 'Page.screencastFrame') {
      const { data, sessionId } = message.params;
      
      // Acknowledge the frame
      this.sendCDP('Page.screencastFrameAck', { sessionId });
      
      // Send to all connected clients
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(data);
        }
      }
      
      // Log frame received (first few only)
      if (!this.frameCount) this.frameCount = 0;
      this.frameCount++;
      if (this.frameCount <= 3) {
        console.log(`Frame ${this.frameCount} received (${data.length} bytes)`);
      }
    }
  }

  stop() {
    if (this.cdpWs && this.isStreaming) {
      this.sendCDP('Page.stopScreencast');
      this.isStreaming = false;
    }
  }
}

// Handle graceful shutdown
const screencast = new BrowserScreencast();

process.on('SIGINT', () => {
  console.log('\nStopping screencast...');
  screencast.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  screencast.stop();
  process.exit(0);
});

// Start the screencast
screencast.start().catch(console.error);
