/**
 * Journal Sync Adapter
 * 
 * Registers the journal sync service with the dashboard layout
 * to enable automatic syncing when network is available.
 */

import { JournalSyncService } from './journal-sync.service.svelte';

// Import to initialize the service
// This ensures the sync service is registered and will start syncing when network is available
JournalSyncService;

