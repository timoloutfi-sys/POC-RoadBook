import { useEffect, useRef, useState, type ReactNode } from 'react'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

const fmt = (v: number | null) => (v == null ? '' : String(v))
const parse = (t: string) => { const n = parseFloat(t.replace(',', '.')); return t.trim() === '' || !Number.isFinite(n) ? null : n }

/**
 * Champ numérique : garde ce que tu tapes tel quel (pas de zéro qui s'ajoute devant),
 * ne remonte qu'un nombre valide, et reformate en quittant le champ.
 * `step` règle les flèches haut et bas.
 */
export function Num({ value, onChange, min, max, step, placeholder }: {
  value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; placeholder?: string
}) {
  const [txt, setTxt] = useState(fmt(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current && parse(txt) !== value) setTxt(fmt(value)) }, [value, txt])
  return (
    <input type="number" inputMode="decimal" value={txt} min={min} max={max} step={step ?? 'any'} placeholder={placeholder}
      onFocus={e => { focused.current = true; e.target.select() }}
      onBlur={() => { focused.current = false; setTxt(fmt(value)) }}
      onChange={e => { setTxt(e.target.value); onChange(parse(e.target.value)) }} />
  )
}
