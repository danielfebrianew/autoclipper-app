import { describe, it, expect, beforeEach } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved } from '../test/utils'
import BootstrapScreen from './BootstrapScreen'

const deps = [
  { name: 'yt-dlp', status: 'pending', message: 'belum', icon: 'download' },
  { name: 'ffmpeg', status: 'pending', message: 'belum', icon: 'film' },
]

describe('BootstrapScreen', () => {
  beforeEach(() => {
    mockResolved('CheckDependencies', deps)
    mockResolved('RunSetup', undefined)
  })

  it('renders the dependency list once loaded', async () => {
    renderWithStore(<BootstrapScreen />)
    expect(await screen.findByText('yt-dlp')).toBeInTheDocument()
    expect(screen.getByText('ffmpeg')).toBeInTheDocument()
  })

  it('shows the "menyiapkan" headline while not done', async () => {
    renderWithStore(<BootstrapScreen />)
    expect(await screen.findByText(/Menyiapkan Auto Clipper/i)).toBeInTheDocument()
  })

  it('runs setup when the install button is clicked', async () => {
    const user = userEvent.setup()
    renderWithStore(<BootstrapScreen />)
    await screen.findByText('yt-dlp')
    await user.click(screen.getByRole('button', { name: /install dependency/i }))
    await waitFor(() => expect(calls.RunSetup.length).toBeGreaterThan(0))
  })

  it('shows the ready state + continue button when all deps are ok', async () => {
    mockResolved('CheckDependencies', [
      { name: 'yt-dlp', status: 'ok', message: 'ok' },
      { name: 'ffmpeg', status: 'ok', message: 'ok' },
    ])
    const { store } = renderWithStore(<BootstrapScreen />)
    expect(await screen.findByText(/Auto Clipper siap dipakai/i)).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /lanjut ke aktivasi/i }))
    expect(store.getState().ui.screen).toBe('activation')
  })
})
