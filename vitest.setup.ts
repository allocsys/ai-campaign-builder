import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock URL.createObjectURL and URL.revokeObjectURL
  if (!URL.createObjectURL) {
    URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-blob-url')
  }
  if (!URL.revokeObjectURL) {
    URL.revokeObjectURL = vi.fn()
  }
}

// Mock crypto.randomUUID
if (typeof globalThis !== 'undefined') {
  if (!globalThis.crypto) {
    globalThis.crypto = {} as any
  }
  if (!globalThis.crypto.randomUUID) {
    globalThis.crypto.randomUUID = vi.fn(() => '10000000-1000-4000-8000-100000000000') as any
  }
}
