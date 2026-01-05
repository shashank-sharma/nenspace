import type { StorageAdapter } from './storage.interface'
import { WebStorageAdapter } from './web-adapter'
import { TauriStorageAdapter } from './tauri-adapter'

let storageAdapter: StorageAdapter | null = null
let platform: 'tauri' | 'web' | null = null

async function detectPlatform(): Promise<'tauri' | 'web'> {
  if (platform) return platform

  try {
    const { getTauriVersion } = await import('@tauri-apps/api/app')
    await getTauriVersion()
    platform = 'tauri'
  } catch {
    platform = 'web'
  }

  return platform
}

export async function getStorageAdapter(): Promise<StorageAdapter> {
  if (storageAdapter) return storageAdapter

  const detectedPlatform = await detectPlatform()

  if (detectedPlatform === 'tauri') {
    storageAdapter = new TauriStorageAdapter()
  } else {
    const { pb } = await import('$lib/config/pocketbase')
    storageAdapter = new WebStorageAdapter(pb)
  }

  return storageAdapter
}

export function resetStorageAdapter(): void {
  storageAdapter = null
  platform = null
}

