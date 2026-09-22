import 'dotenv/config';
import path from 'node:path';
import express from 'express';
import { createApp } from './server/app';

const app = createApp();
const port = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, hmr: { port: port + 1 } },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const webRoot = path.resolve('dist/web');
  app.use(express.static(webRoot, { index: false }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/assets/')) {
      res.status(404).end();
      return;
    }
    res.sendFile(path.join(webRoot, 'index.html'));
  });
}
const server = app.listen(port, '0.0.0.0', () =>
  console.log(`MadaTours is running at http://localhost:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(() => process.exit(0));
  });
}
