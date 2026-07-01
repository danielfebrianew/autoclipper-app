import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved } from '../test/utils'
import ExportOverlay from './ExportOverlay'

const uiBase = {
  screen: 'workspace', overlay: 'export', previewClipId: null, previewTab: 'edit',
  exportClipIds: null, deleteClipIds: null, deleteProjectId: null,
  activeProjectId: 'proj-1', playTarget: null, overlayProjectId: null,
}

const clip = (id: string, over: any = {}) => ({
  id, clip_index: 0, hook: `Hook ${id}`, duration_seconds: 30, status: 'ready', ...over,
})

function state(ids: string[], list: any[], generateProgress: any = {}) {
  return {
    ui: { ...uiBase, exportClipIds: ids },
    clip: { list, selected: [], loading: false, generateProgress },
  } as any
}

describe('ExportOverlay', () => {
  it('lists the target clips and the count in the header', () => {
    renderWithStore(<ExportOverlay />, { preloadedState: state(['a', 'b'], [clip('a'), clip('b')]) })
    expect(screen.getByText(/Ekspor 2 klip/)).toBeInTheDocument()
    expect(screen.getByText('Hook a')).toBeInTheDocument()
    expect(screen.getByText('Hook b')).toBeInTheDocument()
  })

  it('shows per-clip progress when generating', () => {
    renderWithStore(<ExportOverlay />, {
      preloadedState: state(['a'], [clip('a')], { a: { step: 'reframe', percent: 50, message: '' } }),
    })
    expect(screen.getByText(/Reframe 9:16 50%/)).toBeInTheDocument()
  })

  it('starts the export on "Mulai ekspor"', async () => {
    mockResolved('GenerateClips', undefined)
    const user = userEvent.setup()
    renderWithStore(<ExportOverlay />, { preloadedState: state(['a'], [clip('a')]) })
    await user.click(screen.getByRole('button', { name: /mulai ekspor/i }))
    await waitFor(() => expect(calls.GenerateClips.length).toBeGreaterThan(0))
    expect(calls.GenerateClips[0]).toEqual(['proj-1', ['a']])
  })

  it('closes the overlay on cancel', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<ExportOverlay />, { preloadedState: state(['a'], [clip('a')]) })
    await user.click(screen.getByRole('button', { name: /batal/i }))
    expect(store.getState().ui.overlay).toBeNull()
  })
})
