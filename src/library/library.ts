import { deserializeRoute, serializeRoute, type Route } from '../route/route'
import type { Db } from './db'
import { metaOf } from './roadbooks'
import type { Ride, RideChunk, RoadBook, RoadBookMeta } from './types'

type StoredRoute = ReturnType<typeof serializeRoute>
interface Entry { rb: RoadBook; meta: RoadBookMeta }

const chunkKey = (rideId: string, seq: number) => `${rideId}:${String(seq).padStart(6, '0')}`

/** Road books et sorties enregistrés dans IndexedDB. */
export class Library {
  private db: Db
  constructor(db: Db) { this.db = db }

  /** Enregistre un road book ; le tracé n'est réécrit que s'il est fourni. */
  async saveRoadBook(rb: RoadBook, route?: Route | null, estH: number | null = null) {
    const prev = await this.db.get<Entry>('roadbooks', rb.id)
    const r = route === undefined ? await this.getRoute(rb.id) : route
    const next = { ...rb, updated: Date.now() }
    await this.db.put('roadbooks', rb.id, { rb: next, meta: metaOf(next, r, estH ?? prev?.meta.estH ?? null) } satisfies Entry)
    if (route) await this.db.put('routes', rb.id, serializeRoute(route))
    else if (route === null) await this.db.del('routes', rb.id)
    return next
  }

  async getRoadBook(id: string): Promise<RoadBook | undefined> { return (await this.db.get<Entry>('roadbooks', id))?.rb }

  async getRoute(id: string): Promise<Route | null> {
    const d = await this.db.get<StoredRoute>('routes', id)
    return d ? deserializeRoute(d) : null
  }

  /** Les plus récemment modifiés d'abord. */
  async list(): Promise<RoadBookMeta[]> {
    return (await this.db.all<Entry>('roadbooks')).map(e => e.meta).sort((a, b) => b.updated - a.updated)
  }

  /** Les sorties déjà faites restent : elles gardent leur copie du plan. */
  async removeRoadBook(id: string) {
    await this.db.del('roadbooks', id)
    await this.db.del('routes', id)
  }

  async saveRide(r: Ride) { await this.db.put('rides', r.id, r) }
  async getRide(id: string) { return this.db.get<Ride>('rides', id) }

  async listRides(roadbookId?: string): Promise<Ride[]> {
    const all = await this.db.all<Ride>('rides')
    return all.filter(r => !roadbookId || r.roadbookId === roadbookId).sort((a, b) => b.start - a.start)
  }

  async appendChunk(c: RideChunk) { await this.db.put('chunks', chunkKey(c.rideId, c.seq), c) }
  async chunks(rideId: string) { return this.db.allPrefix<RideChunk>('chunks', `${rideId}:`) }

  async removeRide(id: string) {
    await this.db.del('rides', id)
    await this.db.delPrefix('chunks', `${id}:`)
  }
}
