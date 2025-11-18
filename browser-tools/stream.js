#!/usr/bin/env node

import http from 'node:http';
import puppeteer from "puppeteer-core";

const action = process.env.TOOLBOX_ACTION || '';
const PORT = 9333; // Port for the video stream

switch (action) {
  case 'describe':
    console.log(JSON.stringify({
      name: 'browser_stream',
      description: 'Start a live video stream of the browser. Returns a URL that can be viewed in a browser or embedded in a UI component.',
      inputSchema: {
        type: 'object',
        properties: {
          port: {
            type: 'number',
            description: 'Port to run the stream server on',
            default: PORT
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
        const streamPort = params.port || PORT;

        // Connect to Chrome
        const browser = await puppeteer.connect({
          browserURL: "http://localhost:9222",
          defaultViewport: null,
        });

        const pages = await browser.pages();
        const page = pages[0];

        if (!page) {
          console.error("✗ No active tab found");
          process.exit(1);
        }

        // Create CDP Session
        const client = await page.createCDPSession();

        // Set up MJPEG Server
        const clients = new Set();

        const server = http.createServer((req, res) => {
          if (req.url === '/stream') {
            res.writeHead(200, {
              'Content-Type': 'multipart/x-mixed-replace; boundary=--frame',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'Access-Control-Allow-Origin': '*'
            });

            clients.add(res);
            
            console.error(`Client connected. Total: ${clients.size}`);

            res.on('close', () => {
              clients.delete(res);
              console.error(`Client disconnected. Total: ${clients.size}`);
            });
          } else {
            // Simple viewer page
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="margin:0;background:#000;display:flex;justify-content:center;align-items:center;height:100vh;">
                  <img src="/stream" style="max-width:100%;max-height:100%;object-fit:contain;">
                </body>
              </html>
            `);
          }
        });

        server.listen(streamPort, () => {
          // console.error to avoid polluting stdout which is used for tool result
          console.error(`Stream server listening on port ${streamPort}`);
          
          // Return the URL as the tool result
          console.log(`http://localhost:${streamPort}/stream`);
        });

        // Handle Frames
        client.on('Page.screencastFrame', async (frame) => {
          const { data, sessionId, metadata } = frame;
          const buffer = Buffer.from(data, 'base64');

          // Broadcast to all clients
          for (const res of clients) {
            res.write(`--frame\r\n`);
            res.write(`Content-Type: image/jpeg\r\n`);
            res.write(`Content-Length: ${buffer.length}\r\n`);
            res.write(`\r\n`);
            res.write(buffer);
            res.write(`\r\n`);
          }

          try {
            await client.send('Page.screencastFrameAck', { sessionId });
          } catch (e) {
            // Ignore errors if session closed
          }
        });

        // Start Screencast
        await client.send('Page.startScreencast', {
          format: 'jpeg',
          quality: 60,
          everyNthFrame: 1,
          maxWidth: 1280,
          maxHeight: 720
        });

        console.error("Screencast started");

        // Keep process alive
        process.on('SIGINT', async () => {
          await client.send('Page.stopScreencast');
          await browser.disconnect();
          server.close();
          process.exit(0);
        });

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
