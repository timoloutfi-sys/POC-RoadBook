import { useEffect, useRef, useState } from 'react'
import { clamp } from '../core/format'
import type { Route } from '../route/route'
import { Field, Num } from './fields'
import { ProfilePick } from './ProfilePick'

/** Curseur de réglage fin : couvre ±2 km autour de la valeur au moment où on le prend, par pas de 0,1 km. */
function FineSlider({ value, max, label, onChange }: { value: number; max: number; label: string; onChange: (v: number) => void }) {
  const [base, setBase] = useState(value)
  const live = useRef(false)
  const lo = Math.max(0, base - 2), hi = Math.min(max, base + 2)
  const settle = () => { live.current = false; setBase(value) }
  // Tant qu'on ne tient pas le curseur, il se recentre sur la valeur (profil touché, champ modifié).
  useEffect(() => { if (!live.current) setBase(value) }, [value])
  return (
    <input type="range" className="fine" aria-label={label} min={lo} max={hi} step={0.1} value={clamp(value, lo, hi)}
      onPointerDown={() => { live.current = true }} onPointerUp={settle} onPointerCancel={settle} onKeyUp={settle} onBlur={settle}
      onChange={e => onChange(Math.round(+e.target.value * 10) / 10)} />
  )
}

/**
 * Choisir un tronçon (ou un point) sur le profil, puis l'affiner : champs « Du km » / « Au km » et curseur de réglage fin.
 * `onChange(a, b, montée?)` : un appui sur une montée renvoie son nom.
 */
export function KmRange({ route, a, b, point, onChange }: {
  route: Route; a: number; b: number; point?: boolean; onChange: (a: number, b: number, climb?: { name: string }) => void
}) {
  const L = route.total / 1000
  const field = (label: string, v: number, set: (x: number) => void) => (
    <Field label={label}>
      <>
        <Num value={v} min={0} max={L} step={0.1} onChange={x => set(clamp(x ?? 0, 0, L))} />
        <FineSlider value={clamp(v, 0, L)} max={L} label={`${label} : réglage fin`} onChange={set} />
      </>
    </Field>
  )
  return (
    <>
      <ProfilePick route={route} a={a} b={point ? a : b} point={point} onPick={(x, y, c) => onChange(x, point ? x : y, c)} />
      {point
        ? field('Kilomètre', a, x => onChange(x, x))
        : <div className="cols2">{field('Du km', a, x => onChange(x, b))}{field('Au km', b, x => onChange(a, x))}</div>}
    </>
  )
}
