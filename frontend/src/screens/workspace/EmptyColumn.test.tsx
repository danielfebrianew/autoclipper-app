import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved } from '../../test/utils'
import EmptyColumn from './EmptyColumn'

describe('EmptyColumn', () => {
  it('renders the "Aktivitas" placeholder', () => {
    renderWithStore(<EmptyColumn />)
    expect(screen.getByText('Aktivitas')).toBeInTheDocument()
    expect(screen.getByText(/belum ada aktivitas/i)).toBeInTheDocument()
  })

  it('disables the submit button until a URL is entered', async () => {
    const user = userEvent.setup()
    renderWithStore(<EmptyColumn />)
    const input = screen.getByPlaceholderText(/paste link/i)
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    await user.type(input, 'https://youtube.com/watch?v=abc')
    expect(button).toBeEnabled()
  })

  it('starts a download for a valid YouTube link', async () => {
    mockResolved('StartDownload', { project_id: 'p1', video_exists: false, video_id: 'v1' })
    const user = userEvent.setup()
    const { store } = renderWithStore(<EmptyColumn />)
    await user.type(screen.getByPlaceholderText(/paste link/i), 'https://youtu.be/xyz{Enter}')
    await waitFor(() => expect(calls.StartDownload.length).toBeGreaterThan(0))
    await waitFor(() => expect(store.getState().ui.activeProjectId).toBe('p1'))
  })
})
