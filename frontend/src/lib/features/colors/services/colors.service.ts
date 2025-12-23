import { pb } from '$lib/config/pocketbase';
import { NetworkService } from '$lib/services/network.service.svelte';
import { toast } from 'svelte-sonner';
import type { Color, ColorPalette } from '../types';
import { PaletteStorageService } from './palette-storage.service';
import { hexToRgb } from '../utils/color-conversion.util';
import { hexToHslValues, parseHsl, hslToHex } from '$lib/utils/color.utils';
import { PALETTE_PAGE_SIZE } from '../constants';

export class ColorsService {
    static async fetchPalettes(searchQuery?: string): Promise<ColorPalette[]> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            return [];
        }

        try {
            if (NetworkService.isOnline) {
                let filter = `user = "${userId}"`;
                if (searchQuery?.trim()) {
                    filter += ` && (name ~ "${searchQuery}" || description ~ "${searchQuery}")`;
                }

                const resultList = await pb.collection('color_palettes').getList(1, PALETTE_PAGE_SIZE, {
                    sort: '-updated',
                    filter,
                });

                const palettes = resultList.items as ColorPalette[];
                await this.cachePalettes(palettes);

                return palettes;
            } else {
                let cachedPalettes = await PaletteStorageService.getPalettesByUser(userId);

                if (searchQuery?.trim()) {
                    cachedPalettes = await PaletteStorageService.searchPalettes(searchQuery);
                }

                return cachedPalettes;
            }
        } catch (error) {
            console.error('Failed to fetch palettes from server, using cache:', error);
            const cachedPalettes = await PaletteStorageService.getPalettesByUser(userId);
            return cachedPalettes;
        }
    }

    private static async cachePalettes(palettes: ColorPalette[]): Promise<void> {
        try {
            for (const palette of palettes) {
                await PaletteStorageService.savePalette(palette);
            }
        } catch (error) {
            console.error('Failed to cache palettes:', error);
        }
    }

    static async createPalette(palette: Omit<ColorPalette, 'id' | 'created' | 'updated' | 'user'>): Promise<ColorPalette> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        try {
            if (NetworkService.isOnline) {
                const record = await pb.collection('color_palettes').create({
                    ...palette,
                    user: userId,
                });

                const newPalette = record as unknown as ColorPalette;
                await PaletteStorageService.savePalette(newPalette);
                toast.success('Palette created successfully');
                return newPalette;
            } else {
                const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const localPalette: ColorPalette = {
                    ...palette,
                    id: localId,
                    user: userId,
                    created: new Date().toISOString(),
                    updated: new Date().toISOString(),
                };

                await PaletteStorageService.savePalette(localPalette);
                toast.success('Palette saved locally (will sync when online)');
                return localPalette;
            }
        } catch (error) {
            console.error('Failed to create palette:', error);
            toast.error('Failed to create palette');
            throw error;
        }
    }

    static async updatePalette(paletteId: string, updates: Partial<ColorPalette>): Promise<ColorPalette> {
        const userId = pb.authStore.model?.id;
        if (!userId) {
            throw new Error('User not authenticated');
        }

        try {
            if (NetworkService.isOnline) {
                const record = await pb.collection('color_palettes').update(paletteId, {
                    ...updates,
                    updated: new Date().toISOString(),
                });

                const updatedPalette = record as unknown as ColorPalette;
                await PaletteStorageService.savePalette(updatedPalette);
                toast.success('Palette updated successfully');
                return updatedPalette;
            } else {
                const existing = await PaletteStorageService.getPalette(paletteId);
                if (!existing) {
                    throw new Error('Palette not found');
                }

                const updatedPalette: ColorPalette = {
                    ...existing,
                    ...updates,
                    updated: new Date().toISOString(),
                };

                await PaletteStorageService.savePalette(updatedPalette);
                toast.success('Palette updated locally (will sync when online)');
                return updatedPalette;
            }
        } catch (error) {
            console.error('Failed to update palette:', error);
            toast.error('Failed to update palette');
            throw error;
        }
    }

    static async deletePalette(paletteId: string): Promise<void> {
        try {
            if (NetworkService.isOnline) {
                await pb.collection('color_palettes').delete(paletteId);
            }

            await PaletteStorageService.deletePalette(paletteId);
            toast.success('Palette deleted successfully');
        } catch (error) {
            console.error('Failed to delete palette:', error);
            toast.error('Failed to delete palette');
            throw error;
        }
    }

    static createColorFromHex(hex: string): Color {
        const rgb = hexToRgb(hex);
        const hslStr = hexToHslValues(hex);
        const hslArr = parseHsl(hslStr);

        if (!hslArr) {
            throw new Error('Invalid hex color');
        }

        return {
            hex: hex.toUpperCase(),
            rgb,
            hsl: {
                h: hslArr[0],
                s: hslArr[1],
                l: hslArr[2],
            },
        };
    }

    static lightenColor(color: Color, amount: number): Color {
        const newL = Math.min(100, color.hsl.l + amount);
        const newHex = hslToHex(color.hsl.h, color.hsl.s, newL);
        return this.createColorFromHex(newHex);
    }

    static darkenColor(color: Color, amount: number): Color {
        const newL = Math.max(0, color.hsl.l - amount);
        const newHex = hslToHex(color.hsl.h, color.hsl.s, newL);
        return this.createColorFromHex(newHex);
    }

    static saturateColor(color: Color, amount: number): Color {
        const newS = Math.min(100, color.hsl.s + amount);
        const newHex = hslToHex(color.hsl.h, newS, color.hsl.l);
        return this.createColorFromHex(newHex);
    }

    static desaturateColor(color: Color, amount: number): Color {
        const newS = Math.max(0, color.hsl.s - amount);
        const newHex = hslToHex(color.hsl.h, newS, color.hsl.l);
        return this.createColorFromHex(newHex);
    }

    static isValidHex(hex: string): boolean {
        return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
    }
}

