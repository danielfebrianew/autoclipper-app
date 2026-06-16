import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { GetSettings, SaveSettings, GetProviders, TestProviderKey } from '../../../wailsjs/go/main/App'
import { settings, main } from '../../../wailsjs/go/models'

type Settings = settings.Settings
type Provider = main.Provider

interface SettingsState {
  data: Settings | null
  providers: Provider[]
  loading: boolean
  saving: boolean
  testStatus: Record<string, { connected: boolean; message: string; testing?: boolean }>
}

const initialState: SettingsState = {
  data: null,
  providers: [],
  loading: false,
  saving: false,
  testStatus: {},
}

export const fetchSettings = createAsyncThunk('settings/get', async () => {
  const [data, providers] = await Promise.all([GetSettings(), GetProviders()])
  return { data, providers }
})

export const saveSettings = createAsyncThunk('settings/save', async (data: Settings) => {
  await SaveSettings(data)
  // re-read providers so connected/empty status refreshes
  const providers = await GetProviders()
  return providers
})

export const testProvider = createAsyncThunk(
  'settings/test',
  async ({ providerId, key }: { providerId: string; key: string }) => {
    const status = await TestProviderKey(providerId, key)
    return { providerId, status }
  },
)

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // Local optimistic edits before save
    patchSettings(state, action: PayloadAction<Partial<Settings>>) {
      if (state.data) state.data = { ...state.data, ...action.payload } as Settings
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSettings.pending, (state) => { state.loading = true })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.data = action.payload.data
        state.providers = action.payload.providers
        state.loading = false
      })
      .addCase(fetchSettings.rejected, (state) => { state.loading = false })
      .addCase(saveSettings.pending, (state) => { state.saving = true })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.providers = action.payload
        state.saving = false
      })
      .addCase(saveSettings.rejected, (state) => { state.saving = false })
      .addCase(testProvider.pending, (state, action) => {
        const id = action.meta.arg.providerId
        state.testStatus[id] = { ...state.testStatus[id], connected: false, message: '', testing: true }
      })
      .addCase(testProvider.fulfilled, (state, action) => {
        const { providerId, status } = action.payload
        state.testStatus[providerId] = { connected: status.connected, message: status.message, testing: false }
      })
      .addCase(testProvider.rejected, (state, action) => {
        const id = action.meta.arg.providerId
        state.testStatus[id] = { connected: false, message: 'Gagal menguji', testing: false }
      })
  },
})

export const { patchSettings } = settingsSlice.actions
export default settingsSlice.reducer
