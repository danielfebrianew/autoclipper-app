import { describe, it, expect } from 'vitest'
import reducer, { setLicenseValid, setSetupComplete, initApp } from './appSlice'

const init = () => reducer(undefined, { type: '@@INIT' })

describe('appSlice', () => {
  it('starts loading with everything false', () => {
    const s = init()
    expect(s.loading).toBe(true)
    expect(s.licenseValid).toBe(false)
    expect(s.setupComplete).toBe(false)
  })

  it('setLicenseValid / setSetupComplete update flags', () => {
    expect(reducer(init(), setLicenseValid(true)).licenseValid).toBe(true)
    expect(reducer(init(), setSetupComplete(true)).setupComplete).toBe(true)
  })

  it('initApp.fulfilled hydrates state and stops loading', () => {
    const s = reducer(init(), {
      type: initApp.fulfilled.type,
      payload: { licenseValid: true, setupComplete: true, version: '1.2.3' },
    })
    expect(s.licenseValid).toBe(true)
    expect(s.setupComplete).toBe(true)
    expect(s.version).toBe('1.2.3')
    expect(s.loading).toBe(false)
  })

  it('initApp.rejected stops loading', () => {
    const s = reducer(init(), { type: initApp.rejected.type, error: { message: 'boom' } })
    expect(s.loading).toBe(false)
  })
})
