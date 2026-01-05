import { writable, derived } from "svelte/store"

export type ModalType = string | null

export interface ModalState {
  activeModal: ModalType
  triggerPosition?: { x: number; y: number }
  error?: string
}

const initialState: ModalState = {
  activeModal: null,
  triggerPosition: undefined,
  error: undefined
}

let lastToggleTime = 0
const TOGGLE_DEBOUNCE_MS = 100

function createModalStore() {
  const { subscribe, set, update } = writable<ModalState>(initialState)

  return {
    subscribe,
    openModal: (type: string, position?: { x: number; y: number }): void => {
      update((state) => ({
        ...state,
        activeModal: type,
        triggerPosition: position,
        error: undefined
      }))
    },
    closeModal: (): void => {
      set(initialState)
    },
    toggleCommandPalette: (position?: { x: number; y: number }): void => {
      const now = Date.now()
      const timeSinceLastToggle = now - lastToggleTime
      
      if (timeSinceLastToggle < TOGGLE_DEBOUNCE_MS) {
        return
      }
      lastToggleTime = now
      
      update((state) => {
        if (state.activeModal === "command-palette") {
          return initialState
        }
        return {
          activeModal: "command-palette",
          triggerPosition: position,
          error: undefined
        }
      })
    },
    clearError: (): void => {
      update((state) => ({
        ...state,
        error: undefined
      }))
    }
  }
}

export const modalStore = createModalStore()
export type ModalStoreType = ReturnType<typeof createModalStore>

export const isModalOpen = derived(modalStore, ($modalStore) => $modalStore.activeModal !== null)
export const currentModal = derived(modalStore, ($modalStore) => $modalStore.activeModal)

