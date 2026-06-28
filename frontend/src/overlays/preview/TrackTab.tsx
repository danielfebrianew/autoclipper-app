import { useState } from 'react'
import { ArrowsClockwiseIcon } from '@phosphor-icons/react'
import { SetClipTrackTemplate, SetClipTrackOpts, RetrackFaces } from '../../../wailsjs/go/main/App'
import { toastError, toastSuccess } from '../../lib/toast'
import { cn } from '../../lib/cn'

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
    <div className="flex flex-col gap-4.5">

      {/* Template grid */}
      <section>
        <Label>Template track</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => handleTemplate(t.id)}
              className={cn(
                'flex flex-col gap-1.5 p-2.5 pb-2 rounded-[10px] cursor-pointer text-left border transition-[background] duration-150',
                template === t.id
                  ? 'bg-[rgba(123,97,255,0.18)] border-accent-lo'
                  : 'bg-white/4 border-transparent',
              )}
            >
              <pre className={cn('m-0 text-[8px] leading-[1.3] font-mono', template === t.id ? 'text-accent-hi' : 'text-faint')}>
                {t.diagram}
              </pre>
              <div>
                <div className="text-[11.5px] font-bold text-text">{t.label}</div>
                <div className="text-[10px] text-faint">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Options */}
      <section>
        <Label>Opsi</Label>
        <div className="flex flex-col gap-2.5">
          <ToggleRow label="Smooth gerakan" value={smooth} onChange={v => handleOpts({ smooth: v })} />
          <ToggleRow label="Lock pembicara utama" value={lockMain} onChange={v => handleOpts({ lockMain: v })} />
        </div>
      </section>

      {/* Sensitivity */}
      <section>
        <div className="flex justify-between mb-2">
          <Label>Sensitivitas</Label>
          <span className="text-[11px] font-mono text-accent-hi">{sensitivity}</span>
        </div>
        <input
          type="range" min={0} max={100} value={sensitivity}
          onChange={e => handleOpts({ sensitivity: Number(e.target.value) })}
          className="w-full"
          style={{ accentColor: 'var(--color-accent-hi)' }}
        />
        <div className="flex justify-between text-[10px] text-faint mt-1">
          <span>Lambat</span><span>Cepat</span>
        </div>
      </section>

      {/* Re-track button */}
      <button
        onClick={handleRetrack}
        disabled={retracking}
        className="btn-primary w-full py-2.5 rounded-[10px] text-[13px] gap-1.75"
      >
        <ArrowsClockwiseIcon
          size={14}
          className={retracking ? 'animate-[spin_0.8s_linear_infinite]' : undefined}
        />
        {retracking ? 'Memproses track…' : 'Re-track Wajah'}
      </button>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold tracking-[0.5px] uppercase text-faint">
      {children}
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12.5px] text-muted">{label}</span>
      <button onClick={() => onChange(!value)} className={cn('toggle shrink-0', value && 'on')} />
    </div>
  )
}
