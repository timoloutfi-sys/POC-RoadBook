import { describe, expect, it } from 'vitest'
import { cadenceFrom, parseCsc, parseHeartRate, parsePower, speedFrom } from './decode'

const dv = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer)

describe('trames Bluetooth', () => {
  it('FC sur 8 bits', () => expect(parseHeartRate(dv([0x00, 148]))).toBe(148))
  it('FC sur 16 bits', () => expect(parseHeartRate(dv([0x01, 0x2c, 0x01]))).toBe(300))

  it('puissance seule', () => {
    expect(parsePower(dv([0x00, 0x00, 0xfa, 0x00]))).toEqual({ power: 250, crank: null })
  })
  it('puissance négative ramenée à 0', () => {
    expect(parsePower(dv([0x00, 0x00, 0xff, 0xff])).power).toBe(0)
  })
  it('puissance + équilibre + tours de pédalier', () => {
    // drapeaux 0x21 : équilibre (1 octet) puis pédalier
    const r = parsePower(dv([0x21, 0x00, 0xc8, 0x00, 0x32, 0x0a, 0x00, 0x00, 0x04]))
    expect(r.power).toBe(200)
    expect(r.crank).toEqual({ revs: 10, time: 1024 })
  })
  it('CSC roue + pédalier', () => {
    const r = parseCsc(dv([0x03, 0x64, 0, 0, 0, 0x00, 0x08, 0x05, 0x00, 0x00, 0x04]))
    expect(r.wheel).toEqual({ revs: 100, time: 2048 })
    expect(r.crank).toEqual({ revs: 5, time: 1024 })
  })
  it('CSC pédalier seul', () => {
    expect(parseCsc(dv([0x02, 0x05, 0x00, 0x00, 0x04]))).toEqual({ wheel: null, crank: { revs: 5, time: 1024 } })
  })
})

describe('cadence et vitesse', () => {
  it('90 rpm : 3 tours en 2 s', () => {
    expect(cadenceFrom({ revs: 10, time: 0 }, { revs: 13, time: 2048 })).toBeCloseTo(90)
  })
  it('gère le retour à zéro des compteurs et du temps', () => {
    expect(cadenceFrom({ revs: 65535, time: 64512 }, { revs: 1, time: 1024 })).toBeCloseTo(60)
  })
  it('ignore les écarts aberrants', () => {
    expect(cadenceFrom({ revs: 0, time: 0 }, { revs: 0, time: 1024 })).toBeNull()
    expect(cadenceFrom({ revs: 0, time: 0 }, { revs: 50, time: 1024 })).toBeNull()
  })
  it('vitesse : 4 tours de 2146 mm en 1 s ≈ 30,9 km/h', () => {
    expect(speedFrom({ revs: 100, time: 0 }, { revs: 104, time: 1024 }, 2146)! * 3.6).toBeCloseTo(30.9, 1)
  })
  it('vitesse : compteur de roue sur 32 bits qui revient à zéro', () => {
    expect(speedFrom({ revs: 0xffffffff, time: 0 }, { revs: 3, time: 1024 }, 2000)).toBeCloseTo(8)
  })
})
