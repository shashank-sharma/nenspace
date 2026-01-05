// Build information - this file gets updated during build process
// The timestamp below represents when this extension was last built
export const BUILD_INFO = {
  buildTimestamp: '2025-10-25T11:55:16.319Z', // This gets updated during build
  buildDate: '25/10/2025',
  buildTime: '5:25:16 pm',
  version: '0.0.1', // From package.json
  environment: 'development' as 'development' | 'production' | 'staging' | 'test'
} as const

// Helper function to format build timestamp for display
export function getBuildDisplayInfo() {
  const buildDate = new Date(BUILD_INFO.buildTimestamp)
  return {
    formatted: buildDate.toLocaleString(),
    relative: getRelativeTime(buildDate),
    timestamp: BUILD_INFO.buildTimestamp,
    version: BUILD_INFO.version,
    environment: BUILD_INFO.environment
  }
}

// Helper function to get relative time (e.g., "2 hours ago")
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMinutes < 1) {
    return 'Just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`
  } else {
    return date.toLocaleDateString()
  }
}
