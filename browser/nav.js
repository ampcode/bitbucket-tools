#!/usr/bin/env node

import puppeteer from "puppeteer-core";

const action = process.env.TOOLBOX_ACTION || '';

switch (action) {
  case 'describe':
    console.log(JSON.stringify({
      name: 'browser_navigate',
      description: 'Navigate the browser to a URL. Can open in current tab or a new tab.',
      inputSchema: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to navigate to'
          },
          newTab: {
            type: 'boolean',
            description: 'If true, open URL in a new tab instead of current tab',
            default: false
          }
        },
        required: ['url']
      }
    }));
    break;

  case 'execute':
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { input += chunk; });
    
    process.stdin.on('end', async () => {
      try {
        const params = JSON.parse(input);
        const url = params.url;
        const newTab = params.newTab || false;
        
        if (!url) {
          console.error('Error: url parameter required');
          process.exit(1);
        }

        const b = await puppeteer.connect({
          browserURL: "http://localhost:9222",
          defaultViewport: null,
        });

        const pages = await b.pages();
        
        if (newTab) {
          const p = await b.newPage();
          await p.goto(url, { waitUntil: "domcontentloaded" });
          console.log("✓ Opened in new tab:", url);
        } else {
          // Reuse existing page if available, otherwise create one
          let p = pages[0];
          if (!p) {
            p = await b.newPage();
          }
          await p.goto(url, { waitUntil: "domcontentloaded" });
          await p.bringToFront();
          console.log("✓ Opened:", url);
        }

        await b.disconnect();
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
