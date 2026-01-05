

export const COLOR_PALETTE = [
    { name: 'blue', bg: 'bg-blue-500', text: 'text-blue-500', border: 'border-blue-500', light: 'bg-blue-50', dark: 'bg-blue-900/20' },
    { name: 'green', bg: 'bg-green-500', text: 'text-green-500', border: 'border-green-500', light: 'bg-green-50', dark: 'bg-green-900/20' },
    { name: 'purple', bg: 'bg-purple-500', text: 'text-purple-500', border: 'border-purple-500', light: 'bg-purple-50', dark: 'bg-purple-900/20' },
    { name: 'orange', bg: 'bg-orange-500', text: 'text-orange-500', border: 'border-orange-500', light: 'bg-orange-50', dark: 'bg-orange-900/20' },
    { name: 'pink', bg: 'bg-pink-500', text: 'text-pink-500', border: 'border-pink-500', light: 'bg-pink-50', dark: 'bg-pink-900/20' },
    { name: 'teal', bg: 'bg-teal-500', text: 'text-teal-500', border: 'border-teal-500', light: 'bg-teal-50', dark: 'bg-teal-900/20' },
    { name: 'indigo', bg: 'bg-indigo-500', text: 'text-indigo-500', border: 'border-indigo-500', light: 'bg-indigo-50', dark: 'bg-indigo-900/20' },
    { name: 'yellow', bg: 'bg-yellow-500', text: 'text-yellow-500', border: 'border-yellow-500', light: 'bg-yellow-50', dark: 'bg-yellow-900/20' },
    { name: 'red', bg: 'bg-red-500', text: 'text-red-500', border: 'border-red-500', light: 'bg-red-50', dark: 'bg-red-900/20' },
    { name: 'cyan', bg: 'bg-cyan-500', text: 'text-cyan-500', border: 'border-cyan-500', light: 'bg-cyan-50', dark: 'bg-cyan-900/20' },
] as const;

export type ColorInfo = typeof COLOR_PALETTE[number];

function hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

export function getColorForNode(nodeId: string): ColorInfo {
    const hash = hashString(nodeId);
    const index = hash % COLOR_PALETTE.length;
    return COLOR_PALETTE[index];
}

export function createColorMapping(nodeIds: string[]): Map<string, ColorInfo> {
    const mapping = new Map<string, ColorInfo>();
    nodeIds.forEach(nodeId => {
        mapping.set(nodeId, getColorForNode(nodeId));
    });
    return mapping;
}

