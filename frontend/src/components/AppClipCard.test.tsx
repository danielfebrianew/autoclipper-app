import { describe, it, expect, vi } from 'vitest'
import { render, screen, userEvent } from '../test/utils'
import AppClipCard from './AppClipCard'
import type { Clip } from '../store/slices/clipSlice'

const clip = (over: Partial<Clip> = {}): Clip => ({
  id: 'c1', clip_index: 0, duration_seconds: 30, viral_score: 70,
  hook: 'A great hook', summary: '', category: 'tutorial', energy_level: 'high',
  start_seconds: 0, end_seconds: 30,
} as Clip)

describe('AppClipCard', () => {
  it('renders the hook, category and formatted duration', () => {
    render(<AppClipCard clip={clip()} />)
    expect(screen.getByText('A great hook')).toBeInTheDocument()
    expect(screen.getByText('tutorial')).toBeInTheDocument()
    // 0:30 appears both in the thumb badge and the info row.
    expect(screen.getAllByText('0:30').length).toBeGreaterThanOrEqual(1)
  })

  it('calls onPreview when the card is clicked (not generating)', async () => {
    const onPreview = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<AppClipCard clip={clip()} onPreview={onPreview} />)
    await user.click(container.firstChild as HTMLElement)
    expect(onPreview).toHaveBeenCalled()
  })

  it('toggles selection without triggering preview', async () => {
    const onPreview = vi.fn()
    const onToggleSelect = vi.fn()
    const user = userEvent.setup()
    render(<AppClipCard clip={clip()} onPreview={onPreview} onToggleSelect={onToggleSelect} />)
    // The checkbox is the first button rendered inside the thumb.
    const checkbox = screen.getAllByRole('button')[0]
    await user.click(checkbox)
    expect(onToggleSelect).toHaveBeenCalled()
    expect(onPreview).not.toHaveBeenCalled()
  })

  it('shows the generating overlay and opens the log instead of previewing', async () => {
    const onPreview = vi.fn()
    const onOpenLog = vi.fn()
    const user = userEvent.setup()
    render(
      <AppClipCard
        clip={clip()}
        progress={{ step: 'reframe', percent: 42, message: '' }}
        onPreview={onPreview}
        onOpenLog={onOpenLog}
      />,
    )
    expect(screen.getByText(/reframe 42%/i)).toBeInTheDocument()
    await user.click(screen.getByText(/lihat log/i))
    expect(onOpenLog).toHaveBeenCalled()
    expect(onPreview).not.toHaveBeenCalled()
  })

  it('wires the hover toolbar buttons to their handlers', async () => {
    const onDelete = vi.fn()
    const onExport = vi.fn()
    const user = userEvent.setup()
    render(<AppClipCard clip={clip()} onDelete={onDelete} onExport={onExport} />)
    await user.click(screen.getByTitle('Hapus'))
    await user.click(screen.getByTitle('Export'))
    expect(onDelete).toHaveBeenCalled()
    expect(onExport).toHaveBeenCalled()
  })
})
