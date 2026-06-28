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
import { cn } from '../../lib/cn'

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
    <div className="flex items-start gap-5 py-4 border-b border-border-soft">
      <div className="flex-1">
        <div className="text-[13.5px] font-semibold text-text">{label}</div>
        {description && <div className="text-[12px] text-muted mt-0.75 leading-normal">{description}</div>}
      </div>
      <div className="shrink-0 min-w-60">{children}</div>
    </div>
  )
}

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
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <input
            className="field w-full py-2.25 pl-3 pr-9 rounded-[10px] text-[13px]"
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="••••••••••"
          />
          <button
            onClick={() => setShow(s => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-none border-none cursor-pointer flex"
          >
            {show ? <EyeSlashIcon size={15} color="var(--color-muted)" /> : <EyeIcon size={15} color="var(--color-muted)" />}
          </button>
        </div>
        <button
          onClick={handleTest}
          disabled={status?.testing}
          className="btn-ghost px-3.5 rounded-[10px] text-[12.5px] min-w-14 flex items-center justify-center"
        >
          {status?.testing ? <Spinner size={13} /> : 'Uji'}
        </button>
      </div>
      {status && !status.testing && status.message && (
        <div className={cn('flex items-center gap-1.25 text-[11.5px]', status.connected ? 'text-good' : 'text-bad')}>
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
      <FieldRow label="KIE.ai API Key" description="Utama — analisis klip & caption via Gemini di Kie.ai.">
        <ApiKeyField providerId="kie" value={data.kie_api_key} onChange={v => set({ kie_api_key: v })} />
      </FieldRow>
      <FieldRow label="Gemini API Key" description="Opsional — Google AI Studio langsung (cadangan).">
        <ApiKeyField providerId="gemini" value={data.gemini_api_key} onChange={v => set({ gemini_api_key: v })} />
      </FieldRow>
      <FieldRow label="OpenAI API Key" description="Opsional — penggunaan mendatang.">
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
        <input className="field w-full py-2.25 px-3 rounded-[10px] text-[13px]"
          value={data.gemini_model} onChange={e => set({ gemini_model: e.target.value })} />
      </FieldRow>
      <FieldRow label="Engine transkrip" description="Sumber transkrip video.">
        <select className="field w-full py-2.25 px-3 rounded-[10px] text-[13px] text-text"
          value={data.transcript_engine} onChange={e => set({ transcript_engine: e.target.value })}>
          <option value="youtube">YouTube Transcript</option>
          <option value="whisper">Whisper (lokal)</option>
        </select>
      </FieldRow>
      <FieldRow label="Auto-reframe" description="Otomatis crop 9:16 mengikuti wajah.">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={data.auto_reframe} onChange={e => set({ auto_reframe: e.target.checked })} />
          <span className="text-[13px] text-muted">Aktifkan</span>
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
        <input className="field w-full py-2.25 px-3 rounded-[10px] text-[12px] font-mono"
          value={data.output_dir} onChange={e => set({ output_dir: e.target.value })}
          placeholder="~/AutoClipper Output" />
      </FieldRow>
      <FieldRow label="Batas penyimpanan (GB)" description="Untuk bar progress penyimpanan.">
        <input className="field w-full py-2.25 px-3 rounded-[10px] text-[13px]"
          type="number" value={data.storage_limit_gb} onChange={e => set({ storage_limit_gb: Number(e.target.value) })} />
      </FieldRow>
      <FieldRow label="Hapus source otomatis" description="Hapus video sumber setelah klip diekspor.">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={data.delete_source_after} onChange={e => set({ delete_source_after: e.target.checked })} />
          <span className="text-[13px] text-muted">Aktifkan</span>
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
        <select className="field w-full py-2.25 px-3 rounded-[10px] text-[13px] text-text"
          value={data.ui_language} onChange={e => set({ ui_language: e.target.value })}>
          <option value="id">Indonesia</option>
          <option value="en">English</option>
        </select>
      </FieldRow>
      <FieldRow label="Bahasa transkrip" description="Bahasa untuk transkripsi & analisis.">
        <select className="field w-full py-2.25 px-3 rounded-[10px] text-[13px] text-text"
          value={data.transcript_language} onChange={e => set({ transcript_language: e.target.value })}>
          <option value="id">Indonesia</option>
          <option value="en">English</option>
        </select>
      </FieldRow>
      <FieldRow label="Rasio default" description="Rasio aspek default untuk klip baru.">
        <select className="field w-full py-2.25 px-3 rounded-[10px] text-[13px] text-text"
          value={data.default_ratio} onChange={e => set({ default_ratio: e.target.value })}>
          <option value="9:16">9:16 (Vertikal)</option>
          <option value="1:1">1:1 (Persegi)</option>
          <option value="4:5">4:5 (Portrait)</option>
        </select>
      </FieldRow>
      <FieldRow label="Jumlah klip maks" description="Maksimum rekomendasi klip per video.">
        <input className="field w-full py-2.25 px-3 rounded-[10px] text-[13px]"
          type="number" value={data.max_clips} onChange={e => set({ max_clips: Number(e.target.value) })} />
      </FieldRow>
      <FieldRow label="Buka saat startup" description="Jalankan aplikasi saat komputer menyala.">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={data.open_on_startup} onChange={e => set({ open_on_startup: e.target.checked })} />
          <span className="text-[13px] text-muted">Aktifkan</span>
        </label>
      </FieldRow>
    </div>
  )
}

function AboutTab() {
  const version = useAppSelector(s => s.app.version)
  return (
    <div className="py-5">
      <div className="flex items-center gap-3.5 mb-7">
        <div className="w-13 h-13 rounded-2xl bg-[linear-gradient(160deg,var(--color-accent-hi),var(--color-accent-lo))] flex items-center justify-center shadow-[0_10px_30px_-8px_var(--color-accent-glow)]">
          <span className="text-[24px] text-white font-extrabold">AC</span>
        </div>
        <div>
          <div className="text-[18px] font-extrabold text-text">Auto Clipper</div>
          <div className="text-[12.5px] text-muted mt-0.5 font-mono">v{version || '1.0.0'}</div>
        </div>
      </div>
      {[['Platform', 'macOS (Apple Silicon)'], ['Engine', 'Wails v2 + Go + React'], ['Worker', 'Python FastAPI + ffmpeg + yt-dlp'], ['Model', 'YOLOv8 + faster-whisper']].map(([k, v]) => (
        <div key={k} className="flex justify-between py-2.5 border-b border-border-soft text-[13px]">
          <span className="text-muted">{k}</span>
          <span className="text-text font-mono text-[12px]">{v}</span>
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
    <div
      className="absolute inset-0 z-50 bg-[rgba(8,6,13,0.82)] backdrop-blur-lg flex items-center justify-center font-ui"
      onClick={() => dispatch(closeOverlay())}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-175 h-140 flex bg-panel-strong rounded-[22px] border border-border shadow-[0_30px_80px_rgba(0,0,0,0.7)] overflow-hidden animate-[acfadein_0.18s_ease-out]"
      >
        {/* Left nav */}
        <div className="w-50 shrink-0 border-r border-border-soft px-2.5 py-5 flex flex-col gap-0.75">
          <div className="text-[11.5px] font-bold tracking-[0.6px] uppercase text-faint px-2 mb-2.5">
            Pengaturan
          </div>
          {TABS.map(t => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-[11px] border-none cursor-pointer text-left w-full font-ui group',
                  active ? 'bg-accent-soft' : 'bg-transparent hover:bg-white/4',
                )}
              >
                <Icon size={16} color={active ? 'var(--color-accent-hi)' : 'var(--color-muted)'} weight={active ? 'fill' : 'regular'} />
                <span className={cn('text-[13.5px]', active ? 'font-bold text-text' : 'font-medium text-muted')}>{t.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-13 shrink-0 flex items-center px-6 border-b border-border-soft">
            <span className="flex-1 text-[14px] font-bold text-text">
              {TABS.find(t => t.id === activeTab)?.label}
            </span>
            <button onClick={() => dispatch(closeOverlay())} className="icon-btn">
              <XIcon size={18} color="var(--color-muted)" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pt-1 pb-6">
            {loading || !data
              ? <div className="flex items-center justify-center h-full"><Spinner size={20} color="var(--color-accent-hi)" /></div>
              : <Content />}
          </div>

          <div className="shrink-0 flex justify-end px-6 py-3 border-t border-border-soft">
            <button
              className="btn-primary flex items-center gap-2 px-5.5 py-2.5 rounded-[11px] text-[14px]"
              onClick={handleSave}
              disabled={saving || !data}
            >
              {saving && <Spinner size={14} />} Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
