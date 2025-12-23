import type { Color, ColorPalette, ColorHarmony, ExtractedPalette } from '../types';

class ColorsStore {
    selectedColor = $state<Color | null>(null);
    activePalette = $state<ColorPalette | null>(null);
    extractedPalette = $state<ExtractedPalette | null>(null);
    currentHarmony = $state<ColorHarmony | null>(null);
    activeTab = $state<'palettes' | 'picker' | 'extract' | 'harmony'>('palettes');
    isPaletteModalOpen = $state(false);
    palettes = $state<ColorPalette[]>([]);
    isLoading = $state(false);
    searchQuery = $state('');
    pickerColor = $state<Color | null>(null);

    filteredPalettes = $derived(
        this.searchQuery
            ? this.palettes.filter(p =>
                p.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                p.description?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                p.tags?.some(tag => tag.toLowerCase().includes(this.searchQuery.toLowerCase()))
            )
            : this.palettes
    );

    setSelectedColor(color: Color | null) {
        this.selectedColor = color;
    }

    setActivePalette(palette: ColorPalette | null) {
        this.activePalette = palette;
    }

    setExtractedPalette(palette: ExtractedPalette | null) {
        this.extractedPalette = palette;
    }

    setCurrentHarmony(harmony: ColorHarmony | null) {
        this.currentHarmony = harmony;
    }

    setActiveTab(tab: typeof this.activeTab) {
        this.activeTab = tab;
    }

    setPaletteModalOpen(open: boolean) {
        this.isPaletteModalOpen = open;
    }

    setPalettes(palettes: ColorPalette[]) {
        this.palettes = palettes;
    }

    addPalette(palette: ColorPalette) {
        this.palettes = [...this.palettes, palette];
    }

    updatePalette(paletteId: string, updates: Partial<ColorPalette>) {
        this.palettes = this.palettes.map(p =>
            p.id === paletteId ? { ...p, ...updates } : p
        );
    }

    removePalette(paletteId: string) {
        this.palettes = this.palettes.filter(p => p.id !== paletteId);
    }

    setLoading(loading: boolean) {
        this.isLoading = loading;
    }

    setSearchQuery(query: string) {
        this.searchQuery = query;
    }

    setPickerColor(color: Color | null) {
        this.pickerColor = color;
    }

    reset() {
        this.selectedColor = null;
        this.activePalette = null;
        this.extractedPalette = null;
        this.currentHarmony = null;
        this.pickerColor = null;
    }
}

export const colorsStore = new ColorsStore();

