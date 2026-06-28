import { useState } from 'react'
import { cn } from '../../lib/cn'

interface ToggleProps { on?: boolean; onToggle?: (v: boolean) => void }

export default function Toggle({ on: init = false, onToggle }: ToggleProps) {
  const [on, setOn] = useState(init)
  const toggle = () => { const next = !on; setOn(next); onToggle?.(next) }
  return (
    <button
      onClick={toggle}
      className={cn(
        'w-10.5 h-6 rounded-xl border-none cursor-pointer p-0.5 shrink-0 flex transition-[background] duration-200',
        on
          ? 'bg-[linear-gradient(160deg,var(--color-accent-hi),var(--color-accent-lo))] justify-end'
          : 'bg-white/10 justify-start',
      )}
    >
      <span className="w-5 h-5 rounded-[10px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.4)]" />
    </button>
  )
}
