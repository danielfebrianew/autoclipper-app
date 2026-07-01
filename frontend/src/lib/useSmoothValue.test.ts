import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSmoothValue } from './useSmoothValue'

describe('useSmoothValue', () => {
  let rafCallbacks: FrameRequestCallback[] = []

  beforeEach(() => {
    rafCallbacks = []
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    })
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => { vi.restoreAllMocks() })

  // Drain queued RAF callbacks, simulating animation frames.
  function flushFrames(n: number) {
    for (let i = 0; i < n; i++) {
      const batch = rafCallbacks
      rafCallbacks = []
      act(() => batch.forEach(cb => cb(performance.now())))
      if (rafCallbacks.length === 0) break
    }
  }

  it('initialises at the target value', () => {
    const { result } = renderHook(() => useSmoothValue(42))
    expect(result.current).toBe(42)
  })

  it('glides toward a new target over frames and snaps when close', () => {
    const { result, rerender } = renderHook(({ t }) => useSmoothValue(t, 0.5), {
      initialProps: { t: 0 },
    })
    expect(result.current).toBe(0)

    rerender({ t: 100 })
    flushFrames(50)

    // With speed 0.5 it converges to the target and snaps (diff < 0.1).
    expect(result.current).toBe(100)
  })

  it('cancels the animation frame on unmount', () => {
    const cancelSpy = vi.spyOn(globalThis, 'cancelAnimationFrame')
    const { rerender, unmount } = renderHook(({ t }) => useSmoothValue(t), {
      initialProps: { t: 0 },
    })
    rerender({ t: 50 }) // schedules a frame
    unmount()
    expect(cancelSpy).toHaveBeenCalled()
  })
})
