import { getStorageAdapter } from '../services/storage'
import type { Vault } from '../types'
import {
  isAutoCancelledError,
  extractErrorMessage
} from '../utils/error-handler'

class VaultStore {
  vaults = $state<Vault[]>([])
  activeVaultId = $state<string | null>(null)
  loading = $state(false)
  error = $state<string | null>(null)
  private initializePromise: Promise<void> | null = null

  get activeVault() {
    return this.vaults.find(v => v.id === this.activeVaultId) || null
  }

  async initialize() {
    if (this.initializePromise) {
      return this.initializePromise
    }

    this.initializePromise = this._doInitialize()

    try {
      await this.initializePromise
    } finally {
      this.initializePromise = null
    }
  }

  private async _doInitialize() {
    this.loading = true
    this.error = null

    try {
      const storage = await getStorageAdapter()
      const vaults = await storage.listVaults()

      const lastActiveId =
        typeof window !== 'undefined'
          ? localStorage.getItem('markdown_activeVaultId')
          : null

      const activeId =
        vaults.find(v => v.id === lastActiveId)?.id ||
        vaults[0]?.id ||
        null

      this.vaults = vaults
      this.activeVaultId = activeId

      if (activeId && typeof window !== 'undefined') {
        localStorage.setItem('markdown_activeVaultId', activeId)
      }
    } catch (err) {
      if (isAutoCancelledError(err)) {
        if (this.vaults.length > 0) {
          return
        }
        this.error = null
        return
      }

      this.error = extractErrorMessage(err)
    } finally {
      this.loading = false
    }
  }

  async createVault(name: string, path?: string): Promise<Vault> {
    this.loading = true
    this.error = null

    try {
      const storage = await getStorageAdapter()
      const vault = await storage.createVault(name, path)

      this.vaults = [...this.vaults, vault]
      this.activeVaultId = vault.id

      if (typeof window !== 'undefined') {
        localStorage.setItem('markdown_activeVaultId', vault.id)
      }

      return vault
    } catch (err) {
      this.error = extractErrorMessage(err)
      throw err
    } finally {
      this.loading = false
    }
  }

  async openVault(id: string): Promise<Vault> {
    this.loading = true
    this.error = null

    try {
      const storage = await getStorageAdapter()
      const vault = await storage.openVault(id)

      const existingIndex = this.vaults.findIndex(v => v.id === id)
      if (existingIndex >= 0) {
        this.vaults[existingIndex] = vault
      } else {
        this.vaults = [...this.vaults, vault]
      }

      this.activeVaultId = id

      if (typeof window !== 'undefined') {
        localStorage.setItem('markdown_activeVaultId', id)
      }

      return vault
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to open vault'
      throw err
    } finally {
      this.loading = false
    }
  }

  setActiveVault(id: string) {
    if (id === '') {
      this.activeVaultId = null
      if (typeof window !== 'undefined') {
        localStorage.removeItem('markdown_activeVaultId')
      }
    } else if (this.vaults.some(v => v.id === id)) {
      this.activeVaultId = id
      if (typeof window !== 'undefined') {
        localStorage.setItem('markdown_activeVaultId', id)
      }
    }
  }

  async deleteVault(id: string) {
    this.loading = true
    this.error = null

    try {
      const storage = await getStorageAdapter()
      await storage.deleteVault(id)

      this.vaults = this.vaults.filter(v => v.id !== id)

      if (this.activeVaultId === id) {
        this.activeVaultId = this.vaults[0]?.id || null
        if (this.activeVaultId && typeof window !== 'undefined') {
          localStorage.setItem('markdown_activeVaultId', this.activeVaultId)
        } else if (typeof window !== 'undefined') {
          localStorage.removeItem('markdown_activeVaultId')
        }
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to delete vault'
      throw err
    } finally {
      this.loading = false
    }
  }

  async updateVaultSettings(id: string, settings: Partial<Vault['settings']>) {
    this.loading = true
    this.error = null

    try {
      const storage = await getStorageAdapter()
      const updated = await storage.updateVaultSettings(id, settings)

      const index = this.vaults.findIndex(v => v.id === id)
      if (index >= 0) {
        this.vaults[index] = updated
      }

      return updated
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to update vault settings'
      throw err
    } finally {
      this.loading = false
    }
  }

  reset() {
    this.vaults = []
    this.activeVaultId = null
    this.loading = false
    this.error = null
  }
}

export const vaultStore = new VaultStore()

