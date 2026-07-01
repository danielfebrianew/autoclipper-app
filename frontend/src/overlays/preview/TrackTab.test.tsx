import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent, waitFor, calls, mockResolved } from '../../test/utils'
import TrackTab from './TrackTab'

function setup(props: Partial<Parameters<typeof TrackTab>[0]> = {}) {
  const onTemplateChange = vi.fn()
  const onOptsChange = vi.fn()
  const onRetrack = vi.fn()
  render(
    <TrackTab
      clipId="c1"
      template="single"
      smooth
      lockMain={false}
      sensitivity={50}
      onTemplateChange={onTemplateChange}
      onOptsChange={onOptsChange}
      onRetrack={onRetrack}
      {...props}
    />,
  )
  return { onTemplateChange, onOptsChange, onRetrack }
}

describe('TrackTab', () => {
  it('renders all six templates', () => {
    setup()
    for (const label of ['Single', 'Single Atas', 'Dual', 'Dual Sisi', 'Speaker', 'Static']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('selects a template and persists it', async () => {
    const user = userEvent.setup()
    const { onTemplateChange } = setup()
    await user.click(screen.getByText('Dual'))
    expect(onTemplateChange).toHaveBeenCalledWith('dual')
    await waitFor(() => expect(calls.SetClipTrackTemplate).toContainEqual(['c1', 'dual']))
  })

  it('toggles smooth and lock options', async () => {
    const user = userEvent.setup()
    const { onOptsChange } = setup()
    const toggles = screen.getAllByRole('button').filter(b => b.className.includes('toggle'))
    await user.click(toggles[0]) // smooth → off
    expect(onOptsChange).toHaveBeenCalledWith(expect.objectContaining({ smooth: false }))
  })

  it('updates sensitivity from the slider', () => {
    const { onOptsChange } = setup()
    const slider = screen.getByRole('slider')
    fireInput(slider, '80')
    expect(onOptsChange).toHaveBeenCalledWith(expect.objectContaining({ sensitivity: 80 }))
  })

  it('runs re-track and calls onRetrack on success', async () => {
    mockResolved('RetrackFaces', undefined)
    const user = userEvent.setup()
    const { onRetrack } = setup()
    await user.click(screen.getByRole('button', { name: /re-track wajah/i }))
    await waitFor(() => expect(onRetrack).toHaveBeenCalled())
    expect(calls.RetrackFaces).toContainEqual(['c1'])
  })
})

// jsdom: userEvent.type on range inputs is finicky; set value + fire change.
function fireInput(el: Element, value: string) {
  const input = el as HTMLInputElement
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}
