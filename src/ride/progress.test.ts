import { describe, expect, it } from 'vitest'
import type { TimelineRow } from '../strategy/timeline'
import { gapOf, nextStopOf, plannedKjAt } from './progress'

const res = { ratio: Float32Array.from({ length: 101 }, () => 0.8), cumT: Float64Array.from({ length: 101 }, (_, i) => i * 10) }
const row = (o: Partial<TimelineRow>): TimelineRow => ({ id: 'x', kind: 'point', icon: 'note', km: 10, label: '', at: null, gapS: null, stop: 0, night: false, ...o })

describe('avancement par rapport au plan', () => {
  it('cumule le travail prévu', () => {
    // 100 échantillons de 10 s à 0,8 × 250 W = 200 W → 2 kJ chacun
    expect(plannedKjAt(res, 250, 5)).toBeCloseTo(200, 0) // km 5 = échantillon 100
    expect(plannedKjAt(res, 250, 0)).toBe(0)
  })
  it('donne le retard : positif = en retard', () => {
    const etas = [{ km: 0, t: 0 }, { km: 100, t: 10000 }]
    expect(gapOf(etas, 50, 5300)).toBe(300)
    expect(gapOf(etas, 50, 4700)).toBe(-300)
    expect(gapOf([], 50, 100)).toBeNull()
  })
  it('trouve le prochain arrêt : eau, ravito ou arrêt prévu, pas les notes ni le passé', () => {
    const rows = [row({ km: 5, icon: 'eau' }), row({ km: 12, icon: 'note' }), row({ km: 20, icon: 'danger', stop: 5, label: 'Pause' }), row({ km: 30, icon: 'ravito' })]
    expect(nextStopOf(rows, 6)!.name).toBe('Pause')
    expect(nextStopOf(rows, 6)!.kmAway).toBe(14)
    expect(nextStopOf(rows, 25)!.name).toBe('Ravito')
    expect(nextStopOf(rows, 31)).toBeNull()
  })
})
