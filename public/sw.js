// Simple Service Worker for FeedLoop PWA
self.addEventListener('install', (event) => {
  console.log('SW: Install');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SW: Activate');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through for now, can be updated for offline caching
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'FeedLoop Update';
  const options = {
    body: data.body || 'A new action recorded in your area.',
    icon: '/favicon.svg',
    vibrate: [100, 50, 100],
    data: data
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
