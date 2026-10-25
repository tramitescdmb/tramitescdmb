const ESTATICOS = "estaticos-v1";
const PAGINAS = "hojas-visita-v1";
const HOJA_VISITA = /^\/expedientes\/[^/]+\/visitas\/[^/]+\/?$/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== ESTATICOS && c !== PAGINAS).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

async function primeroCache(request) {
  const cache = await caches.open(ESTATICOS);
  const guardada = await cache.match(request);
  if (guardada) return guardada;
  const respuesta = await fetch(request);
  if (respuesta.ok) cache.put(request, respuesta.clone());
  return respuesta;
}

async function primeroRed(request) {
  const cache = await caches.open(PAGINAS);
  try {
    const respuesta = await fetch(request);
    if (respuesta.ok && !respuesta.redirected) cache.put(request, respuesta.clone());
    return respuesta;
  } catch {
    const guardada = await cache.match(request, { ignoreSearch: true });
    if (guardada) return guardada;
    return new Response(
      '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title><body style="font-family:system-ui;padding:24px;color:#292524"><h1 style="font-size:18px">Sin conexión</h1><p>Esta hoja de visita no se abrió antes con señal en este dispositivo. Ábrala con conexión al menos una vez el día de la visita para poder diligenciarla sin señal.</p></body>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/geo/")) {
    event.respondWith(primeroCache(request));
    return;
  }
  if (request.mode === "navigate" && HOJA_VISITA.test(url.pathname)) {
    event.respondWith(primeroRed(request));
  }
});
