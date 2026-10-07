import { clamp, hrs, uid } from '../core/format'
import { BLOCK, blockLimit, computePlan, type BlockZone, type PlanInput } from './plan'
import type { BaseRules, Section } from './types'
import { zoneBandPct } from './zones'

/** Ce que le coureur cherche à faire : la suggestion s'adapte, l'algorithme ne devine rien. */
export type Intent = 'course' | 'endurance' | 'tempo' | 'seuil' | 'vo2max' | 'progressive'

export const INTENTS: { id: Intent; n: string; d: string }[] = [
  { id: 'course', n: 'Course ou ultra', d: 'Le plus vite possible, à un rythme tenable' },
  { id: 'endurance', n: 'Endurance', d: 'Zone 2, du début à la fin' },
  { id: 'tempo', n: 'Tempo', d: 'Blocs en zone 3 sur les montées' },
  { id: 'seuil', n: 'Seuil', d: 'Blocs en zone 4 sur les montées' },
  { id: 'vo2max', n: 'VO2max', d: 'Efforts courts en zone 5' },
  { id: 'progressive', n: 'Progressive', d: 'Z2, puis Z3, puis Z4' },
]

export interface Suggestion {
  /** Cibles de base (plat, montée, descente), en % de FTP. */
  manual: BaseRules
  /** Cibles par tronçon, modifiables comme celles que le coureur pose lui-même. */
  imposed: Section[]
  /** Une phrase qui résume ce qui a été proposé. */
  note: string
}

const ENDURANCE: BaseRules = { plat: [65, 72], montee: [65, 75], descente: [0, 60], gUp: 3.5, gDown: -3 }
const round5 = (v: number) => Math.round(v / 5) * 5
const blockZoneOf = (i: Intent, unit: 'power' | 'hr'): BlockZone | null => (i === 'tempo' ? 2 : i === 'seuil' ? 3 : i === 'vo2max' ? (unit === 'hr' ? 3 : 4) : null)

/** Minutes d'efforts proposées pour une sortie de H heures, dans les limites de ce qui se tient. */
export function suggestedMinutes(intent: Intent, H: number, unit: 'power' | 'hr' = 'power') {
  const z = blockZoneOf(intent, unit)
  if (z == null) return 0
  const raw = intent === 'tempo' ? clamp(round5(H * 60 * 0.2), 20, 120) : intent === 'seuil' || unit === 'hr' ? clamp(round5(H * 60 * 0.18), 15, 60) : clamp(Math.round((H * 60 * 0.04) / 2) * 2, 4, 20)
  return Math.min(raw, blockLimit(z, H))
}

const toImposed = (s: Section): Section => ({ ...s, id: uid(), locked: true, gen: false, auto: false, mark: false })

/** Propose des cibles à partir du parcours et de l'intention. Rien n'est appliqué : c'est au coureur de valider et de retoucher. */
export function suggestPlan(inp: PlanInput, intent: Intent, minutes?: number): Suggestion {
  const { unit } = inp
  const run = (over: Partial<PlanInput['cfg']>) => computePlan({ ...inp, cfg: { ...inp.cfg, imposed: [], minutes: {}, intensity: null, ...over } })

  if (intent === 'course') {
    const r = run({ mode: 'course' })
    const climbs = r.sections.filter(s => s.kind === 'montee' && !s.locked)
    const cmin = climbs.length ? Math.round(climbs.reduce((a, s) => a + s.min, 0) / climbs.length) : r.base.plat[1]
    const cmax = climbs.length ? Math.max(...climbs.map(s => s.max)) : r.base.plat[1] + 8
    const manual: BaseRules = { plat: r.base.plat, montee: [Math.min(cmin, cmax - 2), cmax], descente: [0, 60], gUp: 3.5, gDown: -3 }
    const nights = r.sections.filter(s => s.name.startsWith('Nuit') && !s.locked).map(toImposed)
    return { manual, imposed: nights, note: `Rythme tenable sur ${hrs(r.H)} : cible de base, un maximum plus haut en montée${nights.length ? ', plus baissé la nuit' : ''}.` }
  }
  if (intent === 'endurance') return { manual: ENDURANCE, imposed: [], note: 'Zone 2 partout, un peu plus haut en montée.' }

  if (intent === 'progressive') {
    const L = inp.route.total / 1000, third = Math.round((L / 3) * 10) / 10
    const parts = [[0, third, 1], [third, third * 2, 2], [third * 2, L, 3]] as const
    const imposed = parts.map(([a, b, z]) => { const [lo, hi] = zoneBandPct(z, unit); return { id: uid(), kind: 'zone' as const, name: `Progressive ${z} sur 3 (Z${z + 1})`, a: +a.toFixed(1), b: +b.toFixed(1), min: lo, max: hi, msg: '', avant: 0.5, locked: true } })
    return { manual: ENDURANCE, imposed, note: 'Trois tiers : Z2, puis Z3, puis Z4.' }
  }

  const z = blockZoneOf(intent, unit)!
  const base = run({ mode: 'entrainement' }), mins = Math.min(minutes ?? suggestedMinutes(intent, base.H, unit), blockLimit(z, base.H))
  const r = run({ mode: 'entrainement', minutes: { 2: 0, 3: 0, 4: 0, [z]: mins } })
  const imposed = r.sections.filter(s => new RegExp(`^${BLOCK[z].name} \\d`).test(s.name)).map(toImposed)
  const fell = intent === 'vo2max' && unit === 'hr'
  return { manual: ENDURANCE, imposed, note: `${imposed.length} bloc${imposed.length > 1 ? 's' : ''} de ${BLOCK[z].name.toLowerCase()} placés sur les montées${fell ? ' (pas de VO2max en cardio : seuil à la place)' : ''}, endurance entre les blocs.` }
}
