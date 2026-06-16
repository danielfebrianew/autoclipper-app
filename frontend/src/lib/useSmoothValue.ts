import { useEffect, useRef, useState } from 'react'

/**
 * Smoothly interpolates a displayed number toward a target value using
 * requestAnimationFrame, so progress bars glide instead of jumping when
 * backend events arrive in coarse steps.
 *
 * @param target  the latest target value (e.g. download percent 0-100)
 * @param speed   fraction of the remaining distance to cover per frame (0..1)
 */
export function useSmoothValue(target: number, speed = 0.12): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const current = displayRef.current
      const diff = target - current
      // Snap when close enough to avoid endless tiny frames.
      if (Math.abs(diff) < 0.1) {
        displayRef.current = target
        setDisplay(target)
        rafRef.current = null
        return
      }
      const next = current + diff * speed
      displayRef.current = next
      setDisplay(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [target, speed])

  return display
}
