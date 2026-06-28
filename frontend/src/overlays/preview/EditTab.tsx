import { Clip } from '../../store/slices/clipSlice'
import { SetClipAspectRatio } from '../../../wailsjs/go/main/App'
import { cn } from '../../lib/cn'

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
    <div className="flex flex-col gap-4.5">

      {/* Trim info */}
      <section>
        <Label>Durasi terpilih</Label>
        <div className="flex gap-2">
          <InfoBox label="IN" value={fmt(inPoint)} />
          <InfoBox label="OUT" value={fmt(outPoint)} />
          <InfoBox label="Dur" value={fmt(dur)} accent />
        </div>
      </section>

      {/* Aspect ratio */}
      <section>
        <Label>Rasio output</Label>
        <div className="flex gap-1.5">
          {RATIOS.map(r => (
            <button
              key={r}
              onClick={() => handleRatio(r)}
              className={cn('chip flex-1 py-2 text-[12.5px] justify-center rounded-[10px]', ratio === r && 'active')}
            >
              {r}
            </button>
          ))}
        </div>
      </section>

      {/* Preview toggles */}
      <section>
        <Label>Preview overlay</Label>
        <div className="flex flex-col gap-2">
          <ToggleRow label="Tampilkan face-track" value={showCrop} onChange={onShowCropChange} />
          <ToggleRow label="Tampilkan caption" value={showCaption} onChange={onShowCaptionChange} />
        </div>
      </section>

      <div className="h-px bg-border-soft" />

      {/* Clip info */}
      <section>
        <Label>Hook</Label>
        <p className="text-[13px] text-text leading-[1.55] m-0">{clip.hook}</p>
      </section>
      <section>
        <Label>Ringkasan</Label>
        <p className="text-[12.5px] text-muted leading-[1.6] m-0">{clip.summary}</p>
      </section>
      <section>
        <div className="flex gap-2">
          {([['Viral', clip.viral_score], ['Konten', clip.content_score], ['Engage', clip.engagement_score]] as [string, number][]).map(([l, v]) => (
            <div key={l} className="flex-1 bg-white/4 rounded-[10px] px-2.5 pt-2.5 pb-2 text-center">
              <div className="text-[16px] font-extrabold text-accent-hi font-mono">{v}</div>
              <div className="text-[10px] text-faint mt-0.75">{l}</div>
            </div>
          ))}
        </div>
      </section>
      {clip.transcript_excerpt && (
        <section>
          <Label>Transkrip</Label>
          <p className="font-mono text-[11px] text-muted leading-[1.7] m-0 whitespace-pre-wrap">{clip.transcript_excerpt}</p>
        </section>
      )}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10.5px] font-bold tracking-[0.5px] uppercase text-faint mb-2">
      {children}
    </div>
  )
}

function InfoBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex-1 bg-white/4 rounded-lg px-2 pt-2 pb-1.5 text-center">
      <div className={cn('text-[13px] font-bold font-mono', accent ? 'text-accent-hi' : 'text-text')}>{value}</div>
      <div className="text-[10px] text-faint mt-0.5">{label}</div>
    </div>
  )
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12.5px] text-muted">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={cn('toggle shrink-0', value && 'on')}
      />
    </div>
  )
}
