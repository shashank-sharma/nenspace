import { browser } from "$app/environment";
import { pb } from "$lib/config/pocketbase";
import { emit } from "@tauri-apps/api/event";

class HealthServiceImpl {
    #status = $state({
        connected: null as boolean | null,
        checking: false,
        error: null as string | null,
    });
    #intervalId: NodeJS.Timeout | null = null;

    constructor() {
        if (browser) {
            this.check();
            this.#intervalId = setInterval(() => this.check(), 60000 * 5); // Check every 60 seconds
        }
    }

    get status() {
        return this.#status;
    }

    check = async () => {
        if (this.#status.checking) return;
        this.#status.checking = true;
        this.#status.error = null;

        try {
            const health = await pb.health.check();
            if (health.code === 200) {
                this.#status.connected = true;
            } else {
                throw new Error(health.message);
            }
        } catch (err) {
            this.#status.connected = false;
            this.#status.error =
                err instanceof Error ? err.message : String(err);
        } finally {
            this.#status.checking = false;
        }

        // Emit to floating window
        if (browser && window.__TAURI__) {
            try {
                await emit("health-status-update", {
                    connected: this.#status.connected,
                    checking: this.#status.checking,
                    error: this.#status.error,
                });
            } catch (error) {
                // Silently fail if floating window not available
            }
        }
    };

    destroy = () => {
        if (this.#intervalId) {
            clearInterval(this.#intervalId);
        }
    };
}

export const HealthService = new HealthServiceImpl();
