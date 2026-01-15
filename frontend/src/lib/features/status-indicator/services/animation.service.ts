import { animate, remove } from 'animejs';
import { browser } from '$app/environment';
import { getAnimationPreset, getSpringEasing, type AnimationPreset } from '../utils/animation-presets';

// Anime.js types
type AnimeInstance = ReturnType<typeof animate>;
type AnimeParams = Parameters<typeof animate>[0];

/**
 * Animation presets for Dynamic Island
 */
export const ISLAND_ANIMATIONS = {
    MORPH_DURATION: 400,
    CONTENT_FADE_DURATION: 200,
    SPRING_CONFIG: 'spring(1, 80, 13, 0)', // mass, stiffness, damping, velocity
    MARQUEE_SPEED: 50, // pixels per second
};

class AnimationService {
    private activeAnimations: Set<AnimeInstance> = new Set();

    /**
     * Coordinated morph animation for the island container
     */
    async morph(
        target: HTMLElement | string, 
        config: {
            width: number;
            height: number;
            translateX?: number;
            translateY?: number;
            borderRadius?: number;
            duration?: number;
            easing?: string;
            preset?: AnimationPreset;
        }
    ): Promise<void> {
        if (!browser) return;

        const preset = config.preset ? getAnimationPreset(config.preset) : null;
        const easing = config.easing || (preset ? getSpringEasing(preset) : ISLAND_ANIMATIONS.SPRING_CONFIG);
        const duration = config.duration ?? (preset?.duration ?? ISLAND_ANIMATIONS.MORPH_DURATION);

        return new Promise((resolve) => {
            const anim = animate(target, {
                width: config.width,
                height: config.height,
                translateX: config.translateX ?? 0,
                translateY: config.translateY ?? 0,
                borderRadius: config.borderRadius ?? 20,
                duration,
                easing,
                autoplay: true,
                complete: (instance: any) => {
                    this.activeAnimations.delete(instance);
                    resolve();
                }
            });
            this.activeAnimations.add(anim);
        });
    }

    /**
     * Fade in/out content with optional preset
     */
    async fade(
        target: HTMLElement | string, 
        type: 'in' | 'out',
        options?: {
            preset?: AnimationPreset;
            duration?: number;
        }
    ): Promise<void> {
        if (!browser) return;

        const preset = options?.preset ? getAnimationPreset(options.preset) : null;
        const duration = options?.duration ?? (preset?.duration ?? ISLAND_ANIMATIONS.CONTENT_FADE_DURATION);
        const easing = preset ? getSpringEasing(preset) : 'easeOutQuad';

        return new Promise((resolve) => {
            const anim = animate(target, {
                opacity: type === 'in' ? [0, 1] : [1, 0],
                scale: type === 'in' ? [0.95, 1] : [1, 0.95],
                duration,
                easing,
                autoplay: true,
                complete: (instance: any) => {
                    this.activeAnimations.delete(instance);
                    resolve();
                }
            });
            this.activeAnimations.add(anim);
        });
    }

    /**
     * Coordinated fade + morph transition for view changes
     */
    async transition(
        container: HTMLElement | string,
        content: HTMLElement | string,
        morphConfig: {
            width: number;
            height: number;
            translateX?: number;
            translateY?: number;
            borderRadius?: number;
        },
        options?: {
            preset?: AnimationPreset;
            duration?: number;
        }
    ): Promise<void> {
        if (!browser) return;

        // Fade out content
        await this.fade(content, 'out', options);
        
        // Morph container
        await this.morph(container, {
            ...morphConfig,
            ...options,
        });
        
        // Fade in content
        await this.fade(content, 'in', options);
    }

    /**
     * Bounce animation for attention-grabbing notifications
     */
    bounce(target: HTMLElement | string, intensity: 'light' | 'medium' | 'strong' = 'medium'): AnimeInstance | null {
        if (!browser) return null;

        const scales = {
            light: [1, 1.05, 1],
            medium: [1, 1.1, 1],
            strong: [1, 1.15, 1],
        };

        const anim = animate(target, {
            scale: scales[intensity],
            duration: 400,
            easing: 'spring(1, 100, 10, 0)',
            autoplay: true,
            complete: (instance: any) => {
                this.activeAnimations.delete(instance);
            }
        });

        this.activeAnimations.add(anim);
        return anim;
    }

    /**
     * Create a marquee animation for overflowing text
     * Waits 2 seconds, then scrolls one-way to the end
     */
    createMarquee(target: HTMLElement | string, containerWidth: number, textWidth: number): AnimeInstance | null {
        if (!browser || textWidth <= containerWidth) return null;

        const overflow = textWidth - containerWidth + 20; // some padding
        const scrollDuration = (overflow / ISLAND_ANIMATIONS.MARQUEE_SPEED) * 1000;
        const initialDelay = 1000; // Wait 1 second before starting scroll

        const anim = animate(target, {
            translateX: [0, -overflow],
            duration: scrollDuration,
            delay: initialDelay,
            easing: 'easeInOutQuad',
            autoplay: true,
            complete: (instance: any) => {
                this.activeAnimations.delete(instance);
            }
        });

        this.activeAnimations.add(anim);
        return anim;
    }

    /**
     * Generic animation wrapper with tracking
     */
    animate(target: HTMLElement | string | HTMLElement[], params: any): AnimeInstance {
        const originalComplete = params.complete;
        
        const anim = animate(target, {
            ...params,
            complete: (anim: any) => {
                this.activeAnimations.delete(anim);
                if (typeof originalComplete === 'function') {
                    originalComplete(anim);
                }
            }
        });
        
        this.activeAnimations.add(anim);
        return anim;
    }

    /**
     * Cleanup all active animations
     */
    cleanup(): void {
        this.activeAnimations.forEach(anim => {
            try {
                anim.pause();
            } catch (e) {
                // Ignore errors
            }
        });
        this.activeAnimations.clear();
    }
}

export const AnimationEngine = new AnimationService();
