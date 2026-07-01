import { describe, it, expect } from 'vitest'
import reducer, { appendLog, setStreaming, setLogClip, clearLog, LogLine } from './logSlice'

const init = () => reducer(undefined, { type: '@@INIT' })
const line = (m: string): LogLine => ({ t: '2026-01-01T00:00:00', tool: 'ffmpeg', level: 'info', m })

describe('logSlice', () => {
  it('starts empty and not streaming', () => {
    const s = init()
    expect(s.lines).toEqual([])
    expect(s.streaming).toBe(false)
    expect(s.clipId).toBeNull()
  })

  it('appendLog adds a line', () => {
    const s = reducer(init(), appendLog(line('hello')))
    expect(s.lines).toHaveLength(1)
    expect(s.lines[0].m).toBe('hello')
  })

  it('caps the buffer at 500 lines (drops the oldest)', () => {
    let s = init()
    for (let i = 0; i < 505; i++) s = reducer(s, appendLog(line(`l${i}`)))
    expect(s.lines).toHaveLength(500)
    expect(s.lines[0].m).toBe('l5')          // first 5 dropped
    expect(s.lines[499].m).toBe('l504')
  })

  it('setStreaming toggles the streaming flag', () => {
    expect(reducer(init(), setStreaming(true)).streaming).toBe(true)
  })

  it('setLogClip sets the clip id', () => {
    expect(reducer(init(), setLogClip('clip-1')).clipId).toBe('clip-1')
  })

  it('clearLog resets lines, streaming, and clipId', () => {
    let s = reducer(init(), appendLog(line('x')))
    s = reducer(s, setStreaming(true))
    s = reducer(s, setLogClip('c'))
    s = reducer(s, clearLog())
    expect(s.lines).toEqual([])
    expect(s.streaming).toBe(false)
    expect(s.clipId).toBeNull()
  })
})
