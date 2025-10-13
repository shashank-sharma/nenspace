/**
 * Floating Indicator Settings Service
 * 
 * Manages settings for the floating status indicator window.
 * Settings persist to localStorage and sync to the floating window via Tauri events.
 */

import { browser } from "$app/environment";
import { emit } from "@tauri-apps/api/event";

export interface FloatingIndicatorSettings {
    enabled: boolean;
    size: number; // Scale factor: 0.5 to 2.0
    opacity: number; // 0.5 to 1.0
}

class PersistentState<T> {
    #state: T;

    constructor(
        private readonly key: string,
        defaultValue: T,
    ) {
        const storedValue = browser ? localStorage.getItem(this.key) : null;
        let initialState = defaultValue;
        if (storedValue) {
            try {
                initialState = JSON.parse(storedValue);
            } catch (e) {
                console.error(
                    `Failed to parse localStorage key "${this.key}", removing it.`,
                    e,
                );
                if (browser) {
                    localStorage.removeItem(this.key);
                }
            }
        }
        this.#state = $state(initialState);
    }

    get value() {
        return this.#state;
    }

    set value(newValue: T) {
        this.#state = newValue;
        if (browser) {
            localStorage.setItem(this.key, JSON.stringify(newValue));
        }
        // Notify floating window via Tauri
        this.syncToFloatingWindow();
    }

    async syncToFloatingWindow() {
        if (browser && window.__TAURI__) {
            try {
                await emit("indicator-settings-update", { settings: this.#state });
            } catch (error) {
                console.error("[FloatingIndicator] Failed to sync settings:", error);
            }
        }
    }
}

const settings = new PersistentState<FloatingIndicatorSettings>(
    "floating_indicator_settings",
    { enabled: true, size: 1.0, opacity: 0.95 },
);

export const FloatingIndicatorService = {
    settings,
};

