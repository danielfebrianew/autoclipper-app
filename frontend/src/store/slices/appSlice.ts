import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { IsLicenseValid, IsSetupComplete, GetAppVersion } from '../../../wailsjs/go/main/App'

interface AppState {
  licenseValid: boolean
  setupComplete: boolean
  version: string
  loading: boolean
}

const initialState: AppState = {
  licenseValid: false,
  setupComplete: false,
  version: '',
  loading: true,
}

export const initApp = createAsyncThunk('app/init', async () => {
  const [licenseValid, setupComplete, version] = await Promise.all([
    IsLicenseValid(),
    IsSetupComplete(),
    GetAppVersion(),
  ])
  return { licenseValid, setupComplete, version }
})

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setLicenseValid(state, action: PayloadAction<boolean>) {
      state.licenseValid = action.payload
    },
    setSetupComplete(state, action: PayloadAction<boolean>) {
      state.setupComplete = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initApp.fulfilled, (state, action) => {
        state.licenseValid = action.payload.licenseValid
        state.setupComplete = action.payload.setupComplete
        state.version = action.payload.version
        state.loading = false
      })
      .addCase(initApp.rejected, (state) => {
        state.loading = false
      })
  },
})

export const { setLicenseValid, setSetupComplete } = appSlice.actions
export default appSlice.reducer
