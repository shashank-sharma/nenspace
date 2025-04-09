// Export all PWA services and hooks
import {
  initPwa,
  showInstallPrompt,
  registerServiceWorker,
  checkInstallStatus,
  installPrompt,
  isPwaInstalled,
  promptUnavailableReason,
  isOffline
} from './core';

import {
  devControls,
  triggerInstallBanner,
  resetInstallBanner,
  toggleInstalledState,
  toggleOfflineMode
} from './dev-tools';

export {
  initPwa,
  showInstallPrompt,
  registerServiceWorker,
  checkInstallStatus,
  installPrompt,
  isPwaInstalled,
  promptUnavailableReason,
  isOffline,
  // Dev tools
  devControls,
  triggerInstallBanner,
  resetInstallBanner,
  toggleInstalledState,
  toggleOfflineMode
};

// Add functions to control service worker caching for testing

/**
 * Disables all caching in the service worker
 * Use this during development/testing to always see latest changes
 */
export function disableServiceWorkerCaching(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    console.warn('Service Worker not supported in this browser or environment');
    return Promise.resolve(false);
  }
  
  return new Promise((resolve) => {
    console.log('[PWA] Disabling Service Worker caching...');
    
    // Set a timeout in case we don't get a response
    const timeoutId = setTimeout(() => {
      console.warn('[PWA] No response from Service Worker when disabling caching');
      resolve(false);
    }, 3000);
    
    // Listen for the response
    const messageListener = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SW_ECHO' && 'cachingDisabled' in event.data) {
        console.log('[PWA] Service Worker caching disabled:', event.data.cachingDisabled);
        clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener('message', messageListener);
        resolve(event.data.cachingDisabled === true);
      }
    };
    
    navigator.serviceWorker.addEventListener('message', messageListener);
    
    // Attempt to send the message to all active service workers
    navigator.serviceWorker.ready
      .then(registration => {
        if (registration.active) {
          registration.active.postMessage({
            type: 'TOGGLE_CACHING',
            disable: true
          });
        } else {
          console.warn('[PWA] No active service worker found');
          clearTimeout(timeoutId);
          navigator.serviceWorker.removeEventListener('message', messageListener);
          resolve(false);
        }
      })
      .catch(err => {
        console.error('[PWA] Error communicating with service worker:', err);
        clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener('message', messageListener);
        resolve(false);
      });
  });
}

/**
 * Enables caching in the service worker
 * Use this to restore normal caching behavior after testing
 */
export function enableServiceWorkerCaching(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    console.warn('Service Worker not supported in this browser or environment');
    return Promise.resolve(false);
  }
  
  return new Promise((resolve) => {
    console.log('[PWA] Enabling Service Worker caching...');
    
    // Set a timeout in case we don't get a response
    const timeoutId = setTimeout(() => {
      console.warn('[PWA] No response from Service Worker when enabling caching');
      resolve(false);
    }, 3000);
    
    // Listen for the response
    const messageListener = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SW_ECHO' && 'cachingDisabled' in event.data) {
        console.log('[PWA] Service Worker caching enabled:', !event.data.cachingDisabled);
        clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener('message', messageListener);
        resolve(event.data.cachingDisabled === false);
      }
    };
    
    navigator.serviceWorker.addEventListener('message', messageListener);
    
    // Attempt to send the message to all active service workers
    navigator.serviceWorker.ready
      .then(registration => {
        if (registration.active) {
          registration.active.postMessage({
            type: 'TOGGLE_CACHING',
            disable: false
          });
        } else {
          console.warn('[PWA] No active service worker found');
          clearTimeout(timeoutId);
          navigator.serviceWorker.removeEventListener('message', messageListener);
          resolve(false);
        }
      })
      .catch(err => {
        console.error('[PWA] Error communicating with service worker:', err);
        clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener('message', messageListener);
        resolve(false);
      });
  });
}

/**
 * Checks if service worker caching is currently disabled
 */
export function isServiceWorkerCachingDisabled(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return Promise.resolve(false);
  }
  
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve(false);
    }, 3000);
    
    const messageListener = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SW_ECHO' && 'cachingDisabled' in event.data) {
        clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener('message', messageListener);
        resolve(event.data.cachingDisabled === true);
      }
    };
    
    navigator.serviceWorker.addEventListener('message', messageListener);
    
    navigator.serviceWorker.ready
      .then(registration => {
        if (registration.active) {
          registration.active.postMessage({
            type: 'CHECK_CACHING_STATUS'
          });
        } else {
          clearTimeout(timeoutId);
          navigator.serviceWorker.removeEventListener('message', messageListener);
          resolve(false);
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener('message', messageListener);
        resolve(false);
      });
  });
} 