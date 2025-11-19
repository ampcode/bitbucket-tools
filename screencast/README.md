# Browser Screencast

Live stream a Chrome browser session using Chrome DevTools Protocol (CDP).

## Setup

```bash
cd screencast
npm install
```

## Usage

```bash
# Start the screencast server
npm start

# Or with custom options
node browser-screencast.js --port 3000 --cdp-port 9222 --quality 80 --fps 10
```

Then open http://localhost:3000 in another browser to view the live stream.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | 3000 | HTTP server port for viewing the stream |
| `--cdp-port` | 9222 | Chrome DevTools Protocol port |
| `--quality` | 80 | JPEG quality (1-100) |
| `--fps` | 10 | Maximum frames per second |

## Requirements

The target Chrome browser must have remote debugging enabled **via port** (not pipe).

**Note:** The default DevTools MCP uses `--remote-debugging-pipe` which doesn't expose a network port. You need to start Chrome manually with port-based debugging:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-screencast

# Linux
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-screencast

# Windows
chrome.exe --remote-debugging-port=9222 --user-data-dir=%TEMP%\chrome-screencast
```

Then navigate to any page and run the screencast script.

## Features

- 🎬 Live streaming via WebSocket
- ⏸ Pause/resume streaming
- 📸 Download snapshots
- 📊 FPS and frame counter
- 🔄 Auto-reconnection
