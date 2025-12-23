import { browser } from '$app/environment';
import type { Color, ExtractedPalette, ImageExtractionOptions, RGB } from '../types';
import { hexToRgb, rgbToHex } from '../utils/color-conversion.util';
import { hexToHslValues, parseHsl } from '$lib/utils/color.utils';

interface PixelData {
    r: number;
    g: number;
    b: number;
    count: number;
}

export async function extractColorsFromImage(
    file: File,
    options: ImageExtractionOptions = { algorithm: 'dominant', colorCount: 5 }
): Promise<ExtractedPalette> {
    if (!browser) {
        throw new Error('Image extraction only works in browser');
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imageUrl = e.target?.result as string;
                const colors = await extractColorsFromImageUrl(imageUrl, options);
                resolve({
                    colors,
                    source: imageUrl,
                    extractionOptions: options,
                });
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

export async function extractColorsFromImageUrl(
    imageUrl: string,
    options: ImageExtractionOptions = { algorithm: 'dominant', colorCount: 5 }
): Promise<Color[]> {
    if (!browser) {
        throw new Error('Image extraction only works in browser');
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const pixels = imageData.data;

                let colors: Color[];

                switch (options.algorithm) {
                    case 'dominant':
                        colors = extractDominantColors(pixels, options.colorCount, options.sampleRate);
                        break;
                    case 'kmeans':
                        colors = extractKMeansColors(pixels, options.colorCount, options.sampleRate);
                        break;
                    case 'simple':
                        colors = extractSimpleColors(pixels, options.colorCount, options.sampleRate);
                        break;
                    default:
                        colors = extractDominantColors(pixels, options.colorCount, options.sampleRate);
                }

                resolve(colors);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
    });
}

function extractDominantColors(
    pixels: Uint8ClampedArray,
    colorCount: number,
    sampleRate: number = 10
): Color[] {
    const colorMap = new Map<string, PixelData>();

    for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        if (a < 128) continue;

        const quantizedR = Math.round(r / 10) * 10;
        const quantizedG = Math.round(g / 10) * 10;
        const quantizedB = Math.round(b / 10) * 10;
        const key = `${quantizedR},${quantizedG},${quantizedB}`;

        if (colorMap.has(key)) {
            colorMap.get(key)!.count++;
        } else {
            colorMap.set(key, { r: quantizedR, g: quantizedG, b: quantizedB, count: 1 });
        }
    }

    const sortedColors = Array.from(colorMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, colorCount);

    return sortedColors.map(pixel => createColorFromRgb({ r: pixel.r, g: pixel.g, b: pixel.b }));
}

function extractSimpleColors(
    pixels: Uint8ClampedArray,
    colorCount: number,
    sampleRate: number = 50
): Color[] {
    const colors: Color[] = [];
    const step = Math.max(1, Math.floor((pixels.length / 4) / colorCount / sampleRate));

    for (let i = 0; i < pixels.length && colors.length < colorCount; i += 4 * step) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const a = pixels[i + 3];

        if (a >= 128) {
            colors.push(createColorFromRgb({ r, g, b }));
        }
    }

    return colors;
}

function extractKMeansColors(
    pixels: Uint8ClampedArray,
    colorCount: number,
    sampleRate: number = 20
): Color[] {
    const samples: RGB[] = [];
    for (let i = 0; i < pixels.length; i += 4 * sampleRate) {
        const a = pixels[i + 3];
        if (a >= 128) {
            samples.push({
                r: pixels[i],
                g: pixels[i + 1],
                b: pixels[i + 2],
            });
        }
    }

    if (samples.length === 0) {
        return [];
    }

    const centroids: RGB[] = [];
    for (let i = 0; i < colorCount; i++) {
        const randomIndex = Math.floor(Math.random() * samples.length);
        centroids.push({ ...samples[randomIndex] });
    }

    for (let iter = 0; iter < 10; iter++) {
        const clusters: RGB[][] = Array(colorCount).fill(null).map(() => []);

        for (const sample of samples) {
            let minDist = Infinity;
            let nearestCluster = 0;

            for (let i = 0; i < centroids.length; i++) {
                const dist = colorDistance(sample, centroids[i]);
                if (dist < minDist) {
                    minDist = dist;
                    nearestCluster = i;
                }
            }

            clusters[nearestCluster].push(sample);
        }

        for (let i = 0; i < centroids.length; i++) {
            if (clusters[i].length > 0) {
                const avg = clusters[i].reduce(
                    (acc, pixel) => ({
                        r: acc.r + pixel.r,
                        g: acc.g + pixel.g,
                        b: acc.b + pixel.b,
                    }),
                    { r: 0, g: 0, b: 0 }
                );
                centroids[i] = {
                    r: Math.round(avg.r / clusters[i].length),
                    g: Math.round(avg.g / clusters[i].length),
                    b: Math.round(avg.b / clusters[i].length),
                };
            }
        }
    }

    return centroids.map(rgb => createColorFromRgb(rgb));
}

function colorDistance(c1: RGB, c2: RGB): number {
    const dr = c1.r - c2.r;
    const dg = c1.g - c2.g;
    const db = c1.b - c2.b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
}

function createColorFromRgb(rgb: RGB): Color {
    const hex = rgbToHex(rgb);
    const hslStr = hexToHslValues(hex);
    const hslArr = parseHsl(hslStr);

    if (!hslArr) {
        throw new Error('Failed to parse HSL');
    }

    return {
        hex,
        rgb,
        hsl: {
            h: hslArr[0],
            s: hslArr[1],
            l: hslArr[2],
        },
    };
}

