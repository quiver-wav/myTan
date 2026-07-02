// Service worker di myTan — funzionamento offline.
// Strategia:
//  - navigazioni (apertura app): network-first, fallback alla index in cache
//  - asset same-origin (js/css/icone): cache-first, poi rete
//  - API Open-Meteo: network-first, fallback all'ultimo dato in cache
//    (così l'ultimo piano resta consultabile anche senza connessione)
//
// La prima apertura deve avvenire ONLINE per popolare la cache.

const VERSION = "mytan-v2";
const SHELL = `${VERSION}-shell`;
const API = `${VERSION}-api`;
const API_HOSTS = ["api.open-meteo.com", "geocoding-api.open-meteo.com"];

// Percorsi relativi alla posizione del SW: funziona sia in root sia in sottocartella.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest"])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // API meteo/geocoding: network-first con fallback alla cache
  if (API_HOSTS.includes(url.hostname)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(API).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // Solo same-origin per il resto
  if (url.origin !== self.location.origin) return;

  // Navigazioni: network-first, fallback alla index in cache (app shell).
  // A ogni navigazione riuscita la copia offline della index viene aggiornata,
  // così l'app offline non resta indietro di versione.
  if (request.mode === "navigate") {
    const indexUrl = new URL("./index.html", self.registration.scope).toString();
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(indexUrl, copy));
          return res;
        })
        .catch(() =>
          caches.match(indexUrl).then((r) => r || caches.match(self.registration.scope)),
        ),
    );
    return;
  }

  // Asset statici: cache-first, poi rete (e popola la cache)
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
