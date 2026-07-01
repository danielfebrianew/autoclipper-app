import { vi } from 'vitest'

// Mock of the Wails runtime (wailsjs/runtime/runtime). Only the bits the app
// actually uses are given behavior; everything else is a no-op vi.fn().
// EventsOn returns an unsubscribe fn like the real runtime.

export const EventsOn = vi.fn(() => vi.fn())
export const EventsOnce = vi.fn(() => vi.fn())
export const EventsOnMultiple = vi.fn(() => vi.fn())
export const EventsOff = vi.fn()
export const EventsOffAll = vi.fn()
export const EventsEmit = vi.fn()

export const BrowserOpenURL = vi.fn()
export const OnFileDrop = vi.fn()
export const OnFileDropOff = vi.fn()
export const Quit = vi.fn()
export const Hide = vi.fn()
export const Show = vi.fn()

export const LogDebug = vi.fn()
export const LogError = vi.fn()
export const LogInfo = vi.fn()
export const LogPrint = vi.fn()
export const LogTrace = vi.fn()
export const LogWarning = vi.fn()
export const LogFatal = vi.fn()

export const WindowReload = vi.fn()
export const WindowReloadApp = vi.fn()
export const WindowSetTitle = vi.fn()
export const Environment = vi.fn(() => Promise.resolve({ buildType: 'test', platform: 'darwin', arch: 'arm64' }))
