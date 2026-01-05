import type { ComponentType } from "svelte"
import IconHome from "../components/icons/IconHome.svelte"
import IconSettings from "../components/icons/IconSettings.svelte"
import IconBookmark from "../components/icons/IconBookmark.svelte"
import IconLogout from "../components/icons/IconLogout.svelte"
import IconTask from "../components/icons/IconTask.svelte"
import IconHelp from "../components/icons/IconHelp.svelte"
import { modalStore } from "../stores/modal.store"
import { authFlowService } from "../../features/auth/services/auth-flow.service"
import { createLogger } from "../utils/logger.util"
import { shortcutsHandler } from "../utils/shortcuts-handler.util"

const logger = createLogger('[Commands]')

/**
 * Command interface for all commands in the command palette
 */
export interface Command {
  id: string
  label: string
  description: string
  icon: ComponentType
  action: () => void | Promise<void>
  keywords: string[]
  shortcut?: string
  category?: string
}

/**
 * Command registry - centralized location for all commands
 * Add new commands here to make them available in the command palette
 */
export const COMMAND_REGISTRY: Record<string, Command> = {
  SETTINGS: {
    id: "settings",
    label: "Settings",
    description: "Open settings panel",
    icon: IconSettings,
    action: () => {
      modalStore.openModal("settings")
    },
    keywords: ["settings", "preferences", "config", "options", "theme"],
    category: "navigation"
  },

  ADD_BOOKMARK: {
    id: "add-bookmark",
    label: "Add Bookmark",
    description: "Save current page as bookmark",
    icon: IconBookmark,
    action: () => {
      modalStore.openModal("bookmark")
    },
    keywords: ["bookmark", "save", "add", "mark", "favorite"],
    category: "actions"
  },

  HOME: {
    id: "home",
    label: "Home",
    description: "Open home dashboard",
    icon: IconHome,
    action: () => {
      modalStore.openModal("home")
    },
    keywords: ["home", "dashboard", "main", "overview"],
    category: "navigation"
  },

  TASKS: {
    id: "tasks",
    label: "Tasks",
    description: "View and manage your tasks",
    icon: IconTask,
    action: () => {
      modalStore.openModal("tasks")
    },
    keywords: ["tasks", "todo", "list", "kanban", "project", "work"],
    category: "navigation"
  },

  LOGOUT: {
    id: "logout",
    label: "Logout",
    description: "Sign out of your account",
    icon: IconLogout,
    action: async () => {
      try {
        await authFlowService.logout()
        globalThis.location.reload()
      } catch (error) {
        logger.error("Logout failed", error)
      }
    },
    keywords: ["logout", "signout", "exit", "disconnect", "sign out"],
    category: "account"
  },

  // Help Command
  SHOW_HELP: {
    id: "show-help",
    label: "Show Help",
    description: "Show keyboard shortcuts help",
    icon: IconHelp,
    action: () => {
      // This will be handled by the shortcuts handler
      shortcutsHandler.showHelp()
    },
    keywords: ["help", "shortcuts", "keys", "guide"],
    category: "help"
  }
}

/**
 * Get all commands as an array
 */
export function getAllCommands(): Command[] {
  return Object.values(COMMAND_REGISTRY)
}

/**
 * Get commands by category
 */
export function getCommandsByCategory(category: string): Command[] {
  return getAllCommands().filter((cmd) => cmd.category === category)
}

/**
 * Register a new command dynamically
 * Use this to add feature-specific commands from other modules
 */
export function registerCommand(command: Command): void {
  if (COMMAND_REGISTRY[command.id.toUpperCase()]) {
    logger.warn(`Command with id "${command.id}" already exists`)
    return
  }
  COMMAND_REGISTRY[command.id.toUpperCase()] = command
}

/**
 * Unregister a command
 */
export function unregisterCommand(commandId: string): void {
  delete COMMAND_REGISTRY[commandId.toUpperCase()]
}

