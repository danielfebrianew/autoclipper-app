import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/utils'
import ViralChip from './ViralChip'

describe('ViralChip', () => {
  it('shows the score', () => {
    render(<ViralChip score={72} />)
    expect(screen.getByText('72')).toBeInTheDocument()
  })

  it('uses the "hot" variant for scores >= 85', () => {
    render(<ViralChip score={90} />)
    expect(screen.getByText('90').closest('span')!.className).toContain('hot')
  })

  it('uses the "cool" variant for scores below 85', () => {
    render(<ViralChip score={84} />)
    expect(screen.getByText('84').closest('span')!.className).toContain('cool')
  })

  it('wraps in an absolutely-positioned floater when float is set', () => {
    const { container } = render(<ViralChip score={50} float />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('absolute')
  })

  it('renders the bare chip (no floater) without float', () => {
    const { container } = render(<ViralChip score={50} />)
    const root = container.firstChild as HTMLElement
    expect(root.className).toContain('viral-chip')
  })
})
