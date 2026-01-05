/**
 * Color Palette
 * 
 * Centralized color definitions matching frontend design tokens.
 * All color values in HSL format for consistency with frontend theme system.
 */

import type { ThemeName, ThemeToken } from './palette';

// Default theme token values (HSL format: "h s% l%")
export const LIGHT_THEME_COLORS: Record<ThemeToken, string> = {
    '--background': '0 0% 100%',
    '--foreground': '222.2 84% 4.9%',
    '--muted': '210 40% 96.1%',
    '--muted-foreground': '215.4 16.3% 46.9%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '222.2 84% 4.9%',
    '--card': '0 0% 100%',
    '--card-foreground': '222.2 84% 4.9%',
    '--border': '214.3 31.8% 91.4%',
    '--input': '214.3 31.8% 91.4%',
    '--primary': '222.2 47.4% 11.2%',
    '--primary-foreground': '210 40% 98%',
    '--secondary': '210 40% 96.1%',
    '--secondary-foreground': '222.2 47.4% 11.2%',
    '--accent': '210 40% 96.1%',
    '--accent-foreground': '222.2 47.4% 11.2%',
    '--destructive': '0 84.2% 60.2%',
    '--destructive-foreground': '210 40% 98%',
    '--ring': '222.2 84% 4.9%',
    '--completed': '142.1 76.2% 36.3%',
    '--completed-foreground': '355.7 100% 97.3%',
    '--sidebar-background': '0 0% 98%',
    '--sidebar-foreground': '240 5.3% 26.1%',
    '--sidebar-primary': '240 5.9% 10%',
    '--sidebar-primary-foreground': '0 0% 98%',
    '--sidebar-accent': '240 4.8% 95.9%',
    '--sidebar-accent-foreground': '240 5.9% 10%',
    '--sidebar-border': '220 13% 91%',
    '--sidebar-ring': '217.2 91.2% 59.8%',
};

export const DARK_THEME_COLORS: Record<ThemeToken, string> = {
    '--background': '222.2 84% 4.9%',
    '--foreground': '210 40% 98%',
    '--muted': '217.2 32.6% 17.5%',
    '--muted-foreground': '215 20.2% 65.1%',
    '--popover': '222.2 84% 4.9%',
    '--popover-foreground': '210 40% 98%',
    '--card': '222.2 84% 4.9%',
    '--card-foreground': '210 40% 98%',
    '--border': '217.2 32.6% 17.5%',
    '--input': '217.2 32.6% 17.5%',
    '--primary': '210 40% 98%',
    '--primary-foreground': '222.2 47.4% 11.2%',
    '--secondary': '217.2 32.6% 17.5%',
    '--secondary-foreground': '210 40% 98%',
    '--accent': '217.2 32.6% 17.5%',
    '--accent-foreground': '210 40% 98%',
    '--destructive': '0 62.8% 30.6%',
    '--destructive-foreground': '210 40% 98%',
    '--ring': '212.7 26.8% 83.9%',
    '--completed': '142.1 70.6% 45.3%',
    '--completed-foreground': '144.9 80.4% 10%',
    '--sidebar-background': '240 5.9% 10%',
    '--sidebar-foreground': '240 4.8% 95.9%',
    '--sidebar-primary': '224.3 76.3% 48%',
    '--sidebar-primary-foreground': '0 0% 100%',
    '--sidebar-accent': '240 3.7% 15.9%',
    '--sidebar-accent-foreground': '240 4.8% 95.9%',
    '--sidebar-border': '240 3.7% 15.9%',
    '--sidebar-ring': '217.2 91.2% 59.8%',
};

export const NATURE_THEME_COLORS: Record<ThemeToken, string> = {
    '--background': '0 0% 100%',
    '--foreground': '20 14.3% 4.1%',
    '--muted': '60 4.8% 95.9%',
    '--muted-foreground': '25 5.3% 44.7%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '20 14.3% 4.1%',
    '--card': '0 0% 100%',
    '--card-foreground': '20 14.3% 4.1%',
    '--border': '20 5.9% 90%',
    '--input': '20 5.9% 90%',
    '--primary': '24.6 95% 53.1%',
    '--primary-foreground': '60 9.1% 97.8%',
    '--secondary': '60 4.8% 95.9%',
    '--secondary-foreground': '24 9.8% 10%',
    '--accent': '60 4.8% 95.9%',
    '--accent-foreground': '24 9.8% 10%',
    '--destructive': '0 84.2% 60.2%',
    '--destructive-foreground': '60 9.1% 97.8%',
    '--ring': '24.6 95% 53.1%',
    '--completed': '142.1 76.2% 36.3%',
    '--completed-foreground': '138.5 76.5% 96.7%',
    '--sidebar-background': '36 100% 99.02%',
    '--sidebar-foreground': '20 14.3% 4.1%',
    '--sidebar-primary': '24.6 95% 53.1%',
    '--sidebar-primary-foreground': '60 9.1% 97.8%',
    '--sidebar-accent': '60 4.8% 95.9%',
    '--sidebar-accent-foreground': '24 9.8% 10%',
    '--sidebar-border': '20 5.9% 90%',
    '--sidebar-ring': '24.6 95% 53.1%',
};

/**
 * Get theme colors for a specific theme
 */
export function getThemeColors(theme: ThemeName): Record<ThemeToken, string> {
    switch (theme) {
        case 'light':
            return LIGHT_THEME_COLORS;
        case 'dark':
            return DARK_THEME_COLORS;
        case 'nature':
            return NATURE_THEME_COLORS;
        default:
            return LIGHT_THEME_COLORS;
    }
}

/**
 * Status colors (matching frontend notification system)
 */
export const STATUS_COLORS = {
    success: {
        bg: '#22c55e',
        text: '#dcfce7',
        iconColor: '#bbf7d0',
    },
    error: {
        bg: '#ef4444',
        text: '#fecaca',
        iconColor: '#fecaca',
    },
    warning: {
        bg: '#eab308',
        text: '#fef9c3',
        iconColor: '#fef08a',
    },
    info: {
        bg: '#3b82f6',
        text: '#bfdbfe',
        iconColor: '#bfdbfe',
    },
    loading: {
        bg: '#6b7280',
        text: '#e5e7eb',
        iconColor: '#9ca3af',
    },
    default: {
        bg: '#1f2937',
        text: '#ffffff',
        iconColor: '#ffffff',
    },
} as const;

