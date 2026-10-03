import { getLibrary, useLibrary } from '../library/session'
import { summarize } from '../library/summary'
import type { Ride, RideChunk, RideEvent, RideSummary } from '../library/types'
import { uid } from '../core/format'
import { STEP } from '../route/route'
import { useStore } from '../storage/store'
import { effectiveFtp, effectiveLthr, effortUnit } from '../strategy/rider'
import { timeline } from '../strategy/timeline'
import type { RoutePoint } from '../strategy/types'
import { rideState } from './scope'

export interface Sample { t: number; km: number; speed: number; power: number | null; hr: number | null; cad: number | null; ele: number | null; moving: boolean; tgt: 0 | 1 | 2 }

const FLUSH = 30
const STOP_AFTER = 20

const dayName = (t: number) => new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

/** Calcule le résumé et clôt une sortie (nom, fin, chiffres). */
async function summaryOf(ride: Ride, remindersTotal: number): Promise<RideSummary | null> {
  const lib = getLibrary()
  if (!lib) return null
  return summarize(await lib.chunks(ride.id), {
    etas: ride.planSnapshot?.etas, remindersTotal,
    remindersDone: ride.events.filter(e => e.type === 'reminder' && e.ok).length,
  })
}

export async function finalize(ride: Ride, name?: string, remindersTotal = 0): Promise<Ride | null> {
  const lib = getLibrary(), s = await summaryOf(ride, remindersTotal)
  if (!lib || !s) return null
  const done = { ...ride, name: name?.trim() || ride.name, end: ride.end ?? Date.now(), summary: s }
  await lib.saveRide(done)
  if (useLibrary.getState().unfinished?.id === ride.id) useLibrary.setState({ unfinished: null })
  return done
}

/** Enregistre la sortie en direct : une mesure par seconde, écrite par morceaux de 30 s. */
class Recorder {
  ride: Ride | null = null
  private seq = 0
  private buf: Sample[] = []
  private passed = 0
  private pts: RoutePoint[] = []
  private still = 0
  private stopped = false

  get active() { return this.ride != null }

  async begin() {
    const lib = getLibrary()
    if (!lib || this.ride) return
    const c = rideState(), now = Date.now()
    const rb = useLibrary.getState().current
    const res = useStore.getState().planResult
    let snapshot: Ride['planSnapshot']
    if (!useStore.getState().libre && c.route && res && c.plan) {
      const t0 = new Date(c.plan.start)
      const rows = timeline({ route: c.route, res, points: c.points, marks: c.sections.filter(s => s.mark), start: isNaN(t0.valueOf()) ? null : t0 })
      snapshot = {
        sections: c.sections, points: c.points, base: c.base, plan: c.plan,
        etas: rows.filter(r => r.at).map(r => ({ km: r.km, t: (r.at!.valueOf() - t0.valueOf()) / 1000 })),
      }
    }
    const libre = !snapshot
    this.pts = libre ? [] : c.points.filter(p => !p.gen).sort((a, b) => a.km - b.km)
    this.ride = {
      id: uid() + now.toString(36), kind: libre ? 'libre' : 'roadbook', start: now, end: null,
      name: `${libre ? 'Sortie libre' : rb?.name ?? 'Sortie'} · ${dayName(now)}`,
      roadbookId: libre ? undefined : rb?.id, roadbookName: libre ? undefined : rb?.name,
      planSnapshot: snapshot,
      riderSnapshot: { ftp: effectiveFtp(c.rider), mass: c.rider.mass, cda: c.rider.cda, lthr: effectiveLthr(c.rider), unit: effortUnit(c.rider) },
      summary: null, events: [],
    }
    this.seq = 0; this.passed = 0; this.buf = []; this.still = 0; this.stopped = false
    await lib.saveRide(this.ride)
  }

  /** Reprend une sortie restée ouverte ; renvoie où elle en était. */
  async resume(r: Ride): Promise<{ km: number; moving: number } | null> {
    const lib = getLibrary()
    if (!lib) return null
    const chunks = await lib.chunks(r.id)
    const sum = summarize(chunks)
    this.ride = r; this.seq = chunks.length; this.buf = []; this.still = 0; this.stopped = false
    this.pts = (r.planSnapshot?.points ?? []).filter(p => !p.gen).sort((a, b) => a.km - b.km)
    this.passed = this.pts.filter(p => p.km <= sum.km).length
    useLibrary.setState({ unfinished: null })
    return { km: sum.km, moving: sum.moving }
  }

  event(e: Omit<RideEvent, 't'>) { if (this.ride) this.ride.events.push({ t: Date.now(), ...e }) }

  sample(s: Sample) {
    if (!this.ride) return
    this.buf.push(s)
    if (s.moving) {
      this.still = 0
      if (this.stopped) { this.stopped = false; this.event({ type: 'resume', km: s.km }) }
    } else if (++this.still === STOP_AFTER && !this.stopped) { this.stopped = true; this.event({ type: 'stop', km: s.km }) }
    while (this.passed < this.pts.length && this.pts[this.passed].km <= s.km) { this.event({ type: 'point', km: s.km, ref: this.pts[this.passed].id }); this.passed++ }
    if (this.buf.length >= FLUSH) void this.flush()
  }

  /** Écritures en file : une à la fois, dans l'ordre, pour que la lecture finale voie tout. */
  private queue: Promise<void> = Promise.resolve()

  flush(): Promise<void> {
    const lib = getLibrary(), ride = this.ride
    if (!lib || !ride || !this.buf.length) return this.queue
    const b = this.buf, seq = this.seq++
    this.buf = []
    const f32 = (g: (s: Sample) => number | null) => Float32Array.from(b, s => g(s) ?? NaN)
    const chunk: RideChunk = {
      rideId: ride.id, seq, t: Float64Array.from(b, s => s.t), km: f32(s => s.km), speed: f32(s => s.speed),
      power: f32(s => s.power), hr: f32(s => s.hr), cad: f32(s => s.cad), ele: f32(s => s.ele),
      moving: Uint8Array.from(b, s => (s.moving ? 1 : 0)), tgt: Uint8Array.from(b, s => s.tgt),
    }
    this.queue = this.queue.then(async () => { await lib.appendChunk(chunk); await lib.saveRide(ride) }).catch(() => {})
    return this.queue
  }

  /** Chiffres de la sortie en cours, sans la clore (écran de fin, avant « Enregistrer »). */
  async preview(remindersTotal: number): Promise<{ ride: Ride; summary: RideSummary } | null> {
    if (!this.ride) return null
    await this.flush()
    const summary = await summaryOf(this.ride, remindersTotal)
    return summary ? { ride: { ...this.ride, summary }, summary } : null
  }

  async finish(name: string | undefined, remindersTotal: number) {
    if (!this.ride) return null
    await this.flush()
    const r = await finalize(this.ride, name, remindersTotal)
    this.ride = null
    return r
  }

  async discard() {
    const id = this.ride?.id
    this.ride = null; this.buf = []
    await this.queue
    if (id) await getLibrary()?.removeRide(id)
  }
}

export const recorder = new Recorder()
export const eleAt = (route: { ele: Float32Array; n: number } | null, dMeters: number) =>
  route ? route.ele[Math.min(route.n - 1, Math.max(0, Math.round(dMeters / STEP)))] : null

// Chrome peut être suspendu ou tué en arrière-plan : on écrit ce qui est en attente dès que la page se cache.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void recorder.flush() })
  window.addEventListener('pagehide', () => { void recorder.flush() })
}
