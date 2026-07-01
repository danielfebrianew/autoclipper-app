import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved } from '../../test/utils'
import RenderPanel from './RenderPanel'

const current = (over: any = {}) => ({
  id: 'ov1', name: 'Overlay One', source_video_path: '/v.mp4', source_clip_id: '',
  video_width: 1080, video_height: 1920, video_fps: 30, video_duration: 12,
  layout: {}, click_sound: { enabled: false, volume: 1 }, cover: null, tracks: [],
  created_at: '', updated_at: '', ...over,
})

function state(render: any = { status: 'idle', percent: 0, message: '', outputPath: '' }) {
  return {
    overlay: { projects: [], current: current(), images: [], loading: false, saveStatus: 'idle', render },
  } as any
}

describe('RenderPanel', () => {
  it('shows the Render button when idle', () => {
    renderWithStore(<RenderPanel />, { preloadedState: state() })
    expect(screen.getByRole('button', { name: /^render$/i })).toBeInTheDocument()
  })

  it('starts a render when clicked', async () => {
    mockResolved('RenderOverlay', undefined)
    const user = userEvent.setup()
    renderWithStore(<RenderPanel />, { preloadedState: state() })
    await user.click(screen.getByRole('button', { name: /^render$/i }))
    await waitFor(() => expect(calls.RenderOverlay.length).toBeGreaterThan(0))
  })

  it('shows a progress bar and cancel button while running', () => {
    renderWithStore(<RenderPanel />, {
      preloadedState: state({ status: 'running', percent: 40, message: 'encoding', outputPath: '' }),
    })
    expect(screen.getByText('encoding')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /batal/i })).toBeInTheDocument()
  })

  it('offers play + open-folder when done', () => {
    renderWithStore(<RenderPanel />, {
      preloadedState: state({ status: 'done', percent: 100, message: '', outputPath: '/out.mp4' }),
    })
    expect(screen.getByRole('button', { name: /putar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /buka folder/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /render ulang/i })).toBeInTheDocument()
  })

  it('navigates back to the project list', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<RenderPanel />, { preloadedState: state() })
    await user.click(screen.getByRole('button', { name: /semua project/i }))
    expect(store.getState().ui.overlayProjectId).toBeNull()
  })
})
