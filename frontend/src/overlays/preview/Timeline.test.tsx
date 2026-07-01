import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '../../test/utils'
import Timeline from './Timeline'

// jsdom's synthetic PointerEvent doesn't carry clientX, so build a MouseEvent
// (which does) and tag it with the pointer type so the handlers receive coords.
function pointer(type: string, clientX: number) {
  const ev = new MouseEvent(type, { bubbles: true, clientX })
  return ev
}

// jsdom doesn't lay out elements, so getBoundingClientRect returns zeros.
// Stub it to a known 100px-wide track so xToSec math is testable.
beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function (): DOMRect {
    return { left: 0, top: 0, right: 100, bottom: 48, width: 100, height: 48, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
  }
})

function setup(props: Partial<Parameters<typeof Timeline>[0]> = {}) {
  const onInChange = vi.fn()
  const onOutChange = vi.fn()
  const onSeek = vi.fn()
  const { container } = render(
    <Timeline
      duration={100}
      inPoint={10}
      outPoint={90}
      currentTime={50}
      waveform={[]}
      thumbnails={[]}
      onInChange={onInChange}
      onOutChange={onOutChange}
      onSeek={onSeek}
      {...props}
    />,
  )
  return { container, onInChange, onOutChange, onSeek }
}

describe('Timeline (preview)', () => {
  it('renders the duration labels', () => {
    setup()
    expect(screen.getByText('0:00')).toBeInTheDocument()  // start
    // testing-library collapses the double space in "IN  0:10".
    expect(screen.getByText(/IN\s+0:10/)).toBeInTheDocument()
    expect(screen.getByText(/OUT\s+1:30/)).toBeInTheDocument()
  })

  it('seeks when the track is clicked', () => {
    const { container, onSeek } = setup()
    const track = container.querySelector('[class*="cursor-pointer"]')!
    track.dispatchEvent(pointer('pointerdown', 50))
    // 50/100 * 100s duration = 50s
    expect(onSeek).toHaveBeenCalledWith(50)
  })

  it('drags the IN handle and clamps below outPoint', () => {
    const { container, onInChange } = setup()
    const inHandle = container.querySelector('[data-handle="in"]')!
    // pointerdown sets `dragging`; the window move-listener attaches in an
    // effect, so flush with act() before dispatching the move.
    act(() => { inHandle.dispatchEvent(pointer('pointerdown', 10)) })
    act(() => { window.dispatchEvent(pointer('pointermove', 30)) }) // → 30s
    expect(onInChange).toHaveBeenCalledWith(30)
    act(() => { window.dispatchEvent(pointer('pointerup', 0)) })
  })

  it('drags the OUT handle', () => {
    const { container, onOutChange } = setup()
    const outHandle = container.querySelector('[data-handle="out"]')!
    act(() => { outHandle.dispatchEvent(pointer('pointerdown', 90)) })
    act(() => { window.dispatchEvent(pointer('pointermove', 70)) }) // → 70s
    expect(onOutChange).toHaveBeenCalledWith(70)
    act(() => { window.dispatchEvent(pointer('pointerup', 0)) })
  })
})
