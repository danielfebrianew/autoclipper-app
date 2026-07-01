import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, mockResolved } from '../../test/utils'
import LibraryMain from './LibraryMain'

const video = (over: any = {}) => ({
  video_id: 'v1', title: 'Alpha Video', youtube_url: 'https://y/1', created_at: '2026-01-01',
  duration: 600, source_bytes: 1024 * 1024 * 100, file_exists: true, video_path: '/v.mp4',
  clip_count: 3, project_count: 1, status: 'ready', thumb_path: '', ...over,
})

function state(list: any[], detailVideoId: string | null = null) {
  return {
    library: {
      list, loading: false, busyId: null, storage: null,
      detailVideoId, detailProjects: [], detailLoading: false,
    },
  } as any
}

describe('LibraryMain', () => {
  // Mount effect re-fetches the library list; seed it so preloaded state sticks.
  const render = (list: any[], detailVideoId: string | null = null) => {
    mockResolved('ListLibraryVideos', list)
    return renderWithStore(<LibraryMain />, { preloadedState: state(list, detailVideoId) })
  }

  it('renders the video cards', async () => {
    render([video()])
    expect(await screen.findByText('Alpha Video')).toBeInTheDocument()
  })

  it('filters videos by the search box', async () => {
    const user = userEvent.setup()
    render([video({ video_id: 'a', title: 'Alpha' }), video({ video_id: 'b', title: 'Beta' })])
    await screen.findByText('Beta')
    await user.type(screen.getByPlaceholderText(/cari judul/i), 'Beta')
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).toBeNull()
  })

  it('shows the empty state when nothing matches', async () => {
    const user = userEvent.setup()
    render([video({ title: 'Alpha' })])
    await screen.findByText('Alpha')
    await user.type(screen.getByPlaceholderText(/cari judul/i), 'zzz')
    expect(screen.getByText(/tidak ada video yang cocok/i)).toBeInTheDocument()
  })

  it('opens the sort menu and picks a sort option', async () => {
    const user = userEvent.setup()
    render([video()])
    await user.click(screen.getByRole('button', { name: /terbaru/i }))
    await user.click(screen.getByRole('button', { name: /terbesar/i }))
    expect(screen.getByRole('button', { name: /terbesar/i })).toBeInTheDocument()
  })

  it('renders the detail view when a detail video is set', () => {
    mockResolved('ListProjectsByVideo', [])
    render([video()], 'v1')
    // LibraryDetail header shows a back-to-Library button.
    expect(screen.getByRole('button', { name: /library/i })).toBeInTheDocument()
  })
})
