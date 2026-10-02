import { ackReminder, emit, evalRun, newRun, smoothSev, type EvalContext, type RunState } from '../alerts/engine'
import { matchRoute } from '../gps/match'
import { STEP } from '../route/route'
import { SENSORS, SensorHub } from '../sensors/ble'
import { avg10, newSim, simStep, type SimParams, type SimState } from '../sim/sim'
import { useStore } from '../storage/store'
import { effectiveFtp, effectiveLthr } from '../strategy/rider'
import { targetAt, type EffortSource } from '../strategy/target'
import { buildData, type WidgetData } from './data'
import { signal } from './signal'

export type RideSource = 'live' | 'sim'
export interface SimOptions { speed: number; behavior: number; startKm: number; noPower: boolean }

interface Gps { lat: number | null; lon: number | null; speed: number; acc: number | null; ts: number; tsRaw: number; idx: number; off: boolean; err: string | null }

/** Sortie en cours : capteurs, GPS ou coureur virtuel, moteur d'alertes. Un seul exemplaire pour toute l'appli. */
class Ride {
  src: RideSource = 'live'
  running = false
  hub = new SensorHub()
  live: RunState = newRun()
  sim: SimState = newSim()
  simOpts: SimOptions = { speed: 60, behavior: 0.3, startKm: 0, noPower: false }
  gps: Gps = { lat: null, lon: null, speed: 0, acc: null, ts: 0, tsRaw: 0, idx: 0, off: false, err: null }
  private pBuf: number[] = []
  private movD = 0
  private hrHist: number[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private watchId: number | null = null
  private wake: WakeLockSentinel | null = null

  /** Mesure qui pilote la cible : puissance si un capteur est connecté, sinon FC. */
  source(): EffortSource {
    if (this.src === 'sim') return this.simOpts.noPower ? 'hr' : 'power'
    return !this.hub.connected('power') && this.hub.connected('hr') ? 'hr' : 'power'
  }

  private ctx(): EvalContext {
    const c = useStore.getState()
    return { alerts: c.alerts, points: c.points, sections: c.sections, periodic: c.periodic, maxPerHour: c.maxPerHour, source: this.source(), now: performance.now() }
  }

  /** Vrai s'il y a une sortie à reprendre. */
  get hasRide() { return (this.src === 'live' ? this.live.t : this.sim.t) > 0 }
  get run(): RunState { return this.src === 'live' ? this.live : this.sim }

  async start(src: RideSource) {
    const cfg = useStore.getState()
    this.src = src
    this.hub.wheelCirc = cfg.wheel
    this.hub.onLost = k => { if (emit(this.live, this.ctx(), 'critique', `Capteur ${SENSORS[k].n.toLowerCase()} perdu`)) signal('critique') }
    if (src === 'sim') {
      if (!cfg.route) return
      if (this.sim.done || this.sim.t === 0) { this.sim = newSim(); this.sim.d = this.simOpts.startKm * 1000 }
    }
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

  newRide() {
    this.live = newRun(); this.gps.idx = 0; this.pBuf = []; this.movD = 0; this.hrHist = []
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
    const route = useStore.getState().route
    if (route) {
      const m = matchRoute(route, c.latitude, c.longitude, g.idx)
      g.off = m.off
      if (!m.off) { g.idx = m.idx; this.live.d = m.idx * STEP }
    }
  }

  private tickLive() {
    const st = this.live, g = this.gps, hub = this.hub, now = performance.now()
    hub.expire(now)
    const route = useStore.getState().route
    const gpsFresh = g.ts > 0 && now - g.ts < 10000
    const sv = hub.vals.spd
    const speed = sv != null ? sv : gpsFresh ? g.speed : 0
    if (!gpsFresh && sv != null && route) st.d = Math.min(route.total, st.d + sv)
    if (hub.vals.power != null) { this.pBuf.push(hub.vals.power); if (this.pBuf.length > 10) this.pBuf.shift() } else this.pBuf = []
    if (speed > 0.8) {
      st.t++; this.movD += speed
      if (st.t % 5 === 0 && hub.vals.hr != null) { this.hrHist.push(hub.vals.hr); if (this.hrHist.length > 120) this.hrHist.shift() }
      const c = useStore.getState(), ctx = this.ctx()
      const tg = targetAt(route, c.sections, c.base, effectiveFtp(c.rider), effectiveLthr(c.rider), st.d, st.t / 3600)
      const sigs = evalRun(st, ctx, tg, { power: avg10(this.pBuf, NaN) || null, hr: hub.vals.hr, cad: (hub.vals.cad ?? 0) > 0 ? hub.vals.cad : null, speed: speed * 3.6 })
      sigs.forEach(signal)
    } else smoothSev(st, {})
  }

  private tickSim() {
    const c = useStore.getState(), route = c.route
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
  ack() { ackReminder(this.run, useStore.getState().periodic, performance.now()) }

  data(now = new Date()): WidgetData {
    const c = useStore.getState(), st = this.run, source = this.source()
    const banner = st.banner && performance.now() < st.banner.until ? st.banner : null
    if (this.src === 'sim') {
      const s = this.sim
      return buildData({ source, route: c.route, sections: c.sections, points: c.points, periodic: c.periodic, base: c.base, rider: c.rider, run: s,
        power: avg10(s.buf, s.p), hr: s.hr, cad: s.cad, speed: s.v * 3.6, vAvg: s.t > 60 ? (s.d / s.t) * 3.6 : 28, hrHist: s.hrHist, now, banner })
    }
    const v = this.hub.vals, g = this.gps, fresh = performance.now() - g.ts < 10000
    return buildData({ source, route: c.route, sections: c.sections, points: c.points, periodic: c.periodic, base: c.base, rider: c.rider, run: st,
      power: this.pBuf.length ? avg10(this.pBuf, 0) : null, hr: v.hr, cad: v.cad, speed: (v.spd != null ? v.spd : fresh ? g.speed : 0) * 3.6,
      vAvg: st.t > 60 ? (this.movD / st.t) * 3.6 : 28, hrHist: this.hrHist, now, banner })
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
