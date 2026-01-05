import type { SyncState, ConflictRecord } from '../types'

class SyncStore {
  state = $state<SyncState>({
    status: 'idle',
    lastSync: null,
    pendingChanges: 0,
    conflicts: [],
    error: null
  })

  setStatus(status: SyncState['status']) {
    this.state.status = status
  }

  setLastSync(date: Date | null) {
    this.state.lastSync = date
  }

  setPendingChanges(count: number) {
    this.state.pendingChanges = count
  }

  addConflict(conflict: ConflictRecord) {
    this.state.conflicts = [...this.state.conflicts, conflict]
  }

  resolveConflict(id: string) {
    this.state.conflicts = this.state.conflicts.filter(c => c.id !== id)
  }

  setError(error: string | null) {
    this.state.error = error
  }

  reset() {
    this.state = {
      status: 'idle',
      lastSync: null,
      pendingChanges: 0,
      conflicts: [],
      error: null
    }
  }
}

export const syncStore = new SyncStore()

