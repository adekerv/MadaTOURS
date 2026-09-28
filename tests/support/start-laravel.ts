import { startLaravel } from './laravel';
const app = await startLaravel(3100, 3101);
console.log('Laravel test server ready on 3100 with isolated PostgreSQL and Auth fixtures.');
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    void app.close();
  });
