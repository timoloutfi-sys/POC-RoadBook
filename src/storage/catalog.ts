/**
 * Catalogue des widgets : décrit par des données (groupe, tailles autorisées, réglages), pas par le rendu.
 * Les mêmes règles serviront au boîtier du vélo.
 */
export type WidgetKind =
  | 'effort' | 'hr' | 'cad' | 'speed' | 'target' | 'zone' | 'zones' | 'intarget'
  | 'reserve' | 'punch' | 'endurance' | 'drift' | 'carbs' | 'carbgap' | 'fuel'
  | 'lap'
  | 'profile' | 'climb' | 'next' | 'slope'
  | 'gap' | 'arrival' | 'time' | 'dist' | 'clock'
  | 'sunset' | 'sumeffort' | 'sumroute' | 'sumfuel'

export type Group = 'Effort' | 'Réserves' | 'Entraînement' | 'Parcours' | 'Temps et plan' | 'Synthèses' | 'Repères'
export type Size = [w: number, h: number]

export interface WidgetDef {
  k: WidgetKind
  name: string
  group: Group
  /** Une phrase, l'essentiel seulement. */
  desc: string
  sizes: Size[]
  /** Besoin d'un parcours, d'un capteur de puissance ou de cardio : sinon le widget affiche « -- ». */
  needs?: ('route' | 'power' | 'hr')[]
}

const S = (...a: [number, number][]): Size[] => a
const row = (from: number, to: number, h: number): Size[] => Array.from({ length: to - from + 1 }, (_, i) => [from + i, h] as Size)

export const CATALOG: WidgetDef[] = [
  { k: 'effort', name: 'Puissance', group: 'Effort', desc: 'Puissance du moment et sa cible.', sizes: S([1, 1], [2, 1], [1, 2], [2, 2]), needs: ['power'] },
  { k: 'hr', name: 'FC', group: 'Effort', desc: 'Fréquence cardiaque et sa cible.', sizes: S([1, 1], [2, 1], [1, 2], [2, 2]), needs: ['hr'] },
  { k: 'cad', name: 'Cadence', group: 'Effort', desc: 'Tours de pédale par minute.', sizes: S([1, 1], [2, 1]) },
  { k: 'speed', name: 'Vitesse', group: 'Effort', desc: 'Vitesse instantanée ou moyenne.', sizes: S([1, 1], [2, 1]) },
  { k: 'target', name: 'Cible', group: 'Effort', desc: 'Cible du moment, zone et durée restante.', sizes: S([2, 1], [3, 1], [2, 2]) },
  { k: 'zone', name: 'Zone', group: 'Effort', desc: 'Zone en cours et depuis quand.', sizes: S([1, 1], [2, 1]) },
  { k: 'zones', name: 'Temps par zone', group: 'Effort', desc: 'Temps passé dans chaque zone depuis le départ.', sizes: S([2, 1], [1, 2], [2, 2], [3, 1], [3, 2]) },
  { k: 'intarget', name: 'Dans la cible', group: 'Effort', desc: 'Part du temps passée dans la cible.', sizes: S([1, 1], [2, 1], [3, 1]) },
  { k: 'reserve', name: 'Réserve', group: 'Réserves', desc: 'Punch et endurance côte à côte.', sizes: S([2, 1], [1, 2], [2, 2]), needs: ['power'] },
  { k: 'punch', name: 'Punch', group: 'Réserves', desc: 'Ce qui reste pour les efforts au-dessus du seuil.', sizes: S([1, 1], [2, 1]), needs: ['power'] },
  { k: 'endurance', name: 'Endurance', group: 'Réserves', desc: 'Capacité restante après le travail accumulé.', sizes: S([1, 1], [2, 1]) },
  { k: 'drift', name: 'Dérive cardiaque', group: 'Réserves', desc: 'Hausse de la FC à puissance égale.', sizes: S([1, 1], [2, 1]), needs: ['power', 'hr'] },
  { k: 'carbs', name: 'Glucides / h', group: 'Réserves', desc: 'Glucides brûlés par heure, en moyenne.', sizes: S([1, 1], [2, 1], [2, 2]) },
  { k: 'carbgap', name: 'Écart glucides', group: 'Réserves', desc: 'Glucides mangés moins brûlés.', sizes: S([1, 1], [2, 1]) },
  { k: 'fuel', name: 'Rappel', group: 'Réserves', desc: 'Prochain rappel de nutrition ou d’eau.', sizes: S([1, 1], [2, 1]) },
  { k: 'lap', name: 'Tour', group: 'Entraînement', desc: 'Moyennes du tour en cours.', sizes: S([1, 1], [2, 1], [2, 2]) },
  { k: 'profile', name: 'Profil', group: 'Parcours', desc: 'Relief à venir avec tes points et ta position.', sizes: [...S([2, 1]), ...row(3, 6, 1), ...row(3, 6, 2)], needs: ['route'] },
  { k: 'climb', name: 'Montée', group: 'Parcours', desc: 'Montée en cours ou prochaine, par paliers de pente.', sizes: S([2, 1], [4, 1], [2, 2], [4, 2]), needs: ['route'] },
  { k: 'next', name: 'Prochains points', group: 'Parcours', desc: 'Points et notes du road book à venir.', sizes: [...S([2, 1]), ...row(3, 6, 1), ...S([2, 2]), ...row(3, 6, 2)], needs: ['route'] },
  { k: 'slope', name: 'Pente', group: 'Parcours', desc: 'Pente sous les roues.', sizes: S([1, 1]), needs: ['route'] },
  { k: 'gap', name: 'Écart au plan', group: 'Temps et plan', desc: 'Avance ou retard sur l’heure prévue.', sizes: S([1, 1], [2, 1], [2, 2]), needs: ['route'] },
  { k: 'arrival', name: 'Arrivée', group: 'Temps et plan', desc: 'Heure d’arrivée estimée.', sizes: S([1, 1], [2, 1]), needs: ['route'] },
  { k: 'time', name: 'Roulage', group: 'Temps et plan', desc: 'Temps passé en mouvement.', sizes: S([1, 1], [2, 1]) },
  { k: 'dist', name: 'Distance', group: 'Temps et plan', desc: 'Distance parcourue et restante.', sizes: S([1, 1], [2, 1]) },
  { k: 'clock', name: 'Heure', group: 'Temps et plan', desc: 'Heure actuelle.', sizes: S([1, 1], [2, 1]) },
  { k: 'sumeffort', name: 'Synthèse effort', group: 'Synthèses', desc: 'Puissance, FC, zone, cible, réserves en une grille.', sizes: S([2, 1], [3, 1], [2, 2], [3, 2], [4, 2]) },
  { k: 'sumroute', name: 'Synthèse parcours', group: 'Synthèses', desc: 'Distance, arrivée, écart au plan, prochains repères.', sizes: S([2, 1], [3, 1], [2, 2], [3, 2], [4, 2]), needs: ['route'] },
  { k: 'sumfuel', name: 'Synthèse nutrition', group: 'Synthèses', desc: 'Glucides brûlés, écart, prochain rappel.', sizes: S([2, 1], [3, 1], [2, 2], [3, 2]) },
  { k: 'sunset', name: 'Coucher du soleil', group: 'Repères', desc: 'Coucher du soleil, ou lever la nuit.', sizes: S([1, 1], [2, 1]), needs: ['route'] },
]

export const GROUPS: Group[] = ['Effort', 'Réserves', 'Entraînement', 'Parcours', 'Temps et plan', 'Synthèses', 'Repères']
export const WIDGETS = Object.fromEntries(CATALOG.map(d => [d.k, d.name])) as Record<WidgetKind, string>
export const defOf = (k: WidgetKind) => CATALOG.find(d => d.k === k)!

export const isAllowed = (k: WidgetKind, w: number, h: number) => defOf(k).sizes.some(s => s[0] === w && s[1] === h)

/** Taille autorisée la plus proche de celle demandée (à égalité, la plus grande). */
export function nearestSize(k: WidgetKind, w: number, h: number): Size {
  let best = defOf(k).sizes[0], bd = Infinity
  for (const s of defOf(k).sizes) {
    const d = Math.abs(s[0] - w) + Math.abs(s[1] - h) - (s[0] * s[1]) / 1000
    if (d < bd) { bd = d; best = s }
  }
  return best
}

/** Plus grande taille autorisée qui tient dans w × h ; null si aucune. */
export function fitSize(k: WidgetKind, w: number, h: number): Size | null {
  let best: Size | null = null
  for (const s of defOf(k).sizes) if (s[0] <= w && s[1] <= h && (!best || s[0] * s[1] > best[0] * best[1])) best = s
  return best
}

/** Anciens identifiants, repris par les écrans déjà enregistrés. */
export const LEGACY: Record<string, { k: WidgetKind; o?: Record<string, string | number | boolean> }> = {
  stop: { k: 'next', o: { content: 'stops' } },
  cum: { k: 'gap' },
}

/** Réglages d'un widget : une liste de choix par réglage. */
export interface OptionDef { key: string; label: string; choices: { v: string | number | boolean; l: string }[] }
export const OPTIONS: Partial<Record<WidgetKind, OptionDef[]>> = {
  effort: [{ key: 'wkg', label: 'Unité', choices: [{ v: false, l: 'W' }, { v: true, l: 'W/kg' }] }],
  speed: [{ key: 'avg', label: 'Mesure', choices: [{ v: false, l: 'Instantanée' }, { v: true, l: 'Moyenne' }] }],
  profile: [{ key: 'range', label: 'À venir', choices: [{ v: 5, l: '5 km' }, { v: 15, l: '15 km' }, { v: 25, l: '25 km' }] }],
}

/** Une variante d'une famille : un widget du catalogue (et ses réglages) qu'on choisit dans la famille. */
export interface Variant { k: WidgetKind; label: string; o?: Record<string, string | number | boolean> }
/** Famille : ce que l'utilisateur voit dans le catalogue. Plusieurs widgets proches y sont des variantes. */
export interface Family { id: string; name: string; desc: string; variants: Variant[] }

export const FAMILIES: Family[] = [
  { id: 'effort', name: 'Effort', desc: 'Puissance, FC et cible', variants: [{ k: 'effort', label: 'Puissance' }, { k: 'hr', label: 'FC' }, { k: 'target', label: 'Cible' }] },
  { id: 'zones', name: 'Zones', desc: 'Zone en cours, temps par zone, dans la cible', variants: [{ k: 'zone', label: 'Zone en cours' }, { k: 'zones', label: 'Temps par zone' }, { k: 'intarget', label: 'Dans la cible' }] },
  { id: 'reserves', name: 'Réserves', desc: 'Punch, endurance, dérive cardiaque', variants: [{ k: 'punch', label: 'Punch' }, { k: 'endurance', label: 'Endurance' }, { k: 'reserve', label: 'Les deux' }, { k: 'drift', label: 'Dérive cardiaque' }] },
  { id: 'nutrition', name: 'Nutrition', desc: 'Glucides, écart, prochain rappel, synthèse', variants: [{ k: 'carbs', label: 'Glucides / h' }, { k: 'carbgap', label: 'Écart glucides' }, { k: 'fuel', label: 'Prochain rappel' }, { k: 'sumfuel', label: 'Synthèse' }] },
  { id: 'relief', name: 'Relief', desc: 'Profil à venir et montée', variants: [{ k: 'profile', label: 'Profil' }, { k: 'climb', label: 'Montée' }] },
  { id: 'points', name: 'Prochains points', desc: 'Points, notes, arrêts', variants: [{ k: 'next', label: 'Points et notes', o: { content: 'all' } }, { k: 'next', label: 'Points', o: { content: 'points' } }, { k: 'next', label: 'Notes', o: { content: 'notes' } }, { k: 'next', label: 'Arrêts', o: { content: 'stops' } }] },
  { id: 'valeur', name: 'Valeur', desc: 'Un chiffre au choix : cadence, vitesse, pente, distance, heure…', variants: [{ k: 'cad', label: 'Cadence' }, { k: 'speed', label: 'Vitesse' }, { k: 'slope', label: 'Pente' }, { k: 'dist', label: 'Distance' }, { k: 'time', label: 'Roulage' }, { k: 'clock', label: 'Heure' }, { k: 'arrival', label: 'Arrivée' }, { k: 'gap', label: 'Écart au plan' }, { k: 'sunset', label: 'Soleil' }] },
  { id: 'synthese', name: 'Synthèse', desc: 'Plusieurs valeurs en une grille', variants: [{ k: 'sumeffort', label: 'Effort' }, { k: 'sumroute', label: 'Parcours' }, { k: 'lap', label: 'Tour' }] },
]

/** Famille et variante d'un widget posé sur un écran. */
export function familyOf(k: WidgetKind, o?: Record<string, string | number | boolean>): { family: Family; variant: Variant } {
  for (const f of FAMILIES) {
    const v = f.variants.find(x => x.k === k && (!x.o || x.o.content === (o?.content === 'stops' || o?.stops ? 'stops' : o?.content ?? 'all')))
    if (v) return { family: f, variant: v }
  }
  const f = FAMILIES[0]
  return { family: f, variant: f.variants[0] }
}
