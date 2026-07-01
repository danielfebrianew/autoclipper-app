import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, userEvent, waitFor, mockResolved } from '../../test/utils'
import WorkspaceMain from './WorkspaceMain'

const clip = (over: any = {}) => ({
  id: 'c1', project_id: 'p1', clip_index: 0, hook: 'Clip Hook', category: 'x',
  viral_score: 70, duration_seconds: 30, start_seconds: 0, end_seconds: 30,
  energy_level: 'high', summary: '', ...over,
})

function state(list: any[], selected: string[] = []) {
  return {
    ui: {
      screen: 'workspace', overlay: null, previewClipId: null, previewTab: 'edit',
      exportClipIds: null, deleteClipIds: null, deleteProjectId: null,
      activeProjectId: 'p1', playTarget: null, overlayProjectId: null,
    },
    clip: { list, selected, loading: false, generateProgress: {} },
  } as any
}

describe('WorkspaceMain', () => {
  const render = (list: any[], selected: string[] = []) => {
    mockResolved('GetClips', list)
    return renderWithStore(<WorkspaceMain />, { preloadedState: state(list, selected) })
  }

  it('renders clip cards for the active project', async () => {
    render([clip()])
    expect(await screen.findByText('Clip Hook')).toBeInTheDocument()
  })

  it('shows the empty state when there are no clips', async () => {
    render([])
    expect(await screen.findByText(/belum ada klip untuk proyek ini/i)).toBeInTheDocument()
  })

  it('selects all clips via the toolbar checkbox', async () => {
    const user = userEvent.setup()
    const { store } = render([clip({ id: 'a' }), clip({ id: 'b' })])
    await screen.findAllByText('Clip Hook')
    await user.click(screen.getAllByRole('button')[0])
    await waitFor(() => expect(store.getState().clip.selected).toEqual(['a', 'b']))
  })

  it('opens the export overlay when clips are selected', async () => {
    const user = userEvent.setup()
    const { store } = render([clip()], ['c1'])
    await user.click(await screen.findByRole('button', { name: /ekspor \(1\)/i }))
    expect(store.getState().ui.overlay).toBe('export')
  })

  it('changes the sort order via the menu', async () => {
    const user = userEvent.setup()
    render([clip()])
    await user.click(screen.getByRole('button', { name: /skor viral/i }))
    await user.click(screen.getByRole('button', { name: /durasi/i }))
    expect(screen.getByRole('button', { name: /durasi/i })).toBeInTheDocument()
  })
})
