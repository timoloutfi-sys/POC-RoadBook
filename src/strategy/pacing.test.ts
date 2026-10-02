import { describe, expect, it } from 'vitest'
import { speedFor } from '../physics/physics'
import { STEP, buildRoute, demoPoints, smoothGrades } from '../route/route'
import { ifForDuration, optimalPacing, smooth } from './pacing'

const body = { mass: 82, cda: 0.3 }
const route = buildRoute('Démo', demoPoints())
const gs = smoothGrades(route)

const timeAndNp = (ratio: ArrayLike<number>, ftp: number) => {
  let t = 0, s = 0
  for (let i = 0; i < gs.length; i++) { const d = STEP / speedFor(body, ratio[i] * ftp, gs[i] / 100); t += d; s += ratio[i] ** 4 * d }
  return { t, np: (s / t) ** 0.25 }
}

describe('allure optimale', () => {
  it('atteint la puissance normalisée demandée', () => {
    const p = optimalPacing(gs, body, 240, { np: 0.75 })
    expect(p.np).toBeCloseTo(0.75, 2)
    expect(timeAndNp(p.ratio, 240).np).toBeCloseTo(0.75, 2)
  })
  it('va plus vite qu’une puissance constante de même fatigue', () => {
    const t0 = performance.now()
    const p = optimalPacing(gs, body, 240, { np: 0.75 })
    const ms = performance.now() - t0
    const flat = timeAndNp(new Float32Array(gs.length).fill(0.75), 240)
    expect(timeAndNp(p.ratio, 240).t).toBeLessThan(flat.t * 0.995)
    expect(ms).toBeLessThan(1500)
  })
  it('appuie dans les montées, récupère en descente', () => {
    const p = optimalPacing(gs, body, 240, { np: 0.75 })
    let up = 0, nUp = 0, down = 0, nDown = 0
    for (let i = 0; i < gs.length; i++) {
      if (gs[i] > 4) { up += p.ratio[i]; nUp++ }
      if (gs[i] < -3) { down += p.ratio[i]; nDown++ }
    }
    expect(up / nUp).toBeGreaterThan(0.85)
    expect(down / nDown).toBeLessThan(0.6)
  })
  it('vise un temps total', () => {
    const base = optimalPacing(gs, body, 240, { np: 0.75 })
    const p = optimalPacing(gs, body, 240, { time: base.time * 1.1 })
    expect(Math.abs(p.time - base.time * 1.1) / (base.time * 1.1)).toBeLessThan(0.01)
    expect(p.np).toBeLessThan(0.75)
  })
  it('l’intensité tenable baisse avec la durée', () => {
    expect(ifForDuration(1)).toBeGreaterThan(ifForDuration(4))
    expect(ifForDuration(4)).toBeGreaterThan(ifForDuration(16))
    expect(ifForDuration(500)).toBe(0.5)
  })
  it('lisse sans changer la moyenne', () => {
    const a = new Float32Array([0, 0, 10, 0, 0, 0, 0])
    const s = smooth(a, 1)
    expect(s[2]).toBeCloseTo(10 / 3)
    expect(s.reduce((x, y) => x + y)).toBeCloseTo(10, 0)
  })
})
