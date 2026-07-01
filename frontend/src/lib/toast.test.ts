import { describe, it, expect, vi, beforeEach } from 'vitest'
import toast from 'react-hot-toast'
import { toastError, toastSuccess, toastInfo, errText } from './toast'

vi.mock('react-hot-toast', () => {
  const fn = vi.fn() as any
  fn.error = vi.fn()
  fn.success = vi.fn()
  return { default: fn }
})

describe('errText', () => {
  it('returns the fallback for null/undefined', () => {
    expect(errText(null)).toBe('Terjadi kesalahan')
    expect(errText(undefined, 'custom')).toBe('custom')
  })

  it('returns a string error as-is', () => {
    expect(errText('boom')).toBe('boom')
  })

  it('returns Error.message', () => {
    expect(errText(new Error('failed'))).toBe('failed')
  })

  it('falls back when Error has an empty message', () => {
    expect(errText(new Error(''), 'fb')).toBe('fb')
  })

  it('reads .message off a plain object', () => {
    expect(errText({ message: 'obj msg' })).toBe('obj msg')
  })

  it('falls back when object has no usable message', () => {
    expect(errText({ foo: 'bar' }, 'fb')).toBe('fb')
  })
})

describe('toast wrappers', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('toastError calls toast.error with the message', () => {
    toastError('nope')
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect((toast.error as any).mock.calls[0][0]).toBe('nope')
  })

  it('toastSuccess calls toast.success with the message', () => {
    toastSuccess('yay')
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect((toast.success as any).mock.calls[0][0]).toBe('yay')
  })

  it('toastInfo calls the base toast with the message', () => {
    toastInfo('fyi')
    expect(toast).toHaveBeenCalledTimes(1)
    expect((toast as any).mock.calls[0][0]).toBe('fyi')
  })
})
