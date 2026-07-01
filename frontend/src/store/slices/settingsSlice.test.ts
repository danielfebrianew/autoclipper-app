import { describe, it, expect } from 'vitest'
import reducer, {
  patchSettings, fetchSettings, saveSettings, testProvider,
} from './settingsSlice'

const init = () => reducer(undefined, { type: '@@INIT' })

describe('settingsSlice', () => {
  it('patchSettings is a no-op when no data is loaded yet', () => {
    expect(reducer(init(), patchSettings({ gemini_model: 'x' } as any)).data).toBeNull()
  })

  it('patchSettings merges into loaded data', () => {
    const seeded = { ...init(), data: { gemini_model: 'a', max_clips: 5 } as any }
    const s = reducer(seeded, patchSettings({ gemini_model: 'b' } as any))
    expect(s.data).toEqual({ gemini_model: 'b', max_clips: 5 })
  })

  it('fetchSettings lifecycle: pending → fulfilled', () => {
    let s = reducer(init(), { type: fetchSettings.pending.type })
    expect(s.loading).toBe(true)
    s = reducer(s, {
      type: fetchSettings.fulfilled.type,
      payload: { data: { max_clips: 9 }, providers: [{ id: 'kie' }] },
    })
    expect(s.data).toEqual({ max_clips: 9 })
    expect(s.providers).toEqual([{ id: 'kie' }])
    expect(s.loading).toBe(false)
  })

  it('fetchSettings.rejected clears loading', () => {
    const s = reducer({ ...init(), loading: true }, { type: fetchSettings.rejected.type })
    expect(s.loading).toBe(false)
  })

  it('saveSettings lifecycle: pending → fulfilled refreshes providers', () => {
    let s = reducer(init(), { type: saveSettings.pending.type })
    expect(s.saving).toBe(true)
    s = reducer(s, { type: saveSettings.fulfilled.type, payload: [{ id: 'gemini' }] })
    expect(s.providers).toEqual([{ id: 'gemini' }])
    expect(s.saving).toBe(false)
  })

  it('saveSettings.rejected clears saving', () => {
    const s = reducer({ ...init(), saving: true }, { type: saveSettings.rejected.type })
    expect(s.saving).toBe(false)
  })

  it('testProvider pending marks the provider as testing', () => {
    const s = reducer(init(), {
      type: testProvider.pending.type,
      meta: { arg: { providerId: 'kie', key: 'k' } },
    })
    expect(s.testStatus.kie).toEqual({ connected: false, message: '', testing: true })
  })

  it('testProvider fulfilled records connection result', () => {
    const s = reducer(init(), {
      type: testProvider.fulfilled.type,
      payload: { providerId: 'kie', status: { connected: true, message: 'OK' } },
    })
    expect(s.testStatus.kie).toEqual({ connected: true, message: 'OK', testing: false })
  })

  it('testProvider rejected records failure', () => {
    const s = reducer(init(), {
      type: testProvider.rejected.type,
      meta: { arg: { providerId: 'kie', key: 'k' } },
    })
    expect(s.testStatus.kie).toEqual({ connected: false, message: 'Gagal menguji', testing: false })
  })
})
