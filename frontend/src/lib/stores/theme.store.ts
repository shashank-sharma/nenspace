import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

function createThemeStore() {
    // Get initial theme from localStorage or system preference
    const getInitialTheme = (): Theme => {
        if (!browser) return 'light';
        
        const savedTheme = localStorage.getItem('theme') as Theme;
        if (savedTheme) return savedTheme;
        
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const { subscribe, set } = writable<Theme>(getInitialTheme());

    return {
        subscribe,
        getTheme: (): Theme => {
            if (!browser) return 'light';
            
            const savedTheme = localStorage.getItem('theme') as Theme;
            if (savedTheme) return savedTheme;
            
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        },
        toggleTheme: () => {
            if (!browser) return;
            
            const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            document.documentElement.classList.toggle('dark');
            localStorage.setItem('theme', newTheme);
            set(newTheme);
        },
        setTheme: (theme: Theme) => {
            if (!browser) return;
            
            document.documentElement.classList.toggle('dark', theme === 'dark');
            localStorage.setItem('theme', theme);
            set(theme);
        }
    };
}

export const theme = createThemeStore();