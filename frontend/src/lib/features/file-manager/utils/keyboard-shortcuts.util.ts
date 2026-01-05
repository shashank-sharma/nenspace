import type { FileRecord } from '../types';

export interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
    handler: () => void;
}

export function registerKeyboardShortcuts(shortcuts: KeyboardShortcut[]): () => void {
    function handleKeyDown(event: KeyboardEvent) {
        for (const shortcut of shortcuts) {
            const keyMatch = event.key === shortcut.key || event.code === shortcut.key;
            const ctrlMatch = shortcut.ctrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey;
            const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
            const altMatch = shortcut.alt ? event.altKey : !event.altKey;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                event.preventDefault();
                shortcut.handler();
                break;
            }
        }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
}

export function createFileManagerShortcuts(handlers: {
    selectAll?: () => void;
    delete?: () => void;
    download?: () => void;
    rename?: () => void;
    search?: () => void;
    upload?: () => void;
}): KeyboardShortcut[] {
    const shortcuts: KeyboardShortcut[] = [];

    if (handlers.selectAll) {
        shortcuts.push({
            key: 'a',
            ctrl: true,
            handler: handlers.selectAll
        });
    }

    if (handlers.delete) {
        shortcuts.push({
            key: 'Delete',
            handler: handlers.delete
        });
    }

    if (handlers.download) {
        shortcuts.push({
            key: 'd',
            ctrl: true,
            handler: handlers.download
        });
    }

    if (handlers.rename) {
        shortcuts.push({
            key: 'F2',
            handler: handlers.rename
        });
    }

    if (handlers.search) {
        shortcuts.push({
            key: 'f',
            ctrl: true,
            handler: handlers.search
        });
    }

    if (handlers.upload) {
        shortcuts.push({
            key: 'u',
            ctrl: true,
            handler: handlers.upload
        });
    }

    return shortcuts;
}

