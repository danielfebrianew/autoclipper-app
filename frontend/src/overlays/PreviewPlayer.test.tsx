import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor } from '../test/utils'
import PreviewPlayer from './PreviewPlayer'

// OutputStage spins up a WebGL renderer that jsdom can't provide; stub the
// preview stages so we can test PreviewPlayer's own behavior in isolation.
vi.mock('./preview/OutputStage', () => ({ default: () => <div data-testid="output-stage" /> }))
vi.mock('./preview/SourceStage', () => ({
  default: () => <div data-testid="source-stage" />,
}))

const clip = (over: any = {}) => ({
  id: 'c1', clip_index: 0, project_id: 'p1', hook: 'My Hook', category: 'tutorial',
  viral_score: 88, start_seconds: 0, end_seconds: 30, duration_seconds: 30,
  aspect_ratio: '9:16', caption_style: 'bold', caption_position: 'bot', caption_size: 'M',
  caption_text: '', track_template: 'single', track_smooth: true, track_lock_main: false,
  track_sensitivity: 50, ...over,
})

function state(over: any = {}) {
  return {
    ui: {
      screen: 'workspace', overlay: 'preview', previewClipId: 'c1', previewTab: 'edit',
      exportClipIds: null, deleteClipIds: null, deleteProjectId: null,
      activeProjectId: 'p1', playTarget: null, overlayProjectId: null, ...over,
    },
    clip: { list: [clip()], selected: [], loading: false, generateProgress: {} },
  } as any
}

describe('PreviewPlayer', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders nothing when the clip is not found', () => {
    const { container } = renderWithStore(<PreviewPlayer />, {
      preloadedState: state({ previewClipId: 'missing' }),
    })
    // Falls back to null → empty render.
    expect(container.querySelector('[data-testid="source-stage"]')).toBeNull()
  })

  it('renders the header with hook, category and viral score', () => {
    renderWithStore(<PreviewPlayer />, { preloadedState: state() })
    // "My Hook" appears in both the header title and the source label.
    expect(screen.getAllByText(/My Hook/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('tutorial')).toBeInTheDocument()
    expect(screen.getAllByText(/88/).length).toBeGreaterThanOrEqual(1)
  })

  it('switches the active preview tab', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<PreviewPlayer />, { preloadedState: state() })
    await user.click(screen.getByRole('button', { name: /track/i }))
    expect(store.getState().ui.previewTab).toBe('track')
  })

  it('opens the export overlay for the current clip', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<PreviewPlayer />, { preloadedState: state() })
    await user.click(screen.getByRole('button', { name: /export klip/i }))
    await waitFor(() => {
      const ui = store.getState().ui
      expect(ui.overlay).toBe('export')
      expect(ui.exportClipIds).toEqual(['c1'])
    })
  })

  it('toggles split view', async () => {
    const user = userEvent.setup()
    renderWithStore(<PreviewPlayer />, { preloadedState: state() })
    expect(screen.getByRole('button', { name: /split view/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /split view/i }))
    expect(screen.getByRole('button', { name: /single/i })).toBeInTheDocument()
  })
})
