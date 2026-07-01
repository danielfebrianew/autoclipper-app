import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useClipThumb } from './useClipThumb'
import { mockResolved, mockRejected, calls } from '../test/mocks/wails'
import type { Clip } from '../store/slices/clipSlice'

const clip = (over: Partial<Clip> = {}): Clip =>
  ({ id: 'c1', start_seconds: 0, end_seconds: 30, ...over } as Clip)

describe('useClipThumb', () => {
  it('returns a /media URL when a thumbnail path is returned', async () => {
    mockResolved('GetClipThumbnails', ['/abs/thumb.jpg'])
    const { result } = renderHook(() => useClipThumb(clip()))
    await waitFor(() => expect(result.current).toBe('/media/abs/thumb.jpg'))
  })

  it('stays null when the binding returns no paths', async () => {
    mockResolved('GetClipThumbnails', [])
    const { result } = renderHook(() => useClipThumb(clip()))
    await new Promise(r => setTimeout(r, 10))
    expect(result.current).toBeNull()
  })

  it('stays null when the binding rejects', async () => {
    mockRejected('GetClipThumbnails', new Error('nope'))
    const { result } = renderHook(() => useClipThumb(clip()))
    await new Promise(r => setTimeout(r, 10))
    expect(result.current).toBeNull()
  })

  it('refetches when the clip id changes', async () => {
    mockResolved('GetClipThumbnails', ['/abs/a.jpg'])
    const { rerender } = renderHook(({ c }) => useClipThumb(c), {
      initialProps: { c: clip({ id: 'c1' }) },
    })
    await waitFor(() => expect(calls.GetClipThumbnails).toContainEqual(['c1', 1]))

    rerender({ c: clip({ id: 'c2' }) })
    await waitFor(() => expect(calls.GetClipThumbnails).toContainEqual(['c2', 1]))
  })
})
