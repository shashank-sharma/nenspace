import { browser } from '$app/environment';
import type { ThemeName, ThemeToken, PaletteTokenValue } from '$lib/theme/palette';
import { THEME_TOKENS } from '$lib/theme/palette';
import { hexToHslValues, hslToHex } from '$lib/utils/color.utils';
import { ThemeService } from './theme.service.svelte';

type TokenMap = Record<ThemeToken, string>; // hsl values

const STORAGE_KEY = 'palette-overrides';
const STORAGE_VERSION = 1;

class PaletteServiceImpl {
    #overrides = $state<Record<ThemeName, Partial<TokenMap>>>({
        light: {},
        dark: {},
        nature: {},
    });

    constructor() {
        if (browser) {
            this.#load();
            // Apply current theme overrides on load
            this.applyToDom(ThemeService.theme as ThemeName);
        }
    }

    get overrides() {
        return this.#overrides;
    }

    getActiveTokens(theme: ThemeName): PaletteTokenValue[] {
        if (!browser) return [];
        const list: PaletteTokenValue[] = [];
        for (const token of THEME_TOKENS) {
            const hsl = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
            const hex = hsl ? hslToHex(...(hsl.match(/(\d+\.?\d*)/g)!.map(Number) as [number, number, number])) : '#000000';
            list.push({ name: token, hsl, hex });
        }
        return list;
    }

    setOverride(theme: ThemeName, token: ThemeToken, hex: string): void {
        const hsl = hexToHslValues(hex);
        this.#overrides[theme] = { ...this.#overrides[theme], [token]: hsl };
        this.#save();
        this.applyToDom(theme);
    }

    clearOverrides(theme?: ThemeName) {
        if (theme) {
            this.#overrides[theme] = {};
        } else {
            this.#overrides = { light: {}, dark: {}, nature: {} } as any;
        }
        this.#save();
        if (browser) this.applyToDom((ThemeService.theme as ThemeName));
    }

    applyToDom(theme: ThemeName) {
        if (!browser) return;
        const overrides = this.#overrides[theme] || {};
        const doc = document.documentElement;
        for (const [token, hsl] of Object.entries(overrides)) {
            doc.style.setProperty(token, hsl as string);
        }
    }

    #load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                // Future migration hook based on version
                this.#overrides = parsed.overrides ?? parsed;
            }
        } catch {}
    }

    #save() {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ version: STORAGE_VERSION, overrides: this.#overrides })
            );
        } catch {}
    }

    export(theme: ThemeName): string {
        const tokens = this.getActiveTokens(theme).reduce<Record<string,string>>((acc, t) => {
            acc[t.name] = t.hex;
            return acc;
        }, {});
        return JSON.stringify({ version: STORAGE_VERSION, theme, tokens }, null, 2);
    }

    import(theme: ThemeName, json: string) {
        const data = JSON.parse(json) as { tokens: Record<string,string> };
        for (const [token, hex] of Object.entries(data.tokens)) {
            this.setOverride(theme, token as ThemeToken, hex);
        }
        this.applyToDom(theme);
    }
}

export const PaletteService = new PaletteServiceImpl();


