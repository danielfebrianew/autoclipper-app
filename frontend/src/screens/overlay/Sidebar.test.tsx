import { describe, it, expect } from 'vitest'
import { renderWithPlayback, screen, userEvent, waitFor } from '../../test/utils'
import Sidebar from './Sidebar'

const current = (over: any = {}) => ({
  id: 'ov1', name: 'Overlay One', source_video_path: '/v.mp4', source_clip_id: '',
  video_width: 1080, video_height: 1920, video_fps: 30, video_duration: 12,
  layout: { aspect_ratio: '9:16', image_area_ratio: 0.3, fit: 'cover' },
  click_sound: { enabled: false, volume: 1 }, cover: null, tracks: [],
  created_at: '', updated_at: '', ...over,
})

function state(over: any = {}) {
  return {
    overlay: {
      projects: [], current: current(), images: [], loading: false,
      saveStatus: 'idle', render: { status: 'idle', percent: 0, message: '', outputPath: '' }, ...over,
    },
  } as any
}

describe('Sidebar', () => {
  it('renders the project name and aspect-ratio control', () => {
    renderWithPlayback(<Sidebar />, { preloadedState: state() })
    expect(screen.getByText('Overlay One')).toBeInTheDocument()
    expect(screen.getByText('Aspect ratio')).toBeInTheDocument()
  })

  it('shows a save-status label when dirty', () => {
    renderWithPlayback(<Sidebar />, { preloadedState: state({ saveStatus: 'dirty' }) })
    expect(screen.getByText(/perubahan belum disimpan/i)).toBeInTheDocument()
  })

  it('updates the aspect ratio via the segmented control', async () => {
    const user = userEvent.setup()
    const { store } = renderWithPlayback(<Sidebar />, { preloadedState: state() })
    await user.click(screen.getByRole('button', { name: '1:1' }))
    await waitFor(() => expect(store.getState().overlay.current?.layout.aspect_ratio).toBe('1:1'))
    // Local edits mark the project dirty for auto-save.
    expect(store.getState().overlay.saveStatus).toBe('dirty')
  })
})
