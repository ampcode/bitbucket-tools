#!/usr/bin/env node

import puppeteer from "puppeteer-core";

const action = process.env.TOOLBOX_ACTION || '';

switch (action) {
  case 'describe':
    console.log(JSON.stringify({
      name: 'browser_eval',
      description: 'Evaluate JavaScript code in the current browser tab. Returns the result of the expression.',
      inputSchema: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'JavaScript code to evaluate in the browser context (e.g., "document.title", "document.querySelectorAll(\'a\').length")'
          }
        },
        required: ['code']
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
        const code = params.code;
        
        if (!code) {
          console.error('Error: code parameter required');
          process.exit(1);
        }

        const b = await puppeteer.connect({
          browserURL: "http://localhost:9222",
          defaultViewport: null,
        });

        const p = (await b.pages()).at(-1);

        if (!p) {
          console.error("✗ No active tab found");
          process.exit(1);
        }

        let result;

        try {
          result = await p.evaluate((c) => {
            const AsyncFunction = (async () => {}).constructor;
            return new AsyncFunction(`return (${c})`)();
          }, code);
        } catch (e) {
          console.log("Failed to evaluate expression");
          console.log(`  Expression: ${code}`);
          console.log(e);
          process.exit(1);
        }

        if (Array.isArray(result)) {
          for (let i = 0; i < result.length; i++) {
            if (i > 0) console.log("");
            for (const [key, value] of Object.entries(result[i])) {
              console.log(`${key}: ${value}`);
            }
          }
        } else if (typeof result === "object" && result !== null) {
          for (const [key, value] of Object.entries(result)) {
            console.log(`${key}: ${value}`);
          }
        } else {
          console.log(result);
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
