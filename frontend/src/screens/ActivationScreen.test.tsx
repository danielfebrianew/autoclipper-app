import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved, mockRejected, fireEvent } from '../test/utils'
import ActivationScreen from './ActivationScreen'

function inputs() {
  return screen.getAllByPlaceholderText('XXXX') as HTMLInputElement[]
}

describe('ActivationScreen', () => {
  it('renders four key-group inputs', () => {
    renderWithStore(<ActivationScreen />)
    expect(inputs()).toHaveLength(4)
  })

  it('filters non-alphanumerics and uppercases input', async () => {
    const user = userEvent.setup()
    renderWithStore(<ActivationScreen />)
    await user.type(inputs()[0], 'ab-1!')
    expect(inputs()[0].value).toBe('AB1')
  })

  it('auto-advances focus after filling a group', async () => {
    const user = userEvent.setup()
    renderWithStore(<ActivationScreen />)
    await user.type(inputs()[0], 'ABCD')
    expect(inputs()[1]).toHaveFocus()
  })

  it('splits a pasted full key across the groups', () => {
    renderWithStore(<ActivationScreen />)
    fireEvent.paste(inputs()[0], { clipboardData: { getData: () => 'ABCD-EFGH-IJKL-MNOP' } })
    const vals = inputs().map(i => i.value)
    expect(vals).toEqual(['ABCD', 'EFGH', 'IJKL', 'MNOP'])
  })

  it('activates and moves to the workspace on success', async () => {
    mockResolved('ActivateLicense', undefined)
    const user = userEvent.setup()
    const { store } = renderWithStore(<ActivationScreen />)
    const groups = inputs()
    for (let i = 0; i < 4; i++) await user.type(groups[i], 'ABCD')
    await user.click(screen.getByRole('button', { name: /aktifkan/i }))
    await waitFor(() => expect(store.getState().ui.screen).toBe('workspace'))
    expect(store.getState().app.licenseValid).toBe(true)
  })

  it('routes to the offline screen on a network error', async () => {
    mockRejected('ActivateLicense', 'network unreachable')
    const user = userEvent.setup()
    const { store } = renderWithStore(<ActivationScreen />)
    const groups = inputs()
    for (let i = 0; i < 4; i++) await user.type(groups[i], 'ABCD')
    await user.click(screen.getByRole('button', { name: /aktifkan/i }))
    await waitFor(() => expect(store.getState().ui.screen).toBe('offline'))
  })

  it('shows an inline error for an invalid license', async () => {
    mockRejected('ActivateLicense', 'invalid key')
    const user = userEvent.setup()
    renderWithStore(<ActivationScreen />)
    const groups = inputs()
    for (let i = 0; i < 4; i++) await user.type(groups[i], 'ABCD')
    await user.click(screen.getByRole('button', { name: /aktifkan/i }))
    expect(await screen.findByText(/lisensi tidak valid/i)).toBeInTheDocument()
  })
})
