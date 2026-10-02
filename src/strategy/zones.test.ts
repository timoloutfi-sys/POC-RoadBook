import { describe, expect, it } from 'vitest'
import { buildRoute } from '../route/route'
import { effectiveFtp, effectiveLthr } from './rider'
import { hrBand, targetAt } from './target'
import { defaultBase } from './types'
import { hrRatioForPowerRatio, powerZoneOf } from './zones'

describe('zones', () => {
  it('classe les fractions de FTP', () => {
    expect(powerZoneOf(0.5)).toBe(0)
    expect(powerZoneOf(0.7)).toBe(1)
    expect(powerZoneOf(1.0)).toBe(3)
    expect(powerZoneOf(2)).toBe(6)
  })
  it('les bornes de zones puissance et cardio se correspondent', () => {
    expect(hrRatioForPowerRatio(0.55)).toBeCloseTo(0.68)
    expect(hrRatioForPowerRatio(0.9)).toBeCloseTo(0.94)
    expect(hrRatioForPowerRatio(0.65)).toBeGreaterThan(0.68)
    expect(hrRatioForPowerRatio(0.65)).toBeLessThan(0.83)
  })
  it('bande cardio : au moins 6 bpm de large, élargie par la dérive', () => {
    const b = hrBand(70, 71, 170)
    expect(b.max - b.min).toBeGreaterThanOrEqual(6)
    const later = hrBand(70, 71, 170, 2)
    expect(later.max - b.max).toBe(6)
    expect(later.min).toBe(b.min)
  })
})

describe('profil coureur', () => {
  const base = { mass: 82, cda: 0.3, lthr: null, hrMax: null, flatSpeed: null }
  it('FTP saisie prioritaire', () => expect(effectiveFtp({ ...base, ftp: 250 })).toBe(250))
  it('FTP estimée depuis la vitesse sur le plat', () => {
    const f = effectiveFtp({ ...base, ftp: null, flatSpeed: 30 })
    expect(f).toBeGreaterThan(180)
    expect(f).toBeLessThan(260)
  })
  it('FC seuil estimée à 90 % de la FC max', () => {
    expect(effectiveLthr({ ...base, ftp: null, hrMax: 190 })).toBe(171)
    expect(effectiveLthr({ ...base, ftp: null })).toBeNull()
  })
})

describe('cible', () => {
  // 2 km de plat puis 2 km à 6 %
  const pts = Array.from({ length: 81 }, (_, i) => ({ lat: 48 + (i * 50) / 111320, lon: 2, ele: i <= 40 ? 100 : 100 + (i - 40) * 3 }))
  const r = buildRoute('test', pts)
  it('applique les règles de base selon la pente', () => {
    expect(targetAt(r, [], defaultBase(), 200, 170, 800).kind).toBe('plat')
    const t = targetAt(r, [], defaultBase(), 200, 170, 3200)
    expect(t.kind).toBe('montee')
    expect(t.power).toEqual({ min: 150, max: 180 })
    expect(t.hr).not.toBeNull()
  })
  it('une section l’emporte sur les règles', () => {
    const s = { id: 'x', kind: 'zone' as const, name: 'Bloc', a: 0.5, b: 1.5, min: 95, max: 100, msg: '', avant: 0 }
    const t = targetAt(r, [s], defaultBase(), 200, null, 1000)
    expect(t.label).toBe('Bloc')
    expect(t.power).toEqual({ min: 190, max: 200 })
    expect(t.hr).toBeNull()
    expect(t.zone).toBe(3)
  })
})
