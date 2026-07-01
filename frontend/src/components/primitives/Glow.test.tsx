import { describe, it, expect } from 'vitest'
import { render } from '../../test/utils'
import Glow from './Glow'

describe('Glow', () => {
  it('applies default position, size and color via inline style', () => {
    const { container } = render(<Glow />)
    const el = container.firstChild as HTMLElement
    expect(el.style.left).toBe('50%')
    expect(el.style.top).toBe('50%')
    expect(el.style.width).toBe('360px')
    // jsdom normalizes rgba() spacing, so match without spaces sensitivity.
    expect(el.style.background.replace(/\s/g, '')).toContain('rgba(123,97,255,0.22)')
  })

  it('honors custom x/y/size/color props', () => {
    const { container } = render(<Glow x="10%" y="20%" size={200} color="rgba(0,0,0,0.5)" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.left).toBe('10%')
    expect(el.style.top).toBe('20%')
    expect(el.style.width).toBe('200px')
    expect(el.style.height).toBe('200px')
    expect(el.style.background.replace(/\s/g, '')).toContain('rgba(0,0,0,0.5)')
  })

  it('is a pointer-events-none decorative layer', () => {
    const { container } = render(<Glow />)
    expect((container.firstChild as HTMLElement).className).toContain('pointer-events-none')
  })
})
