import { useRef, useState } from 'react'
import { UploadSimpleIcon, TrashIcon, ImageIcon } from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import {
  updateLayout, updateClick,
  setOverlayCover, removeOverlayCover,
  type ImageFit,
} from '../../store/slices/overlaySlice'
import { toastError, errText } from '../../lib/toast'
import ImageLibrary from './ImageLibrary'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--color-faint)' }}>{title}</div>
      {children}
    </div>
  )
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 9, padding: 3 }}>
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            flex: 1, padding: '6px 4px', borderRadius: 7, border: 'none', cursor: 'pointer',
            fontSize: 12, fontFamily: 'var(--font-ui)',
            background: value === v ? 'var(--color-accent)' : 'transparent',
            color: value === v ? '#fff' : 'var(--color-muted)',
            fontWeight: value === v ? 600 : 500,
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export default function Sidebar() {
  const dispatch = useAppDispatch()
  const current = useAppSelector(s => s.overlay.current)!
  const saveStatus = useAppSelector(s => s.overlay.saveStatus)
  const coverInput = useRef<HTMLInputElement>(null)
  const [coverBusy, setCoverBusy] = useState(false)

  const { layout, click_sound: click, cover } = current

  async function handleCover(file: File) {
    setCoverBusy(true)
    try {
      const reader = new FileReader()
      const dataUri = await new Promise<string>((res, rej) => {
        reader.onload = () => res(reader.result as string)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      await dispatch(setOverlayCover({ projectId: current.id, srcOrBase64: dataUri })).unwrap()
    } catch (e) {
      toastError(errText(e, 'Gagal mengunggah cover'))
    } finally {
      setCoverBusy(false)
    }
  }

  const saveLabel = saveStatus === 'saving' ? 'Menyimpan…'
    : saveStatus === 'saved' ? 'Tersimpan'
    : saveStatus === 'dirty' ? 'Perubahan belum disimpan'
    : saveStatus === 'error' ? 'Gagal menyimpan' : ''

  return (
    <div style={{
      width: 280, flexShrink: 0, borderLeft: '1px solid var(--color-border-soft)',
      display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: 16, gap: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current.name}
        </div>
      </div>
      {saveLabel && (
        <div style={{ fontSize: 11, marginTop: -10, color: saveStatus === 'error' ? 'var(--color-bad)' : 'var(--color-faint)' }}>
          {saveLabel}
        </div>
      )}

      <Section title="Aspect ratio">
        <Seg
          value={layout.aspect_ratio}
          options={[['9:16', '9:16'], ['1:1', '1:1'], ['16:9', '16:9']]}
          onChange={v => dispatch(updateLayout({ aspect_ratio: v }))}
        />
      </Section>

      <Section title={`Tinggi area overlay — ${Math.round(layout.image_area_ratio * 100)}%`}>
        <input
          type="range" min={5} max={90} value={Math.round(layout.image_area_ratio * 100)}
          onChange={e => dispatch(updateLayout({ image_area_ratio: Number(e.target.value) / 100 }))}
          style={{ width: '100%', accentColor: 'var(--color-accent)' }}
        />
      </Section>

      <Section title="Penyesuaian gambar (fit)">
        <Seg<ImageFit>
          value={layout.image_fit}
          options={[['cover', 'Cover'], ['contain', 'Contain']]}
          onChange={v => dispatch(updateLayout({ image_fit: v }))}
        />
      </Section>

      <Section title="Warna latar (contain)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="color" value={layout.background_color}
            onChange={e => dispatch(updateLayout({ background_color: e.target.value }))}
            style={{ width: 36, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-muted)' }}>{layout.background_color}</span>
        </div>
      </Section>

      <Section title="Click sound">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text)', cursor: 'pointer' }}>
          <input type="checkbox" checked={click.enabled} onChange={e => dispatch(updateClick({ enabled: e.target.checked }))} style={{ accentColor: 'var(--color-accent)' }} />
          Aktifkan click saat overlay muncul
        </label>
        {click.enabled && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, color: 'var(--color-faint)', marginBottom: 4 }}>Volume — {Math.round(click.volume * 100)}%</div>
            <input
              type="range" min={0} max={200} value={Math.round(click.volume * 100)}
              onChange={e => dispatch(updateClick({ volume: Number(e.target.value) / 100 }))}
              style={{ width: '100%', accentColor: 'var(--color-accent)' }}
            />
          </div>
        )}
      </Section>

      <Section title="Cover 0.5s (thumbnail Shorts)">
        <input ref={coverInput} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void handleCover(f); e.target.value = '' }} />
        {cover ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <img src={'/media' + cover.path} alt="cover" style={{ width: '100%', height: 90, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--color-border)', background: 'rgba(255,255,255,0.03)' }} />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => coverInput.current?.click()} disabled={coverBusy} className="btn-ghost" style={{ flex: 1, fontSize: 12, padding: '6px 8px', borderRadius: 8, gap: 5 }}>
                <UploadSimpleIcon size={13} /> Ganti
              </button>
              <button onClick={() => dispatch(removeOverlayCover(current.id))} className="btn-ghost" style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, gap: 5, color: 'var(--color-muted)' }}>
                <TrashIcon size={13} />
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => coverInput.current?.click()} disabled={coverBusy} className="btn-ghost" style={{ fontSize: 12, padding: '12px', borderRadius: 8, gap: 6, justifyContent: 'center', border: '1px dashed var(--color-border)' }}>
            <ImageIcon size={15} /> {coverBusy ? 'Mengunggah…' : 'Unggah cover'}
          </button>
        )}
      </Section>

      <Section title="Library gambar">
        <ImageLibrary />
      </Section>
    </div>
  )
}
