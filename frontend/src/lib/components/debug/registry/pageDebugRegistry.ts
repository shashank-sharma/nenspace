/**
 * Page Debug Settings Registry
 * 
 * This file serves as a central registry for all page-specific debug settings.
 * It allows components to discover which debug settings are applicable to the current page
 * based on the URL pattern.
 */

import ChroniclesDebugSettings from '../sections/ChroniclesDebugSettings.svelte';
import TasksDebugSettings from '../sections/TasksDebugSettings.svelte';

/**
 * Interface for page debug settings configuration
 */
export interface PageDebugSection {
    /**
     * Unique identifier for this debug section
     */
    id: string;
    
    /**
     * Display title shown in the debug panel
     */
    title: string;
    
    /**
     * The Svelte component that contains the debug settings UI
     */
    component: any; // Use any for Svelte 5 component compatibility
    
    /**
     * RegExp pattern to match URLs where this debug section should be shown
     * Example: /\/tasks/i - Will match any URL containing "tasks"
     */
    urlPattern: RegExp;
    
    /**
     * Whether this section should be expanded by default
     */
    expanded?: boolean;
    
    /**
     * Sort priority (lower number = higher priority = displayed first)
     */
    priority?: number;
}

/**
 * Registry of all page-specific debug settings
 * 
 * HOW TO ADD A NEW PAGE DEBUG SETTING:
 * 
 * 1. Create a new component in the sections directory
 *    - You can copy TemplateDebugSettings.svelte as a starting point
 *    - Follow the naming convention: [PageName]DebugSettings.svelte
 * 
 * 2. Import your component at the top of this file:
 *    import MyNewPageDebugSettings from '../sections/MyNewPageDebugSettings.svelte';
 * 
 * 3. Add an entry to the pageDebugRegistry array below with:
 *    - A unique id (e.g., "my-page-debug")
 *    - A descriptive title
 *    - Your component reference
 *    - URL pattern to match (using RegExp)
 *    - Expanded state (optional, default is false)
 *    - Priority (optional, lower number = higher priority)
 */
export const pageDebugRegistry: PageDebugSection[] = [
    // Chronicles page
    {
        id: "chronicles-debug",
        title: "Chronicles Debug Settings",
        component: ChroniclesDebugSettings,
        urlPattern: /\/chronicles/i,
        expanded: true,
        priority: 10,
    },
    
    // Tasks page
    {
        id: "tasks-debug",
        title: "Task View Options",
        component: TasksDebugSettings,
        urlPattern: /\/tasks/i,
        expanded: true,
        priority: 10,
    },
];

/**
 * Get debug settings for a specific URL path
 * @param path Current URL path
 * @returns Array of applicable debug settings, sorted by priority
 */
export function getDebugSettingsForPath(path: string): PageDebugSection[] {
    const applicableSettings = pageDebugRegistry.filter(
        (section) => section.urlPattern.test(path)
    );
    
    // Sort by priority
    return applicableSettings.sort((a, b) => 
        (a.priority || 100) - (b.priority || 100)
    );
}

/**
 * Get a formatted page name from a URL path
 * @param path The URL path
 * @returns Formatted page name
 */
export function getPageNameFromPath(path: string): string {
    // Remove trailing slash if present
    const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
    
    // Get the last segment of the path
    const segments = cleanPath.split('/');
    const lastSegment = segments[segments.length - 1];
    
    if (!lastSegment) {
        return 'Home';
    }
    
    // Convert to title case and replace dashes/underscores with spaces
    return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
} 