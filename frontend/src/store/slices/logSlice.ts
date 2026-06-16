import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface LogLine {
  t: string
  tool: string
  level: 'info' | 'ok' | 'warn' | 'err'
  m: string
}

interface LogState {
  lines: LogLine[]
  streaming: boolean
  clipId: string | null
}

const initialState: LogState = {
  lines: [],
  streaming: false,
  clipId: null,
}

const logSlice = createSlice({
  name: 'log',
  initialState,
  reducers: {
    appendLog(state, action: PayloadAction<LogLine>) {
      state.lines.push(action.payload)
      if (state.lines.length > 500) state.lines.shift()
    },
    setStreaming(state, action: PayloadAction<boolean>) {
      state.streaming = action.payload
    },
    setLogClip(state, action: PayloadAction<string | null>) {
      state.clipId = action.payload
    },
    clearLog(state) {
      state.lines = []
      state.streaming = false
      state.clipId = null
    },
  },
})

export const { appendLog, setStreaming, setLogClip, clearLog } = logSlice.actions
export default logSlice.reducer
