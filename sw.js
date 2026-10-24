// Guarda la app en el móvil para que funcione sin conexión.
// Sirve siempre la copia guardada y, en segundo plano, descarga la versión nueva
// (las actualizaciones se ven la siguiente vez que se abre la app).
const CACHE = 'tarjetas-v4';
const ARCHIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'iconos/icono.svg',
  'iconos/icono-180.png',
  'iconos/icono-192.png',
  'iconos/icono-512.png',
];
// Librerías para el PDF y la imagen: se guardan al instalar para que «Descargar PDF» funcione sin internet.
const LIBRERIAS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
];

self.addEventListener('install', ev => {
  // reload: descarga del servidor, no de la caché del navegador (podría ser la versión anterior).
  const peticiones = ARCHIVOS.map(u => new Request(u, { cache: 'reload' }));
  ev.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(peticiones);
    // Si en ese momento no hay conexión con cdnjs, se guardan la primera vez que se usen.
    await Promise.all(LIBRERIAS.map(u => c.add(new Request(u, { mode: 'cors' })).catch(() => {})));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys()
    .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Las librerías no cambian dentro de una versión: se sirven desde la copia guardada.
  if (url.origin === 'https://cdnjs.cloudflare.com') {
    ev.respondWith(caches.open(CACHE).then(async cache =>
      (await cache.match(req)) || fetch(req).then(resp => {
        if (resp.ok) cache.put(req, resp.clone());
        return resp;
      })));
    return;
  }
  if (url.origin !== location.origin) return;
  ev.respondWith(caches.open(CACHE).then(async cache => {
    const guardada = await cache.match(req, { ignoreSearch: true });
    // no-cache: pregunta siempre al servidor si hay versión nueva (GitHub Pages pide guardar 10 min).
    const nueva = fetch(req.url, { cache: 'no-cache' }).then(resp => {
      if (resp.ok) cache.put(req, resp.clone());
      return resp;
    }).catch(() => null);
    if (guardada) {
      ev.waitUntil(nueva);
      return guardada;
    }
    return (await nueva) || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
  }));
});
