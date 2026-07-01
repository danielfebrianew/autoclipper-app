import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '../../test/utils'
import Caret from './Caret'

describe('Caret', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('starts visible (opacity-100)', () => {
    render(<Caret />)
    expect(screen.getByText('▋').className).toContain('opacity-100')
  })

  it('blinks to hidden after the interval fires', () => {
    render(<Caret />)
    act(() => { vi.advanceTimersByTime(530) })
    expect(screen.getByText('▋').className).toContain('opacity-0')
    act(() => { vi.advanceTimersByTime(530) })
    expect(screen.getByText('▋').className).toContain('opacity-100')
  })
})
