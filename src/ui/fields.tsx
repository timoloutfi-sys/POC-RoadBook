import type { ReactNode } from 'react'

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}

/** Champ numérique qui accepte une saisie vide et ne remonte que des nombres valides. */
export function Num({ value, onChange, min, max, step, placeholder }: {
  value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; placeholder?: string
}) {
  return (
    <input type="number" inputMode="decimal" value={value ?? ''} min={min} max={max} step={step} placeholder={placeholder}
      onChange={e => { const v = e.target.value; onChange(v === '' ? null : Number.isFinite(+v) ? +v : null) }} />
  )
}
