import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist/web', target: 'es2022' },
  server: { host: '0.0.0.0' },
});
