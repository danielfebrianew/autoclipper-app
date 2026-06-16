import { useEffect, useState } from 'react'
import { GetClipThumbnails } from '../../wailsjs/go/main/App'
import { Clip } from '../store/slices/clipSlice'

/**
 * Ambil 1 frame asli dari video pada rentang klip dan kembalikan URL `/media…`
 * untuk dipakai sebagai latar kartu. Mengembalikan null saat belum/gagal load
 * (pemanggil jatuh ke placeholder gradient).
 */
export function useClipThumb(clip: Clip): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    GetClipThumbnails(clip.id, 1)
      .then(paths => {
        if (cancelled) return
        const p = paths?.[0]
        if (p) setUrl(`/media${p}`)
      })
      .catch(() => { /* abaikan — fallback gradient */ })
    return () => { cancelled = true }
  }, [clip.id, clip.start_seconds, clip.end_seconds])

  return url
}
