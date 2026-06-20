import { LightningIcon, ImageIcon, GearSixIcon, SparkleIcon, HardDrivesIcon, FilmReelIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setScreen, openOverlay, openOverlayEditor } from '../store/slices/uiSlice'

type Tab = 'workspace' | 'library' | 'gallery' | 'overlay-editor'

export default function Toolbar() {
  const dispatch = useAppDispatch()
  const screen = useAppSelector(s => s.ui.screen)

  const active: Tab = (screen === 'workspace' || screen === 'library' || screen === 'gallery' || screen === 'overlay-editor')
    ? screen
    : 'workspace'

  return (
    <div style={{
      height: 54, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px',
      borderBottom: '1px solid var(--color-border-soft)',
      position: 'relative', zIndex: 20,
      fontFamily: 'var(--font-ui)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          width: 24, height: 24, borderRadius: 7,
          background: 'linear-gradient(160deg, var(--color-accent-hi), var(--color-accent-lo))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px -3px var(--color-accent-glow)',
          flexShrink: 0,
        }}>
          <SparkleIcon size={13} color="#fff" weight="fill" />
        </span>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', letterSpacing: -0.2, whiteSpace: 'nowrap' }}>
          Auto Clipper
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
          color: 'var(--color-accent-hi)', background: 'var(--color-accent-soft)',
          border: '1px solid var(--color-accent-line)', padding: '2px 6px', borderRadius: 5,
        }}>
          PRO
        </span>
      </div>

      {/* Nav chips — centered absolutely so it's always in the middle of the bar */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex', gap: 3, padding: 4, borderRadius: 12,
      }} className="glass">
        {([
          ['workspace', 'Workspace', LightningIcon],
          ['library',   'Library',   HardDrivesIcon],
          ['gallery',   'Gallery',   ImageIcon],
          ['overlay-editor', 'Editor', FilmReelIcon],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => id === 'overlay-editor' ? dispatch(openOverlayEditor(null)) : dispatch(setScreen(id))}
            className={`chip ${active === id ? 'active' : ''}`}
            style={{ padding: '7px 13px', fontSize: 13, borderRadius: 999 }}
          >
            <Icon size={15} weight={active === id ? 'fill' : 'regular'} />
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Gear */}
      <button className="icon-btn" onClick={() => dispatch(openOverlay('settings'))}>
        <GearSixIcon size={17} color="var(--color-muted)" />
      </button>

      {/* User */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 4px 4px 12px', borderRadius: 999,
      }} className="glass">
        <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-muted)' }}>user</span>
        <span style={{
          width: 26, height: 26, borderRadius: 13,
          background: 'linear-gradient(160deg,#9d86ff,#6b4eff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff',
        }}>U</span>
      </div>
    </div>
  )
}
