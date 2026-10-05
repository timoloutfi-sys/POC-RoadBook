import { uid } from '../core/format'
import { defOf, isAllowed } from './catalog'
import { COLS, ROWS, TEMPLATES, mkLayout, type ScreenDef, type WidgetItem, type WidgetKind } from './defaults'

type Rect = { x: number; y: number; w: number; h: number }

export const overlaps = (items: WidgetItem[], r: Rect, ignoreId: string | null = null) =>
  items.some(b => b.id !== ignoreId && r.x < b.x + b.w && b.x < r.x + r.w && r.y < b.y + b.h && b.y < r.y + r.h)

/** Nouvel écran depuis un modèle, ou vide. */
export const createScreen = (name: string, tpl: keyof typeof TEMPLATES | null): ScreenDef =>
  ({ id: uid(), name, items: tpl ? mkLayout(tpl) : [] })

export const duplicateScreen = (s: ScreenDef): ScreenDef =>
  ({ id: uid(), name: `${s.name} (copie)`, items: s.items.map(i => ({ ...i, id: uid() })) })

/** Place un widget dans la première case libre, dans sa plus petite taille utile puis les suivantes. Null s'il n'y a plus de place. */
export function addWidget(items: WidgetItem[], k: WidgetKind): WidgetItem[] | null {
  const sizes = [...defOf(k).sizes].sort((a, b) => Math.abs(a[0] - 2) + Math.abs(a[1] - 1) - (Math.abs(b[0] - 2) + Math.abs(b[1] - 1)) || a[0] * a[1] - b[0] * b[1])
  for (const [w, h] of sizes)
    for (let y = 0; y <= ROWS - h; y++)
      for (let x = 0; x <= COLS - w; x++)
        if (!overlaps(items, { x, y, w, h })) return [...items, { id: uid(), k, x, y, w, h }]
  return null
}

/** Déplace ou redimensionne, en restant dans la grille, sans chevaucher, et dans une taille autorisée du widget. Retourne null si impossible. */
export function applyRect(items: WidgetItem[], id: string, r: Rect): WidgetItem[] | null {
  const it = items.find(i => i.id === id)
  const ok = it && r.w >= 1 && r.h >= 1 && r.x >= 0 && r.y >= 0 && r.x + r.w <= COLS && r.y + r.h <= ROWS && isAllowed(it.k, r.w, r.h)
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
