import { browser } from "$app/environment";

type Theme = "light" | "dark" | "system" | "nature";

class ThemeServiceImpl {
    #theme = $state<Theme>(this.getInitialTheme());

    constructor() {
        if (browser) {
            this.applyTheme(this.#theme);

            const mediaQuery = window.matchMedia(
                "(prefers-color-scheme: dark)",
            );
            mediaQuery.addEventListener("change", this.handleSystemThemeChange);
        }
    }

    get theme() {
        return this.#theme;
    }

    setTheme = (theme: Theme) => {
        if (!browser) return;
        this.#theme = theme;
        localStorage.setItem("theme", theme);
        this.applyTheme(theme);
    };

    toggleTheme = () => {
        const themes: Theme[] = ["light", "dark", "nature"];
        const currentTheme = this.getInitialTheme();
        const currentIndex = themes.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % themes.length;
        this.setTheme(themes[nextIndex]);
    };

    destroy = () => {
        if (browser) {
            window
                .matchMedia("(prefers-color-scheme: dark)")
                .removeEventListener(
                    "change",
                    this.handleSystemThemeChange,
                );
        }
    };

    private getInitialTheme(): Theme {
        if (!browser) return "dark";
        const savedTheme = localStorage.getItem("theme") as Theme;
        if (savedTheme) return savedTheme;
        return "dark";
    }

    private applyTheme = (theme: Theme) => {
        const doc = document.documentElement;
        doc.classList.remove("dark"); // Remove old class
        let effectiveTheme: "light" | "dark" | "nature" = "light";

        if (theme === "system") {
            effectiveTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light";
        } else {
            effectiveTheme = theme;
        }
        
        doc.setAttribute("data-theme", effectiveTheme);
    };

    private handleSystemThemeChange = () => {
        if (this.#theme === "system") {
            this.applyTheme("system");
        }
    };
}

export const ThemeService = new ThemeServiceImpl();
