import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved } from '../../test/utils'
import EmptyState from './EmptyState'

describe('EmptyState', () => {
  it('renders the headline and paste input', () => {
    renderWithStore(<EmptyState />)
    expect(screen.getByText(/mulai dari sebuah link/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/youtube\.com\/watch/i)).toBeInTheDocument()
  })

  it('keeps the Download button disabled until a URL is typed', async () => {
    const user = userEvent.setup()
    renderWithStore(<EmptyState />)
    const btn = screen.getByRole('button', { name: /download/i })
    expect(btn).toBeDisabled()
    await user.type(screen.getByPlaceholderText(/youtube\.com\/watch/i), 'https://youtu.be/z')
    expect(btn).toBeEnabled()
  })

  it('starts a download and sets the active project on success', async () => {
    mockResolved('StartDownload', { project_id: 'p9', video_exists: false, video_id: 'v9', video_title: 'T' })
    const user = userEvent.setup()
    const { store } = renderWithStore(<EmptyState />)
    await user.type(screen.getByPlaceholderText(/youtube\.com\/watch/i), 'https://youtube.com/watch?v=abc')
    await user.click(screen.getByRole('button', { name: /download/i }))
    await waitFor(() => expect(calls.StartDownload.length).toBeGreaterThan(0))
    await waitFor(() => expect(store.getState().ui.activeProjectId).toBe('p9'))
  })

  it('shows recent library chips', () => {
    renderWithStore(<EmptyState />, {
      preloadedState: {
        library: {
          list: [{ video_id: 'v1', title: 'Recent One', thumb_path: '' }],
          loading: false, busyId: null, storage: null, detailVideoId: null,
          detailProjects: [], detailLoading: false,
        },
      } as any,
    })
    expect(screen.getByText('Recent One')).toBeInTheDocument()
  })
})
