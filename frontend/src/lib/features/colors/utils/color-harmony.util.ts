import type { Color, ColorHarmony, HSL } from '../types';
import { hexToRgb } from './color-conversion.util';
import { hslToHex } from '$lib/utils/color.utils';

export function generateComplementary(baseColor: Color): Color {
    const hsl = baseColor.hsl;
    const newHue = (hsl.h + 180) % 360;
    const newHsl: HSL = { h: newHue, s: hsl.s, l: hsl.l };
    const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
    const newRgb = hexToRgb(newHex);

    return {
        hex: newHex,
        rgb: newRgb,
        hsl: newHsl,
    };
}

export function generateTriadic(baseColor: Color): Color[] {
    const hsl = baseColor.hsl;
    const colors: Color[] = [baseColor];

    for (let i = 1; i < 3; i++) {
        const newHue = (hsl.h + 120 * i) % 360;
        const newHsl: HSL = { h: newHue, s: hsl.s, l: hsl.l };
        const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
        const newRgb = hexToRgb(newHex);

        colors.push({
            hex: newHex,
            rgb: newRgb,
            hsl: newHsl,
        });
    }

    return colors;
}

export function generateTetradic(baseColor: Color): Color[] {
    const hsl = baseColor.hsl;
    const colors: Color[] = [baseColor];

    for (let i = 1; i < 4; i++) {
        const newHue = (hsl.h + 90 * i) % 360;
        const newHsl: HSL = { h: newHue, s: hsl.s, l: hsl.l };
        const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
        const newRgb = hexToRgb(newHex);

        colors.push({
            hex: newHex,
            rgb: newRgb,
            hsl: newHsl,
        });
    }

    return colors;
}

export function generateAnalogous(baseColor: Color, count: number = 5): Color[] {
    const hsl = baseColor.hsl;
    const colors: Color[] = [baseColor];
    const step = 30;
    const half = Math.floor(count / 2);

    for (let i = 1; i <= half; i++) {
        const newHue1 = (hsl.h - step * i + 360) % 360;
        const newHsl1: HSL = { h: newHue1, s: hsl.s, l: hsl.l };
        const newHex1 = hslToHex(newHsl1.h, newHsl1.s, newHsl1.l);
        const newRgb1 = hexToRgb(newHex1);

        colors.unshift({
            hex: newHex1,
            rgb: newRgb1,
            hsl: newHsl1,
        });

        if (colors.length < count) {
            const newHue2 = (hsl.h + step * i) % 360;
            const newHsl2: HSL = { h: newHue2, s: hsl.s, l: hsl.l };
            const newHex2 = hslToHex(newHsl2.h, newHsl2.s, newHsl2.l);
            const newRgb2 = hexToRgb(newHex2);

            colors.push({
                hex: newHex2,
                rgb: newRgb2,
                hsl: newHsl2,
            });
        }
    }

    return colors.slice(0, count);
}

export function generateMonochromatic(baseColor: Color, count: number = 5): Color[] {
    const hsl = baseColor.hsl;
    const colors: Color[] = [];

    for (let i = 0; i < count; i++) {
        const lightness = 20 + (i * (80 / (count - 1)));
        const saturation = Math.max(30, hsl.s - (i * 10));
        const newHsl: HSL = { h: hsl.h, s: saturation, l: lightness };
        const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
        const newRgb = hexToRgb(newHex);

        colors.push({
            hex: newHex,
            rgb: newRgb,
            hsl: newHsl,
        });
    }

    return colors;
}

export function generateSplitComplementary(baseColor: Color): Color[] {
    const hsl = baseColor.hsl;
    const colors: Color[] = [baseColor];

    const complementHue = (hsl.h + 180) % 360;
    const newHue1 = (complementHue - 30 + 360) % 360;
    const newHue2 = (complementHue + 30) % 360;

    [newHue1, newHue2].forEach(hue => {
        const newHsl: HSL = { h: hue, s: hsl.s, l: hsl.l };
        const newHex = hslToHex(newHsl.h, newHsl.s, newHsl.l);
        const newRgb = hexToRgb(newHex);

        colors.push({
            hex: newHex,
            rgb: newRgb,
            hsl: newHsl,
        });
    });

    return colors;
}

export function generateHarmony(baseColor: Color, type: ColorHarmony['type']): ColorHarmony {
    let colors: Color[];

    switch (type) {
        case 'complementary':
            colors = [baseColor, generateComplementary(baseColor)];
            break;
        case 'triadic':
            colors = generateTriadic(baseColor);
            break;
        case 'tetradic':
            colors = generateTetradic(baseColor);
            break;
        case 'analogous':
            colors = generateAnalogous(baseColor, 5);
            break;
        case 'monochromatic':
            colors = generateMonochromatic(baseColor, 5);
            break;
        case 'split-complementary':
            colors = generateSplitComplementary(baseColor);
            break;
        default:
            colors = [baseColor];
    }

    return {
        type,
        colors,
        baseColor,
    };
}

