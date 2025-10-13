import { browser } from "$app/environment";

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

class DeviceServiceImpl {
    #windowSize = $state({
        width: browser ? window.innerWidth : TABLET_BREAKPOINT,
        height: browser ? window.innerHeight : 768,
    });

    constructor() {
        if (browser) {
            window.addEventListener("resize", this.#handleResize);
        }
    }

    get windowSize() {
        return this.#windowSize;
    }
    get isMobile() {
        return this.#windowSize.width < MOBILE_BREAKPOINT;
    }
    get isTablet() {
        return (
            this.#windowSize.width >= MOBILE_BREAKPOINT &&
            this.#windowSize.width < TABLET_BREAKPOINT
        );
    }
    get isDesktop() {
        return this.#windowSize.width >= TABLET_BREAKPOINT;
    }
    get orientation() {
        return this.#windowSize.width >= this.#windowSize.height
            ? "landscape"
            : "portrait";
    }

    destroy() {
        if (browser) {
            window.removeEventListener("resize", this.#handleResize);
        }
    }

    #handleResize = () => {
        this.#windowSize = {
            width: window.innerWidth,
            height: window.innerHeight,
        };
    };
}

export const DeviceService = new DeviceServiceImpl();
