import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent } from '../test/utils'
import OfflineScreen from './OfflineScreen'

describe('OfflineScreen', () => {
  it('renders the offline message', () => {
    renderWithStore(<OfflineScreen />)
    expect(screen.getByText(/Tidak ada koneksi internet/i)).toBeInTheDocument()
  })

  it('"Coba lagi" navigates back to activation', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<OfflineScreen />)
    await user.click(screen.getByRole('button', { name: /coba lagi/i }))
    expect(store.getState().ui.screen).toBe('activation')
  })

  it('"Lanjutkan offline" navigates to the workspace', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<OfflineScreen />)
    await user.click(screen.getByRole('button', { name: /lanjutkan offline/i }))
    expect(store.getState().ui.screen).toBe('workspace')
  })
})
