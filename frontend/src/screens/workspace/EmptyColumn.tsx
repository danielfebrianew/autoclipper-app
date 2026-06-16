import { ClockIcon, FolderSimpleIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchProjects } from '../../store/slices/projectSlice'
import { setActiveProject, setScreen } from '../../store/slices/uiSlice'
import { useEffect } from 'react'

export default function EmptyColumn() {
  const dispatch = useAppDispatch()
  const { list, loading } = useAppSelector(s => s.project)

  useEffect(() => { dispatch(fetchProjects()) }, [])

  function handleSelect(id: string) {
    dispatch(setActiveProject(id))
    dispatch(setScreen('workspace'))
  }

  return (
    <div style={{
      width: 264, flexShrink: 0, borderRight: '1px solid var(--color-border-soft)',
      display: 'flex', flexDirection: 'column', padding: '18px 12px',
      fontFamily: 'var(--font-ui)', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingLeft: 4 }}>
        <ClockIcon size={15} color="var(--color-faint)" />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--color-faint)' }}>
          Proyek
        </span>
      </div>

      {loading && (
        <div style={{ fontSize: 12.5, color: 'var(--color-faint)', paddingLeft: 4 }}>Memuat…</div>
      )}

      {!loading && list.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.5 }}>
          <FolderSimpleIcon size={30} color="var(--color-faint)" />
          <span style={{ fontSize: 12.5, color: 'var(--color-faint)', textAlign: 'center', lineHeight: 1.5 }}>
            Belum ada proyek.<br />Tempel URL YouTube di kanan.
          </span>
        </div>
      )}

      {list.map(p => (
        <button
          key={p.id}
          onClick={() => handleSelect(p.id)}
          style={{
            display: 'flex', flexDirection: 'column', gap: 4, padding: '11px 12px',
            borderRadius: 11, background: 'transparent', border: 'none', cursor: 'pointer',
            textAlign: 'left', width: '100%', marginBottom: 3,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.title || p.video_id}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-faint)', fontFamily: 'var(--font-mono)' }}>
            {p.status}
          </span>
        </button>
      ))}
    </div>
  )
}
