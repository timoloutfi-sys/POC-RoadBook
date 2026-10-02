import { describe, expect, it } from 'vitest'
import { COLS, ROWS, defaultConfig, migrateConfig, mkLayout, type WidgetItem } from './defaults'
import { addWidget, applyRect, createScreen, duplicateScreen, moveScreen, overlaps, removeScreen, stepScreen } from './screens'
import { importPlan } from './transfer'

const w = (id: string, x: number, y: number, ww: number, h: number): WidgetItem => ({ id, k: 'speed', x, y, w: ww, h })

describe('écrans modulaires', () => {
  it('détecte les chevauchements', () => {
    const items = [w('a', 0, 0, 2, 2)]
    expect(overlaps(items, { x: 1, y: 1, w: 1, h: 1 })).toBe(true)
    expect(overlaps(items, { x: 2, y: 0, w: 1, h: 1 })).toBe(false)
    expect(overlaps(items, { x: 0, y: 0, w: 2, h: 2 }, 'a')).toBe(false)
  })
  it('ajoute un widget dans la première case libre, puis refuse quand c’est plein', () => {
    let items: WidgetItem[] = []
    for (let i = 0; i < 40; i++) {
      const next = addWidget(items, 'cad')
      if (!next) break
      items = next
    }
    expect(addWidget(items, 'cad')).toBeNull()
    expect(items.reduce((a, i) => a + i.w * i.h, 0)).toBe(COLS * ROWS)
  })
  it('déplace et redimensionne dans la grille sans chevaucher', () => {
    const items = [w('a', 0, 0, 1, 1), w('b', 1, 0, 1, 1)]
    expect(applyRect(items, 'a', { x: 0, y: 0, w: 2, h: 1 })).toBeNull()
    expect(applyRect(items, 'a', { x: 0, y: 1, w: 1, h: 1 })?.find(i => i.id === 'a')?.y).toBe(1)
    expect(applyRect(items, 'a', { x: COLS, y: 0, w: 1, h: 1 })).toBeNull()
  })
  it('crée, duplique, supprime (jamais le dernier), réordonne', () => {
    const a = createScreen('Plat', 'ultra'), b = duplicateScreen(a)
    expect(b.name).toBe('Plat (copie)')
    expect(b.items[0].id).not.toBe(a.items[0].id)
    expect(createScreen('Vide', null).items).toEqual([])
    expect(removeScreen([a, b], a.id)).toEqual([b])
    expect(removeScreen([a], a.id)).toEqual([a])
    expect(moveScreen([a, b], b.id, -1).map(s => s.id)).toEqual([b.id, a.id])
    expect(moveScreen([a, b], a.id, -1)).toEqual([a, b])
  })
  it('passe d’un écran à l’autre en boucle', () => {
    const a = createScreen('A', null), b = createScreen('B', null)
    expect(stepScreen([a, b], a.id, 1)).toBe(b.id)
    expect(stepScreen([a, b], b.id, 1)).toBe(a.id)
    expect(stepScreen([a, b], a.id, -1)).toBe(b.id)
  })
})

describe('migration', () => {
  it('l’ancienne disposition devient l’écran « Principal », puissance → effort', () => {
    const old = { ...defaultConfig(), layout: mkLayout('clm').map(i => (i.k === 'effort' ? { ...i, k: 'power' as never } : i)), screens: undefined as never }
    const m = migrateConfig(old)
    expect(m.screens).toHaveLength(1)
    expect(m.screens[0].name).toBe('Principal')
    expect(m.screens[0].items.some(i => i.k === 'effort')).toBe(true)
    expect(m.screens[0].items.some(i => (i.k as string) === 'power')).toBe(false)
    expect(m.activeScreen).toBe(m.screens[0].id)
  })
  it('l’import d’un plan de l’ancien prototype donne un écran', () => {
    const o = { cfg: { ftp: 250, layout: [{ id: 'x', k: 'power', x: 0, y: 0, w: 2, h: 2 }] }, route: null }
    const { cfg } = importPlan(JSON.stringify(o))
    expect(cfg.screens[0].items[0].k).toBe('effort')
  })
})
