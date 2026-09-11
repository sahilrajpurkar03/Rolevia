import {
  NetworkOnly,
  Serwist,
  type PrecacheEntry,
  type SerwistGlobalConfig,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;
const allowedPublic = new Set([
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable.png",
  "/apple-touch-icon.png",
  "/brand-mark.png",
]);
const manifest = (self.__SW_MANIFEST ?? []).filter((entry) => {
  const url = typeof entry === "string" ? entry : entry.url;
  return url.startsWith("/_next/static/") || allowedPublic.has(url);
});
const serwist = new Serwist({
  precacheEntries: manifest,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkOnly(),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});
serwist.addEventListeners();
