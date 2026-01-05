/**
 * Test Setup
 * 
 * Global test configuration and mocks.
 */

import { vi } from 'vitest'

// Mock Chrome APIs globally
const mockChrome = {
  notifications: {
    create: vi.fn(),
    clear: vi.fn(),
    onClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    },
    onButtonClicked: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  tabs: {
    create: vi.fn(),
    update: vi.fn(),
    query: vi.fn(),
    get: vi.fn()
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    },
    sync: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn()
    }
  },
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn(),
      removeListener: vi.fn()
    }
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    getAll: vi.fn()
  },
  contextMenus: {
    create: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn()
  }
}

// Mock global chrome object
Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true
})

// Mock global window object for content scripts
Object.defineProperty(global, 'window', {
  value: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    document: {
      createElement: vi.fn(),
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      activeElement: null
    }
  },
  writable: true
})

// Mock global self object for service workers
Object.defineProperty(global, 'self', {
  value: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  },
  writable: true
})

// Mock DOM methods
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    activeElement: null,
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn()
    }
  },
  writable: true
})

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}))

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn()

// Mock setTimeout and setInterval
global.setTimeout = vi.fn((cb) => {
  const id = Math.random()
  setTimeout(cb, 0)
  return id
})
global.setInterval = vi.fn((cb) => {
  const id = Math.random()
  setInterval(cb, 0)
  return id
})
global.clearTimeout = vi.fn()
global.clearInterval = vi.fn()

// Setup DOM environment
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
  resources: 'usable'
})

global.window = dom.window as any
global.document = dom.window.document
global.navigator = dom.window.navigator

// Mock HTMLElement methods
HTMLElement.prototype.focus = vi.fn()
HTMLElement.prototype.blur = vi.fn()
HTMLElement.prototype.click = vi.fn()

// Mock Event constructor
global.Event = dom.window.Event as any
global.KeyboardEvent = dom.window.KeyboardEvent as any
global.MouseEvent = dom.window.MouseEvent as any

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
  // Clear DOM
  document.body.innerHTML = ''
})