import { nanoid } from 'nanoid'
import type { WorkspaceState, PaneState, TabState } from '../types'

class WorkspaceStore {
  state = $state<WorkspaceState>({
    panes: [],
    activePaneId: '',
    layout: 'single'
  })

  private currentVaultId: string | null = null

  get activePane() {
    return this.state.panes.find(p => p.id === this.state.activePaneId) || null
  }

  get activeTab() {
    const pane = this.activePane
    if (!pane) return null
    return pane.tabs.find(t => t.id === pane.activeTabId) || null
  }

  private getStorageKey(vaultId: string): string {
    return `markdown_workspace_state_${vaultId}`
  }

  private findTabByPath(notePath: string): { pane: PaneState; tab: TabState } | null {
    for (const pane of this.state.panes) {
      const tab = pane.tabs.find(t => t.notePath === notePath)
      if (tab) {
        return { pane, tab }
      }
    }
    return null
  }

  private saveToLocalStorage(vaultId: string) {
    if (typeof window === 'undefined' || !vaultId) return

    try {
      const stateToSave = {
        panes: this.state.panes,
        activePaneId: this.state.activePaneId,
        layout: this.state.layout
      }
      localStorage.setItem(this.getStorageKey(vaultId), JSON.stringify(stateToSave))
    } catch (err) {
    }
  }

  private loadFromLocalStorage(vaultId: string): boolean {
    if (typeof window === 'undefined' || !vaultId) return false

    try {
      const saved = localStorage.getItem(this.getStorageKey(vaultId))
      if (!saved) return false

      const parsed = JSON.parse(saved) as WorkspaceState

      if (parsed.panes && Array.isArray(parsed.panes) && parsed.panes.length > 0) {
        this.state = {
          panes: parsed.panes,
          activePaneId: parsed.activePaneId || parsed.panes[0]?.id || '',
          layout: parsed.layout || 'single'
        }
        return true
      }
    } catch (err) {
    }

    return false
  }

  initialize(vaultId?: string) {
    if (vaultId && vaultId !== this.currentVaultId) {
      this.currentVaultId = vaultId
      const loaded = this.loadFromLocalStorage(vaultId)
      if (loaded) {
        return
      }
    }

    const paneId = nanoid()
    this.state = {
      panes: [{
        id: paneId,
        tabs: [],
        activeTabId: ''
      }],
      activePaneId: paneId,
      layout: 'single'
    }

    if (vaultId) {
      this.currentVaultId = vaultId
      this.saveToLocalStorage(vaultId)
    }
  }

  createTab(noteId: string, notePath: string, vaultId?: string): string {
    const existing = this.findTabByPath(notePath)
    if (existing) {
      this.setActiveTab(existing.pane.id, existing.tab.id)
      if (vaultId) {
        this.saveToLocalStorage(vaultId)
      }
      return existing.tab.id
    }

    const tabId = nanoid()
    const pane = this.activePane || this.state.panes[0]

    if (!pane) {
      this.initialize(vaultId)
      return this.createTab(noteId, notePath, vaultId)
    }

    const tab: TabState = {
      id: tabId,
      noteId,
      notePath,
      scrollPosition: 0,
      cursorPosition: { line: 0, ch: 0 }
    }

    pane.tabs = [...pane.tabs, tab]
    pane.activeTabId = tabId

    if (vaultId) {
      this.saveToLocalStorage(vaultId)
    }

    return tabId
  }

  closeTab(paneId: string, tabId: string, vaultId?: string) {
    const pane = this.state.panes.find(p => p.id === paneId)
    if (!pane) return

    pane.tabs = pane.tabs.filter(t => t.id !== tabId)

    if (pane.activeTabId === tabId) {
      pane.activeTabId = pane.tabs[0]?.id || ''
    }

    if (pane.tabs.length === 0 && this.state.panes.length > 1) {
      this.state.panes = this.state.panes.filter(p => p.id !== paneId)
      if (this.state.activePaneId === paneId) {
        this.state.activePaneId = this.state.panes[0]?.id || ''
      }
    }

    if (vaultId) {
      this.saveToLocalStorage(vaultId)
    }
  }

  setActiveTab(paneId: string, tabId: string, vaultId?: string) {
    const pane = this.state.panes.find(p => p.id === paneId)
    if (pane && pane.tabs.some(t => t.id === tabId)) {
      pane.activeTabId = tabId
      this.state.activePaneId = paneId

      if (vaultId) {
        this.saveToLocalStorage(vaultId)
      }
    }
  }

  updateTabScroll(paneId: string, tabId: string, scrollPosition: number) {
    const pane = this.state.panes.find(p => p.id === paneId)
    if (!pane) return

    const tab = pane.tabs.find(t => t.id === tabId)
    if (tab) {
      tab.scrollPosition = scrollPosition
    }
  }

  updateTabCursor(paneId: string, tabId: string, cursorPosition: { line: number; ch: number }) {
    const pane = this.state.panes.find(p => p.id === paneId)
    if (!pane) return

    const tab = pane.tabs.find(t => t.id === tabId)
    if (tab) {
      tab.cursorPosition = cursorPosition
    }
  }

  splitPane(direction: 'horizontal' | 'vertical') {
    const currentPane = this.activePane
    if (!currentPane) return

    const newPaneId = nanoid()
    const newPane: PaneState = {
      id: newPaneId,
      tabs: [],
      activeTabId: ''
    }

    this.state.panes = [...this.state.panes, newPane]
    this.state.layout = direction === 'horizontal' ? 'split-horizontal' : 'split-vertical'
    this.state.activePaneId = newPaneId
  }

  closePane(paneId: string) {
    if (this.state.panes.length <= 1) return

    this.state.panes = this.state.panes.filter(p => p.id !== paneId)

    if (this.state.activePaneId === paneId) {
      this.state.activePaneId = this.state.panes[0]?.id || ''
    }

    if (this.state.panes.length === 1) {
      this.state.layout = 'single'
    }
  }

  reset(vaultId?: string) {
    this.initialize(vaultId)
  }

  clearForVault(vaultId: string) {
    if (this.currentVaultId === vaultId) {
      this.currentVaultId = null
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(this.getStorageKey(vaultId))
      } catch (err) {
      }
    }
  }
}

export const workspaceStore = new WorkspaceStore()

