import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn', () => {
  it('joins plain string args with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c')
  })

  it('drops falsy values (false, null, undefined, 0, empty string)', () => {
    expect(cn('a', false, null, undefined, 0, '', 'b')).toBe('a b')
  })

  it('includes only truthy branches of a conditional object', () => {
    expect(cn('base', { active: true, disabled: false })).toBe('base active')
  })

  it('flattens nested arrays', () => {
    expect(cn(['a', ['b', 'c']], 'd')).toBe('a b c d')
  })

  it('returns an empty string when given nothing truthy', () => {
    expect(cn(false, null, undefined)).toBe('')
  })
})
