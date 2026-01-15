import { browser } from '$app/environment';
import { 
    IslandPriority, 
    type IslandView, 
    type IslandState 
} from '../types/island.types';
import { AnimationEngine } from './animation.service';

class IslandControllerImpl {
    // Reactive state using Svelte 5 runes
    #state = $state<IslandState>({
        activeView: null,
        isLocked: false,
        isExpanded: false
    });

    #queue = $state<IslandView[]>([]);
    #registry = new Map<string, IslandView>();
    #autoDismissTimeout: NodeJS.Timeout | null = null;

    /**
     * Get the current active view
     */
    get activeView(): IslandView | null {
        return this.#state.activeView;
    }

    /**
     * Get expanded state
     */
    get isExpanded(): boolean {
        return this.#state.isExpanded;
    }

    set isExpanded(value: boolean) {
        this.#state.isExpanded = value;
    }

    /**
     * Register a view template (without showing it)
     */
    register(view: IslandView): void {
        this.#registry.set(view.id, view);
    }

    /**
     * Show a view by ID or by providing a full view object
     */
    async show(viewOrId: string | IslandView, options: { force?: boolean } = {}): Promise<void> {
        const view = typeof viewOrId === 'string' ? this.#registry.get(viewOrId) : viewOrId;
        
        if (!view) {
            console.warn(`[IslandController] View not found: ${viewOrId}`);
            return;
        }

        // Handle priority
        const currentPriority = this.#state.activeView?.priority ?? IslandPriority.IDLE;
        
        if (view.priority > currentPriority || options.force) {
            // High priority view, show immediately and maybe queue current
            if (this.#state.activeView && this.#state.activeView.id !== view.id) {
                this.#queue.push(this.#state.activeView);
                // Sort queue by priority
                this.#queue.sort((a, b) => b.priority - a.priority);
            }
            await this.#transitionTo(view);
        } else {
            // Lower priority, just queue it
            if (!this.#queue.find(v => v.id === view.id)) {
                this.#queue.push(view);
                this.#queue.sort((a, b) => b.priority - a.priority);
            }
        }
    }

    /**
     * Hide current view and show next in queue
     */
    async hide(viewId?: string): Promise<void> {
        // If viewId is provided, only hide if it's the current one
        if (viewId && this.#state.activeView?.id !== viewId) return;

        this.#clearAutoDismiss();

        if (this.#queue.length > 0) {
            const next = this.#queue.shift()!;
            await this.#transitionTo(next);
        } else {
            // If nothing in queue and we're not at IDLE priority (like TimeView),
            // we should probably transition back to TimeView if registered
            const timeView = this.#registry.get('time');
            if (timeView && this.#state.activeView?.id !== 'time') {
                await this.#transitionTo(timeView);
            } else if (this.#state.activeView?.id !== 'time') {
                await this.#transitionTo(null);
            }
        }
    }

    /**
     * Internal: Handle the actual view transition
     */
    async #transitionTo(view: IslandView | null): Promise<void> {
        if (this.#state.isLocked) return;
        this.#state.isLocked = true;

        const previousView = this.#state.activeView;

        // 1. Deactivate previous view
        if (previousView?.onDeactivate) {
            previousView.onDeactivate();
        }

        // 2. Clear auto-dismiss
        this.#clearAutoDismiss();

        // 3. Perform transition (fade out -> morph -> fade in)
        // Note: The UI component (FloatingIsland.svelte) will listen for activeView changes
        // and trigger AnimationEngine.morph. The controller just manages the state.
        
        this.#state.activeView = view;
        this.#state.isExpanded = false; // Reset expansion on view change

        // 4. Activate new view
        if (view?.onActivate) {
            view.onActivate();
        }

        // 5. Setup auto-dismiss if applicable
        if (view?.duration && view.duration > 0) {
            this.#autoDismissTimeout = setTimeout(() => {
                this.hide(view.id);
            }, view.duration);
        }

        this.#state.isLocked = false;
    }

    #clearAutoDismiss(): void {
        if (this.#autoDismissTimeout) {
            clearTimeout(this.#autoDismissTimeout);
            this.#autoDismissTimeout = null;
        }
    }

    /**
     * Force clear everything
     */
    clear(): void {
        this.#clearAutoDismiss();
        this.#queue = [];
        this.#state.activeView = null;
        this.#state.isExpanded = false;
    }
}

export const IslandController = new IslandControllerImpl();
