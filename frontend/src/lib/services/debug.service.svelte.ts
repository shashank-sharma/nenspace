import { browser } from "$app/environment";
import { registerDefaultDebugSections } from "./debug/default-sections.svelte";
import { ThemeService } from "$lib/services/theme.service.svelte";
import type { ComponentType } from "svelte";

// --- Types ---
export interface DebugControl {
    id: string;
    component: ComponentType | null; // ComponentType or null for deferred assignment
    props: Record<string, any>;
}

export interface DebugSection {
    id: string;
    title: string;
    controls: DebugControl[];
    isPageSpecific?: boolean;
}

// --- Persistent State Class ---
class PersistentState<T> {
    #state: T;

    constructor(
        private key: string,
        defaultValue: T,
    ) {
        const storedValue = browser ? localStorage.getItem(this.key) : null;
        let initialState = defaultValue;
        if (storedValue) {
            try {
                initialState = JSON.parse(storedValue);
            } catch (e) {
                // Fallback for legacy/plain values that weren't JSON-encoded
                // Use the raw string and normalize it back to JSON for next time
                initialState = (storedValue as unknown) as T;
                try {
                    localStorage.setItem(this.key, JSON.stringify(initialState));
                } catch (_) {
                    // If normalization fails, keep value in memory only
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
    }
}

// --- Debug Service ---
export class DebugServiceImpl {
    #isEnabled = new PersistentState("debugEnabled", false);
    #sections = $state<DebugSection[]>([]);

    constructor() {
        this.#registerDefaultSections();
    }

    get isEnabled() {
        return this.#isEnabled.value;
    }

    toggle = () => {
        this.#isEnabled.value = !this.#isEnabled.value;
    };

    get sections() {
        return this.#sections;
    }

    // ✅ FIXED: Use ThemeService directly instead of duplicate storage
    get theme() {
        return ThemeService.theme;
    }

    setTheme = (theme: "light" | "dark" | "system") => {
        // ✅ FIXED: Only use ThemeService (no duplicate storage)
        ThemeService.setTheme(theme);
    };

    registerSection(section: DebugSection) {
        if (!this.#sections.find((s) => s.id === section.id)) {
            this.#sections.push(section);
        }
    }

    unregisterSection(sectionId: string) {
        this.#sections = this.#sections.filter((s) => s.id !== sectionId);
    }

    #registerDefaultSections() {
        registerDefaultDebugSections(this);
    }
}

export const DebugService = new DebugServiceImpl();
