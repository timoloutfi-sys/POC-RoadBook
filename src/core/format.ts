export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const uid = () => Math.random().toString(36).slice(2, 9)
export const pad2 = (n: number) => String(n).padStart(2, '0')

export const nf1 = (x: number) =>
  (+x).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const nf0 = (x: number) => Math.round(+x).toLocaleString('fr-FR')

/** 3725 → "1:02:05" */
export const hms = (s: number) => {
  s = Math.max(0, Math.round(s))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60
  return `${h}:${pad2(m)}:${pad2(x)}`
}
/** 125 → "2:05" */
export const mmss = (s: number) => {
  s = Math.max(0, Math.round(s))
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`
}
/** 5.25 → "5 h 15" */
export const hrs = (h: number) => {
  const m = Math.round(h * 60)
  return `${Math.floor(m / 60)} h ${pad2(m % 60)}`
}
/** Durée lisible : "45 min" ou "5 h 15". */
export const fdur = (sec: number) => (sec >= 3600 ? hrs(sec / 3600) : `${Math.round(sec / 60)} min`)
export const hhmm = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
