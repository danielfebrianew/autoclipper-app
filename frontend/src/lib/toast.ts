import toast from 'react-hot-toast'

// Shared style matching the D·Thread dark-purple glass theme.
const base = {
  borderRadius: '12px',
  background: 'rgba(20,16,32,0.92)',
  color: 'rgba(255,255,255,0.93)',
  border: '1px solid var(--color-border)',
  fontSize: '13px',
  fontFamily: 'var(--font-ui)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
  maxWidth: '420px',
}

export function toastError(message: string) {
  toast.error(message, {
    style: base,
    iconTheme: { primary: 'var(--color-bad)', secondary: '#fff' },
    duration: 5000,
  })
}

export function toastSuccess(message: string) {
  toast.success(message, {
    style: base,
    iconTheme: { primary: 'var(--color-good)', secondary: '#fff' },
    duration: 3500,
  })
}

export function toastInfo(message: string) {
  toast(message, { style: base, duration: 3500 })
}

/** Normalize a thrown binding error (Wails returns the Go error string) into text. */
export function errText(e: unknown, fallback = 'Terjadi kesalahan'): string {
  if (e == null) return fallback
  if (typeof e === 'string') return e
  if (e instanceof Error) return e.message || fallback
  const m = (e as any)?.message
  return typeof m === 'string' && m ? m : fallback
}
