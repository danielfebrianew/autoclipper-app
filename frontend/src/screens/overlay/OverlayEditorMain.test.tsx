import { describe, it, expect } from 'vitest'
import { renderWithStore, screen, mockResolved } from '../../test/utils'
import OverlayEditorMain from './OverlayEditorMain'

function state(over: any = {}) {
  return {
    ui: {
      screen: 'overlay-editor', overlay: null, previewClipId: null, previewTab: 'edit',
      exportClipIds: null, deleteClipIds: null, deleteProjectId: null,
      activeProjectId: null, playTarget: null, overlayProjectId: null,
    },
    overlay: {
      projects: [], current: null, images: [], loading: false,
      saveStatus: 'idle', render: { status: 'idle', percent: 0, message: '', outputPath: '' },
    },
    ...over,
  } as any
}

describe('OverlayEditorMain', () => {
  it('shows the project list when no project is selected', () => {
    mockResolved('ListOverlayProjects', [])
    renderWithStore(<OverlayEditorMain />, { preloadedState: state() })
    // OverlayProjectList header.
    expect(screen.getByText('Overlay Editor')).toBeInTheDocument()
  })
})
