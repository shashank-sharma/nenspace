import { browser } from "$app/environment";

class PersistentState<T> {
    #state: T;

    constructor(
        private key: string,
        defaultValue: T,
    ) {
        const storedValue = browser ? localStorage.getItem(this.key) : null;
        let initialState = defaultValue;
        if (storedValue) {
            try {
                initialState = JSON.parse(storedValue);
            } catch (e) {
                console.error(
                    `Failed to parse localStorage key "${this.key}", removing it.`,
                    e,
                );
                localStorage.removeItem(this.key);
            }
        }
        this.#state = $state(initialState);
    }

    get value() {
        return this.#state;
    }

    set value(newValue: T) {
        this.#state = newValue;
        if (browser) {
            localStorage.setItem(this.key, JSON.stringify(newValue));
        }
    }
}

const pocketbaseUrl = new PersistentState(
    "pocketbaseUrl",
    "http://127.0.0.1:8090",
);

export const ConfigService = {
    pocketbaseUrl: pocketbaseUrl,
};
