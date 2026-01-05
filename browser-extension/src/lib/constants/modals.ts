/**
 * Modal Constants
 * 
 * Modal type identifiers.
 */

export const MODAL_TYPES = {
    COMMAND_PALETTE: 'command-palette',
    SETTINGS: 'settings',
    BOOKMARK: 'bookmark',
    HOME: 'home',
} as const;

export type ModalType = typeof MODAL_TYPES[keyof typeof MODAL_TYPES];

