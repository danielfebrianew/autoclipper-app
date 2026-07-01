import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved } from '../../test/utils'
import ActivityColumn from './ActivityColumn'

const project = (over: any = {}) => ({
  id: 'p1', name: 'My Project', status: 'analyzing', source_video_id: 'v1',
  gemini_json: '', created_at: '', updated_at: '', ...over,
})

const clip = (over: any = {}) => ({
  id: 'c1', project_id: 'p1', clip_index: 0, start_seconds: 0, end_seconds: 30,
  duration_seconds: 30, viral_score: 80, ...over,
})

const video = (over: any = {}) => ({
  video_id: 'v1', title: 'My Video', youtube_url: 'https://youtu.be/v1',
  duration: 6128, source_bytes: 0, video_path: '', file_exists: true, status: 'ready',
  thumb_path: '', clip_count: 0, project_count: 1, created_at: '', ...over,
})

function state(
  projects: any[],
  activeProjectId: string | null = 'p1',
  extra: { clips?: any[]; library?: any[] } = {},
) {
  return {
    project: { list: projects, current: null, loading: false, error: null, downloadProgress: {} },
    clip: { list: extra.clips ?? [], selected: [], loading: false, generateProgress: {} },
    library: {
      list: extra.library ?? [], loading: false, busyId: null, storage: null,
      detailVideoId: null, detailProjects: [], detailLoading: false,
    },
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

  it('shows the pasted link and download when downloaded', () => {
    renderWithStore(<ActivityColumn />, {
      preloadedState: state([project({ status: 'analyzing' })], 'p1', { library: [video()] }),
    })
    // KAMU bubble with the source URL
    expect(screen.getByText('https://youtu.be/v1')).toBeInTheDocument()
    // Video diunduh — <title> and duration chip (6128s -> 1:42:08)
    expect(screen.getByText('My Video')).toBeInTheDocument()
    expect(screen.getByText('1:42:08')).toBeInTheDocument()
    // active analysis line
    expect(screen.getByText(/Menganalisis transkrip/i)).toBeInTheDocument()
  })

  it('shows detected-moment count when clips are ready', () => {
    renderWithStore(<ActivityColumn />, {
      preloadedState: state(
        [project({ status: 'ready' })], 'p1',
        { library: [video()], clips: [clip({ id: 'c1' }), clip({ id: 'c2' })] },
      ),
    })
    expect(screen.getByText('2 momen')).toBeInTheDocument()
    expect(screen.getByText(/terdeteksi dari transkrip/i)).toBeInTheDocument()
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
