import { useEffect, useState } from 'react'
import {
  XIcon, KeyIcon, CpuIcon, HardDriveIcon, SlidersHorizontalIcon, InfoIcon,
  EyeIcon, EyeSlashIcon, CheckCircleIcon, XCircleIcon,
} from '@phosphor-icons/react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { closeOverlay } from '../../store/slices/uiSlice'
import {
  fetchSettings, saveSettings, testProvider, patchSettings,
} from '../../store/slices/settingsSlice'
import Spinner from '../../components/primitives/Spinner'
import { toastSuccess, toastError, errText } from '../../lib/toast'

type Tab = 'apikeys' | 'model' | 'storage' | 'general' | 'about'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'apikeys', label: 'API Keys', icon: KeyIcon },
  { id: 'model', label: 'Model', icon: CpuIcon },
  { id: 'storage', label: 'Penyimpanan', icon: HardDriveIcon },
  { id: 'general', label: 'Umum', icon: SlidersHorizontalIcon },
  { id: 'about', label: 'Tentang', icon: InfoIcon },
]

function FieldRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, padding: '16px 0', borderBottom: '1px solid var(--color-border-soft)' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
        {description && <div style={{ fontSize: 12, color: 'var(--color-muted)', marginTop: 3, lineHeight: 1.5 }}>{description}</div>}
      </div>
      <div style={{ flexShrink: 0, minWidth: 240 }}>{children}</div>
    </div>
  )
}

/** One API-key field with show/hide toggle + "Uji" button bound to TestProviderKey. */
function ApiKeyField({
  providerId, value, onChange,
}: { providerId: string; value: string; onChange: (v: string) => void }) {
  const dispatch = useAppDispatch()
  const [show, setShow] = useState(false)
  const status = useAppSelector(s => s.settings.testStatus[providerId])

  async function handleTest() {
    if (!value.trim()) { toastError('Isi key terlebih dahulu'); return }
    try {
      const res = await dispatch(testProvider({ providerId, key: value })).unwrap()
      if (res.status.connected) toastSuccess(`${providerId.toUpperCase()}: ${res.status.message}`)
      else toastError(`${providerId.toUpperCase()}: ${res.status.message}`)
    } catch (e) {
      toastError(errText(e, 'Gagal menguji key'))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            className="field"
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="••••••••••"
            style={{ width: '100%', padding: '9px 36px 9px 12px', borderRadius: 10, fontSize: 13 }}
          />
          <button
            onClick={() => setShow(s => !s)}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
          >
            {show ? <EyeSlashIcon size={15} color="var(--color-muted)" /> : <EyeIcon size={15} color="var(--color-muted)" />}
          </button>
        </div>
        <button
          onClick={handleTest}
          disabled={status?.testing}
          className="btn-ghost"
          style={{ padding: '0 14px', borderRadius: 10, fontSize: 12.5, minWidth: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {status?.testing ? <Spinner size={13} /> : 'Uji'}
        </button>
      </div>
      {status && !status.testing && status.message && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: status.connected ? 'var(--color-good)' : 'var(--color-bad)' }}>
          {status.connected ? <CheckCircleIcon size={13} weight="fill" /> : <XCircleIcon size={13} weight="fill" />}
          {status.message}
        </div>
      )}
    </div>
  )
}

function ApiKeysTab() {
  const dispatch = useAppDispatch()
  const data = useAppSelector(s => s.settings.data)
  if (!data) return null
  const set = (patch: any) => dispatch(patchSettings(patch))
  return (
    <div>
      <FieldRow label="KIE.ai API KeyIcon" description="Utama — analisis klip & caption via Gemini di Kie.ai.">
        <ApiKeyField providerId="kie" value={data.kie_api_key} onChange={v => set({ kie_api_key: v })} />
      </FieldRow>
      <FieldRow label="Gemini API KeyIcon" description="Opsional — Google AI Studio langsung (cadangan).">
        <ApiKeyField providerId="gemini" value={data.gemini_api_key} onChange={v => set({ gemini_api_key: v })} />
      </FieldRow>
      <FieldRow label="OpenAI API KeyIcon" description="Opsional — penggunaan mendatang.">
        <ApiKeyField providerId="openai" value={data.openai_api_key} onChange={v => set({ openai_api_key: v })} />
      </FieldRow>
    </div>
  )
}

function ModelTab() {
  const dispatch = useAppDispatch()
  const data = useAppSelector(s => s.settings.data)
  if (!data) return null
  const set = (patch: any) => dispatch(patchSettings(patch))
  return (
    <div>
      <FieldRow label="Model Gemini" description="Model LLM untuk analisis klip.">
        <input className="field" value={data.gemini_model} onChange={e => set({ gemini_model: e.target.value })}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13 }} />
      </FieldRow>
      <FieldRow label="Engine transkrip" description="Sumber transkrip video.">
        <select className="field" value={data.transcript_engine} onChange={e => set({ transcript_engine: e.target.value })}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13, color: 'var(--color-text)' }}>
          <option value="youtube">YouTube Transcript</option>
          <option value="whisper">Whisper (lokal)</option>
        </select>
      </FieldRow>
      <FieldRow label="Auto-reframe" description="Otomatis crop 9:16 mengikuti wajah.">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={data.auto_reframe} onChange={e => set({ auto_reframe: e.target.checked })} />
          <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Aktifkan</span>
        </label>
      </FieldRow>
    </div>
  )
}

function StorageTab() {
  const dispatch = useAppDispatch()
  const data = useAppSelector(s => s.settings.data)
  if (!data) return null
  const set = (patch: any) => dispatch(patchSettings(patch))
  return (
    <div>
      <FieldRow label="Direktori output" description="Klip yang sudah di-render disimpan di sini.">
        <input className="field" value={data.output_dir} onChange={e => set({ output_dir: e.target.value })}
          placeholder="~/AutoClipper Output" style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 12, fontFamily: 'var(--font-mono)' }} />
      </FieldRow>
      <FieldRow label="Batas penyimpanan (GB)" description="Untuk bar progress penyimpanan.">
        <input className="field" type="number" value={data.storage_limit_gb} onChange={e => set({ storage_limit_gb: Number(e.target.value) })}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13 }} />
      </FieldRow>
      <FieldRow label="Hapus source otomatis" description="Hapus video sumber setelah klip diekspor.">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={data.delete_source_after} onChange={e => set({ delete_source_after: e.target.checked })} />
          <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Aktifkan</span>
        </label>
      </FieldRow>
    </div>
  )
}

function GeneralTab() {
  const dispatch = useAppDispatch()
  const data = useAppSelector(s => s.settings.data)
  if (!data) return null
  const set = (patch: any) => dispatch(patchSettings(patch))
  return (
    <div>
      <FieldRow label="Bahasa antarmuka" description="Bahasa tampilan aplikasi.">
        <select className="field" value={data.ui_language} onChange={e => set({ ui_language: e.target.value })}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13, color: 'var(--color-text)' }}>
          <option value="id">Indonesia</option>
          <option value="en">English</option>
        </select>
      </FieldRow>
      <FieldRow label="Bahasa transkrip" description="Bahasa untuk transkripsi & analisis.">
        <select className="field" value={data.transcript_language} onChange={e => set({ transcript_language: e.target.value })}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13, color: 'var(--color-text)' }}>
          <option value="id">Indonesia</option>
          <option value="en">English</option>
        </select>
      </FieldRow>
      <FieldRow label="Rasio default" description="Rasio aspek default untuk klip baru.">
        <select className="field" value={data.default_ratio} onChange={e => set({ default_ratio: e.target.value })}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13, color: 'var(--color-text)' }}>
          <option value="9:16">9:16 (Vertikal)</option>
          <option value="1:1">1:1 (Persegi)</option>
          <option value="4:5">4:5 (Portrait)</option>
        </select>
      </FieldRow>
      <FieldRow label="Jumlah klip maks" description="Maksimum rekomendasi klip per video.">
        <input className="field" type="number" value={data.max_clips} onChange={e => set({ max_clips: Number(e.target.value) })}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 10, fontSize: 13 }} />
      </FieldRow>
      <FieldRow label="Buka saat startup" description="Jalankan aplikasi saat komputer menyala.">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <input type="checkbox" checked={data.open_on_startup} onChange={e => set({ open_on_startup: e.target.checked })} />
          <span style={{ fontSize: 13, color: 'var(--color-muted)' }}>Aktifkan</span>
        </label>
      </FieldRow>
    </div>
  )
}

function AboutTab() {
  const version = useAppSelector(s => s.app.version)
  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: 'linear-gradient(160deg,var(--color-accent-hi),var(--color-accent-lo))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px -8px var(--color-accent-glow)' }}>
          <span style={{ fontSize: 24, color: '#fff', fontWeight: 800 }}>AC</span>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>Auto Clipper</div>
          <div style={{ fontSize: 12.5, color: 'var(--color-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>v{version || '1.0.0'}</div>
        </div>
      </div>
      {[['Platform', 'macOS (Apple Silicon)'], ['Engine', 'Wails v2 + Go + React'], ['Worker', 'Python FastAPI + ffmpeg + yt-dlp'], ['Model', 'YOLOv8 + faster-whisper']].map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border-soft)', fontSize: 13 }}>
          <span style={{ color: 'var(--color-muted)' }}>{k}</span>
          <span style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

const TAB_CONTENT: Record<Tab, React.ElementType> = {
  apikeys: ApiKeysTab,
  model: ModelTab,
  storage: StorageTab,
  general: GeneralTab,
  about: AboutTab,
}

export default function SettingsModal() {
  const dispatch = useAppDispatch()
  const [activeTab, setActiveTab] = useState<Tab>('apikeys')
  const { data, loading, saving } = useAppSelector(s => s.settings)
  const Content = TAB_CONTENT[activeTab]

  useEffect(() => { dispatch(fetchSettings()) }, [])

  async function handleSave() {
    if (!data) return
    try {
      await dispatch(saveSettings(data)).unwrap()
      toastSuccess('Pengaturan disimpan')
      dispatch(closeOverlay())
    } catch (e) {
      toastError(errText(e, 'Gagal menyimpan pengaturan'))
    }
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 50,
      background: 'rgba(8,6,13,0.82)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-ui)',
    }}
    onClick={() => dispatch(closeOverlay())}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 700, height: 560, display: 'flex',
          background: 'var(--color-panel-strong)', borderRadius: 22,
          border: '1px solid var(--color-border)', boxShadow: '0 30px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden', animation: 'acfadein 0.18s ease-out',
        }}
      >
        {/* Left nav */}
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--color-border-soft)', padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--color-faint)', padding: '0 8px', marginBottom: 10 }}>
            Pengaturan
          </div>
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 11,
                  border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  background: active ? 'var(--color-accent-soft)' : 'transparent',
                  fontFamily: 'var(--font-ui)',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <Icon size={16} color={active ? 'var(--color-accent-hi)' : 'var(--color-muted)'} weight={active ? 'fill' : 'regular'} />
                <span style={{ fontSize: 13.5, fontWeight: active ? 700 : 500, color: active ? 'var(--color-text)' : 'var(--color-muted)' }}>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ height: 52, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 24px', borderBottom: '1px solid var(--color-border-soft)' }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
              {TABS.find(t => t.id === activeTab)?.label}
            </span>
            <button onClick={() => dispatch(closeOverlay())} className="icon-btn">
              <XIcon size={18} color="var(--color-muted)" />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 24px' }}>
            {loading || !data
              ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spinner size={20} color="var(--color-accent-hi)" /></div>
              : <Content />}
          </div>

          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '12px 24px', borderTop: '1px solid var(--color-border-soft)' }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving || !data} style={{ padding: '10px 22px', borderRadius: 11, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              {saving && <Spinner size={14} />} Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
