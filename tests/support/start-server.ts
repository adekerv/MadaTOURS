import express from 'express';
import path from 'node:path';
import { createApp } from '../../server/app';
import { testDatabase } from './database';
import { testClients } from './clients';
const db = await testDatabase();
const fixture = testClients(db);
const app = express();
app.use(express.json());
app.post('/__test/admin', async (req, res) => {
  if (
    !process.env.MADATOURS_E2E_TOKEN ||
    req.get('X-Test-Token') !== process.env.MADATOURS_E2E_TOKEN
  )
    return res.sendStatus(403);
  await fixture.grantAdmin(String(req.body.email));
  res.json({ success: true });
});
app.use(createApp(fixture.clients));
app.use(express.static(path.resolve('dist/web')));
app.get('*', (_req, res) => {
  res.sendFile(path.resolve('dist/web/index.html'));
});
const server = app.listen(3100, '127.0.0.1', () =>
  console.log('Test server ready on 3100 (isolated Supabase contract double).'),
);
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.once(signal, () => {
    server.close(() => {
      void db.close().then(() => process.exit(0));
    });
  });
