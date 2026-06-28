import { LightningIcon, ImageIcon, GearSixIcon, SparkleIcon, HardDrivesIcon, FilmReelIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setScreen, openOverlay, openOverlayEditor } from '../store/slices/uiSlice'
import { cn } from '../lib/cn'

type Tab = 'workspace' | 'library' | 'gallery' | 'overlay-editor'

export default function Toolbar() {
  const dispatch = useAppDispatch()
  const screen = useAppSelector(s => s.ui.screen)

  const active: Tab = (screen === 'workspace' || screen === 'library' || screen === 'gallery' || screen === 'overlay-editor')
    ? screen
    : 'workspace'

  return (
    <div className="h-13.5 shrink-0 flex items-center gap-3.5 px-4.5 border-b border-border-soft relative z-20 font-ui">
      {/* Logo */}
      <div className="flex items-center gap-2.25">
        <span className="w-6 h-6 rounded-[7px] bg-[linear-gradient(160deg,var(--color-accent-hi),var(--color-accent-lo))] flex items-center justify-center shadow-[0_4px_12px_-3px_var(--color-accent-glow)] shrink-0">
          <SparkleIcon size={13} color="#fff" weight="fill" />
        </span>
        <span className="text-[14px] font-extrabold text-text tracking-[-0.2px] whitespace-nowrap">
          Auto Clipper
        </span>
        <span className="font-mono text-[9px] font-semibold text-accent-hi bg-accent-soft border border-accent-line px-1.5 py-0.5 rounded-[5px]">
          PRO
        </span>
      </div>

      {/* Nav chips — centered absolutely so it's always in the middle of the bar */}
      <div className="glass absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-0.75 p-1 rounded-xl">
        {([
          ['workspace', 'Workspace', LightningIcon],
          ['library',   'Library',   HardDrivesIcon],
          ['gallery',   'Gallery',   ImageIcon],
          ['overlay-editor', 'Editor', FilmReelIcon],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => id === 'overlay-editor' ? dispatch(openOverlayEditor(null)) : dispatch(setScreen(id))}
            className={cn('chip', active === id && 'active')}
            style={{ padding: '7px 13px', fontSize: 13, borderRadius: 999 }}
          >
            <Icon size={15} weight={active === id ? 'fill' : 'regular'} />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Gear */}
      <button className="icon-btn" onClick={() => dispatch(openOverlay('settings'))}>
        <GearSixIcon size={17} color="var(--color-muted)" />
      </button>

      {/* User */}
      <div className="glass flex items-center gap-2 pl-3 pr-1 py-1 rounded-full">
        <span className="text-[11.5px] font-semibold text-muted">user</span>
        <span className="w-6.5 h-6.5 rounded-full bg-[linear-gradient(160deg,#9d86ff,#6b4eff)] flex items-center justify-center text-[11px] font-bold text-white">U</span>
      </div>
    </div>
  )
}
