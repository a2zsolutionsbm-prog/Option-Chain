import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Server-side proxy route for NSE EOD Participant Wise Open Interest CSV
  // Avoids browser CORS issues and fetches real live CSV data from archives.nseindia.com
  app.get('/api/nse-participant-oi', async (req, res) => {
    const ddmmyyyy = String(req.query.date || '').trim();
    if (!/^\d{8}$/.test(ddmmyyyy)) {
      res.status(400).json({
        ok: false,
        error: 'Invalid date parameter. Expected DDMMYYYY.',
      });
      return;
    }

    const nseArchiveUrl = `https://archives.nseindia.com/content/nsccl/fao_participant_oi_${ddmmyyyy}.csv`;

    try {
      const response = await fetch(nseArchiveUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/csv,text/plain,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          Referer: 'https://www.nseindia.com/',
        },
      });

      if (!response.ok) {
        res.status(response.status).json({
          ok: false,
          status: response.status,
          error: `NSE EOD Participant OI file is not available for ${ddmmyyyy} (HTTP ${response.status}).`,
        });
        return;
      }

      const csvText = await response.text();
      if (!csvText || !csvText.includes('Client Type') || csvText.trim().startsWith('<')) {
        res.status(404).json({
          ok: false,
          error: `No valid NSE Participant OI CSV found for ${ddmmyyyy}.`,
        });
        return;
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).send(csvText);
    } catch (err) {
      res.status(502).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Failed to reach NSE archive server.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
