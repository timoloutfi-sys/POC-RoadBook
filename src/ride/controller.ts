import { ackReminder, emit, newRun, type EvalContext, type RunState } from '../alerts/engine'
import { getLibrary } from '../library/session'
import { matchRoute } from '../gps/match'
import { bundleOf } from './bundle'
import { defaultMetricCfg, metricsView } from './metrics'
import { eat, newEngine, tick, type EngineState } from './engine'
import { rideState } from './scope'
import { SENSORS, SensorHub } from '../sensors/ble'
import { avg10, newSim, simStep, type SimParams, type SimState } from '../sim/sim'
import { useStore } from '../storage/store'
import { effectiveFtp, effectiveLthr } from '../strategy/rider'
import { targetAt, type EffortSource } from '../strategy/target'
import { buildData, type WidgetData } from './data'
import { gapOf, nextStopOf, plannedKjAt, type PlanProgress } from './progress'
import { eleAt, recorder } from './recorder'
import { timeline, type TimelineRow } from '../strategy/timeline'
import { signal } from './signal'

export type RideSource = 'live' | 'sim'
export interface SimOptions { speed: number; behavior: number; startKm: number; noPower: boolean }

interface Gps { lat: number | null; lon: number | null; speed: number; acc: number | null; ts: number; tsRaw: number; pos: number; off: boolean; err: string | null }

/** Sortie en cours : capteurs, GPS ou coureur virtuel, moteur d'alertes. Un seul exemplaire pour toute l'appli. */
class Ride {
  src: RideSource = 'live'
  running = false
  hub = new SensorHub()
  eng: EngineState = newEngine(newRun())
  private fixPending: number | null = null
  get live(): RunState { return this.eng.run }
  sim: SimState = newSim()
  simOpts: SimOptions = { speed: 60, behavior: 0.3, startKm: 0, noPower: false }
  gps: Gps = { lat: null, lon: null, speed: 0, acc: null, ts: 0, tsRaw: 0, pos: 0, off: false, err: null }
  private planCache: { res: unknown; rows: TimelineRow[]; etas: { km: number; t: number }[] } | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private watchId: number | null = null
  private wake: WakeLockSentinel | null = null

  /** Mesure qui pilote la cible : puissance si un capteur est connecté, sinon FC. */
  source(): EffortSource {
    const noPower = useStore.getState().rider.hasPower === false
    if (this.src === 'sim') return this.simOpts.noPower || noPower ? 'hr' : 'power'
    if (noPower) return 'hr'
    return !this.hub.connected('power') && this.hub.connected('hr') ? 'hr' : 'power'
  }

  private metricCfg() { const b = bundleOf(rideState()); return defaultMetricCfg(b.ftp, b.lthr, b.mass) }

  private ctx(): EvalContext {
    const c = rideState()
    return { alerts: c.alerts, points: c.points, sections: c.sections, periodic: c.periodic, maxPerHour: c.maxPerHour, source: this.source(), now: performance.now() }
  }

  /** Vrai s'il y a une sortie à reprendre. */
  get hasRide() { return (this.src === 'live' ? this.live.t : this.sim.t) > 0 }
  get run(): RunState { return this.src === 'live' ? this.live : this.sim }

  async start(src: RideSource) {
    const cfg = rideState()
    this.src = src
    this.hub.wheelCirc = cfg.wheel
    this.hub.onLost = k => { if (emit(this.live, this.ctx(), 'critique', `Capteur ${SENSORS[k].n.toLowerCase()} perdu`)) signal('critique') }
    if (src === 'sim') {
      if (!cfg.route) return
      if (this.sim.done || this.sim.t === 0) { this.sim = newSim(); this.sim.d = this.simOpts.startKm * 1000 }
    }
    if (src === 'live' && !recorder.active) await recorder.begin()
    this.running = true
    this.stopTimer()
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }) } catch { /* plein écran refusé */ }
    try { await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape') } catch { /* verrouillage indisponible */ }
    await this.keepAwake()
    if (src === 'live') {
      if (navigator.geolocation && this.watchId == null) {
        this.gps.err = null
        this.watchId = navigator.geolocation.watchPosition(p => this.onPos(p), e => { if (e.code === 1) this.gps.err = 'Accès à la position refusé.' }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 })
      }
      this.timer = setInterval(() => this.tickLive(), 1000)
    } else {
      this.timer = setInterval(() => this.tickSim(), 100)
    }
  }

  stop() {
    this.running = false
    this.stopTimer()
    if (this.watchId != null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null }
    try { this.wake?.release() } catch { /* déjà libéré */ }
    this.wake = null
    try { if (document.fullscreenElement) void document.exitFullscreen() } catch { /* ignoré */ }
    try { screen.orientation?.unlock?.() } catch { /* ignoré */ }
  }

  /** Avancement par rapport au plan (null en sortie libre ou sans plan). */
  private progress(km: number, elapsedS: number): PlanProgress | null {
    const c = rideState(), res = useStore.getState().planResult
    if (!c.route || !res || !c.plan) return null
    if (this.planCache?.res !== res) {
      const t0 = new Date(c.plan.start), ok = !isNaN(t0.valueOf())
      const rows = timeline({ route: c.route, res, points: c.points, marks: c.sections.filter(s => s.mark), start: ok ? t0 : null })
      this.planCache = { res, rows, etas: ok ? rows.filter(r => r.at).map(r => ({ km: r.km, t: (r.at!.valueOf() - t0.valueOf()) / 1000 })) : [] }
    }
    const ftp = effectiveFtp(c.rider)
    return {
      nextStop: nextStopOf(this.planCache.rows, km), gapS: gapOf(this.planCache.etas, km, elapsedS),
      kj: this.src === 'live' && this.source() === 'power' && this.eng.kjSeen ? this.eng.kj : null, kjPlan: plannedKjAt(res, ftp, km),
    }
  }

  /** Rappels affichés pendant la sortie (pour « rappels tenus »). */
  remindersShown() {
    const msgs = new Set(rideState().periodic.map(p => p.msg))
    return this.live.log.filter(l => msgs.has(l.msg)).length
  }

  /** Remet la sortie à zéro ; une sortie enregistrée mais pas close est conservée telle quelle. */
  newRide() {
    if (recorder.active) void recorder.finish(undefined, this.remindersShown()).then(r => { if (r?.summary && (r.summary.moving < 60 || r.summary.km < 0.1)) void getLibrary()?.removeRide(r.id) })
    this.eng = newEngine(newRun(), 0, rideState().route?.total, this.metricCfg()); this.gps.pos = 0
    this.sim = newSim()
  }

  async keepAwake() {
    try { if ('wakeLock' in navigator && document.visibilityState === 'visible') this.wake = await navigator.wakeLock.request('screen') } catch { /* refusé */ }
  }

  private stopTimer() { if (this.timer) clearInterval(this.timer); this.timer = null }

  private onPos(pos: GeolocationPosition) {
    const c = pos.coords, g = this.gps
    let sp = c.speed
    if (sp == null || !isFinite(sp)) sp = 0
    g.speed = g.ts ? g.speed * 0.4 + sp * 0.6 : sp
    g.lat = c.latitude; g.lon = c.longitude; g.acc = c.accuracy; g.ts = performance.now(); g.tsRaw = pos.timestamp; g.err = null
    const route = rideState().route
    if (route) {
      const m = matchRoute(route, c.latitude, c.longitude, g.pos)
      g.off = m.offRoute
      if (!m.offRoute) { g.pos = m.pos; this.fixPending = m.pos }
    }
  }

  private tickLive() {
    const g = this.gps, hub = this.hub, now = performance.now(), st = this.live
    hub.expire(now)
    const route = rideState().route
    const gpsFresh = g.ts > 0 && now - g.ts < 10000
    const sv = hub.vals.spd
    const speed = sv != null ? sv : gpsFresh ? g.speed : 0
    const out = tick(this.eng, bundleOf(rideState()), { power: hub.vals.power ?? null, hr: hub.vals.hr ?? null, cad: hub.vals.cad ?? null, speed, fix: this.fixPending, source: this.source() }, now)
    this.fixPending = null
    out.signals.forEach(signal)
    recorder.sample({
      t: Date.now(), km: st.d / 1000, speed, power: out.power, hr: hub.vals.hr ?? null,
      cad: hub.vals.cad ?? null, ele: eleAt(route, st.d), lat: gpsFresh ? g.lat : null, lon: gpsFresh ? g.lon : null, moving: out.moving, tgt: out.tgt,
    })
  }

  private tickSim() {
    const c = rideState(), route = c.route
    if (!route || this.sim.done) return
    const ftp = effectiveFtp(c.rider), lthr = effectiveLthr(c.rider) ?? Math.round(ftp * 0.7)
    const ctx = this.ctx()
    const P: SimParams = {
      route, body: c.rider, ftp, lthr, behavior: this.simOpts.behavior, ctx,
      targetAt: (d, h) => targetAt(route, c.sections, c.base, ftp, lthr, d, h),
    }
    const n = Math.max(1, Math.round(this.simOpts.speed / 10))
    for (let i = 0; i < n && !this.sim.done; i++) simStep(this.sim, P).forEach(signal)
    if (this.sim.done) emit(this.sim, ctx, 'info', 'Arrivée')
  }

  /** « Fait » : valide le dernier rappel. */
  ack() {
    const ok = ackReminder(this.run, rideState().periodic, performance.now())
    if (ok && this.src === 'live') { const g = rideState().periodic.find(p => p.id === this.live.lastPerId)?.grams; if (g) eat(this.eng, g) }
    if (ok && this.src === 'live') recorder.event({ type: 'reminder', km: this.live.d / 1000, ok: true })
  }

  /** Reprend une sortie restée ouverte après un arrêt de Chrome. */
  async restore(r: import('../library/types').Ride) {
    const at = await recorder.resume(r)
    if (!at) return
    this.eng = newEngine(newRun(), at.km * 1000, rideState().route?.total, this.metricCfg())
    this.live.t = at.moving; this.eng.kj = at.kj; this.eng.kjSeen = at.kj > 0; this.gps.pos = this.live.d
  }

  data(now = new Date()): WidgetData {
    const c = rideState(), st = this.run, source = this.source()
    const banner = st.banner && performance.now() < st.banner.until ? st.banner : null
    if (this.src === 'sim') {
      const s = this.sim
      return buildData({ source, route: c.route, sections: c.sections, points: c.points, periodic: c.periodic, base: c.base, rider: c.rider, run: s, plan: this.progress(s.d / 1000, s.t),
        power: avg10(s.buf, s.p), hr: s.hr, cad: s.cad, speed: s.v * 3.6, vAvg: s.t > 60 ? (s.d / s.t) * 3.6 : 28, hrHist: s.hrHist, now, banner })
    }
    const v = this.hub.vals, g = this.gps, fresh = performance.now() - g.ts < 10000
    const elapsed = recorder.ride ? (Date.now() - recorder.ride.start) / 1000 : st.t
    return buildData({ source, route: c.route, sections: c.sections, points: c.points, periodic: c.periodic, base: c.base, rider: c.rider, run: st, plan: this.progress(st.d / 1000, elapsed),
      power: this.eng.pBuf.length ? avg10(this.eng.pBuf, 0) : null, hr: v.hr, cad: v.cad, speed: (v.spd != null ? v.spd : fresh ? g.speed : 0) * 3.6,
      vAvg: st.t > 60 ? (this.eng.movD / st.t) * 3.6 : 28, hrHist: this.eng.hrHist, now, banner, m: metricsView(this.eng.m, this.eng.cfg, source === 'power', st.t) })
  }

  /** Problème à signaler à l'écran (GPS, parcours), ou null quand tout va bien. */
  warning(): string | null {
    if (this.src === 'sim') return null
    const g = this.gps, age = performance.now() - g.ts
    if (g.err) return 'GPS refusé'
    if (!g.ts) return 'GPS : recherche…'
    if (age > 10000) return this.hub.vals.spd != null ? 'GPS perdu, distance au capteur' : 'GPS : signal perdu'
    return g.off ? 'Hors parcours' : null
  }
}

export const ride = new Ride()
