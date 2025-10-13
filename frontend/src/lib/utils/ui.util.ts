/**
 * UI Utilities
 * Helper functions for UI components and styling
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

/**
 * Format date to readable string
 */
export function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Get Tailwind color class for priority level
 */
export function getPriorityColor(priority: string): string {
    switch (priority) {
        case 'urgent': return 'text-red-500 dark:text-red-400';
        case 'high': return 'text-orange-500 dark:text-orange-400';
        case 'medium': return 'text-yellow-500 dark:text-yellow-400';
        case 'low': return 'text-blue-500 dark:text-blue-400';
        default: return 'text-foreground';
    }
}

/**
 * Merge Tailwind classes with clsx
 * Handles conflicts intelligently (e.g., "px-2 px-4" → "px-4")
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type FlyAndScaleParams = {
    y?: number;
    x?: number;
    start?: number;
    duration?: number;
};

/**
 * Svelte transition: Fly and scale animation
 */
export const flyAndScale = (
    node: Element,
    params: FlyAndScaleParams = { y: -8, x: 0, start: 0.95, duration: 150 }
): TransitionConfig => {
    const style = getComputedStyle(node);
    const transform = style.transform === "none" ? "" : style.transform;

    const scaleConversion = (
        valueA: number,
        scaleA: [number, number],
        scaleB: [number, number]
    ) => {
        const [minA, maxA] = scaleA;
        const [minB, maxB] = scaleB;

        const percentage = (valueA - minA) / (maxA - minA);
        const valueB = percentage * (maxB - minB) + minB;

        return valueB;
    };

    const styleToString = (
        style: Record<string, number | string | undefined>
    ): string => {
        return Object.keys(style).reduce((str, key) => {
            if (style[key] === undefined) return str;
            return str + key + ":" + style[key] + ";";
        }, "");
    };

    return {
        duration: params.duration ?? 200,
        delay: 0,
        css: (t) => {
            const y = scaleConversion(t, [0, 1], [params.y ?? 5, 0]);
            const x = scaleConversion(t, [0, 1], [params.x ?? 0, 0]);
            const scale = scaleConversion(t, [0, 1], [params.start ?? 0.95, 1]);

            return styleToString({
                transform:
                    transform +
                    "translate3d(" +
                    x +
                    "px, " +
                    y +
                    "px, 0) scale(" +
                    scale +
                    ")",
                opacity: t,
            });
        },
        easing: cubicOut,
    };
};
