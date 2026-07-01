import { describe, it, expect } from 'vitest'
import { render } from '../../test/utils'
import Spinner from './Spinner'

describe('Spinner', () => {
  it('renders an svg with default size 15', () => {
    const { container } = render(<Spinner />)
    const svg = container.querySelector('svg')!
    expect(svg).toBeInTheDocument()
    expect(svg.getAttribute('width')).toBe('15')
    expect(svg.getAttribute('height')).toBe('15')
  })

  it('applies a custom size', () => {
    const { container } = render(<Spinner size={24} />)
    expect(container.querySelector('svg')!.getAttribute('width')).toBe('24')
  })

  it('applies a custom stroke color to the arc', () => {
    const { container } = render(<Spinner color="#ff0000" />)
    const arc = container.querySelector('path')!
    expect(arc.getAttribute('stroke')).toBe('#ff0000')
  })
})
