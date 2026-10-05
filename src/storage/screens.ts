import { uid } from '../core/format'
import { CATALOG, defOf, fitSize, isAllowed } from './catalog'
import { LANDSCAPE, PORTRAIT, TEMPLATES, mkLayout, type Grid, type ScreenDef, type WidgetItem, type WidgetKind } from './defaults'

type Rect = { x: number; y: number; w: number; h: number }

export const overlaps = (items: WidgetItem[], r: Rect, ignoreId: string | null = null) =>
  items.some(b => b.id !== ignoreId && r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h)

/** Nouvel écran depuis un modèle, ou vide. */
export const createScreen = (name: string, tpl: keyof typeof TEMPLATES | null): ScreenDef =>
  ({ id: uid(), name, items: tpl ? mkLayout(tpl) : [] })

export const duplicateScreen = (s: ScreenDef): ScreenDef =>
  ({ id: uid(), name: `${s.name} (copie)`, items: s.items.map(i => ({ ...i, id: uid() })), ...(s.portrait ? { portrait: s.portrait.map(i => ({ ...i, id: uid() })) } : {}) })

/** Place un widget dans la première case libre, dans sa plus petite taille utile puis les suivantes. Null s'il n'y a plus de place. */
export function addWidget(items: WidgetItem[], k: WidgetKind, g: Grid = LANDSCAPE): WidgetItem[] | null {
  const sizes = [...defOf(k).sizes].sort((a, b) => Math.abs(a[0] - 2) + Math.abs(a[1] - 1) - (Math.abs(b[0] - 2) + Math.abs(b[1] - 1)) || a[0] * a[1] - b[0] * b[1])
  for (const [w, h] of sizes)
    for (let y = 0; y <= g.rows - h; y++)
      for (let x = 0; x <= g.cols - w; x++)
        if (!overlaps(items, { x, y, w, h })) return [...items, { id: uid(), k, x, y, w, h }]
  return null
}

/** Déplace ou redimensionne, en restant dans la grille, sans chevaucher, et dans une taille autorisée du widget. Retourne null si impossible. */
export function applyRect(items: WidgetItem[], id: string, r: Rect, g: Grid = LANDSCAPE): WidgetItem[] | null {
  const it = items.find(i => i.id === id)
  const ok = it && r.w >= 1 && r.h >= 1 && r.x >= 0 && r.y >= 0 && r.x + r.w <= g.cols && r.y + r.h <= g.rows && isAllowed(it.k, r.w, r.h)
  if (!ok || overlaps(items, r, id)) return null
  return items.map(i => (i.id === id ? { ...i, ...r } : i))
}

/** Supprime un écran, mais jamais le dernier. */
export function removeScreen(screens: ScreenDef[], id: string): ScreenDef[] {
  return screens.length > 1 ? screens.filter(s => s.id !== id) : screens
}

/** Écran suivant (dir = 1) ou précédent (-1), en boucle. */
export function stepScreen(screens: ScreenDef[], currentId: string, dir: 1 | -1): string {
  const i = Math.max(0, screens.findIndex(s => s.id === currentId))
  return screens[(i + dir + screens.length) % screens.length].id
}

export function moveScreen(screens: ScreenDef[], id: string, dir: 1 | -1): ScreenDef[] {
  const i = screens.findIndex(s => s.id === id), j = i + dir
  if (i < 0 || j < 0 || j >= screens.length) return screens
  const out = [...screens]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

/** Tailles autorisées d'un widget qui tiennent à la case (x, y), à la place libre. */
export function sizesAt(items: WidgetItem[], k: WidgetKind, x: number, y: number, g: Grid = LANDSCAPE, ignoreId: string | null = null) {
  return defOf(k).sizes.filter(([w, h]) => x + w <= g.cols && y + h <= g.rows && !overlaps(items, { x, y, w, h }, ignoreId))
}

/** Widgets qui tiennent à la case libre (x, y), avec leur plus grande taille possible. */
export function fitting(items: WidgetItem[], x: number, y: number, g: Grid = LANDSCAPE) {
  return CATALOG.map(d => {
    const s = sizesAt(items, d.k, x, y, g).sort((a, b) => b[0] * b[1] - a[0] * a[1])[0]
    return s ? { k: d.k, size: s } : null
  }).filter((v): v is { k: WidgetKind; size: [number, number] } => !!v)
}

/**
 * Disposition portrait (3 × 6) générée depuis le paysage : ordre de lecture, gros widgets d'abord,
 * largeur ramenée à 3 colonnes, puis première place libre. Ce qui ne tient plus est écarté.
 */
export function portraitFrom(items: WidgetItem[]): WidgetItem[] {
  const g = PORTRAIT, out: WidgetItem[] = []
  const order = [...items].sort((a, b) => b.w * b.h - a.w * a.h || a.y - b.y || a.x - b.x)
  for (const it of order) {
    let size = fitSize(it.k, Math.min(it.w, g.cols), Math.min(it.h, g.rows))
    while (size) {
      let put = false
      for (let y = 0; y <= g.rows - size[1] && !put; y++)
        for (let x = 0; x <= g.cols - size[0] && !put; x++)
          if (!overlaps(out, { x, y, w: size[0], h: size[1] })) { out.push({ ...it, id: uid(), x, y, w: size[0], h: size[1] }); put = true }
      if (put) break
      // Plus petite taille autorisée, si la place manque.
      const [w, h] = size
      size = fitSize(it.k, w - (w > h ? 1 : 0), h - (h >= w ? 1 : 0))
      if (size && size[0] === w && size[1] === h) size = null
    }
  }
  return out
}

/** Widgets d'un écran dans l'orientation demandée. */
export const itemsFor = (s: ScreenDef, portrait: boolean) => (portrait ? s.portrait ?? portraitFrom(s.items) : s.items)
