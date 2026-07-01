import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, mockResolved } from '../../test/utils'
import OverlayProjectList from './OverlayProjectList'

const project = (over: any = {}) => ({
  id: 'ov1', name: 'Overlay One', source_video_path: '', source_clip_id: '',
  video_width: 1080, video_height: 1920, video_fps: 30, video_duration: 12,
  layout: {}, click_sound: { enabled: false, volume: 1 }, cover: null,
  tracks: [], created_at: '', updated_at: '', ...over,
})

function state(projects: any[]) {
  return {
    overlay: {
      projects, current: null, images: [], loading: false,
      saveStatus: 'idle', render: { status: 'idle', percent: 0, message: '', outputPath: '' },
    },
  } as any
}

describe('OverlayProjectList', () => {
  const render = (projects: any[]) => {
    mockResolved('ListOverlayProjects', projects)
    return renderWithStore(<OverlayProjectList />, { preloadedState: state(projects) })
  }

  it('renders the editor header', () => {
    render([])
    expect(screen.getByText('Overlay Editor')).toBeInTheDocument()
  })

  it('shows the empty state with no projects', async () => {
    render([])
    expect(await screen.findByText(/belum ada project overlay/i)).toBeInTheDocument()
  })

  it('lists project cards', async () => {
    render([project()])
    expect(await screen.findByText('Overlay One')).toBeInTheDocument()
  })

  it('opens a project into the editor', async () => {
    const user = userEvent.setup()
    const { store } = render([project()])
    await user.click(await screen.findByText('Overlay One'))
    await waitFor(() => expect(store.getState().ui.overlayProjectId).toBe('ov1'))
  })

  it('navigates to the gallery via the create button', async () => {
    const user = userEvent.setup()
    const { store } = render([])
    await user.click(screen.getByRole('button', { name: /buat dari klip/i }))
    expect(store.getState().ui.screen).toBe('gallery')
  })
})
