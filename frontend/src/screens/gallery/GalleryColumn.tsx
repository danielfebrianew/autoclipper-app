import { useEffect } from 'react'
import { ImageIcon, HardDrivesIcon, VideoCameraIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchGallery, setActiveVid, GalleryItem } from '../../store/slices/gallerySlice'

function groupByProject(items: GalleryItem[]): Map<string, { title: string; items: GalleryItem[] }> {
  const map = new Map<string, { title: string; items: GalleryItem[] }>()
  for (const item of items) {
    if (!map.has(item.project_id)) {
      map.set(item.project_id, { title: item.source_title, items: [] })
    }
    map.get(item.project_id)!.items.push(item)
  }
  return map
}

export function GalleryColumn() {
  const dispatch = useAppDispatch()
  const { items, activeVid, loading } = useAppSelector(s => s.gallery)

  useEffect(() => { dispatch(fetchGallery()) }, [])

  const groups = groupByProject(items)
  const totalDur = items.reduce((a, c) => a + c.duration_seconds, 0)
  const durMin = Math.round(totalDur / 60)

  return (
    <div style={{
      width: 264, flexShrink: 0, borderRight: '1px solid var(--color-border-soft)',
      display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-ui)',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--color-border-soft)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <ImageIcon size={14} color="var(--color-faint)" />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.7, textTransform: 'uppercase', color: 'var(--color-faint)' }}>
            Galeri
          </span>
        </div>

        {/* Storage mini-bar */}
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: '11px 13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <HardDrivesIcon size={13} color="var(--color-muted)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-muted)', flex: 1 }}>Penyimpanan</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-faint)' }}>{durMin} mnt</span>
          </div>
          <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '32%', background: 'linear-gradient(90deg,var(--color-accent-lo),var(--color-accent-hi))', borderRadius: 3 }} />
          </div>
          <div style={{ marginTop: 5, fontSize: 10, color: 'var(--color-ghost)', fontFamily: 'var(--font-mono)' }}>
            {items.length} klip tersimpan
          </div>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
        {/* All */}
        <button
          onClick={() => dispatch(setActiveVid('all'))}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 10px', borderRadius: 11, border: 'none', cursor: 'pointer', marginBottom: 4,
            background: activeVid === 'all' ? 'var(--color-accent-soft)' : 'transparent',
            textAlign: 'left',
          }}
          onMouseEnter={e => { if (activeVid !== 'all') e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
          onMouseLeave={e => { if (activeVid !== 'all') e.currentTarget.style.background = 'transparent' }}
        >
          <VideoCameraIcon size={15} color={activeVid === 'all' ? 'var(--color-accent-hi)' : 'var(--color-muted)'} weight="fill" />
          <span style={{ fontSize: 13, fontWeight: 600, color: activeVid === 'all' ? 'var(--color-text)' : 'var(--color-muted)', flex: 1 }}>Semua klip</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--color-faint)' }}>{items.length}</span>
        </button>

        {/* Per project */}
        {loading && <div style={{ fontSize: 12.5, color: 'var(--color-faint)', paddingLeft: 8 }}>Memuat…</div>}
        {Array.from(groups.entries()).map(([pid, g]) => (
          <button
            key={pid}
            onClick={() => dispatch(setActiveVid(pid))}
            style={{
              display: 'flex', flexDirection: 'column', gap: 3, width: '100%',
              padding: '10px 10px', borderRadius: 11, border: 'none', cursor: 'pointer', marginBottom: 3,
              background: activeVid === pid ? 'var(--color-accent-soft)' : 'transparent',
              textAlign: 'left',
            }}
            onMouseEnter={e => { if (activeVid !== pid) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
            onMouseLeave={e => { if (activeVid !== pid) e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: activeVid === pid ? 'var(--color-text)' : 'var(--color-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {g.title || pid.slice(0, 8)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--color-faint)', flexShrink: 0 }}>{g.items.length}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
