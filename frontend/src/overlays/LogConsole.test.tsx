import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent } from '../test/utils'
import LogConsole from './LogConsole'
import type { LogLine } from '../store/slices/logSlice'

const line = (over: Partial<LogLine> = {}): LogLine => ({
  t: '2026-01-01T12:34:56', tool: 'ffmpeg', level: 'info', m: 'encoding frame', ...over,
})

function state(lines: LogLine[], streaming = false) {
  return { log: { lines, streaming, clipId: null } } as any
}

describe('LogConsole', () => {
  it('shows the empty state when there are no lines', () => {
    renderWithStore(<LogConsole />, { preloadedState: state([]) })
    expect(screen.getByText(/belum ada log/i)).toBeInTheDocument()
  })

  it('renders log lines with tool, level and message', () => {
    renderWithStore(<LogConsole />, { preloadedState: state([line({ tool: 'whisper', level: 'warn', m: 'slow segment' })]) })
    expect(screen.getByText('whisper')).toBeInTheDocument()
    expect(screen.getByText('WARN')).toBeInTheDocument()
    expect(screen.getByText('slow segment')).toBeInTheDocument()
  })

  it('shows the live indicator while streaming', () => {
    renderWithStore(<LogConsole />, { preloadedState: state([line()], true) })
    expect(screen.getByText(/live/i)).toBeInTheDocument()
  })

  it('clears the log via the clear button', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<LogConsole />, { preloadedState: state([line(), line()]) })
    await user.click(screen.getByTitle(/clear log/i))
    expect(store.getState().log.lines).toEqual([])
  })

  it('closes the overlay on the X button', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<LogConsole />, {
      preloadedState: {
        log: { lines: [line()], streaming: false, clipId: null },
        ui: {
          screen: 'workspace', overlay: 'log', previewClipId: null, previewTab: 'edit',
          exportClipIds: null, deleteClipIds: null, deleteProjectId: null,
          activeProjectId: null, playTarget: null, overlayProjectId: null,
        },
      } as any,
    })
    // The clear button has a title; the close (X) is the other icon button without one.
    const buttons = screen.getAllByRole('button')
    await user.click(buttons[buttons.length - 1])
    expect(store.getState().ui.overlay).toBeNull()
  })
})
