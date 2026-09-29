import { cp, mkdir } from 'node:fs/promises';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'mobile-public-assets',
      async closeBundle() {
        await mkdir('dist/mobile', { recursive: true });
        await cp('public/favicon.svg', 'dist/mobile/favicon.svg');
        await cp('public/theme.js', 'dist/mobile/theme.js');
        await cp('public/assets', 'dist/mobile/assets', { recursive: true });
        await cp('public/photos', 'dist/mobile/photos', { recursive: true });
      },
    },
  ],
  build: { outDir: 'dist/mobile', target: 'es2022' },
  // Copy only native assets, never Laravel's PHP entry point or web build.
  publicDir: false,
});
