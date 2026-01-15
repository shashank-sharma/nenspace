/**
 * Animation Presets for Dynamic Island
 * 
 * Provides consistent animation configurations for different use cases
 */

export type AnimationPreset = 'gentle' | 'snappy' | 'bouncy' | 'critical';

export interface AnimationConfig {
    duration: number;
    easing: string;
    springMass?: number;
    springStiffness?: number;
    springDamping?: number;
    springVelocity?: number;
}

/**
 * Animation presets
 */
export const ANIMATION_PRESETS: Record<AnimationPreset, AnimationConfig> = {
    gentle: {
        duration: 500,
        easing: 'easeInOutQuad',
        springMass: 1,
        springStiffness: 50,
        springDamping: 20,
        springVelocity: 0,
    },
    snappy: {
        duration: 300,
        easing: 'spring(1, 100, 15, 0)',
        springMass: 1,
        springStiffness: 100,
        springDamping: 15,
        springVelocity: 0,
    },
    bouncy: {
        duration: 600,
        easing: 'spring(1, 80, 10, 0)',
        springMass: 1,
        springStiffness: 80,
        springDamping: 10,
        springVelocity: 0,
    },
    critical: {
        duration: 400,
        easing: 'spring(1, 120, 12, 0)',
        springMass: 1,
        springStiffness: 120,
        springDamping: 12,
        springVelocity: 0,
    },
};

/**
 * Get animation config for preset
 */
export function getAnimationPreset(preset: AnimationPreset): AnimationConfig {
    return ANIMATION_PRESETS[preset] || ANIMATION_PRESETS.gentle;
}

/**
 * Get spring easing string for anime.js
 */
export function getSpringEasing(config: AnimationConfig): string {
    if (config.springMass && config.springStiffness && config.springDamping && config.springVelocity !== undefined) {
        return `spring(${config.springMass}, ${config.springStiffness}, ${config.springDamping}, ${config.springVelocity})`;
    }
    return config.easing;
}
