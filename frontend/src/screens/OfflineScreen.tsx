import { WifiNoneIcon, ArrowCounterClockwiseIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { useAppDispatch } from '../store/hooks'
import { setScreen } from '../store/slices/uiSlice'
import Glow from '../components/primitives/Glow'

export default function OfflineScreen() {
  const dispatch = useAppDispatch()

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <Glow x="30%" y="20%" size={400} color="rgba(255,140,60,0.10)" />
      <Glow x="70%" y="60%" size={360} color="rgba(80,60,170,0.12)" />

      <div style={{ width: 400, maxWidth: '100%', position: 'relative', zIndex: 2, fontFamily: 'var(--font-ui)', textAlign: 'center' }}>
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'rgba(255,140,60,0.15)',
            border: '1px solid rgba(255,140,60,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <WifiNoneIcon size={26} color="var(--color-warn)" weight="bold" />
          </div>
        </div>

        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, color: 'var(--color-text)', marginBottom: 10 }}>
          Tidak ada koneksi internet
        </div>
        <div style={{ fontSize: 14, color: 'var(--color-muted)', lineHeight: 1.6, marginBottom: 32 }}>
          Auto Clipper tidak bisa menghubungi server aktivasi.<br />
          Pastikan kamu terhubung ke internet, lalu coba lagi.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <button
            onClick={() => dispatch(setScreen('activation'))}
            className="btn-primary"
            style={{ padding: '13px 0', borderRadius: 14, fontSize: 14, fontWeight: 700, width: '100%' }}
          >
            <ArrowCounterClockwiseIcon size={16} weight="bold" /> Coba lagi
          </button>
          <button
            onClick={() => dispatch(setScreen('workspace'))}
            className="btn-ghost"
            style={{ padding: '13px 0', borderRadius: 14, fontSize: 14, width: '100%' }}
          >
            Lanjutkan offline <ArrowRightIcon size={15} />
          </button>
        </div>

        <div style={{ marginTop: 22, fontSize: 12, color: 'var(--color-faint)', lineHeight: 1.55 }}>
          Jika sudah pernah diaktifkan sebelumnya,<br />kamu bisa tetap menggunakan aplikasi secara offline.
        </div>
      </div>
    </div>
  )
}
