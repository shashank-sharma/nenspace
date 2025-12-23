import { BaseStorageService } from '$lib/services/base-storage.service';
import type { ColorPalette } from '../types';

const STORE_PALETTES = 'palettes';

class PaletteStorageServiceImpl extends BaseStorageService<ColorPalette> {
    constructor() {
        super({
            name: 'nen_space_color_palettes',
            version: 1,
            stores: [
                {
                    name: STORE_PALETTES,
                    keyPath: 'id',
                    indexes: [
                        { name: 'user', keyPath: 'user' },
                        { name: 'name', keyPath: 'name' },
                        { name: 'is_public', keyPath: 'is_public' },
                    ],
                },
            ],
        });
    }

    async savePalette(palette: ColorPalette): Promise<void> {
        return this.save(STORE_PALETTES, palette);
    }

    async getAllPalettes(): Promise<ColorPalette[]> {
        return this.getAll(STORE_PALETTES);
    }

    async getPalette(paletteId: string): Promise<ColorPalette | null> {
        return this.getById(STORE_PALETTES, paletteId);
    }

    async deletePalette(paletteId: string): Promise<void> {
        return this.delete(STORE_PALETTES, paletteId);
    }

    async getPalettesByUser(userId: string): Promise<ColorPalette[]> {
        return this.getByIndex(STORE_PALETTES, 'user', userId);
    }

    async searchPalettes(query: string): Promise<ColorPalette[]> {
        const allPalettes = await this.getAllPalettes();
        const lowerQuery = query.toLowerCase();
        return allPalettes.filter(palette =>
            palette.name.toLowerCase().includes(lowerQuery) ||
            palette.description?.toLowerCase().includes(lowerQuery) ||
            palette.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
    }
}

export const PaletteStorageService = new PaletteStorageServiceImpl();

