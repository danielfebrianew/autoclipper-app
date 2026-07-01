import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved } from '../../test/utils'
import LibraryDetail from './LibraryDetail'

const video = (over: any = {}) => ({
  video_id: 'v1', title: 'Alpha Video', youtube_url: '', created_at: '', duration: 600,
  source_bytes: 100, file_exists: true, video_path: '/v.mp4', clip_count: 5,
  project_count: 2, status: 'ready', thumb_path: '', ...over,
})

const proj = (over: any = {}) => ({ id: 'p1', name: 'Set 1', status: 'ready', ...over })

function state(over: any = {}) {
  return {
    library: {
      list: [video()], loading: false, busyId: null, storage: null,
      detailVideoId: 'v1', detailProjects: [proj()], detailLoading: false, ...over,
    },
  } as any
}

describe('LibraryDetail', () => {
  // The detail view re-fetches its project rows on mount; return them so the
  // effect doesn't blank out the preloaded detailProjects.
  const seedFetch = (projects: any[]) => mockResolved('ListProjectsByVideo', projects)

  it('shows the video title and project summary', () => {
    seedFetch([proj()])
    // detailProjects has 1 entry; video.clip_count is 5.
    const { container } = renderWithStore(<LibraryDetail />, { preloadedState: state() })
    expect(screen.getByText('Alpha Video')).toBeInTheDocument()
    // Summary text is split by an inline StackIcon.
    expect(container.textContent).toContain('1 set klip')
    expect(container.textContent).toContain('5 klip total')
  })

  it('lists the project rows', async () => {
    seedFetch([proj({ id: 'p1', name: 'Set 1' }), proj({ id: 'p2', name: 'Set 2' })])
    renderWithStore(<LibraryDetail />, {
      preloadedState: state({ detailProjects: [proj({ id: 'p1', name: 'Set 1' }), proj({ id: 'p2', name: 'Set 2' })] }),
    })
    expect(await screen.findByText('Set 1')).toBeInTheDocument()
    expect(screen.getByText('Set 2')).toBeInTheDocument()
  })

  it('opens a project into the workspace', async () => {
    seedFetch([proj()])
    const user = userEvent.setup()
    const { store } = renderWithStore(<LibraryDetail />, { preloadedState: state() })
    await user.click(await screen.findByText('Set 1'))
    expect(store.getState().ui.screen).toBe('workspace')
    expect(store.getState().ui.activeProjectId).toBe('p1')
  })

  it('makes more clips via the primary button', async () => {
    seedFetch([proj()])
    mockResolved('MakeMoreClips', undefined)
    const user = userEvent.setup()
    renderWithStore(<LibraryDetail />, { preloadedState: state() })
    await user.click(screen.getByRole('button', { name: /buat klip baru/i }))
    await waitFor(() => expect(calls.MakeMoreClips).toContainEqual(['v1']))
  })

  it('closes the detail view via the back button', async () => {
    seedFetch([proj()])
    const user = userEvent.setup()
    const { store } = renderWithStore(<LibraryDetail />, { preloadedState: state() })
    await user.click(screen.getByRole('button', { name: /library/i }))
    expect(store.getState().library.detailVideoId).toBeNull()
  })

  it('empty-states when there are no projects', async () => {
    seedFetch([])
    renderWithStore(<LibraryDetail />, { preloadedState: state({ detailProjects: [] }) })
    expect(await screen.findByText(/belum ada set klip/i)).toBeInTheDocument()
  })
})
