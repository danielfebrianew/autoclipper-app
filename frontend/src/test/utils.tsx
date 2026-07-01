import { ReactElement, ReactNode } from 'react'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { render, RenderOptions } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { rootReducer, RootState } from '../store/store'
import { PlaybackProvider } from '../screens/overlay/playback'

export type TestStore = ReturnType<typeof makeStore>

/** Build a fresh, isolated store with optional preloaded state per test. */
export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState | undefined,
  })
}

interface RenderWithStoreOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>
  store?: TestStore
}

/**
 * Render a component wrapped in a Redux Provider with a fresh store.
 * Returns the RTL result plus the store (to assert dispatched state) and a
 * pre-bound userEvent instance.
 */
export function renderWithStore(
  ui: ReactElement,
  { preloadedState, store = makeStore(preloadedState), ...options }: RenderWithStoreOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>
  }
  return {
    store,
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options }),
  }
}

/**
 * Like renderWithStore, but also wraps the tree in the overlay-editor
 * PlaybackProvider so components that call usePlayback() render.
 */
export function renderWithPlayback(
  ui: ReactElement,
  { preloadedState, store = makeStore(preloadedState), ...options }: RenderWithStoreOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <PlaybackProvider>{children}</PlaybackProvider>
      </Provider>
    )
  }
  return {
    store,
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options }),
  }
}

// Re-export everything from RTL so tests import from one place.
export * from '@testing-library/react'
export { userEvent }

// Wails binding mock controls (alias → src/test/mocks/wails). Use these to
// override/assert backend calls: mockResolved('GetClips', [...]), calls.GetClips, etc.
export {
  setBinding, mockResolved, mockRejected, resetBindings, calls,
} from './mocks/wails'
