import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '../../test/utils'
import ClipThumb from './ClipThumb'

describe('ClipThumb', () => {
  it('renders the label and duration', () => {
    render(<ClipThumb label="scene" dur="0:30" />)
    expect(screen.getByText('scene')).toBeInTheDocument()
    expect(screen.getByText('0:30')).toBeInTheDocument()
  })

  it('shows the image when a src is provided', () => {
    const { container } = render(<ClipThumb src="/media/x.jpg" />)
    const img = container.querySelector('img')!
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toBe('/media/x.jpg')
  })

  it('falls back to the placeholder when the image errors', () => {
    const { container } = render(<ClipThumb src="/broken.jpg" />)
    const img = container.querySelector('img')!
    fireEvent.error(img)
    expect(container.querySelector('img')).toBeNull()
  })

  it('renders the viral chip when a score is given', () => {
    render(<ClipThumb score={88} />)
    expect(screen.getByText('88')).toBeInTheDocument()
  })

  it('renders children passed into the thumb', () => {
    render(<ClipThumb><div data-testid="child">hi</div></ClipThumb>)
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})
