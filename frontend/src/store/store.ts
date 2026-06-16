import { configureStore } from '@reduxjs/toolkit'
import appReducer from './slices/appSlice'
import projectReducer from './slices/projectSlice'
import clipReducer from './slices/clipSlice'
import uiReducer from './slices/uiSlice'
import galleryReducer from './slices/gallerySlice'
import logReducer from './slices/logSlice'
import settingsReducer from './slices/settingsSlice'

export const store = configureStore({
  reducer: {
    app: appReducer,
    project: projectReducer,
    clip: clipReducer,
    ui: uiReducer,
    gallery: galleryReducer,
    log: logReducer,
    settings: settingsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
