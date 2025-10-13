/**
 * Parses an HSL string to an array of numbers.
 * @param hslStr - The HSL string (e.g., "225 8% 18%").
 * @returns An array [h, s, l] or null if parsing fails.
 */
export function parseHsl(hslStr: string): [number, number, number] | null {
	const match = hslStr.match(/(\d+(\.\d+)?)/g);
	if (match && match.length === 3) {
		return [
			parseFloat(match[0]),
			parseFloat(match[1]),
			parseFloat(match[2]),
		];
	}
	return null;
}

/**
 * Converts HSL color values to a HEX string.
 * @param h - Hue
 * @param s - Saturation
 * @param l - Lightness
 * @returns The HEX color string.
 */
export function hslToHex(h: number, s: number, l: number): string {
	s /= 100;
	l /= 100;

	let c = (1 - Math.abs(2 * l - 1)) * s,
		x = c * (1 - Math.abs(((h / 60) % 2) - 1)),
		m = l - c / 2,
		r = 0,
		g = 0,
		b = 0;

	if (0 <= h && h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (60 <= h && h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (120 <= h && h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (180 <= h && h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (240 <= h && h < 300) {
		r = x;
		g = 0;
		b = c;
	} else if (300 <= h && h < 360) {
		r = c;
		g = 0;
		b = x;
	}

	r = Math.round((r + m) * 255);
	g = Math.round((g + m) * 255);
	b = Math.round((b + m) * 255);

	return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Converts a HEX color string to an HSL value string.
 * @param H - The HEX color string (e.g., "#2A2D34").
 * @returns The HSL value string (e.g., "225 8% 18%").
 */
export function hexToHslValues(H: string): string {
	// Convert hex to RGB first
	let r = 0,
		g = 0,
		b = 0;
	if (H.length == 4) {
		r = parseInt('0x' + H[1] + H[1]);
		g = parseInt('0x' + H[2] + H[2]);
		b = parseInt('0x' + H[3] + H[3]);
	} else if (H.length == 7) {
		r = parseInt('0x' + H[1] + H[2]);
		g = parseInt('0x' + H[3] + H[4]);
		b = parseInt('0x' + H[5] + H[6]);
	}
	// Then to HSL
	r /= 255;
	g /= 255;
	b /= 255;
	let cmin = Math.min(r, g, b),
		cmax = Math.max(r, g, b),
		delta = cmax - cmin,
		h = 0,
		s = 0,
		l = 0;

	if (delta == 0) h = 0;
	else if (cmax == r) h = ((g - b) / delta) % 6;
	else if (cmax == g) h = (b - r) / delta + 2;
	else h = (r - g) / delta + 4;

	h = Math.round(h * 60);

	if (h < 0) h += 360;

	l = (cmax + cmin) / 2;
	s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
	s = +(s * 100).toFixed(1);
	l = +(l * 100).toFixed(1);

	return `${h} ${s}% ${l}%`;
}
