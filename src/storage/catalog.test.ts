import { describe, expect, it } from 'vitest'
import { previewData } from '../ride/data'
import { tileOf } from '../ui/tiles'
import { CATALOG, FAMILIES, familyOf, fitSize, isAllowed, nearestSize, type WidgetKind } from './catalog'
import { COLS, PORTRAIT, ROWS, TEMPLATES, mkLayout, normalizeItems, type WidgetItem } from './defaults'
import { addWidget, applyRect, fitting, overlaps, portraitFrom } from './screens'

describe('catalogue', () => {
  it('chaque widget a au moins une taille et son nom, et ses tailles tiennent dans la grille', () => {
    expect(CATALOG.length).toBe(29)
    for (const d of CATALOG) {
      expect(d.sizes.length).toBeGreaterThan(0); expect(d.name).toBeTruthy(); expect(d.desc).toBeTruthy()
      for (const [w, h] of d.sizes) { expect(w).toBeLessThanOrEqual(COLS); expect(h).toBeLessThanOrEqual(ROWS) }
    }
  })
  it('les écrans prêts à l’emploi respectent les tailles autorisées et ne se chevauchent pas', () => {
    for (const k of Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]) {
      const items = mkLayout(k)
      for (const it of items) {
        expect(isAllowed(it.k, it.w, it.h), `${k}: ${it.k} ${it.w}×${it.h}`).toBe(true)
        expect(it.x + it.w).toBeLessThanOrEqual(COLS); expect(it.y + it.h).toBeLessThanOrEqual(ROWS)
        expect(overlaps(items.filter(o => o !== it), it)).toBe(false)
      }
    }
  })
  it('taille la plus proche et plus grande taille qui tient', () => {
    expect(nearestSize('cad', 3, 2)).toEqual([2, 1])
    expect(fitSize('effort', 3, 3)).toEqual([2, 2])
    expect(fitSize('profile', 2, 2)).toEqual([2, 1])
    expect(fitSize('slope', 6, 3)).toEqual([1, 1])
  })
  it('redimensionnement : seulement des tailles autorisées', () => {
    const items: WidgetItem[] = [{ id: 'a', k: 'cad', x: 0, y: 0, w: 1, h: 1 }]
    expect(applyRect(items, 'a', { x: 0, y: 0, w: 2, h: 2 })).toBeNull()
    expect(applyRect(items, 'a', { x: 0, y: 0, w: 2, h: 1 })).not.toBeNull()
  })
  it('ajoute un widget dans une taille autorisée', () => {
    const r = addWidget([], 'slope')!
    expect([r[0].w, r[0].h]).toEqual([1, 1])
    const z = addWidget([], 'zones')!
    expect(isAllowed('zones', z[0].w, z[0].h)).toBe(true)
  })
})

describe('migration des écrans enregistrés', () => {
  it('remplace les anciens widgets et ramène les tailles', () => {
    const old = [
      { id: '1', k: 'stop', x: 0, y: 0, w: 2, h: 1 }, { id: '2', k: 'cum', x: 2, y: 0, w: 2, h: 1 },
      { id: '3', k: 'effort', x: 0, y: 1, w: 3, h: 2 }, { id: '4', k: 'power', x: 4, y: 1, w: 1, h: 1 }, { id: '5', k: 'inconnu', x: 5, y: 2, w: 1, h: 1 },
    ] as unknown as WidgetItem[]
    const n = normalizeItems(old)
    expect(n.map(i => i.k)).toEqual(['next', 'gap', 'effort', 'effort'])
    expect(n[0].o).toEqual({ content: 'stops' })
    expect([n[2].w, n[2].h]).toEqual([2, 2])
  })
})

describe('contenu des widgets', () => {
  const d = previewData()
  it('chaque widget du catalogue produit un contenu avec les données d’aperçu', () => {
    for (const k of CATALOG.map(c => c.k) as WidgetKind[]) {
      if (['effort', 'hr', 'target', 'next', 'profile', 'fuel', 'gap'].includes(k)) continue
      const t = tileOf(k, d)
      expect(t.empty, k).toBeUndefined()
    }
  })
  it('sans moteur, les widgets de réserve affichent --', () => {
    expect(tileOf('punch', { ...d, m: null }).empty).toBe('--')
    expect(tileOf('drift', { ...d, m: { ...d.m!, drift: null }, t: 600 }).empty).toBe('Mesure en cours')
  })
  it('l’écart de glucides est signé et en grammes', () => {
    expect(tileOf('carbgap', d).val).toBe('−27'); expect(tileOf('carbgap', d).unit).toBe('g')
  })
  it('le temps par zone marque la zone en cours', () => {
    const t = tileOf('zones', d)
    expect(t.bars!.filter(b => b.now).length).toBe(1); expect(t.bars!.length).toBe(5)
  })
})

describe('portrait et cases vides', () => {
  it('génère le portrait : 3 colonnes, tailles autorisées, sans chevauchement, gros widgets d’abord', () => {
    for (const k of Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[]) {
      const land = mkLayout(k), p = portraitFrom(land)
      expect(p.length).toBeGreaterThan(0)
      for (const it of p) {
        expect(isAllowed(it.k, it.w, it.h), `${k} ${it.k}`).toBe(true)
        expect(it.x + it.w).toBeLessThanOrEqual(PORTRAIT.cols); expect(it.y + it.h).toBeLessThanOrEqual(PORTRAIT.rows)
        expect(overlaps(p.filter(o => o !== it), it)).toBe(false)
      }
      expect(p[0].w * p[0].h).toBeGreaterThanOrEqual(p[p.length - 1].w * p[p.length - 1].h)
    }
  })
  it('le profil large devient 3 colonnes en portrait', () => {
    const p = portraitFrom([{ id: 'a', k: 'profile', x: 0, y: 0, w: 4, h: 1 }])
    expect(p[0].w).toBe(3)
  })
  it('propose ce qui tient dans une case libre', () => {
    const items: WidgetItem[] = [{ id: 'a', k: 'effort', x: 0, y: 0, w: 2, h: 2 }]
    const f = fitting(items, 2, 0)
    expect(f.find(x => x.k === 'slope')!.size).toEqual([1, 1])
    expect(f.find(x => x.k === 'profile')!.size).toEqual([4, 2])
    const tight = fitting([{ id: 'a', k: 'effort', x: 1, y: 0, w: 1, h: 1 }], 0, 0)
    expect(tight.find(x => x.k === 'cad')!.size).toEqual([1, 1]) // la case voisine est prise : pas de 2×1
  })
  it('les tailles se contrôlent selon la grille portrait', () => {
    const items: WidgetItem[] = [{ id: 'a', k: 'cad', x: 2, y: 0, w: 1, h: 1 }]
    expect(applyRect(items, 'a', { x: 2, y: 0, w: 2, h: 1 }, PORTRAIT)).toBeNull()
    expect(applyRect(items, 'a', { x: 1, y: 0, w: 2, h: 1 }, PORTRAIT)).not.toBeNull()
  })
})

describe('familles du catalogue', () => {
  it('8 familles ; chaque widget du catalogue est dans une famille, aucun n’est oublié', () => {
    expect(FAMILIES.length).toBe(8)
    const kinds = new Set(FAMILIES.flatMap(f => f.variants.map(v => v.k)))
    for (const d of CATALOG) expect(kinds.has(d.k), d.k).toBe(true)
    for (const k of kinds) expect(CATALOG.some(d => d.k === k), k).toBe(true)
  })
  it('retrouve la famille et la variante d’un widget posé', () => {
    expect(familyOf('punch').family.id).toBe('reserves')
    expect(familyOf('next', { content: 'notes' }).variant.label).toBe('Notes')
    expect(familyOf('next').variant.label).toBe('Points et notes')
    expect(familyOf('next', { stops: true }).variant.label).toBe('Arrêts')
    expect(familyOf('cad').family.id).toBe('valeur')
  })
})
