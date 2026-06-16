import { useState } from 'react'
import { ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { SetClipTrackTemplate, SetClipTrackOpts, RetrackFaces } from '../../../wailsjs/go/main/App'
import { toastError, toastSuccess } from '../../lib/toast'

const TEMPLATES = [
  {
    id: 'single', label: 'Single', desc: 'Satu speaker, tengah',
    diagram: '┌──────┐\n│  ██  │\n└──────┘',
  },
  {
    id: 'single_top', label: 'Single Atas', desc: 'Satu speaker, atas',
    diagram: '┌──────┐\n│ ██   │\n│      │\n└──────┘',
  },
  {
    id: 'dual', label: 'Dual', desc: 'Dua speaker berdampingan',
    diagram: '┌──────┐\n│ █  █ │\n└──────┘',
  },
  {
    id: 'dual_side', label: 'Dual Sisi', desc: 'Dua speaker bertumpuk',
    diagram: '┌──────┐\n│ ████ │\n│ ████ │\n└──────┘',
  },
  {
    id: 'speaker', label: 'Speaker', desc: 'Ikuti pembicara aktif',
    diagram: '┌──────┐\n│ →██← │\n└──────┘',
  },
  {
    id: 'static', label: 'Static', desc: 'Crop tetap, tidak bergerak',
    diagram: '┌──────┐\n│[████]│\n└──────┘',
  },
]

interface Props {
  clipId: string
  template: string
  smooth: boolean
  lockMain: boolean
  sensitivity: number
  onTemplateChange: (t: string) => void
  onOptsChange: (opts: { smooth: boolean; lockMain: boolean; sensitivity: number }) => void
  onRetrack: () => void
}

export default function TrackTab({
  clipId, template, smooth, lockMain, sensitivity,
  onTemplateChange, onOptsChange, onRetrack,
}: Props) {
  const [retracking, setRetracking] = useState(false)

  function handleTemplate(id: string) {
    onTemplateChange(id)
    SetClipTrackTemplate(clipId, id).catch(() => {})
  }

  function handleOpts(patch: Partial<{ smooth: boolean; lockMain: boolean; sensitivity: number }>) {
    const next = { smooth, lockMain, sensitivity, ...patch }
    onOptsChange(next)
    SetClipTrackOpts(clipId, { smooth: next.smooth, lock_main: next.lockMain, sensitivity: next.sensitivity }).catch(() => {})
  }

  async function handleRetrack() {
    setRetracking(true)
    try {
      await RetrackFaces(clipId)
      onRetrack()
      toastSuccess('Face tracking selesai')
    } catch (e: any) {
      toastError(e?.message || 'Gagal re-track wajah')
    } finally {
      setRetracking(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Template grid */}
      <section>
        <Label>Template track</Label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => handleTemplate(t.id)}
              style={{
                display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 10px 8px',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                background: template === t.id ? 'rgba(123,97,255,0.18)' : 'rgba(255,255,255,0.04)',
                border: template === t.id ? '1px solid var(--color-accent-lo)' : '1px solid transparent',
                transition: 'background 0.15s',
              }}
            >
              <pre style={{ margin: 0, fontSize: 8, lineHeight: 1.3, color: template === t.id ? 'var(--color-accent-hi)' : 'var(--color-faint)', fontFamily: 'var(--font-mono)' }}>
                {t.diagram}
              </pre>
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-text)' }}>{t.label}</div>
                <div style={{ fontSize: 10, color: 'var(--color-faint)' }}>{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Options */}
      <section>
        <Label>Opsi</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow label="Smooth gerakan" value={smooth} onChange={v => handleOpts({ smooth: v })} />
          <ToggleRow label="Lock pembicara utama" value={lockMain} onChange={v => handleOpts({ lockMain: v })} />
        </div>
      </section>

      {/* Sensitivity */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <Label>Sensitivitas</Label>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--color-accent-hi)' }}>{sensitivity}</span>
        </div>
        <input
          type="range" min={0} max={100} value={sensitivity}
          onChange={e => handleOpts({ sensitivity: Number(e.target.value) })}
          style={{ width: '100%', accentColor: 'var(--color-accent-hi)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-faint)', marginTop: 4 }}>
          <span>Lambat</span><span>Cepat</span>
        </div>
      </section>

      {/* Re-track button */}
      <button
        onClick={handleRetrack}
        disabled={retracking}
        className="btn-primary"
        style={{ width: '100%', padding: '10px 0', borderRadius: 10, fontSize: 13, gap: 7 }}
      >
        <ArrowsClockwiseIcon size={14} style={{ animation: retracking ? 'spin 0.8s linear infinite' : 'none' }} />
        {retracking ? 'Memproses track…' : 'Re-track Wajah'}
      </button>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--color-faint)', marginBottom: 0 }}>{children}</div>
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{label}</span>
      <button onClick={() => onChange(!value)} className={`toggle ${value ? 'on' : ''}`} style={{ flexShrink: 0 }} />
    </div>
  )
}
