import { WifiNoneIcon, ArrowCounterClockwiseIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { useAppDispatch } from '../store/hooks'
import { setScreen } from '../store/slices/uiSlice'
import Glow from '../components/primitives/Glow'

export default function OfflineScreen() {
  const dispatch = useAppDispatch()

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-10">
      <Glow x="30%" y="20%" size={400} color="rgba(255,140,60,0.10)" />
      <Glow x="70%" y="60%" size={360} color="rgba(80,60,170,0.12)" />

      <div className="w-100 max-w-full relative z-2 font-ui text-center">
        {/* Icon */}
        <div className="flex justify-center mb-5.5">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(255,140,60,0.15)] border border-[rgba(255,140,60,0.35)] flex items-center justify-center">
            <WifiNoneIcon size={26} color="var(--color-warn)" weight="bold" />
          </div>
        </div>

        <div className="text-[22px] font-extrabold tracking-[-0.4px] text-text mb-2.5">
          Tidak ada koneksi internet
        </div>
        <div className="text-[14px] text-muted leading-[1.6] mb-8">
          Auto Clipper tidak bisa menghubungi server aktivasi.<br />
          Pastikan kamu terhubung ke internet, lalu coba lagi.
        </div>

        <div className="flex flex-col gap-2.75">
          <button
            onClick={() => dispatch(setScreen('activation'))}
            className="btn-primary w-full py-3.25 rounded-[14px] text-[14px] font-bold"
          >
            <ArrowCounterClockwiseIcon size={16} weight="bold" /> Coba lagi
          </button>
          <button
            onClick={() => dispatch(setScreen('workspace'))}
            className="btn-ghost w-full py-3.25 rounded-[14px] text-[14px]"
          >
            Lanjutkan offline <ArrowRightIcon size={15} />
          </button>
        </div>

        <div className="mt-5.5 text-[12px] text-faint leading-[1.55]">
          Jika sudah pernah diaktifkan sebelumnya,<br />kamu bisa tetap menggunakan aplikasi secara offline.
        </div>
      </div>
    </div>
  )
}
