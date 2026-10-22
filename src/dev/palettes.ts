/**
 * Palettes candidates tirées du « Dictionary of Color Combinations » de Sanzo Wada (1933).
 * Chaque couleur porte son nom dans le dictionnaire ; chaque palette part d'une ou deux combinaisons
 * du livre (numéros entre parenthèses) puis complète les rôles de l'appli avec des couleurs du même livre, sans aucune teinte inventée.
 */
export interface C { hex: string; n: string }
export interface Palette {
  id: string; name: string; combos: number[]; idea: string
  night: { bg: C; cell: C; line: C; ink: C; mut: C }
  day: { bg: C; cell: C; line: C; ink: C; mut: C }
  accent: C; accentNight: C; nav: C; ok: C; warn: C; hi: C; lo: C; loDeep: C
  zones: C[]
}

const w = (hex: string, n: string): C => ({ hex, n })
// Couleurs du dictionnaire utilisées par plusieurs palettes.
const BLACK = w('#111314', 'Black'), WHITE = w('#ffffff', 'White'), NEUTRAL = w('#b6bfc1', 'Neutral Gray')
const SLATE = w('#34454c', 'Slate Color'), PLUMB = w('#70727c', 'Deep Violet / Plumbeous'), MINERAL = w('#a2b0ad', 'Mineral Gray')

export const PALETTES: Palette[] = [
  {
    id: 'indigo', name: 'Indigo et jaune', combos: [295, 126],
    idea: 'Nuit d’encre (Dull Violet Black) et jaune vif : le contraste le plus fort, très lisible au soleil comme la nuit.',
    night: { bg: w('#1e0e3f', 'Dull Violet Black'), cell: w('#051230', 'Deep Indigo'), line: w('#40456a', 'Violet Blue'), ink: w('#f5ecc2', 'Sulpher Yellow'), mut: w('#b5b1d8', 'Grayish Lavender - A') },
    day: { bg: w('#ebd3a2', 'Ivory Buff'), cell: w('#fbe6a0', 'Naples Yellow'), line: w('#c2ae93', 'Ecru'), ink: w('#051230', 'Deep Indigo'), mut: w('#40456a', 'Violet Blue') },
    accent: w('#e2b540', 'Yellow Ocher'), accentNight: w('#fff200', 'Yellow'), nav: w('#b73f74', 'Rosolanc Purple'),
    ok: w('#009465', 'Dull Viridian Green'), warn: w('#fcb315', 'Orange Yellow'), hi: w('#cc1236', 'Carmine'), lo: w('#a7d4e4', 'Pale King’s Blue'), loDeep: w('#006eb8', 'Blue'),
    zones: [NEUTRAL, w('#006eb8', 'Blue'), w('#009465', 'Dull Viridian Green'), w('#fcb315', 'Orange Yellow'), w('#f37420', 'Orange'), w('#cc1236', 'Carmine'), w('#59256a', 'Red Violet')],
  },
  {
    id: 'ardoise', name: 'Ardoise et orange', combos: [140, 340],
    idea: 'Ardoise et noir de Wada, orange pêche en accent, bleu d’Anvers et vert d’eau : sobre, technique, proche d’un instrument.',
    night: { bg: BLACK, cell: SLATE, line: PLUMB, ink: WHITE, mut: NEUTRAL },
    day: { bg: NEUTRAL, cell: WHITE, line: MINERAL, ink: BLACK, mut: SLATE },
    accent: w('#f15a30', 'Peach Red'), accentNight: w('#f3a257', 'Golden Yellow'), nav: w('#a36aa5', 'Aconite Violet'),
    ok: w('#00b49b', 'Sea Green'), warn: w('#f3a257', 'Golden Yellow'), hi: w('#f15a30', 'Peach Red'), lo: w('#78cdd0', 'Calamine Blue'), loDeep: w('#007190', 'Antwarp Blue'),
    zones: [NEUTRAL, w('#007190', 'Antwarp Blue'), w('#00b49b', 'Sea Green'), w('#f3a257', 'Golden Yellow'), w('#f15a30', 'Peach Red'), w('#a72144', 'Red'), w('#4f4086', 'Violet')],
  },
  {
    id: 'foret', name: 'Forêt et corail', combos: [332, 284],
    idea: 'Vert ardoise profond et papier Naples, corail et jaune abricot : chaud, plus « carnet de route ».',
    night: { bg: w('#112f2c', 'Deep Slate Green'), cell: w('#253122', 'Deep Slate Olive'), line: w('#004f46', 'Dusky Green'), ink: w('#fbe6a0', 'Naples Yellow'), mut: w('#b4cdc2', 'Glaucous Green') },
    day: { bg: w('#f5ecc2', 'Sulpher Yellow'), cell: WHITE, line: w('#c1c494', 'Olive Buff'), ink: w('#253122', 'Deep Slate Olive'), mut: w('#42533e', 'Blackish Olive') },
    accent: w('#ffdd00', 'Apricot Yellow'), accentNight: w('#ffdd00', 'Apricot Yellow'), nav: w('#bf5892', 'Eupatorium Purple'),
    ok: w('#00b49b', 'Sea Green'), warn: w('#ffdd00', 'Apricot Yellow'), hi: w('#cb2f43', 'Scarlet'), lo: w('#bce4e5', 'Nile Blue'), loDeep: w('#007190', 'Antwarp Blue'),
    zones: [w('#b4cdc2', 'Glaucous Green'), w('#007190', 'Antwarp Blue'), w('#00b49b', 'Sea Green'), w('#ffdd00', 'Apricot Yellow'), w('#f58e84', 'Coral Red'), w('#cb2f43', 'Scarlet'), w('#642d5e', 'Violet Red')],
  },
  {
    id: 'carmin', name: 'Carmin et lavande', combos: [307, 329],
    idea: 'Pourpre Cotinga et lavande, carmin et jaune crème : la plus « Wada », élégante, un peu moins de contraste en plein soleil.',
    night: { bg: w('#1e0e3f', 'Dull Violet Black'), cell: w('#501345', 'Cotinga Purple'), line: w('#642d5e', 'Violet Red'), ink: w('#f5ecc2', 'Sulpher Yellow'), mut: w('#c0a9b3', 'Grayish Lavender - B') },
    day: { bg: w('#b5b1d8', 'Grayish Lavender - A'), cell: WHITE, line: w('#c0a9b3', 'Grayish Lavender - B'), ink: w('#1e0e3f', 'Dull Violet Black'), mut: w('#501345', 'Cotinga Purple') },
    accent: w('#cc1236', 'Carmine'), accentNight: w('#fdbf68', 'Cream Yellow'), nav: w('#a36aa5', 'Aconite Violet'),
    ok: w('#489b6e', 'Green'), warn: w('#fdbf68', 'Cream Yellow'), hi: w('#cc1236', 'Carmine'), lo: w('#97acc8', 'Salvia Blue'), loDeep: w('#1c4286', 'Deep Lyons Blue'),
    zones: [PLUMB, w('#5a82b3', 'Olympic Blue'), w('#489b6e', 'Green'), w('#fdbf68', 'Cream Yellow'), w('#f68c50', 'Apricot Orange'), w('#cc1236', 'Carmine'), w('#59256a', 'Red Violet')],
  },
]

/** Variables CSS de la vue de course : jour et nuit mélangés par --n, comme `device.css`. */
export const deviceCss = (p: Palette) => {
  const mix = (n: C, d: C) => `color-mix(in srgb, ${n.hex} calc(var(--n) * 100%), ${d.hex})`
  return `--d-bg: ${mix(p.night.bg, p.day.bg)}; --d-cell: ${mix(p.night.cell, p.day.cell)}; --d-line: ${mix(p.night.line, p.day.line)};
  --d-ink: ${mix(p.night.ink, p.day.ink)}; --d-mut: ${mix(p.night.mut, p.day.mut)}; --d-acc: ${mix(p.accentNight, p.accent)};
  --d-ok: ${p.ok.hex}; --d-hi: ${p.hi.hex}; --d-lo: ${p.loDeep.hex}; --d-warn: ${p.warn.hex};`
}
/** Variables CSS de la préparation (thème sombre de l'appli). */
export const rootCss = (p: Palette) =>
  `--bg: ${p.night.bg.hex}; --surface: ${p.night.cell.hex}; --raised: ${p.night.line.hex}; --ink: ${p.night.ink.hex}; --muted: ${p.night.mut.hex}; --line: ${p.night.line.hex};
  --accent: ${p.accentNight.hex}; --accent-ink: ${p.night.bg.hex}; --accent-fg: ${p.accentNight.hex}; --danger: ${p.hi.hex}; --ok: ${p.ok.hex};`
