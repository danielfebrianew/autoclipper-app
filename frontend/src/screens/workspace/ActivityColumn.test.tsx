import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved } from '../../test/utils'
import ActivityColumn from './ActivityColumn'

const project = (over: any = {}) => ({
  id: 'p1', name: 'My Project', status: 'analyzing', source_video_id: 'v1',
  gemini_json: '', created_at: '', updated_at: '', ...over,
})

function state(projects: any[], activeProjectId: string | null = 'p1') {
  return {
    project: { list: projects, current: null, loading: false, error: null, downloadProgress: {} },
    clip: { list: [], selected: [], loading: false, generateProgress: {} },
    ui: {
      screen: 'workspace', overlay: null, previewClipId: null, previewTab: 'edit',
      exportClipIds: null, deleteClipIds: null, deleteProjectId: null,
      activeProjectId, playTarget: null, overlayProjectId: null,
    },
  } as any
}

describe('ActivityColumn', () => {
  it('shows the active project name as the header', async () => {
    mockResolved('ListProjects', [project()])
    renderWithStore(<ActivityColumn />, { preloadedState: state([project()]) })
    expect(await screen.findByText('My Project')).toBeInTheDocument()
  })

  it('renders the processing thread steps', () => {
    renderWithStore(<ActivityColumn />, { preloadedState: state([project({ status: 'analyzing' })]) })
    expect(screen.getByText('Download video')).toBeInTheDocument()
    expect(screen.getByText('Transkripsi')).toBeInTheDocument()
    expect(screen.getByText('Analisis Gemini')).toBeInTheDocument()
  })

  it('falls back to "Aktivitas" with no active project', () => {
    renderWithStore(<ActivityColumn />, { preloadedState: state([], null) })
    expect(screen.getByText('Aktivitas')).toBeInTheDocument()
  })

  it('starts a download from the pinned input', async () => {
    mockResolved('StartDownload', { project_id: 'p2', video_exists: false, video_id: 'v2', video_title: 'T' })
    const user = userEvent.setup()
    renderWithStore(<ActivityColumn />, { preloadedState: state([], null) })
    await user.type(screen.getByPlaceholderText(/paste link/i), 'https://youtu.be/abc{Enter}')
    await waitFor(() => expect(calls.StartDownload.length).toBeGreaterThan(0))
  })
})
