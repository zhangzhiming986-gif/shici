const CACHE = 'shici-shell-v4';
const ASSETS = ['index.html','style.css','app.js','core.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png'];
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('shici-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin) return;
  const name=url.pathname.split('/').pop();
  if(!ASSETS.includes(name)&&event.request.mode!=='navigate')return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try {
      const response=await fetch(event.request);
      // Never cache authentication redirects or error pages.
      if(response.ok&&!response.redirected&&response.type==='basic')await cache.put(event.request,response.clone());
      return response;
    } catch(error) {
      const cached=await cache.match(event.request);
      if(cached)return cached;
      throw error;
    }
  })());
});
