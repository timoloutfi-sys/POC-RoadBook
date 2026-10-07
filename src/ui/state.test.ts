import { describe, expect, it } from 'vitest'
import { carbGapState, driftState, gapState, inTargetState, reserveState } from './state'

describe('couleurs d’état cohérentes', () => {
  it('écart au plan : l’avance est verte, le retard passe de l’ambre au rouge', () => {
    expect(gapState(-8)).toBe('ok'); expect(gapState(0)).toBe('ok'); expect(gapState(1)).toBe('ok')
    expect(gapState(3)).toBe('warn'); expect(gapState(5)).toBe('warn'); expect(gapState(6)).toBe('hi'); expect(gapState(40)).toBe('hi')
  })
  it('réserves, dérive, glucides, dans la cible : vert bon, ambre à surveiller, rouge mauvais', () => {
    expect([reserveState(90), reserveState(55), reserveState(20)]).toEqual(['ok', 'warn', 'hi'])
    expect([driftState(1), driftState(4), driftState(7)]).toEqual(['ok', 'warn', 'hi'])
    expect([carbGapState(10), carbGapState(-45), carbGapState(-90)]).toEqual(['ok', 'warn', 'hi'])
    expect([inTargetState(80), inTargetState(45), inTargetState(10)]).toEqual(['ok', 'warn', 'hi'])
  })
})
