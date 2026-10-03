import { cadenceFrom, parseCsc, parseHeartRate, parsePower, speedFrom, type RevSample } from './decode'

export type SensorKind = 'power' | 'hr' | 'cad' | 'spd'
export type SensorState = 'connexion…' | 'connecté' | 'reconnexion…' | 'perdu' | 'échec de connexion'

export const SENSORS: Record<SensorKind, { svc: BluetoothServiceUUID; chr: BluetoothCharacteristicUUID; n: string }> = {
  power: { svc: 'cycling_power', chr: 'cycling_power_measurement', n: 'Puissance' },
  hr: { svc: 'heart_rate', chr: 'heart_rate_measurement', n: 'Cardio' },
  cad: { svc: 'cycling_speed_and_cadence', chr: 'csc_measurement', n: 'Cadence' },
  spd: { svc: 'cycling_speed_and_cadence', chr: 'csc_measurement', n: 'Vitesse' },
}

export interface SensorInfo { name: string; state: SensorState }

/** Dernières valeurs : puissance W, FC bpm, cadence rpm, vitesse m/s. */
export interface Readings { power: number | null; hr: number | null; cad: number | null; spd: number | null }

export const bluetoothAvailable = () => typeof navigator !== 'undefined' && !!navigator.bluetooth && window.isSecureContext

/** Gère les capteurs Bluetooth : connexion, reconnexion automatique, décodage. */
export class SensorHub {
  vals: Readings = { power: null, hr: null, cad: null, spd: null }
  ts: Record<SensorKind, number> = { power: 0, hr: 0, cad: 0, spd: 0 }
  sensors: Partial<Record<SensorKind, SensorInfo & { dev: BluetoothDevice; manual: boolean }>> = {}
  wheelCirc = 2146
  private crank: Partial<Record<string, RevSample>> = {}
  private wheel: Partial<Record<string, RevSample>> = {}
  private crankSeen = false
  private wheelSeen = false
  onChange: () => void = () => {}
  onLost: (k: SensorKind) => void = () => {}

  connected = (k: SensorKind) => this.sensors[k]?.state === 'connecté'

  /**
   * `all` : liste tous les appareils Bluetooth à portée, par leur nom. Utile quand un capteur
   * n'annonce pas son type (le filtre normal le cache). On choisit alors l'appareil à la main.
   */
  async connect(kind: SensorKind, all = false) {
    if (!navigator.bluetooth) throw new Error('Bluetooth indisponible : utilise Chrome sur Android.')
    const dev = await navigator.bluetooth.requestDevice(all
      ? { acceptAllDevices: true, optionalServices: ['cycling_power', 'heart_rate', 'cycling_speed_and_cadence'] }
      : { filters: [{ services: [SENSORS[kind].svc] }] })
    const prev = this.sensors[kind]
    if (prev && prev.dev !== dev) this.disconnect(kind)
    this.sensors[kind] = { dev, name: dev.name || SENSORS[kind].n, state: 'connexion…', manual: false }
    this.onChange()
    dev.addEventListener('gattserverdisconnected', () => this.reconnect(kind, dev))
    try { await this.attach(kind) }
    catch (e) { const s = this.sensors[kind]; if (s) s.state = 'échec de connexion'; this.onChange(); throw e }
  }

  private async attach(kind: SensorKind) {
    const s = this.sensors[kind]!
    const srv = await s.dev.gatt!.connect()
    const ch = await (await srv.getPrimaryService(SENSORS[kind].svc)).getCharacteristic(SENSORS[kind].chr)
    ch.addEventListener('characteristicvaluechanged', e => this.onData(kind, (e.target as BluetoothRemoteGATTCharacteristic).value!))
    await ch.startNotifications()
    s.state = 'connecté'
    this.onChange()
  }

  private async reconnect(kind: SensorKind, dev: BluetoothDevice) {
    const s = this.sensors[kind]
    if (!s || s.manual || s.dev !== dev) return
    s.state = 'reconnexion…'
    this.onChange()
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 1500 * (i + 1)))
      if (!this.sensors[kind] || this.sensors[kind]!.manual) return
      try { await this.attach(kind); return } catch { /* nouvel essai */ }
    }
    s.state = 'perdu'
    this.onChange()
    this.onLost(kind)
  }

  disconnect(kind: SensorKind) {
    const s = this.sensors[kind]
    if (!s) return
    s.manual = true
    try { if (s.dev.gatt?.connected) s.dev.gatt.disconnect() } catch { /* déjà déconnecté */ }
    delete this.sensors[kind]
    this.vals[kind] = null
    this.onChange()
  }

  private onData(kind: SensorKind, dv: DataView) {
    const now = performance.now()
    try {
      if (kind === 'hr') { this.vals.hr = parseHeartRate(dv); this.ts.hr = now }
      else if (kind === 'power') {
        const r = parsePower(dv)
        this.vals.power = r.power; this.ts.power = now
        if (r.crank) this.onCrank('power', r.crank, now)
      } else {
        const r = parseCsc(dv)
        if (r.wheel) this.onWheel(kind, r.wheel, now)
        if (r.crank) this.onCrank('cad', r.crank, now)
      }
    } catch { /* trame tronquée : ignorée */ }
  }

  private onCrank(src: string, cur: RevSample, now: number) {
    this.crankSeen = true
    const prev = this.crank[src]
    if (prev && cur.revs !== prev.revs) {
      const c = cadenceFrom(prev, cur)
      if (c != null) { this.vals.cad = c; this.ts.cad = now }
    }
    if (!prev || cur.revs !== prev.revs) this.crank[src] = cur
  }

  private onWheel(src: string, cur: RevSample, now: number) {
    this.wheelSeen = true
    const prev = this.wheel[src]
    if (prev && cur.revs !== prev.revs) {
      const v = speedFrom(prev, cur, this.wheelCirc)
      if (v != null) { this.vals.spd = v; this.ts.spd = now }
    }
    if (!prev || cur.revs !== prev.revs) this.wheel[src] = cur
  }

  /** À appeler chaque seconde : remet à zéro les valeurs périmées (arrêt, capteur muet). */
  expire(now = performance.now()) {
    if (now - this.ts.power > 4000) this.vals.power = this.connected('power') ? 0 : null
    if (now - this.ts.hr > 6000) this.vals.hr = null
    if (now - this.ts.cad > 3000) this.vals.cad = (this.connected('cad') || this.connected('power')) && this.crankSeen ? 0 : null
    if (now - this.ts.spd > 3000) this.vals.spd = (this.connected('spd') || this.connected('cad')) && this.wheelSeen ? 0 : null
  }
}
