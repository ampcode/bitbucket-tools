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
const WebSocket = require('ws'); // Still needed for CDP connections

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
    <h1>Browser Screencast</h1>
    <div id="status" class="status connecting">Connecting...</div>
    <div class="screen-container">
      <img id="screen" alt="Browser screen" />
    </div>
    <div class="controls">
      <button onclick="togglePause()">Pause</button>
      <button onclick="takeSnapshot()">Snapshot</button>
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
    
    let eventSource;
    let paused = false;
    let frameCount = 0;
    let lastFpsUpdate = Date.now();
    let fpsFrameCount = 0;
    
    function connect() {
      eventSource = new EventSource('/stream');
      
      eventSource.onopen = () => {
        status.textContent = 'Connected - Streaming';
        status.className = 'status connected';
      };
      
      eventSource.onmessage = (event) => {
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
      
      eventSource.onerror = () => {
        status.textContent = 'Disconnected - Reconnecting...';
        status.className = 'status disconnected';
        eventSource.close();
        setTimeout(connect, 2000);
      };
    }
    
    function togglePause() {
      paused = !paused;
      event.target.textContent = paused ? 'Resume' : 'Pause';
      status.textContent = paused ? 'Paused' : 'Connected - Streaming';
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
    this.browserWs = null;
    this.pageWs = null;
    this.currentTargetId = null;
    this.isStreaming = false;
    this.messageId = 1;
    this.frameCount = 0;
  }

  async start() {
    // Start HTTP server with SSE support
    const server = http.createServer((req, res) => {
      if (req.url === '/' || req.url === '/index.html' || req.url === '/viewer') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(HTML_PAGE);
      } else if (req.url === '/stream') {
        // Server-Sent Events endpoint
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'X-Accel-Buffering': 'no'
        });
        
        // Send initial comment to establish connection
        res.write(':ok\n\n');
        
        console.log('Client connected (SSE)');
        this.clients.add(res);
        
        req.on('close', () => {
          console.log('Client disconnected (SSE)');
          this.clients.delete(res);
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(CONFIG.httpPort, () => {
      console.log(`\nScreencast server running at http://localhost:${CONFIG.httpPort}\n`);
    });

    // Connect to Chrome DevTools
    await this.connectToBrowser();
  }

  async connectToBrowser() {
    try {
      // Get browser WebSocket endpoint
      const response = await fetch(`http://localhost:${CONFIG.cdpPort}/json/version`);
      const version = await response.json();
      
      console.log(`Connecting to browser: ${version.Browser}`);
      
      // Connect to browser-level WebSocket
      this.browserWs = new WebSocket(version.webSocketDebuggerUrl);
      
      this.browserWs.on('open', () => {
        console.log('Connected to browser');
        
        // Enable target discovery to track page changes
        this.sendBrowser('Target.setDiscoverTargets', { discover: true });
      });

      this.browserWs.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleBrowserMessage(message);
      });

      this.browserWs.on('close', () => {
        console.log('Browser connection closed. Reconnecting...');
        this.isStreaming = false;
        setTimeout(() => this.connectToBrowser(), 2000);
      });

      this.browserWs.on('error', (err) => {
        console.error('Browser WebSocket error:', err.message);
      });

    } catch (err) {
      console.error(`Failed to connect to Chrome on port ${CONFIG.cdpPort}:`, err.message);
      console.log('\nMake sure Chrome is running with remote debugging enabled:');
      console.log(`  chrome --remote-debugging-port=${CONFIG.cdpPort}\n`);
      setTimeout(() => this.connectToBrowser(), 3000);
    }
  }

  sendBrowser(method, params = {}) {
    const id = this.messageId++;
    this.browserWs.send(JSON.stringify({ id, method, params }));
    return id;
  }

  sendPage(method, params = {}) {
    if (!this.pageWs) return;
    const id = this.messageId++;
    this.pageWs.send(JSON.stringify({ id, method, params }));
    return id;
  }

  async handleBrowserMessage(message) {
    if (message.error) {
      console.error('Browser Error:', message.error);
      return;
    }

    // Handle target events
    if (message.method === 'Target.targetCreated') {
      const target = message.params.targetInfo;
      if (target.type === 'page') {
        console.log(`New page: ${target.title || target.url}`);
        // Switch to new page
        await this.connectToPage(target.targetId);
      }
    } else if (message.method === 'Target.targetInfoChanged') {
      const target = message.params.targetInfo;
      if (target.type === 'page' && target.targetId === this.currentTargetId) {
        console.log(`Page updated: ${target.title || target.url}`);
      }
    } else if (message.method === 'Target.targetDestroyed') {
      if (message.params.targetId === this.currentTargetId) {
        console.log('Current page closed');
        this.currentTargetId = null;
        if (this.pageWs) {
          this.pageWs.close();
          this.pageWs = null;
        }
      }
    }

    // When we get the list of targets, connect to the most recent page
    if (message.result && message.result.targetInfos) {
      const pages = message.result.targetInfos.filter(t => t.type === 'page');
      if (pages.length > 0) {
        const target = pages[pages.length - 1]; // Most recent
        await this.connectToPage(target.targetId);
      }
    }
  }

  async connectToPage(targetId) {
    if (this.currentTargetId === targetId) return;
    if (this.isConnecting) return; // Prevent race conditions
    
    this.isConnecting = true;
    
    // Close existing page connection
    if (this.pageWs) {
      this.isStreaming = false;
      this.pageWs.close();
      this.pageWs = null;
    }

    this.currentTargetId = targetId;
    
    // Get page WebSocket URL
    const response = await fetch(`http://localhost:${CONFIG.cdpPort}/json`);
    const targets = await response.json();
    const target = targets.find(t => t.id === targetId);
    
    if (!target) {
      console.error('Target not found:', targetId);
      this.isConnecting = false;
      return;
    }

    console.log(`Switching to: ${target.title || target.url}`);
    
    this.pageWs = new WebSocket(target.webSocketDebuggerUrl);
    
    this.pageWs.on('open', () => {
      this.isConnecting = false;
      this.startScreencast();
    });

    this.pageWs.on('message', (data) => {
      const message = JSON.parse(data.toString());
      this.handlePageMessage(message);
    });

    this.pageWs.on('close', () => {
      console.log('Page connection closed');
      this.isStreaming = false;
      this.isConnecting = false;
    });

    this.pageWs.on('error', (err) => {
      console.error('Page WebSocket error:', err.message);
      this.isConnecting = false;
    });
  }

  startScreencast() {
    this.sendPage('Page.startScreencast', {
      format: 'jpeg',
      quality: CONFIG.quality,
      maxWidth: 1920,
      maxHeight: 1080,
      everyNthFrame: Math.max(1, Math.floor(60 / CONFIG.maxFps)),
    });
    
    this.isStreaming = true;
    this.frameCount = 0;
    console.log(`Screencast started (quality: ${CONFIG.quality}, max fps: ${CONFIG.maxFps})`);
  }

  handlePageMessage(message) {
    if (message.error) {
      console.error('Page Error:', message.error);
      return;
    }
    
    if (message.method === 'Page.screencastFrame') {
      const { data, sessionId } = message.params;
      
      // Acknowledge the frame
      this.sendPage('Page.screencastFrameAck', { sessionId });
      
      // Send to all connected SSE clients
      for (const client of this.clients) {
        try {
          client.write(`data: ${data}\n\n`);
        } catch (err) {
          // Client disconnected
          this.clients.delete(client);
        }
      }
      
      // Log frame received (first few only)
      this.frameCount++;
      if (this.frameCount <= 3) {
        console.log(`Frame ${this.frameCount} received (${data.length} bytes)`);
      }
    }
  }

  stop() {
    if (this.pageWs && this.isStreaming) {
      this.sendPage('Page.stopScreencast');
      this.isStreaming = false;
    }
    if (this.browserWs) {
      this.browserWs.close();
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
