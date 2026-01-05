import type { ComponentType } from "svelte"
import HomePanel from "../components/panels/HomePanel.svelte"
import SettingsPanel from "../components/panels/SettingsPanel.svelte"
import AddBookmarkPanel from "../components/panels/AddBookmarkPanel.svelte"
import TasksPanel from "../components/panels/TasksPanel.svelte"
import CommandPalette from "../components/CommandPalette.svelte"
import { createLogger } from "../utils/logger.util"

const logger = createLogger('[Modals]')

/**
 * Modal configuration interface
 */
export interface ModalConfig {
  id: string
  component: ComponentType
  title?: string
  size?: "small" | "medium" | "large"
}

/**
 * Modal registry - centralized location for all modal definitions
 * Add new modals here to make them available throughout the app
 */
export const MODAL_REGISTRY: Record<string, ModalConfig> = {
  HOME: {
    id: "home",
    component: HomePanel,
    title: "Dashboard",
    size: "medium"
  },

  SETTINGS: {
    id: "settings",
    component: SettingsPanel,
    // No title - SettingsPanel handles its own header
    size: "large"
  },

  BOOKMARK: {
    id: "bookmark",
    component: AddBookmarkPanel,
    title: "Add Bookmark",
    size: "medium"
  },

  TASKS: {
    id: "tasks",
    component: TasksPanel,
    title: "Tasks",
    size: "large"
  },

  COMMAND_PALETTE: {
    id: "command-palette",
    component: CommandPalette,
    size: "medium"
  }
}

/**
 * Get modal configuration by ID
 */
export function getModalConfig(modalId: string): ModalConfig | undefined {
  return Object.values(MODAL_REGISTRY).find((modal) => modal.id === modalId)
}

/**
 * Register a new modal dynamically
 * Use this to add feature-specific modals from other modules
 */
export function registerModal(modal: ModalConfig): void {
  if (MODAL_REGISTRY[modal.id.toUpperCase()]) {
    logger.warn(`Modal with id "${modal.id}" already exists`)
    return
  }
  MODAL_REGISTRY[modal.id.toUpperCase()] = modal
}

/**
 * Unregister a modal
 */
export function unregisterModal(modalId: string): void {
  delete MODAL_REGISTRY[modalId.toUpperCase()]
}

/**
 * Get all registered modal IDs
 */
export function getAllModalIds(): string[] {
  return Object.values(MODAL_REGISTRY).map((modal) => modal.id)
}

