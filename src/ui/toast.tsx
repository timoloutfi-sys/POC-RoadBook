import { useEffect, useState } from 'react'

let push: (m: string) => void = () => {}
/** Message bref en bas de l'écran. */
export const toast = (m: string) => push(m)

export function Toaster() {
  const [msg, setMsg] = useState('')
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    push = m => { setMsg(m); clearTimeout(t); t = setTimeout(() => setMsg(''), 2800) }
    return () => { clearTimeout(t); push = () => {} }
  }, [])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}
