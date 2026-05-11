const express = require('express');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

let fileVersion = Date.now();

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected', version: fileVersion }));
});

fs.watch(publicDir, { recursive: true }, (eventType, filename) => {
  fileVersion = Date.now();
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'reload', version: fileVersion }));
    }
  });
});

app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    let html = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf-8');
    const liveReloadScript = `
      <script>
        (function() {
          const ws = new WebSocket('ws://' + window.location.host);
          ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'reload') {
              window.location.reload();
            }
          };
          ws.onerror = () => setTimeout(() => window.location.reload(), 1000);
        })();
      </script>
    `;
    html = html.replace('</body>', liveReloadScript + '</body>');
    res.type('text/html').send(html);
  } else {
    next();
  }
});

app.use(express.static(publicDir));

server.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
});
