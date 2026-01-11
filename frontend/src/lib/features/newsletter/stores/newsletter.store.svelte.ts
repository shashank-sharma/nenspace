import { browser } from '$app/environment';
import { pb } from '$lib/config/pocketbase';
import { NewsletterService } from '../services/newsletter.service';
import type { Newsletter, NewsletterSettings, NewsletterFilter } from '../types';
import { withErrorHandling } from '$lib/utils';

const DISMISSED_SCAN_KEY = 'newsletter_dismissed_scan_id';

class NewsletterStore {
    settings = $state<NewsletterSettings | null>(null);
    newsletters = $state<Newsletter[]>([]);
    isLoading = $state(false);
    error = $state<string | null>(null);
    totalItems = $state(0);
    totalPages = $state(0);
    currentPage = $state(1);
    filter = $state<NewsletterFilter>({ searchQuery: "", sort: "-last_seen" });
    unsubscribe: (() => void) | null = null;
    lastDismissedScanId = $state<string | null>(browser ? localStorage.getItem(DISMISSED_SCAN_KEY) : null);

    // Derived state using $derived rune
    isEnabled = $derived(this.settings?.is_enabled ?? false);
    activeCount = $derived(this.newsletters.filter(n => n.is_active).length);
    isScanning = $derived(this.settings?.scan_status === 'scanning' || this.settings?.scan_status === 'pending');
    isScanDismissed = $derived(this.lastDismissedScanId === this.settings?.id && this.settings?.scan_status === 'completed');

    /**
     * Initialize the store by loading settings
     */
    async initialize() {
        if (this.isLoading && this.settings) return;

        this.isLoading = true;
        this.error = null;

        await withErrorHandling(
            async () => {
                const settings = await NewsletterService.getSettings();
                this.settings = settings;
                
                if (settings) {
                    this.setupSubscription(settings.id);
                }

                if (this.isEnabled) {
                    await this.loadNewsletters();
                }
            },
            {
                errorMessage: 'Failed to initialize newsletter feature',
                onSuccess: () => {
                    this.isLoading = false;
                },
                onError: (err) => {
                    this.error = err.message;
                    this.isLoading = false;
                }
            }
        );
    }

    /**
     * Setup realtime subscription for settings
     */
    async setupSubscription(id: string) {
        if (!browser || this.unsubscribe) return;

        try {
            this.unsubscribe = await pb.collection('newsletter_settings').subscribe(id, (e) => {
                if (e.action === 'update') {
                    this.settings = e.record as unknown as NewsletterSettings;
                    // If scan just completed, reload newsletters
                    if (this.settings.scan_status === 'completed') {
                        this.loadNewsletters(1);
                    }
                }
            });
        } catch (err) {
            console.error('Failed to subscribe to newsletter settings:', err);
        }
    }

    /**
     * Enable newsletter detection
     */
    async enableNewsletter() {
        this.isLoading = true;
        this.lastDismissedScanId = null; // Reset dismissal on new activation
        if (browser) localStorage.removeItem(DISMISSED_SCAN_KEY);
        await withErrorHandling(
            async () => {
                const settings = await NewsletterService.enableNewsletter();
                this.settings = settings;
                this.setupSubscription(settings.id);
                await this.loadNewsletters();
            },
            {
                successMessage: 'Newsletter detection enabled',
                errorMessage: 'Failed to enable newsletter detection',
                onSuccess: () => {
                    this.isLoading = false;
                }
            }
        );
    }

    /**
     * Disable newsletter detection
     */
    async disableNewsletter() {
        this.isLoading = true;
        await withErrorHandling(
            async () => {
                const settings = await NewsletterService.disableNewsletter();
                this.settings = settings;
            },
            {
                successMessage: 'Newsletter detection disabled',
                errorMessage: 'Failed to disable newsletter detection',
                onSuccess: () => {
                    this.isLoading = false;
                }
            }
        );
    }

    /**
     * Trigger a manual rescan
     */
    async startScan() {
        this.lastDismissedScanId = null; // Reset dismissal on manual rescan
        if (browser) localStorage.removeItem(DISMISSED_SCAN_KEY);
        await withErrorHandling(
            async () => {
                await NewsletterService.startScan();
            },
            {
                successMessage: 'Newsletter scan started',
                errorMessage: 'Failed to start newsletter scan'
            }
        );
    }

    /**
     * Load newsletters with current filters and pagination
     */
    async loadNewsletters(page: number = 1) {
        this.isLoading = true;
        this.currentPage = page;

        await withErrorHandling(
            async () => {
                const result = await NewsletterService.getNewsletters(this.filter, page);
                this.newsletters = result.items;
                this.totalItems = result.totalItems;
                this.totalPages = result.totalPages;
            },
            {
                errorMessage: 'Failed to load newsletters',
                onSuccess: () => {
                    this.isLoading = false;
                }
            }
        );
    }

    /**
     * Toggle active status of a newsletter
     */
    async toggleActive(id: string, isActive: boolean) {
        await withErrorHandling(
            async () => {
                const updated = await NewsletterService.toggleActive(id, isActive);
                const index = this.newsletters.findIndex(n => n.id === id);
                if (index !== -1) {
                    this.newsletters[index] = updated;
                }
            },
            {
                successMessage: isActive ? 'Newsletter activated' : 'Newsletter deactivated',
                errorMessage: 'Failed to update newsletter status'
            }
        );
    }

    /**
     * Update filters and reload
     */
    async setFilter(newFilter: NewsletterFilter) {
        this.filter = { ...this.filter, ...newFilter };
        await this.loadNewsletters(1);
    }

    /**
     * Toggle sort column
     */
    async toggleSort(column: string) {
        const currentSort = this.filter.sort || "";
        let newSort = column;

        if (currentSort === column) {
            // If already sorting by this column asc, toggle to desc
            newSort = `-${column}`;
        } else if (currentSort === `-${column}`) {
            // If already sorting by this column desc, toggle to asc
            newSort = column;
        }

        await this.setFilter({ sort: newSort });
    }

    /**
     * Dismiss the current completed scan
     */
    dismissScan() {
        if (this.settings?.id) {
            this.lastDismissedScanId = this.settings.id;
            if (browser) localStorage.setItem(DISMISSED_SCAN_KEY, this.settings.id);
        }
    }

    /**
     * Reset the store state
     */
    reset() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.settings = null;
        this.newsletters = [];
        this.isLoading = false;
        this.error = null;
        this.totalItems = 0;
        this.totalPages = 0;
        this.currentPage = 1;
        this.filter = { searchQuery: "" };
        this.lastDismissedScanId = null;
        if (browser) localStorage.removeItem(DISMISSED_SCAN_KEY);
    }
}

export const newsletterStore = new NewsletterStore();

