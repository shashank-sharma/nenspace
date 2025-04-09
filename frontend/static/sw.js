const CACHE_VERSION = 'v1.2';
const CACHE_NAME = `app-cache-${CACHE_VERSION}`;
const DEV_MODE = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// Debug flags for testing
let simulateOffline = false;
let logCacheOperations = DEV_MODE;
// NEW: Flag to completely disable caching during testing
let disableCaching = DEV_MODE; // Set to true to disable all caching

// Assets to cache
const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/favicon.png',
  '/icons/apple-icon-180.png',
  '/icons/manifest-icon-192.maskable.png',
  '/icons/manifest-icon-512.maskable.png',
  '/fonts/Gilroy.woff2',
  '/offline.html'  // Add offline fallback page
];

console.log(`[ServiceWorker] Running version ${CACHE_VERSION}, caching ${disableCaching ? 'DISABLED' : 'ENABLED'}`);

// Helper for logging in development
const devLog = (...args) => {
  if (DEV_MODE || logCacheOperations) {
    console.log('[Service Worker]', ...args);
  }
};

// Listen for messages from the main thread
self.addEventListener('message', (event) => {  
  devLog('Message received:', event.data);

  if (event.data && event.data.type === 'OFFLINE_MODE') {
    simulateOffline = event.data.offline;
    devLog('Offline mode set to:', simulateOffline);
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    devLog('Skip waiting message received, activating new version');
    self.skipWaiting();
  }
  
  // NEW: Handle toggling cache disable state from main thread
  if (event.data && event.data.type === 'TOGGLE_CACHING') {
    disableCaching = event.data.disable;
    devLog('Caching disabled:', disableCaching);
  }

  // Echo back to confirm communication
  if (event.source) {
    event.source.postMessage({
      type: 'SW_ECHO',
      receivedMessage: event.data,
      version: CACHE_VERSION,
      cachingDisabled: disableCaching,
      timestamp: new Date().toISOString()
    });
  }
});

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  devLog(`Installing service worker version ${CACHE_VERSION}...`);
  
  // Skip caching if disabled
  if (disableCaching) {
    devLog('Caching disabled, skipping asset caching');
    return self.skipWaiting();
  }
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        devLog('Caching app shell...');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => {
        devLog('Service worker installed');
        return self.skipWaiting();
      })
      .catch(error => {
        devLog('Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  devLog(`Activating service worker version ${CACHE_VERSION}...`);
  
  // If caching is disabled, clear all caches
  if (disableCaching) {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        devLog('Caching disabled, clearing all caches');
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
      .then(() => {
        devLog('All caches cleared');
        return self.clients.claim();
      })
      .then(() => {
        // Notify all clients about the update
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'SW_UPDATED',
              version: CACHE_VERSION,
              cachingDisabled: disableCaching
            });
          });
        });
      })
    );
    return;
  }
  
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            devLog('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      devLog('Service worker activated and claiming clients');
      return self.clients.claim(); // Take control of all pages immediately
    })
    .then(() => {
      // Notify all clients about the update
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: CACHE_VERSION,
            cachingDisabled: disableCaching
          });
          devLog(`Notified client ${client.id} about update`);
        });
      });
    })
  );
});

// Network-first strategy with timeout fallback to cache
const networkFirst = async (request) => {
  // Skip caching if disabled
  if (disableCaching) {
    devLog(`Caching disabled, fetching directly from network: ${request.url}`);
    return fetch(request).catch(err => {
      devLog(`Network error with caching disabled: ${err}`);
      return new Response('Network error and caching is disabled', { status: 503 });
    });
  }
  
  const timeoutPromise = new Promise(resolve => {
    setTimeout(() => resolve(new Response('Network request timed out')), 3000);
  });
  
  try {
    // Try network first
    devLog(`Network-first strategy for: ${request.url}`);
    const networkResponse = await Promise.race([
      fetch(request),
      timeoutPromise
    ]);
    
    // If successful network request
    if (networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      devLog(`Updated cache for: ${request.url}`);
      return networkResponse;
    }
    
    throw new Error('Network response was not ok');
  } catch (error) {
    devLog(`Network request failed, falling back to cache for: ${request.url}`);
    // If network fails, use cache
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Network error and no cache available', { status: 408 });
  }
};

// Cache-first strategy for static assets
const cacheFirst = async (request) => {
  // Skip caching if disabled
  if (disableCaching) {
    devLog(`Caching disabled, fetching directly from network: ${request.url}`);
    return fetch(request);
  }
  
  devLog(`Cache-first strategy for: ${request.url}`);
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    devLog(`Found in cache: ${request.url}`);
    return cachedResponse;
  }
  
  // Not in cache, get from network
  try {
    devLog(`Not in cache, fetching from network: ${request.url}`);
    const networkResponse = await fetch(request);
    
    // Cache the response for future
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
      devLog(`Added to cache: ${request.url}`);
    }
    
    return networkResponse;
  } catch (error) {
    devLog(`Network fetch failed for: ${request.url}`);
    return new Response('Resource not available', { status: 404 });
  }
};

// Create a separate offline page handler
const handleOfflineFallback = async (request) => {
  // Check if this is a navigation request (HTML page)
  if (request.mode === 'navigate' || (request.method === 'GET' && request.headers.get('accept').includes('text/html'))) {
    try {
      // Try the network first
      return await fetch(request);
    } catch (error) {
      devLog('Navigation request failed, serving offline page');
      // If network fails, return the offline page
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match('/offline.html');
      return cachedResponse || new Response('You are offline and the offline page is not cached.', 
        { headers: { 'Content-Type': 'text/html' } });
    }
  }
  
  // For non-navigation requests, use network-first strategy
  return networkFirst(request);
};

// Fetch event - intelligent caching strategy
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip dev server requests
  if (
    url.pathname.startsWith('/browser-sync/') ||
    url.pathname.startsWith('/__vite') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }
  
  // If caching is disabled during development, bypass all cache logic
  if (disableCaching) {
    devLog(`Caching disabled, bypassing cache for: ${url.pathname}`);
    return; // Let the browser handle the request normally
  }
  
  // Check if this is a navigation request first and handle specially for offline
  if (event.request.mode === 'navigate' || 
      (event.request.method === 'GET' && 
       event.request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith(handleOfflineFallback(event.request));
    return;
  }
  
  // If simulating offline mode in development, return offline response
  if (DEV_MODE && simulateOffline) {
    devLog('Simulating offline mode, returning offline response');
    
    event.respondWith(
      (async () => {
        // Check if the request is in cache first
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }
        
        if (event.request.mode === 'navigate') {
          return caches.match('/offline.html').catch(() => {
            return new Response('<h1>You are offline</h1><p>This is a simulated offline response.</p>', {
              headers: { 'Content-Type': 'text/html' }
            });
          });
        }
        
        return new Response('Offline Mode', { 
          status: 503, 
          statusText: 'Simulated Offline Mode' 
        });
      })()
    );
    return;
  }
  
  // For HTML files, use network-first strategy (always try to get latest version)
  if (event.request.mode === 'navigate' || 
      (event.request.headers.get('accept') && 
       event.request.headers.get('accept').includes('text/html'))) {
    devLog(`HTML request detected: ${event.request.url}`);
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // For static assets (JS, CSS, images), use cache-first strategy
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2)$/) ||
    ASSETS_TO_CACHE.includes(url.pathname)
  ) {
    event.respondWith(cacheFirst(event.request));
    return;
  }
  
  // For everything else (including API requests), use network with cache fallback
  event.respondWith(
    (async () => {
      try {
        const networkResponse = await fetch(event.request);
        
        // Don't cache API requests or similar
        if (
          !disableCaching && // Skip caching if disabled
          !event.request.url.includes('/api/') &&
          networkResponse && 
          networkResponse.status === 200 &&
          networkResponse.type === 'basic'
        ) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkResponse.clone());
          devLog(`Cached response for: ${event.request.url}`);
        }
        
        return networkResponse;
      } catch (error) {
        devLog(`Network request failed for: ${event.request.url}`);
        
        // Try from cache if available
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          devLog(`Returning cached response for: ${event.request.url}`);
          return cachedResponse;
        }
        
        // Nothing found, return error
        return new Response('Network error and no cache available', { status: 408 });
      }
    })()
  );
});