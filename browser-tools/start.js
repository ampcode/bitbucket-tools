#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import puppeteer from "puppeteer-core";

const action = process.env.TOOLBOX_ACTION || '';

switch (action) {
  case 'describe':
    console.log(JSON.stringify({
      name: 'browser_start',
      description: 'Start Chrome browser with remote debugging enabled on port 9222. Optionally copy your default Chrome profile to preserve cookies and logins.',
      inputSchema: {
        type: 'object',
        properties: {
          useProfile: {
            type: 'boolean',
            description: 'If true, copy your default Chrome profile (cookies, logins). If false, start with fresh profile.',
            default: false
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
        const useProfile = params.useProfile || false;

        // Kill existing Chrome
        // try {
        //   execSync("killall 'Google Chrome'", { stdio: "ignore" });
        // } catch {}

        // Wait a bit for processes to fully die
        // await new Promise((r) => setTimeout(r, 1000));

        // Setup profile directory
        execSync("mkdir -p ~/.cache/scraping", { stdio: "ignore" });

        if (useProfile) {
          // Sync profile with rsync (much faster on subsequent runs)
          execSync(
            `rsync -a --delete "${process.env.HOME}/Library/Application Support/Google/Chrome/" ~/.cache/scraping/`,
            { stdio: "pipe" },
          );
        }

        // Start Chrome in background (detached so Node can exit)
        const args = [
          "--remote-debugging-port=9222",
          `--user-data-dir=${process.env["HOME"]}/.cache/scraping`,
        ];
        
        if (useProfile) {
          args.push('--profile-directory=Profile 2');
        }

        spawn(
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          args,
          { detached: true, stdio: "ignore" },
        ).unref();

        // Wait for Chrome to be ready by attempting to connect
        let connected = false;
        for (let i = 0; i < 30; i++) {
          try {
            const browser = await puppeteer.connect({
              browserURL: "http://localhost:9222",
              defaultViewport: null,
            });

            await browser.disconnect();
            connected = true;
            break;
          } catch {
            await new Promise((r) => setTimeout(r, 500));
          }
        }

        if (!connected) {
          console.error("✗ Failed to connect to Chrome");
          process.exit(1);
        }

        console.log(
          `✓ Chrome started on :9222${useProfile ? " with your profile" : ""}`,
        );
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
