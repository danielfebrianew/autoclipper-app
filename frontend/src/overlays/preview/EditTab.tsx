import { Clip } from '../../store/slices/clipSlice'
import { SetClipAspectRatio } from '../../../wailsjs/go/main/App'

const RATIOS = ['9:16', '1:1', '4:5']

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

interface Props {
  clip: Clip
  inPoint: number
  outPoint: number
  ratio: string
  showCrop: boolean
  showCaption: boolean
  onRatioChange: (r: string) => void
  onShowCropChange: (v: boolean) => void
  onShowCaptionChange: (v: boolean) => void
}

export default function EditTab({
  clip, inPoint, outPoint, ratio,
  showCrop, showCaption,
  onRatioChange, onShowCropChange, onShowCaptionChange,
}: Props) {
  const dur = outPoint - inPoint

  async function handleRatio(r: string) {
    onRatioChange(r)
    await SetClipAspectRatio(clip.id, r).catch(() => {})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* Trim info */}
      <section>
        <Label>Durasi terpilih</Label>
        <div style={{ display: 'flex', gap: 8 }}>
          <InfoBox label="IN" value={fmt(inPoint)} />
          <InfoBox label="OUT" value={fmt(outPoint)} />
          <InfoBox label="Dur" value={fmt(dur)} accent />
        </div>
      </section>

      {/* Aspect ratio */}
      <section>
        <Label>Rasio output</Label>
        <div style={{ display: 'flex', gap: 6 }}>
          {RATIOS.map(r => (
            <button
              key={r}
              onClick={() => handleRatio(r)}
              className={`chip ${ratio === r ? 'active' : ''}`}
              style={{ flex: 1, padding: '8px 0', fontSize: 12.5, justifyContent: 'center', borderRadius: 10 }}
            >
              {r}
            </button>
          ))}
        </div>
      </section>

      {/* Preview toggles */}
      <section>
        <Label>Preview overlay</Label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ToggleRow label="Tampilkan face-track" value={showCrop} onChange={onShowCropChange} />
          <ToggleRow label="Tampilkan caption" value={showCaption} onChange={onShowCaptionChange} />
        </div>
      </section>

      <div style={{ height: 1, background: 'var(--color-border-soft)' }} />

      {/* Clip info */}
      <section>
        <Label>Hook</Label>
        <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.55, margin: 0 }}>{clip.hook}</p>
      </section>
      <section>
        <Label>Ringkasan</Label>
        <p style={{ fontSize: 12.5, color: 'var(--color-muted)', lineHeight: 1.6, margin: 0 }}>{clip.summary}</p>
      </section>
      <section>
        <div style={{ display: 'flex', gap: 8 }}>
          {([['Viral', clip.viral_score], ['Konten', clip.content_score], ['Engage', clip.engagement_score]] as [string, number][]).map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-accent-hi)', fontFamily: 'var(--font-mono)' }}>{v}</div>
              <div style={{ fontSize: 10, color: 'var(--color-faint)', marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>
      {clip.transcript_excerpt && (
        <section>
          <Label>Transkrip</Label>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-muted)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{clip.transcript_excerpt}</p>
        </section>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--color-faint)', marginBottom: 8 }}>{children}</div>
}

function InfoBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 8px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', color: accent ? 'var(--color-accent-hi)' : 'var(--color-text)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--color-faint)', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 12.5, color: 'var(--color-muted)' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`toggle ${value ? 'on' : ''}`}
        style={{ flexShrink: 0 }}
      />
    </div>
  )
}
