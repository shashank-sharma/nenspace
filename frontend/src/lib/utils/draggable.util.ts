/**
 * Draggable Utility
 * 
 * Reusable logic for making elements draggable with click/drag detection.
 * Used by StatusIndicator and DebugPanel components.
 * 
 * Features:
 * - Mouse and touch support
 * - Click vs drag detection
 * - Boundary validation
 * - Position persistence
 * - Automatic cleanup
 */

import { browser } from '$app/environment';

export interface Position {
    x: number;
    y: number;
}

export interface DraggableOptions {
    /** Initial position */
    initialPosition: Position;
    /** Element dimensions for boundary checking */
    elementSize: { width: number; height: number };
    /** Minimum distance in pixels to consider it a drag (vs click) */
    dragThreshold?: number;
    /** LocalStorage key for position persistence */
    storageKey: string;
    /** Callback when element is clicked (not dragged) */
    onClick?: () => void;
    /** Callback during drag */
    onDrag?: (position: Position) => void;
    /** Callback when drag ends */
    onDragEnd?: (position: Position) => void;
}

export interface DraggableState {
    position: Position;
    isDragging: boolean;
}

/**
 * Validate and constrain position within viewport bounds
 */
export function validatePosition(
    pos: Position,
    elementSize: { width: number; height: number },
    fallbackPosition?: Position
): Position {
    if (!browser) return pos;

    const isOutOfBounds =
        pos.x < 0 ||
        pos.y < 0 ||
        pos.x + elementSize.width > window.innerWidth ||
        pos.y + elementSize.height > window.innerHeight;

    if (isOutOfBounds && fallbackPosition) {
        return fallbackPosition;
    }

    return {
        x: Math.max(0, Math.min(pos.x, window.innerWidth - elementSize.width)),
        y: Math.max(0, Math.min(pos.y, window.innerHeight - elementSize.height)),
    };
}

/**
 * Load position from localStorage with validation
 */
export function loadPosition(
    storageKey: string,
    elementSize: { width: number; height: number },
    defaultPosition: Position
): Position {
    if (!browser) return defaultPosition;

    const savedPosition = localStorage.getItem(storageKey);
    if (!savedPosition) return defaultPosition;

    try {
        const pos = JSON.parse(savedPosition) as Position;
        return validatePosition(pos, elementSize, defaultPosition);
    } catch (error) {
        console.warn(`Failed to parse ${storageKey}, using default position`, error);
        return defaultPosition;
    }
}

/**
 * Save position to localStorage
 */
export function savePosition(storageKey: string, position: Position): void {
    if (!browser) return;
    
    try {
        localStorage.setItem(storageKey, JSON.stringify(position));
    } catch (error) {
        console.warn(`Failed to save position to ${storageKey}`, error);
    }
}

/**
 * Create draggable behavior
 */
export function createDraggable(options: DraggableOptions) {
    const {
        elementSize,
        dragThreshold = 5,
        storageKey,
        onClick,
        onDrag,
        onDragEnd,
    } = options;

    let cleanup: (() => void) | null = null;

    /**
     * Start dragging
     */
    function startDrag(startX: number, startY: number, currentPosition: Position) {
        // Clean up previous drag if exists
        cleanup?.();

        let isDragging = true;
        let hasMoved = false;
        const startPosX = currentPosition.x;
        const startPosY = currentPosition.y;

        const handleMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;

            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

            const deltaX = Math.abs(clientX - startX);
            const deltaY = Math.abs(clientY - startY);

            // Track if actually moved beyond threshold
            if (deltaX > dragThreshold || deltaY > dragThreshold) {
                hasMoved = true;
            }

            const newX = startPosX + (clientX - startX);
            const newY = startPosY + (clientY - startY);

            const validatedPosition = validatePosition(
                { x: newX, y: newY },
                elementSize
            );

            onDrag?.(validatedPosition);
        };

        const stopDrag = () => {
            isDragging = false;
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('touchmove', handleMove);
            document.removeEventListener('mouseup', stopDrag);
            document.removeEventListener('touchend', stopDrag);

            // If didn't move, treat as click
            if (!hasMoved) {
                onClick?.();
            } else {
                // Save position only if actually dragged
                const currentPos = currentPosition;
                savePosition(storageKey, currentPos);
                onDragEnd?.(currentPos);
            }

            cleanup = null;
        };

        document.addEventListener('mousemove', handleMove);
        document.addEventListener('touchmove', handleMove);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchend', stopDrag);

        cleanup = stopDrag;

        return cleanup;
    }

    /**
     * Handle mouse down
     */
    function handleMouseDown(event: MouseEvent, currentPosition: Position) {
        event.preventDefault();
        return startDrag(event.clientX, event.clientY, currentPosition);
    }

    /**
     * Handle touch start
     */
    function handleTouchStart(event: TouchEvent, currentPosition: Position) {
        event.preventDefault();
        return startDrag(
            event.touches[0].clientX,
            event.touches[0].clientY,
            currentPosition
        );
    }

    return {
        handleMouseDown,
        handleTouchStart,
        cleanup: () => cleanup?.(),
    };
}
