import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, calls, mockResolved } from '../test/utils'
import DeleteConfirm from './DeleteConfirm'

const uiBase = {
  screen: 'workspace', overlay: 'delete', previewClipId: null, previewTab: 'edit',
  exportClipIds: null, deleteClipIds: null, deleteProjectId: null,
  activeProjectId: 'proj-1', playTarget: null, overlayProjectId: null,
}

const clip = (id: string, over: any = {}) => ({
  id, clip_index: 0, hook: `Hook ${id}`, duration_seconds: 30, ...over,
})

function clipState(ids: string[], list: any[]) {
  return {
    ui: { ...uiBase, deleteClipIds: ids },
    clip: { list, selected: [], loading: false, generateProgress: {} },
    project: { list: [], current: null, loading: false, error: null, downloadProgress: {} },
  } as any
}

function projectState(projectId: string, projects: any[]) {
  return {
    ui: { ...uiBase, deleteProjectId: projectId },
    clip: { list: [], selected: [], loading: false, generateProgress: {} },
    project: { list: projects, current: null, loading: false, error: null, downloadProgress: {} },
  } as any
}

describe('DeleteConfirm', () => {
  it('shows single-clip copy with hook and duration', () => {
    renderWithStore(<DeleteConfirm />, { preloadedState: clipState(['c1'], [clip('c1')]) })
    expect(screen.getByText(/Hapus 1 klip\?/)).toBeInTheDocument()
    expect(screen.getByText(/Hook c1/)).toBeInTheDocument()
  })

  it('shows the multi-clip breakdown', () => {
    const list = [clip('a'), clip('b'), clip('c')]
    renderWithStore(<DeleteConfirm />, { preloadedState: clipState(['a', 'b', 'c'], list) })
    expect(screen.getByText(/Hapus 3 klip\?/)).toBeInTheDocument()
  })

  it('deletes clips and closes on confirm', async () => {
    mockResolved('RemoveClip', undefined)
    mockResolved('GetClips', [])
    const user = userEvent.setup()
    const { store } = renderWithStore(<DeleteConfirm />, { preloadedState: clipState(['c1'], [clip('c1')]) })
    await user.click(screen.getByRole('button', { name: /hapus/i }))
    await waitFor(() => expect(store.getState().ui.overlay).toBeNull())
    expect(calls.RemoveClip).toContainEqual(['c1'])
  })

  it('shows project-mode copy and deletes the project on confirm', async () => {
    mockResolved('DeleteProject', undefined)
    const user = userEvent.setup()
    const { store } = renderWithStore(<DeleteConfirm />, {
      preloadedState: projectState('proj-9', [{ id: 'proj-9', name: 'My Project' }]),
    })
    expect(screen.getByText(/Hapus proyek\?/)).toBeInTheDocument()
    expect(screen.getByText(/My Project/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /hapus/i }))
    await waitFor(() => expect(calls.DeleteProject).toContainEqual(['proj-9']))
  })

  it('closes without deleting on cancel', async () => {
    const user = userEvent.setup()
    const { store } = renderWithStore(<DeleteConfirm />, { preloadedState: clipState(['c1'], [clip('c1')]) })
    await user.click(screen.getByRole('button', { name: /batal/i }))
    expect(store.getState().ui.overlay).toBeNull()
    expect(calls.RemoveClip).toHaveLength(0)
  })
})
