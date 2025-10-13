/**
 * Modal State Management Hook
 * Centralized state management for create/edit/delete modals
 * 
 * Eliminates boilerplate modal state across features
 */

export interface ModalState<T> {
    createModalOpen: boolean;
    editModalOpen: boolean;
    deleteModalOpen: boolean;
    selectedItem: T | null;
    itemToDelete: T | null;
}

/**
 * Hook for managing modal state in CRUD features
 * 
 * @returns Modal state and control methods
 * 
 * @example
 * const modals = useModalState<Task>();
 * 
 * // Open create modal
 * modals.openCreate();
 * 
 * // Open edit modal with item
 * modals.openEdit(task);
 * 
 * // Open delete confirmation
 * modals.openDelete(task);
 * 
 * // In template:
 * <Dialog.Root bind:open={modals.createModalOpen}>
 *     <MyForm onsubmit={handleCreate} />
 * </Dialog.Root>
 */
export function useModalState<T>() {
    let createModalOpen = $state(false);
    let editModalOpen = $state(false);
    let deleteModalOpen = $state(false);
    let selectedItem = $state<T | null>(null);
    let itemToDelete = $state<T | null>(null);

    /**
     * Open create modal
     */
    function openCreate(): void {
        selectedItem = null;
        createModalOpen = true;
    }

    /**
     * Open edit modal with selected item
     */
    function openEdit(item: T): void {
        selectedItem = item;
        editModalOpen = true;
    }

    /**
     * Open delete confirmation with item
     */
    function openDelete(item: T): void {
        itemToDelete = item;
        deleteModalOpen = true;
    }

    /**
     * Close all modals and reset state
     */
    function closeAll(): void {
        createModalOpen = false;
        editModalOpen = false;
        deleteModalOpen = false;
        selectedItem = null;
        itemToDelete = null;
    }

    /**
     * Close create modal
     */
    function closeCreate(): void {
        createModalOpen = false;
        selectedItem = null;
    }

    /**
     * Close edit modal
     */
    function closeEdit(): void {
        editModalOpen = false;
        selectedItem = null;
    }

    /**
     * Close delete modal
     */
    function closeDelete(): void {
        deleteModalOpen = false;
        itemToDelete = null;
    }

    return {
        // State (read-write via getters/setters for $bindable compatibility)
        get createModalOpen() {
            return createModalOpen;
        },
        set createModalOpen(value: boolean) {
            createModalOpen = value;
            if (!value) selectedItem = null;
        },

        get editModalOpen() {
            return editModalOpen;
        },
        set editModalOpen(value: boolean) {
            editModalOpen = value;
            if (!value) selectedItem = null;
        },

        get deleteModalOpen() {
            return deleteModalOpen;
        },
        set deleteModalOpen(value: boolean) {
            deleteModalOpen = value;
            // Don't clear itemToDelete here - let it persist until explicit close
            // This fixes the issue where clicking "Delete" would have undefined ID
        },

        get selectedItem() {
            return selectedItem;
        },

        get itemToDelete() {
            return itemToDelete;
        },

        // Methods
        openCreate,
        openEdit,
        openDelete,
        closeAll,
        closeCreate,
        closeEdit,
        closeDelete,
    };
}
