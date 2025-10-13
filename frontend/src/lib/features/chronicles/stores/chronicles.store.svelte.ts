import { browser } from '$app/environment';
import type { JournalEntry } from '../types';
import { STORAGE_KEYS, TOTAL_STEPS } from '../constants';
import type { ViewMode } from '../constants';

/**
 * ChroniclesStore
 * Global state management for chronicles feature using Svelte 5 runes
 */
class ChroniclesStore {
    currentEntry = $state<JournalEntry | null>(null);
    isLoading = $state(false);
    error = $state<string | null>(null);
    currentStep = $state(1);
    viewMode = $state<ViewMode>('edit');
    hasEntryForToday = $state(false);

    constructor() {
        // Load initial state from localStorage
        if (browser) {
            this.loadFromLocalStorage();
        }
    }

    // Computed properties
    get isFirstStep() {
        return this.currentStep === 1;
    }

    get isLastStep() {
        return this.currentStep === TOTAL_STEPS;
    }

    get canGoBack() {
        return this.currentStep > 1;
    }

    get canGoForward() {
        return this.currentStep < TOTAL_STEPS;
    }

    // State management methods
    reset() {
        this.currentEntry = null;
        this.isLoading = false;
        this.error = null;
        this.currentStep = 1;
        this.viewMode = 'edit';
        this.hasEntryForToday = false;

        if (browser) {
            localStorage.removeItem(STORAGE_KEYS.CHRONICLES_STATE);
        }
    }

    setStep(step: number) {
        if (step >= 1 && step <= TOTAL_STEPS) {
            this.currentStep = step;
            this.saveToLocalStorage();
        }
    }

    nextStep() {
        if (this.canGoForward) {
            this.currentStep++;
            this.saveToLocalStorage();
        }
    }

    prevStep() {
        if (this.canGoBack) {
            this.currentStep--;
            this.saveToLocalStorage();
        }
    }

    setViewMode(mode: ViewMode) {
        this.viewMode = mode;
        this.saveToLocalStorage();
    }

    setCurrentEntry(entry: JournalEntry | null) {
        this.currentEntry = entry;
        this.saveToLocalStorage();
    }

    setLoading(loading: boolean) {
        this.isLoading = loading;
    }

    setError(error: string | null) {
        this.error = error;
    }

    setHasEntryForToday(hasEntry: boolean) {
        this.hasEntryForToday = hasEntry;
        this.saveToLocalStorage();
    }

    updateField<K extends keyof JournalEntry>(field: K, value: JournalEntry[K]) {
        if (this.currentEntry) {
            this.currentEntry = {
                ...this.currentEntry,
                [field]: value,
            };
            this.saveToLocalStorage();
        }
    }

    // Local storage persistence
    private saveToLocalStorage() {
        if (browser) {
            const state = {
                currentEntry: this.currentEntry,
                currentStep: this.currentStep,
                viewMode: this.viewMode,
                hasEntryForToday: this.hasEntryForToday,
            };
            localStorage.setItem(STORAGE_KEYS.CHRONICLES_STATE, JSON.stringify(state));
        }
    }

    private loadFromLocalStorage() {
        if (browser) {
            try {
                const saved = localStorage.getItem(STORAGE_KEYS.CHRONICLES_STATE);
                if (saved) {
                    const state = JSON.parse(saved);
                    this.currentEntry = state.currentEntry || null;
                    this.currentStep = state.currentStep || 1;
                    this.viewMode = state.viewMode || 'edit';
                    this.hasEntryForToday = state.hasEntryForToday || false;
                }
            } catch (error) {
                // Silently fail - invalid localStorage data will be ignored
            }
        }
    }

    clearLocalStorage() {
        if (browser) {
            localStorage.removeItem(STORAGE_KEYS.CHRONICLES_STATE);
        }
    }
}

// Export singleton instance
export const chroniclesStore = new ChroniclesStore();
