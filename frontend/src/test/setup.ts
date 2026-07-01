import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { resetBindings } from './mocks/wails'

// The Wails Go bindings + runtime are intercepted via resolve.alias in
// vite.config.ts (test block) → src/test/mocks/*. That makes the mock apply
// no matter how deep the importing component is, so individual tests just
// override specific bindings with vi.mocked(Fn).mockResolvedValue(...).

// Auto-unmount React trees and clear mock call history between tests so each
// case starts from a clean slate.
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  resetBindings() // reset Wails mock impls + recorded calls between tests
})

// --- jsdom polyfills for browser APIs the app touches ---

// matchMedia (used by some libs / responsive checks)
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// ResizeObserver (canvas/stage measuring)
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

// scrollIntoView (LogConsole auto-scroll)
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn()
}

// HTMLMediaElement.play/pause are not implemented in jsdom
Object.defineProperty(HTMLMediaElement.prototype, 'play', {
  configurable: true,
  value: vi.fn().mockResolvedValue(undefined),
})
Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
  configurable: true,
  value: vi.fn(),
})
