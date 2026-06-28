import { useState, useEffect } from 'react'

export default function Caret() {
  const [on, setOn] = useState(true)
  useEffect(() => {
    const id = setInterval(() => setOn(o => !o), 530)
    return () => clearInterval(id)
  }, [])
  return <span className={on ? 'opacity-100' : 'opacity-0'}>▋</span>
}
