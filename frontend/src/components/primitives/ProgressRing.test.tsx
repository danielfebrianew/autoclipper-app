import { describe, it, expect } from 'vitest'
import { render } from '../../test/utils'
import ProgressRing from './ProgressRing'

function progressArc(container: HTMLElement) {
  // The second circle is the progress arc (first is the track).
  return container.querySelectorAll('circle')[1]
}

describe('ProgressRing', () => {
  it('renders an svg of the given size', () => {
    const { container } = render(<ProgressRing pct={50} size={60} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('60')
  })

  it('fully offsets the arc at 0%', () => {
    const { container } = render(<ProgressRing pct={0} size={40} />)
    const arc = progressArc(container)
    const dash = Number(arc.getAttribute('stroke-dasharray'))
    const offset = Number(arc.getAttribute('stroke-dashoffset'))
    expect(offset).toBeCloseTo(dash, 5) // offset === circumference → empty
  })

  it('has zero offset at 100%', () => {
    const { container } = render(<ProgressRing pct={100} size={40} />)
    const offset = Number(progressArc(container).getAttribute('stroke-dashoffset'))
    expect(offset).toBeCloseTo(0, 5)
  })

  it('offsets the arc halfway at 50%', () => {
    const { container } = render(<ProgressRing pct={50} size={40} />)
    const arc = progressArc(container)
    const dash = Number(arc.getAttribute('stroke-dasharray'))
    const offset = Number(arc.getAttribute('stroke-dashoffset'))
    expect(offset).toBeCloseTo(dash / 2, 5)
  })
})
