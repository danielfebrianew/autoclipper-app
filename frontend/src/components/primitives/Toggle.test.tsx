import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '../../test/utils'
import Toggle from './Toggle'

describe('Toggle', () => {
  it('renders in the off state by default', () => {
    render(<Toggle />)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('justify-start')
  })

  it('renders in the on state when `on` is true', () => {
    render(<Toggle on />)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('justify-end')
  })

  it('toggles state and fires onToggle with the next value on click', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<Toggle onToggle={onToggle} />)
    const btn = screen.getByRole('button')

    await user.click(btn)
    expect(onToggle).toHaveBeenCalledWith(true)
    expect(btn.className).toContain('justify-end')

    await user.click(btn)
    expect(onToggle).toHaveBeenCalledWith(false)
    expect(btn.className).toContain('justify-start')
  })
})
