import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
export function offlineShell(): Plugin {
  return {
    name: 'madatours-offline-shell',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = [
        '/',
        '/index.html',
        '/favicon.svg',
        ...Object.keys(bundle)
          .filter((name) => !name.endsWith('.map'))
          .map((name) => `/${name}`),
      ];
      const version = createHash('sha256')
        .update(JSON.stringify(assets))
        .digest('hex')
        .slice(0, 12);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `
const CACHE = 'madatours-shell-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('madatours-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if(request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if(request.mode === 'navigate') {
    event.respondWith((async () => {
      const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),4000);
      try { const response=await fetch(request,{signal:controller.signal}); if(response.ok) return response; throw new Error('Unavailable'); }
      catch { return (await caches.match('/index.html', { cacheName:CACHE })) || new Response('MadaTours is offline.',{status:503}); }
      finally { clearTimeout(timer); }
    })()); return;
  }
  if(ASSETS.includes(url.pathname)) event.respondWith(caches.match(request,{cacheName:CACHE}).then(cached=>cached||fetch(request)));
});`,
      });
    },
  };
}
