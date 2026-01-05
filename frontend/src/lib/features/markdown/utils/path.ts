export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '')
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join('/'))
}

export function dirname(path: string): string {
  const normalized = normalizePath(path)
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash === -1 ? '' : normalized.slice(0, lastSlash)
}

export function basename(path: string): string {
  const normalized = normalizePath(path)
  const lastSlash = normalized.lastIndexOf('/')
  return lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1)
}

export function filenameWithoutExt(path: string): string {
  const base = basename(path)
  const lastDot = base.lastIndexOf('.')
  return lastDot === -1 ? base : base.slice(0, lastDot)
}

export function getFileExtension(path: string): string {
  const base = basename(path)
  const lastDot = base.lastIndexOf('.')
  return lastDot === -1 ? '' : base.slice(lastDot + 1)
}

export function isMarkdownFile(path: string): boolean {
  const ext = getFileExtension(path).toLowerCase()
  return ext === 'md' || ext === 'markdown'
}

export function resolveNotePath(
  target: string,
  currentPath: string,
  vaultSettings: { newLinkFormat: 'shortest' | 'relative' | 'absolute' }
): string {
  if (vaultSettings.newLinkFormat === 'absolute') {
    return normalizePath(target)
  }

  if (vaultSettings.newLinkFormat === 'relative') {
    const currentDir = dirname(currentPath)
    return joinPath(currentDir, target)
  }

  return normalizePath(target)
}

