/**
 * Settings Modal Service
 * 
 * Centralized state management for the fullscreen settings modal.
 * Follows existing service patterns with reactive $state.
 */

class SettingsModalServiceImpl {
    #isOpen = $state(false);

    constructor() {
        // Initialize service
    }

    get isOpen() {
        return this.#isOpen;
    }

    open = () => {
        this.#isOpen = true;
    };

    close = () => {
        this.#isOpen = false;
    };

    toggle = () => {
        this.#isOpen = !this.#isOpen;
    };
}

export const SettingsModalService = new SettingsModalServiceImpl();
