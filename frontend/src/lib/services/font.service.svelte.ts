/**
 * Font Service
 * 
 * Manages font loading, @font-face declarations, and global font application.
 * Integrates with SettingsService to react to font preference changes.
 */

import { browser } from '$app/environment';
import { getFontConfig, type FontConfig, getDefaultFontId } from '$lib/config/fonts.config';

class FontServiceImpl {
    #currentFontId: string | null = null;
    #loadedFonts = new Set<string>();
    #fontFaceElements = new Map<string, HTMLStyleElement>();

    /**
     * Initialize font service - apply default or saved font
     */
    initialize(fontId?: string): void {
        if (!browser) return;

        const targetFontId = fontId || getDefaultFontId();
        this.applyFont(targetFontId);
    }

    /**
     * Load font files and create @font-face declarations
     */
    async loadFont(fontId: string): Promise<void> {
        if (!browser) return;
        if (this.#loadedFonts.has(fontId)) return;

        const config = getFontConfig(fontId);
        if (!config) {
            console.warn(`[FontService] Font config not found: ${fontId}`);
            return;
        }

        // System fonts don't need file loading
        if (config.files.length === 0) {
            this.#loadedFonts.add(fontId);
            return;
        }

        try {
            // Create style element for @font-face declarations
            const styleElement = document.createElement('style');
            styleElement.id = `font-face-${fontId}`;
            
            let fontFaceRules = '';

            for (const file of config.files) {
                const fontFace = this.createFontFaceRule(config, file);
                fontFaceRules += fontFace + '\n';
            }

            styleElement.textContent = fontFaceRules;
            document.head.appendChild(styleElement);
            this.#fontFaceElements.set(fontId, styleElement);

            // Preload fonts for better performance
            await this.preloadFonts(config);

            this.#loadedFonts.add(fontId);
            console.log(`[FontService] Loaded font: ${fontId}`);
        } catch (error) {
            console.error(`[FontService] Failed to load font ${fontId}:`, error);
        }
    }

    /**
     * Create @font-face CSS rule
     */
    private createFontFaceRule(config: FontConfig, file: any): string {
        const weight = typeof file.weight === 'number' ? file.weight : 'normal';
        const style = file.style || 'normal';
        const format = file.format || 'woff2';
        
        return `
            @font-face {
                font-family: "${config.family}";
                src: url("${file.path}") format("${format}");
                font-weight: ${weight};
                font-style: ${style};
                font-display: swap;
            }
        `.trim();
    }

    /**
     * Preload font files for better performance
     */
    private async preloadFonts(config: FontConfig): Promise<void> {
        const preloadPromises = config.files.map(file => {
            return new Promise<void>((resolve, reject) => {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'font';
                link.type = `font/${file.format || 'woff2'}`;
                link.crossOrigin = 'anonymous';
                link.href = file.path;

                link.onload = () => resolve();
                link.onerror = () => {
                    console.warn(`[FontService] Failed to preload font: ${file.path}`);
                    resolve(); // Don't reject, just log warning
                };

                document.head.appendChild(link);
            });
        });

        await Promise.all(preloadPromises);
    }

    /**
     * Apply font globally to the document
     */
    async applyFont(fontId: string): Promise<void> {
        if (!browser) return;

        const config = getFontConfig(fontId);
        if (!config) {
            console.warn(`[FontService] Font config not found: ${fontId}, using default`);
            this.applyFont(getDefaultFontId());
            return;
        }

        // Load font files if not already loaded
        if (!this.#loadedFonts.has(fontId)) {
            await this.loadFont(fontId);
        }

        // Apply font to document root
        const fontFamily = `${config.family}, ${config.fallback}`;
        
        // Apply to html element (affects entire document)
        document.documentElement.style.fontFamily = fontFamily;
        
        // Also set as CSS custom property for component-level control
        document.documentElement.style.setProperty('--font-family', fontFamily);

        this.#currentFontId = fontId;
        console.log(`[FontService] Applied font: ${fontId} (${config.family})`);
    }

    /**
     * Get currently applied font ID
     */
    getCurrentFont(): string | null {
        return this.#currentFontId;
    }

    /**
     * Get font configuration
     */
    getFontConfig(fontId: string): FontConfig | undefined {
        return getFontConfig(fontId);
    }

    /**
     * Cleanup font resources (for testing or reset)
     */
    cleanup(): void {
        if (!browser) return;

        // Remove all font-face style elements
        this.#fontFaceElements.forEach((element, fontId) => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        this.#fontFaceElements.clear();
        this.#loadedFonts.clear();
        this.#currentFontId = null;

        // Reset document font
        document.documentElement.style.fontFamily = '';
        document.documentElement.style.removeProperty('--font-family');
    }
}

export const FontService = new FontServiceImpl();

