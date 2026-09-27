// Cache only the public app shell; never cache Google, account APIs or map projects.
'use strict';
const CACHE='atlas-shell-__BUILD_ID__',SHELL=/*__SHELL_ASSETS__*/[];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('atlas-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 const navigation=request.mode==='navigate',viewer=url.pathname==='/play'||url.pathname==='/player.html';
 if(navigation){if(!viewer&&url.pathname!=='/'&&url.pathname!=='/index.html')return;event.respondWith((async()=>{try{return await fetch(request);}catch{const cache=await caches.open(CACHE);return await cache.match(viewer?'/player.html':'/index.html')||Response.error();}})());return;}
 if(!SHELL.includes(url.pathname))return;
 event.respondWith((async()=>{const cache=await caches.open(CACHE);try{return await fetch(request);}catch{return await cache.match(url.pathname)||Response.error();}})());
});
