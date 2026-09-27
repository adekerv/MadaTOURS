import { offlineShell } from './scripts/web-offline';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [laravel({ input: ['resources/js/main.tsx'], refresh: ['resources/views/**', 'routes/**'] }), react(), tailwindcss(), offlineShell()],
  build: { target: 'es2022' },
  server: { host: '127.0.0.1' },
});
