import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Imported after dotenv so server modules see the .env values.
  const { loadConfig } = await import('./server/config.ts');
  const { createApp } = await import('./server/app.ts');
  const { errorHandler } = await import('./server/http.ts');
  const { checkGeminiAvailability } = await import('./server/gemini.ts');

  const cfg = loadConfig();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  if (cfg.production && !cfg.adminToken) {
    console.warn('[Armora] NODE_ENV=production but ADMIN_TOKEN is not set: all mutating routes are DISABLED (503).');
  }
  console.log(`[Armora] DEMO_MODE=${cfg.demoMode} production=${cfg.production}`);

  const app = createApp(cfg);

  if (!cfg.production) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }
  app.use(errorHandler() as unknown as express.ErrorRequestHandler);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Armora] Server listening on port ${PORT}`);
  });

  // Do not assume the configured Gemini model exists: probe it once at boot.
  checkGeminiAvailability().then((s) => {
    console.log(`[Armora] Gemini status: ${s.state} (${s.detail})`);
  });
}

startServer().catch((err) => {
  console.error('[Armora] Fatal server boot error:', err);
  process.exit(1);
});
