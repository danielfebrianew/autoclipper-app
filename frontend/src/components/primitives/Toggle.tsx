import { useState } from 'react'

interface ToggleProps { on?: boolean; onToggle?: (v: boolean) => void }

export default function Toggle({ on: init = false, onToggle }: ToggleProps) {
  const [on, setOn] = useState(init)
  const toggle = () => { const next = !on; setOn(next); onToggle?.(next) }
  return (
    <button
      onClick={toggle}
      style={{
        width: 42, height: 24, borderRadius: 12,
        border: 'none', cursor: 'pointer', padding: 2,
        background: on
          ? 'linear-gradient(160deg,var(--color-accent-hi),var(--color-accent-lo))'
          : 'rgba(255,255,255,0.1)',
        transition: 'background 0.2s',
        display: 'flex',
        justifyContent: on ? 'flex-end' : 'flex-start',
        flexShrink: 0,
      }}
    >
      <span style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.4)' }} />
    </button>
  )
}
