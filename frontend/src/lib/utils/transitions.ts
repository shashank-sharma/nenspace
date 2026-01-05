import type { TransitionConfig } from "svelte/transition";
import { cubicOut, cubicIn, cubicInOut, quadOut, quadIn, quadInOut } from "svelte/easing";

export function shouldAnimate(): boolean {
    if (typeof window === "undefined") return true;
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface AnimeTransitionConfig {
    duration?: number;
    easing?: string | number[];
    opacity?: [number, number];
    translateX?: [number, number];
    translateY?: [number, number];
    scale?: [number, number];
    delay?: number;
}

function getEasingFunction(easing: string | number[]) {
    if (typeof easing === "string") {
        switch (easing) {
            case "easeOutCubic":
                return cubicOut;
            case "easeInCubic":
                return cubicIn;
            case "easeInOutCubic":
                return cubicInOut;
            case "easeOutQuad":
                return quadOut;
            case "easeInQuad":
                return quadIn;
            case "easeInOutQuad":
                return quadInOut;
            default:
                return cubicOut;
        }
    }

    return cubicOut;
}

export function animeTransition(
    node: Element,
    config: AnimeTransitionConfig = {}
): TransitionConfig {
    const {
        duration = 300,
        easing = "easeOutCubic",
        opacity = [0, 1],
        translateX = [0, 0],
        translateY = [0, 0],
        scale = [1, 1],
        delay = 0,
    } = config;

    if (!shouldAnimate()) {
        return {
            duration: 0,
            css: () => "",
        };
    }

    const [opacityStart, opacityEnd] = opacity;
    const [translateXStart, translateXEnd] = translateX;
    const [translateYStart, translateYEnd] = translateY;
    const [scaleStart, scaleEnd] = scale;

    const easingFunction = getEasingFunction(easing);

    return {
        duration,
        delay,
        easing: easingFunction,
        css: (t: number) => {

            const opacityValue = opacityStart + (opacityEnd - opacityStart) * t;
            const translateXValue = translateXStart + (translateXEnd - translateXStart) * t;
            const translateYValue = translateYStart + (translateYEnd - translateYStart) * t;
            const scaleValue = scaleStart + (scaleEnd - scaleStart) * t;

            return `
                opacity: ${opacityValue};
                transform: translate3d(${translateXValue}px, ${translateYValue}px, 0) scale(${scaleValue});
            `;
        },
    };
}

export function animePageTransition(
    node: Element,
    direction: "in" | "out" = "in",
    config: Partial<AnimeTransitionConfig> = {}
): TransitionConfig {
    const slideDistance = config.translateX?.[1] || 20;

    if (direction === "out") {
        return animeTransition(node, {
            duration: config.duration || 250,
            easing: config.easing || "easeInCubic",
            opacity: [1, 0],
            translateX: [0, -slideDistance],
            ...config,
        });
    }

    return animeTransition(node, {
        duration: config.duration || 300,
        easing: config.easing || "easeOutCubic",
        opacity: [0, 1],
        translateX: [slideDistance, 0],
        ...config,
    });
}

export function animeSectionTransition(
    node: Element,
    config: Partial<AnimeTransitionConfig> = {}
): TransitionConfig {
    return animeTransition(node, {
        duration: config.duration || 200,
        easing: config.easing || "easeInOutCubic",
        opacity: [0, 1],
        scale: [0.98, 1],
        ...config,
    });
}

export function animeFadeTransition(
    node: Element,
    config: Partial<AnimeTransitionConfig> = {}
): TransitionConfig {
    return animeTransition(node, {
        duration: config.duration || 300,
        easing: config.easing || "easeInOutCubic",
        opacity: [0, 1],
        ...config,
    });
}

export function animeSlideTransition(
    node: Element,
    direction: "left" | "right" | "up" | "down" = "left",
    config: Partial<AnimeTransitionConfig> = {}
): TransitionConfig {
    const distance = config.translateX?.[1] || 30;
    const translateConfig: Partial<AnimeTransitionConfig> = {};

    switch (direction) {
        case "left":
            translateConfig.translateX = [-distance, 0];
            break;
        case "right":
            translateConfig.translateX = [distance, 0];
            break;
        case "up":
            translateConfig.translateY = [-distance, 0];
            break;
        case "down":
            translateConfig.translateY = [distance, 0];
            break;
    }

    return animeTransition(node, {
        duration: config.duration || 300,
        easing: config.easing || "easeOutCubic",
        opacity: [0, 1],
        ...translateConfig,
        ...config,
    });
}

export function animeScaleTransition(
    node: Element,
    config: Partial<AnimeTransitionConfig> = {}
): TransitionConfig {
    return animeTransition(node, {
        duration: config.duration || 300,
        easing: config.easing || "easeOutCubic",
        opacity: [0, 1],
        scale: [0.9, 1],
        ...config,
    });
}

