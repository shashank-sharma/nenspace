import { browser } from "$app/environment";
import { DebugService } from "$lib/services/debug.service.svelte";
import type { DebugControl } from "$lib/services/debug.service.svelte";
import type { ComponentType } from "svelte";

/**
 * Debug Settings Manager
 * Handles localStorage persistence and provides type-safe helpers
 */
export class DebugSettings<T extends Record<string, any>> {
    private readonly storageKey: string;
    private readonly defaults: T;
    public current: T;

    constructor(storageKey: string, defaults: T) {
        this.storageKey = storageKey;
        this.defaults = defaults;
        this.current = this.load();
    }

    /**
     * Load settings from localStorage, merging with defaults
     */
    private load(): T {
        if (!browser) return { ...this.defaults };

        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                return { ...this.defaults, ...parsed };
            } catch (e) {
                console.error(`Failed to parse debug settings for ${this.storageKey}:`, e);
            }
        }
        return { ...this.defaults };
    }

    /**
     * Update a specific setting and persist to localStorage
     */
    update<K extends keyof T>(key: K, value: T[K]): void {
        this.current[key] = value;
        if (browser) {
            localStorage.setItem(this.storageKey, JSON.stringify(this.current));
        }
    }

    /**
     * Reset to defaults
     */
    reset(): void {
        this.current = { ...this.defaults };
        if (browser) {
            localStorage.removeItem(this.storageKey);
        }
    }

    /**
     * Get current value of a setting
     */
    get<K extends keyof T>(key: K): T[K] {
        return this.current[key];
    }
}

/**
 * Page Debug Section Builder
 * Fluent API for building debug sections with less boilerplate
 */
export class PageDebugBuilder {
    private readonly sectionId: string;
    private readonly title: string;
    private readonly controls: DebugControl[] = [];

    constructor(sectionId: string, title: string) {
        this.sectionId = sectionId;
        this.title = title;
    }

    /**
     * Add a button control
     */
    addButton(id: string, label: string, onClick: () => void): this {
        this.controls.push({
            id,
            component: null, // Will be set during register
            props: { label, click: onClick },
        });
        return this;
    }

    /**
     * Add a switch control
     */
    addSwitch(
        id: string,
        label: string,
        checked: boolean,
        onChange: (value: boolean) => void,
        description?: string,
    ): this {
        this.controls.push({
            id,
            component: null, // Will be set during register
            props: { label, checked, change: onChange, description },
        });
        return this;
    }

    /**
     * Add a select control
     */
    addSelect(
        id: string,
        label: string,
        options: { value: string; label: string }[],
        value: string,
        onChange: (value: string) => void,
    ): this {
        this.controls.push({
            id,
            component: null, // Will be set during register
            props: { label, options, value, change: onChange },
        });
        return this;
    }

    /**
     * Add a custom control
     */
    addCustom(id: string, component: ComponentType, props: Record<string, any>): this {
        this.controls.push({ id, component, props });
        return this;
    }

    /**
     * Register the section with DebugService
     * Returns cleanup function
     */
    register(
        components: {
            ButtonControl: ComponentType;
            SwitchControl: ComponentType;
            SelectControl: ComponentType | null;
        },
    ): () => void {
        // Set component references
        this.controls.forEach((control) => {
            if (!control.component) {
                // Auto-detect component type based on props
                if (control.props.click !== undefined) {
                    control.component = components.ButtonControl;
                } else if (control.props.checked !== undefined) {
                    control.component = components.SwitchControl;
                } else if (control.props.options !== undefined) {
                    control.component = components.SelectControl;
                }
            }
        });

        DebugService.registerSection({
            id: this.sectionId,
            title: this.title,
            isPageSpecific: true,
            controls: this.controls,
        });

        // Return cleanup function
        return () => {
            DebugService.unregisterSection(this.sectionId);
        };
    }
}

/**
 * Helper to create a page debug section
 */
export function createPageDebug(sectionId: string, title: string): PageDebugBuilder {
    return new PageDebugBuilder(sectionId, title);
}

