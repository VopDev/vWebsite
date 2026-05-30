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

// ── Songless stats API ────────────────────────────────────────────────────────
const STATS_FILE = path.join(__dirname, 'data', 'songless-stats.json');

function readStats() {
  try {
    if (fs.existsSync(STATS_FILE)) return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
  } catch {}
  return {};
}

function writeStats(data) {
  const dir = path.dirname(STATS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STATS_FILE, JSON.stringify(data));
}

const EMPTY_SLOT = () => ({ '1':0,'2':0,'3':0,'4':0,'5':0,'6':0,'fail':0 });

app.use(express.json());

app.post('/api/songless/result', (req, res) => {
  const { date, slot, guessCount, won } = req.body;
  if (!date || slot == null || guessCount == null || won == null)
    return res.status(400).json({ error: 'missing fields' });

  const stats = readStats();
  if (!stats[date]) stats[date] = {};
  if (!stats[date][slot]) stats[date][slot] = EMPTY_SLOT();

  const key = won ? String(guessCount) : 'fail';
  stats[date][slot][key] = (stats[date][slot][key] || 0) + 1;
  writeStats(stats);
  res.json({ ok: true });
});

app.get('/api/songless/stats', (req, res) => {
  const { date, slot } = req.query;
  const stats    = readStats();
  const slotData = stats[date]?.[slot] ?? EMPTY_SLOT();
  const total    = Object.values(slotData).reduce((a, b) => a + b, 0);
  res.json({ ...slotData, total });
});

app.delete('/api/songless/stats', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'missing date' });
  const stats = readStats();
  delete stats[date];
  writeStats(stats);
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────

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
app.use('/public', express.static(publicDir));

server.listen(PORT, () => {
  console.log(`Project running at http://localhost:${PORT}`);
});
