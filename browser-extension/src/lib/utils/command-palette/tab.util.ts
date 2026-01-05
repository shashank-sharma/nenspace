import type { TabResult } from "../../types/command-palette.types"
import type { GetTabsResponse } from "../../types/messages"
import { sendToBackground } from "@plasmohq/messaging"
import { createLogger } from "../logger.util"

const logger = createLogger("[CommandPalette:Tab]")

export function isValidTab(tab: { id?: number | null; windowId?: number | null }): boolean {
  return (
    tab &&
    typeof tab.id === 'number' &&
    tab.id !== null &&
    tab.id !== undefined &&
    typeof tab.windowId === 'number' &&
    tab.windowId !== null &&
    tab.windowId !== undefined
  )
}

export function normalizeTab(tab: GetTabsResponse["tabs"][0]): TabResult | null {
  if (!isValidTab(tab)) {
    return null
  }

  return {
    id: tab.id!,
    title: tab.title || "Untitled",
    url: tab.url || "",
    favIconUrl: tab.favIconUrl as string | undefined,
    windowId: tab.windowId!,
    lastAccessed: (tab as any).lastAccessed as number | undefined
  }
}

export async function loadTabs(): Promise<TabResult[]> {
  try {
    const response = await sendToBackground<{}, GetTabsResponse>({
      name: "get-tabs"
    })

    if (response?.success && response.tabs) {
      return response.tabs
        .map(normalizeTab)
        .filter((tab): tab is TabResult => tab !== null)
    }

    logger.error("Failed to load tabs", response?.error)
    return []
  } catch (error) {
    logger.error("Error requesting tabs", error)
    return []
  }
}

export function filterValidTabs(tabs: TabResult[]): TabResult[] {
  return tabs.filter(isValidTab)
}

