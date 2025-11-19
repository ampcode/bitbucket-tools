#!/usr/bin/env node

import express from "express";
import { WebSocketServer } from "ws";
import puppeteer from "puppeteer-core";
import http from "http";

const action = process.env.TOOLBOX_ACTION || '';

switch (action) {
  case 'describe':
    console.log(JSON.stringify({
      name: 'browser_serve',
      description: 'Start a web server that streams the browser view and accepts input. Useful for viewing the automation in VS Code Simple Browser or another browser.',
      inputSchema: {
        type: 'object',
        properties: {
          port: {
            type: 'number',
            description: 'Port to run the server on (default: 3000)',
            default: 3000
          },
          quality: {
            type: 'number',
            description: 'Stream quality (0-100)',
            default: 80
          }
        },
        required: []
      }
    }));
    break;

  case 'execute':
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    
    process.stdin.on('end', async () => {
      try {
        const params = JSON.parse(input || '{}');
        const port = params.port || 3000;
        const quality = params.quality || 80;

        // 1. Connect to Browser
        console.error("Connecting to browser...");
        const browser = await puppeteer.connect({
          browserURL: "http://localhost:9222",
          defaultViewport: null,
        });

        const page = (await browser.pages()).at(-1);
        if (!page) throw new Error("No active tab found");

        const client = await page.createCDPSession();
        const { width, height } = await page.viewport() || { width: 1280, height: 800 };

        // 2. Setup Server
        const app = express();
        const server = http.createServer(app);
        const wss = new WebSocketServer({ server });

        // Serve the viewer page
        app.get('/', (req, res) => {
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Browser Stream</title>
              <style>
                body { margin: 0; background: #1e1e1e; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: hidden; }
                #container { position: relative; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
                img { display: block; max-width: 100%; max-height: 100vh; cursor: crosshair; }
                #status { position: absolute; top: 10px; left: 10px; color: lime; font-family: monospace; background: rgba(0,0,0,0.5); padding: 5px; border-radius: 4px; pointer-events: none; }
              </style>
            </head>
            <body>
              <div id="container">
                <img id="screen" />
                <div id="status">Connecting...</div>
              </div>
              <script>
                const img = document.getElementById('screen');
                const status = document.getElementById('status');
                const ws = new WebSocket('ws://' + location.host);
                
                let originalWidth = ${width};
                let originalHeight = ${height};

                ws.onopen = () => status.innerText = 'Connected';
                ws.onclose = () => status.innerText = 'Disconnected';
                
                ws.onmessage = (event) => {
                  const data = JSON.parse(event.data);
                  if (data.image) {
                    img.src = 'data:image/jpeg;base64,' + data.image;
                    if (data.width) originalWidth = data.width;
                    if (data.height) originalHeight = data.height;
                  }
                };

                img.addEventListener('mousedown', (e) => {
                  const rect = img.getBoundingClientRect();
                  // Calculate scale factor
                  const scaleX = originalWidth / rect.width;
                  const scaleY = originalHeight / rect.height;
                  
                  const x = (e.clientX - rect.left) * scaleX;
                  const y = (e.clientY - rect.top) * scaleY;
                  
                  ws.send(JSON.stringify({ type: 'click', x, y }));
                });

                // Prevent drag behavior
                img.addEventListener('dragstart', (e) => e.preventDefault());
              </script>
            </body>
            </html>
          `);
        });

        // 3. Handle WebSocket
        wss.on('connection', (ws) => {
          console.error("Client connected");
          
          // Handle input from client
          ws.on('message', async (msg) => {
            try {
              const { type, x, y } = JSON.parse(msg);
              if (type === 'click') {
                await page.mouse.click(x, y);
              }
            } catch (err) {
              console.error("Input error:", err);
            }
          });
        });

        // 4. Start Screencast
        await client.send('Page.startScreencast', {
          format: 'jpeg',
          quality: quality,
          maxWidth: 1920,
          maxHeight: 1080,
          everyNthFrame: 1
        });

        client.on('Page.screencastFrame', async (frame) => {
          const { data, sessionId, metadata } = frame;
          
          // Broadcast to all connected clients
          const msg = JSON.stringify({ 
            image: data,
            width: metadata.deviceWidth,
            height: metadata.deviceHeight,
            scale: metadata.pageScaleFactor
          });

          wss.clients.forEach(client => {
            if (client.readyState === 1) { // OPEN
              client.send(msg);
            }
          });

          // Ack the frame
          try {
            await client.send('Page.screencastFrameAck', { sessionId });
          } catch (e) {
            // Session might be closed
          }
        });

        console.log(`Server running at http://localhost:${port}`);
        
        // Keep process alive
        server.listen(port);

      } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });
    break;

  default:
    console.error("Error: TOOLBOX_ACTION must be 'describe' or 'execute'");
    process.exit(1);
}
