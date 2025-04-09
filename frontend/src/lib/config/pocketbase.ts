import PocketBase from 'pocketbase';
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Constants
export const POCKETBASE_URL_KEY = 'pocketbase-url';

const POCKETBASE_URL = browser ? 
    (localStorage.getItem(POCKETBASE_URL_KEY) || 'http://127.0.0.1:8090') : 
    'http://127.0.0.1:8090';

export const pb = new PocketBase(POCKETBASE_URL);
export const currentUser = writable(pb.authStore.model);

// Backend connection status
export const backendStatus = writable<{
    connected: boolean | null;  // null = unknown, true = connected, false = disconnected
    checking: boolean;
    error: string | null;
    showModal: boolean;
}>({
    connected: null,
    checking: false,
    error: null,
    showModal: false
});

// Function to check backend health
export async function checkBackendHealth() {
    let currentStatus: { checking: boolean } = { checking: false };
    
    // Get the current value from the store using a subscription
    const unsubscribe = backendStatus.subscribe(value => {
        currentStatus = value;
    });
    unsubscribe();
    
    if (currentStatus.checking) return;
    
    backendStatus.update(s => ({ ...s, checking: true, error: null }));
    
    try {
        // Add a random query parameter to prevent caching
        const timestamp = Date.now();
        const response = await fetch(`${POCKETBASE_URL}/api/health?_t=${timestamp}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            // Short timeout to prevent hanging
            signal: AbortSignal.timeout(5000),
        });
        
        if (response.status === 200) {
            backendStatus.update(s => ({ 
                ...s, 
                connected: true,
                showModal: false 
            }));
        } else {
            const data = await response.json().catch(() => ({}));
            throw new Error(data.message || `Server returned status ${response.status}`);
        }
    } catch (error) {
        backendStatus.update(s => ({ 
            ...s, 
            connected: false,
            error: error instanceof Error ? error.message : String(error),
            showModal: true
        }));
    } finally {
        backendStatus.update(s => ({ ...s, checking: false }));
    }
}

// Update the backend URL
export function updateBackendUrl(newUrl: string) {
    if (browser && newUrl) {
        console.log('Updating PocketBase URL to:', newUrl);
        
        try {
            // Store the URL in localStorage
            localStorage.setItem(POCKETBASE_URL_KEY, newUrl);
            
            // Update the status to show we're trying to connect
            backendStatus.update(s => ({
                ...s,
                checking: true,
                showModal: false, // Hide the modal before reload
                error: null
            }));
            
            // Short delay to ensure the state is updated before reload
            setTimeout(() => {
                // Force reload the page to reinitialize PocketBase with new URL
                window.location.href = window.location.href;
            }, 100);
            
        } catch (error) {
            console.error('Error updating backend URL:', error);
            // Show error in modal
            backendStatus.update(s => ({
                ...s, 
                error: 'Failed to update URL: ' + (error instanceof Error ? error.message : String(error)),
                showModal: true
            }));
        }
    }
}

// Initialize health check on client-side
if (browser) {
    // Initial check
    checkBackendHealth();
}

pb.authStore.onChange((auth) => {
    currentUser.set(pb.authStore.model);
});