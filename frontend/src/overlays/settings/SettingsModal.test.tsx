import { describe, it, expect, beforeEach } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved } from '../../test/utils'
import SettingsModal from './SettingsModal'

const settingsData = {
  kie_api_key: 'kie-key', gemini_api_key: '', openai_api_key: '',
  gemini_model: 'gemini-1.5', transcript_engine: 'youtube', auto_reframe: true,
  output_dir: '~/out', storage_limit_gb: 50, delete_source_after: false,
  ui_language: 'id', transcript_language: 'id', default_ratio: '9:16',
  max_clips: 10, open_on_startup: false,
}

function preload(over: any = {}) {
  return {
    settings: { data: settingsData, providers: [], loading: false, saving: false, testStatus: {}, ...over },
    app: { licenseValid: true, setupComplete: true, version: '1.0.0', loading: false },
    ui: {
      screen: 'workspace', overlay: 'settings', previewClipId: null, previewTab: 'edit',
      exportClipIds: null, deleteClipIds: null, deleteProjectId: null,
      activeProjectId: null, playTarget: null, overlayProjectId: null,
    },
  } as any
}

describe('SettingsModal', () => {
  // The component re-fetches settings on mount; make the binding return our
  // data so the mount effect doesn't blank out the preloaded state.
  beforeEach(() => {
    mockResolved('GetSettings', settingsData)
    mockResolved('GetProviders', [])
  })

  it('opens on the API Keys tab by default', async () => {
    renderWithStore(<SettingsModal />, { preloadedState: preload() })
    // The mount effect re-fetches (pending → loading), so wait for the content.
    expect(await screen.findByText('KIE.ai API Key')).toBeInTheDocument()
  })

  it('switches tabs to Model', async () => {
    const user = userEvent.setup()
    renderWithStore(<SettingsModal />, { preloadedState: preload() })
    await user.click(screen.getByRole('button', { name: /model/i }))
    expect(await screen.findByText('Model Gemini')).toBeInTheDocument()
  })

  it('shows a spinner while loading', () => {
    renderWithStore(<SettingsModal />, { preloadedState: preload({ data: null, loading: true }) })
    expect(screen.queryByText('KIE.ai API Key')).toBeNull()
  })

  it('reveals an API key when toggling the eye button', async () => {
    const user = userEvent.setup()
    const { container } = renderWithStore(<SettingsModal />, { preloadedState: preload() })
    await screen.findByText('KIE.ai API Key') // wait for fields to render
    const keyInput = container.querySelector('input[type="password"]') as HTMLInputElement
    expect(keyInput).toBeInTheDocument()
    const eyeBtn = keyInput.parentElement!.querySelector('button')!
    await user.click(eyeBtn)
    expect(container.querySelector('input[type="text"]')).toBeInTheDocument()
  })

  it('tests a provider key via the Uji button', async () => {
    mockResolved('TestProviderKey', { connected: true, message: 'OK' })
    const user = userEvent.setup()
    renderWithStore(<SettingsModal />, { preloadedState: preload() })
    const ujiButtons = await screen.findAllByRole('button', { name: /uji/i })
    await user.click(ujiButtons[0])
    await waitFor(() => expect(calls.TestProviderKey.length).toBeGreaterThan(0))
  })

  it('saves settings and closes', async () => {
    mockResolved('SaveSettings', undefined)
    mockResolved('GetProviders', [])
    const user = userEvent.setup()
    const { store } = renderWithStore(<SettingsModal />, { preloadedState: preload() })
    await screen.findByText('KIE.ai API Key')
    await user.click(screen.getByRole('button', { name: /simpan/i }))
    await waitFor(() => expect(calls.SaveSettings.length).toBeGreaterThan(0))
    await waitFor(() => expect(store.getState().ui.overlay).toBeNull())
  })
})
