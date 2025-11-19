#!/usr/bin/env node

import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const action = process.env.TOOLBOX_ACTION || '';

switch (action) {
  case 'describe':
    console.log(JSON.stringify({
      name: 'browser_screenshot',
      description: 'Take a screenshot of the current browser tab. Returns the path to the saved screenshot file.',
      inputSchema: {
        type: 'object',
        properties: {},
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
        const b = await puppeteer.connect({
          browserURL: "http://localhost:9222",
          defaultViewport: null,
        });

        const p = (await b.pages()).at(-1);

        if (!p) {
          console.error("✗ No active tab found");
          process.exit(1);
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `screenshot-${timestamp}.png`;
        const filepath = join(tmpdir(), filename);

        await p.screenshot({ path: filepath });

        console.log(filepath);

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
