import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export const installPrompt = writable<Event | null>(null);
export const isPwaInstalled = writable<boolean>(false);
export const promptUnavailableReason = writable<string | null>(null);
export const isOffline = writable<boolean>(false);

export const checkInstallStatus = () => {
  if (!browser) return false;
  
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('[PWA] App is running in standalone mode (installed)');
    isPwaInstalled.set(true);
    promptUnavailableReason.set('App is already installed');
    return true;
  }
  
  // Check if it's installed on iOS
  // @ts-ignore: iOS Safari has a non-standard 'standalone' property
  if (window.navigator.standalone === true) {
    console.log('[PWA] App is installed on iOS');
    isPwaInstalled.set(true);
    promptUnavailableReason.set('App is already installed on iOS');
    return true;
  }
  
  console.log('[PWA] App is not installed');
  return false;
};

// Register service worker
export const registerServiceWorker = async () => {
  if (!browser) return null;
  
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('[PWA] Service worker registered successfully with scope:', registration.scope);
      return registration;
    } catch (error) {
      console.error('[PWA] Service worker registration failed:', error);
      promptUnavailableReason.set('Service worker registration failed');
      return null;
    }
  } else {
    console.warn('[PWA] Service workers are not supported in this browser');
    promptUnavailableReason.set('Service workers not supported');
    return null;
  }
};

let pageOpenTime = Date.now();

export const initPwa = () => {
  if (!browser) return;
  
  console.log('[PWA] Initializing PWA functionality');
  
  // Register service worker for all users (not just PWA installs)
  registerServiceWorker();
  
  // Check if already installed
  checkInstallStatus();
  
  // Monitor online/offline status
  const updateOnlineStatus = () => {
    const connectionStatus = navigator.onLine;
    isOffline.set(!connectionStatus);
    console.log(`[PWA] Connection status: ${connectionStatus ? 'online' : 'offline'}`);
  };
  
  // Initial check
  updateOnlineStatus();
  
  // Add listeners
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  
  // Listen for the beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    console.log('[PWA] Captured beforeinstallprompt event');
    
    // Store the event so it can be triggered later
    installPrompt.set(e);
    // Clear any previous unavailability reason
    promptUnavailableReason.set(null);
  });
  
  // Listen for app installed event
  window.addEventListener('appinstalled', (e) => {
    // Clear the prompt once installed
    installPrompt.set(null);
    isPwaInstalled.set(true);
    promptUnavailableReason.set('App was just installed');
    console.log('[PWA] App was installed successfully');
  });
  
  // Check eligibility after a short delay 
  setTimeout(() => {
    const noPromptAfterInit = !installPrompt;
    
    if (noPromptAfterInit) {
      detectPromptUnavailabilityReason();
    }
    
    // Log PWA eligibility
    logPwaEligibility();
  }, 2000);
};

// Prompt the user to install the PWA
export const showInstallPrompt = async () => {
  if (!browser) return 'unavailable';
  
  let promptEvent: any;
  
  // Get the stored event from the store
  const unsubscribe = installPrompt.subscribe(value => {
    promptEvent = value;
  });
  
  unsubscribe();
  
  if (promptEvent) {
    console.log('[PWA] Showing install prompt');
    promptEvent.prompt();
    
    const userChoice = await promptEvent.userChoice;
    
    if (userChoice.outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt');
    } else {
      console.log('[PWA] User dismissed the install prompt');
      promptUnavailableReason.set('User previously dismissed the prompt');
    }
    
    installPrompt.set(null);
    return userChoice.outcome;
  } else {
    console.warn('[PWA] No install prompt available');
    return 'unavailable';
  }
};

// Try to determine why the install prompt might not be available
export function detectPromptUnavailabilityReason() {
  if (!browser) return;
  
  let isAppInstalled = false;
  isPwaInstalled.subscribe(value => { isAppInstalled = value; })();
  
  if (isAppInstalled) {
    promptUnavailableReason.set('App is already installed');
    return;
  }
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                
  if (isIOS) {
    promptUnavailableReason.set('iOS does not support automatic install prompts (use Share > Add to Home Screen)');
    return;
  }
  
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    promptUnavailableReason.set('PWA installation requires HTTPS');
    return;
  }
  
  if (Date.now() - pageOpenTime < 30000) {
    promptUnavailableReason.set('The page may need to be open longer before install is offered');
    return;
  }
  
  const isChrome = /Chrome/.test(navigator.userAgent) && !/Edge/.test(navigator.userAgent);
  if (isChrome) {
    promptUnavailableReason.set('Chrome may defer the install prompt until user engagement criteria are met');
    return;
  }
  
  promptUnavailableReason.set('Browser may not support automatic installation or heuristics not met');
}

function logPwaEligibility() {
  if (!browser) return;
  
  console.log('[PWA] Checking PWA eligibility...');
  
  // Check for required PWA features
  const checks = {
    'Service Worker': 'serviceWorker' in navigator,
    'Push Manager': 'PushManager' in window,
    'Cache API': 'caches' in window,
    'Web App Manifest': !!document.querySelector('link[rel="manifest"]'),
    'HTTPS': window.location.protocol === 'https:' || window.location.hostname === 'localhost'
  };
  
  console.table(checks);
  
  const eligible = Object.values(checks).every(value => value === true);
  console.log('[PWA] Overall PWA eligibility:', eligible ? 'Eligible ✅' : 'Not Eligible ❌');
  
  const hasPrompt = installPrompt;
  if (!hasPrompt) {
    setTimeout(detectPromptUnavailabilityReason, 1000);
  }
  
  if (document.referrer.includes('android-app://')) {
    console.log('[PWA] App launched from Android intent - likely installable');
  }
} 