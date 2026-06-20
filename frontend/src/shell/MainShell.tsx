import Glow from '../components/primitives/Glow'
import Toolbar from './Toolbar'
import { useAppSelector } from '../store/hooks'
import { GalleryColumn } from '../screens/gallery/GalleryColumn'
import GalleryMain from '../screens/gallery/GalleryMain'
import ActivityColumn from '../screens/workspace/ActivityColumn'
import EmptyColumn from '../screens/workspace/EmptyColumn'
import WorkspaceMain from '../screens/workspace/WorkspaceMain'
import EmptyState from '../screens/workspace/EmptyState'
import LibraryMain from '../screens/library/LibraryMain'
import OverlayEditorMain from '../screens/overlay/OverlayEditorMain'

export default function MainShell() {
  const screen = useAppSelector(s => s.ui.screen)
  const activeProjectId = useAppSelector(s => s.ui.activeProjectId)
  const hasProject = !!activeProjectId

  const isGallery = screen === 'gallery'
  const isLibrary = screen === 'library'
  const isOverlay = screen === 'overlay-editor'

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <Glow x="20%" y="40%" size={460} color="rgba(123,97,255,0.10)" />
      <Glow x="86%" y="-4%" size={420} color="rgba(80,60,170,0.10)" />

      <Toolbar />

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative', zIndex: 2 }}>
        {isOverlay ? (
          <OverlayEditorMain />
        ) : isLibrary ? (
          <LibraryMain />
        ) : (
          <>
            {/* Left column */}
            {isGallery
              ? <GalleryColumn />
              : hasProject ? <ActivityColumn /> : <EmptyColumn />}

            {/* Main area */}
            {isGallery
              ? <GalleryMain />
              : hasProject ? <WorkspaceMain /> : <EmptyState />}
          </>
        )}
      </div>
    </div>
  )
}
