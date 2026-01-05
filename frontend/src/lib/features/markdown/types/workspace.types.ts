export interface TabState {
  id: string
  noteId: string
  notePath: string
  scrollPosition: number
  cursorPosition: { line: number; ch: number }
}

export interface PaneState {
  id: string
  tabs: TabState[]
  activeTabId: string
}

export interface WorkspaceState {
  panes: PaneState[]
  activePaneId: string
  layout: 'single' | 'split-horizontal' | 'split-vertical'
}

