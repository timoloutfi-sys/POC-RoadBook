import type { Track } from '../route/track'
import { corridorTiles } from './corridor'

/**
 * Carte hors ligne : le couloir du parcours (tuiles OpenFreeMap), le style épuré, ses icônes et ses polices,
 * enregistrés sur le téléphone dans une base à part (`roadbook-maps`). Rien n'y dépend de MapLibre.
 */

const OFM = 'https://tiles.openfreemap.org'
export const STYLES = { day: `${OFM}/styles/liberty`, night: `${OFM}/styles/dark` } as const
export type MapTone = keyof typeof STYLES
const RANGES = ['0-255', '256-511', '8192-8447']
const SPRITE_FILES = ['.json', '.png', '@2x.json', '@2x.png']

/** Ce qu'on garde de la carte : routes, eau, verdure, noms de rues et de lieux ; ni commerces, ni bâtiments, ni transports. */
const HIDE = /poi|building|transit|aerodrome|aeroway|housenumber|bus|rail|ferry|boundary|shield|oneway|bridge_pattern|tunnel_pattern/i
const KEEP_LABEL = /^(highway[-_]name|road[-_]label|water[-_]name|place[-_](city|town|village|suburb))/i

/** Carte enregistrée pour un road book. */
export interface MapPack { id: string; keys: string[]; bytes: number; at: number; sig: string; missing: number }
export interface Progress { done: number; total: number; bytes: number }

// ——— Base IndexedDB ———
const STORES = ['tiles', 'assets', 'packs'] as const
type Store = (typeof STORES)[number]
const wrap = <T>(r: IDBRequest<T>) => new Promise<T>((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error) })
let dbP: Promise<IDBDatabase> | null = null
function db() {
  dbP ??= new Promise((ok, ko) => {
    const req = indexedDB.open('roadbook-maps', 1)
    req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s) }
    req.onsuccess = () => ok(req.result)
    req.onerror = () => ko(req.error)
  })
  return dbP
}
const st = async (s: Store, mode: IDBTransactionMode) => (await db()).transaction(s, mode).objectStore(s)
export const getItem = async <T>(s: Store, k: string) => wrap((await st(s, 'readonly')).get(k)) as Promise<T | undefined>
const put = async (s: Store, k: string, v: unknown) => { await wrap((await st(s, 'readwrite')).put(v, k)) }
const del = async (s: Store, k: string) => { await wrap((await st(s, 'readwrite')).delete(k)) }
const keysOf = async (s: Store) => (await wrap((await st(s, 'readonly')).getAllKeys())) as string[]

// ——— Style épuré ———
interface Layer { id: string; type: string; source?: string; layout?: Record<string, unknown> }
interface Style { sources: Record<string, unknown>; layers: Layer[]; sprite?: string; glyphs?: string; [k: string]: unknown }

/** Style OpenFreeMap rendu calme, et branché sur le protocole `rbk://` (tuiles, polices, icônes enregistrées). */
export function calmStyle(s: Style): Style {
  const layers = s.layers.filter(l => l.source !== 'ne2_shaded' && !HIDE.test(l.id) && !(l.type === 'symbol' && !KEEP_LABEL.test(l.id)))
  return {
    ...s, layers,
    sources: { openmaptiles: { type: 'vector', tiles: ['rbk://t/{z}/{x}/{y}'], minzoom: 0, maxzoom: 14, attribution: '© OpenStreetMap · OpenFreeMap' } },
    glyphs: 'rbk://g/{fontstack}/{range}', sprite: 'rbk://s/sprite',
  }
}
const fontsOf = (s: Style) => [...new Set(s.layers.flatMap(l => (l.layout?.['text-font'] as string[] | undefined) ?? []))]

interface Meta { tpl: string; sprite: string; glyphs: string; at: number }
const getJson = async <T>(url: string, signal?: AbortSignal) => { const r = await fetch(url, { signal }); if (!r.ok) throw new Error(`${r.status}`); return (await r.json()) as T }
const getBin = async (url: string, signal?: AbortSignal) => { const r = await fetch(url, { signal }); if (!r.ok) throw new Error(`${r.status}`); return r.arrayBuffer() }

/** Adresses du jour (le jeu de tuiles OpenFreeMap change chaque semaine), styles, icônes et polices. */
async function fetchBase(signal?: AbortSignal): Promise<Meta> {
  const tj = await getJson<{ tiles: string[] }>(`${OFM}/planet`, signal)
  const raw = { day: await getJson<Style>(STYLES.day, signal), night: await getJson<Style>(STYLES.night, signal) }
  const meta: Meta = { tpl: tj.tiles[0], sprite: raw.day.sprite!, glyphs: raw.day.glyphs!, at: Date.now() }
  for (const k of ['day', 'night'] as const) await put('assets', `style:${k}`, calmStyle(raw[k]))
  for (const f of SPRITE_FILES) await put('assets', `s/sprite${f}`, await getBin(`${meta.sprite}${f}`, signal))
  const fonts = new Set([...fontsOf(calmStyle(raw.day)), ...fontsOf(calmStyle(raw.night))])
  for (const font of fonts) for (const r of RANGES) await put('assets', `g/${font}/${r}`, await getBin(meta.glyphs.replace('{fontstack}', encodeURIComponent(font)).replace('{range}', r), signal))
  await put('assets', 'meta', meta)
  return meta
}

/** Style de la carte (jour ou nuit) : celui enregistré, sinon téléchargé. */
export async function mapStyle(tone: MapTone): Promise<Style> {
  const s = await getItem<Style>('assets', `style:${tone}`)
  if (s) return s
  await fetchBase()
  return (await getItem<Style>('assets', `style:${tone}`))!
}

const urlOf = (tpl: string, key: string) => { const [z, x, y] = key.split('/'); return tpl.replace('{z}', z).replace('{x}', x).replace('{y}', y) }

/** Contenu d'une adresse `rbk://` : enregistré, sinon le réseau si on en a ; vide sinon (la carte reste blanche à cet endroit). */
export async function resolve(url: string, signal?: AbortSignal): Promise<ArrayBuffer | object> {
  const path = url.replace(/^rbk:\/\//, '')
  const kind = path[0], key = decodeURIComponent(path.slice(2))
  const store: Store = kind === 't' ? 'tiles' : 'assets'
  const k = kind === 't' ? key : path.slice(0, 2) + key
  const hit = await getItem<ArrayBuffer>(store, k)
  const json = k.endsWith('.json')
  if (hit) return json ? JSON.parse(new TextDecoder().decode(hit)) : hit
  try {
    const meta = (await getItem<Meta>('assets', 'meta')) ?? (await fetchBase(signal))
    const net = kind === 't' ? urlOf(meta.tpl, key) : kind === 's' ? meta.sprite + key.replace(/^sprite/, '') : meta.glyphs.replace('{fontstack}', encodeURIComponent(key.split('/')[0])).replace('{range}', key.split('/')[1])
    const b = await getBin(net, signal)
    return json ? JSON.parse(new TextDecoder().decode(b)) : b
  } catch {
    return json ? {} : new ArrayBuffer(0)
  }
}

// ——— Couloir d'un road book ———
/** Signature d'un tracé : la carte est à refaire si le GPX change. */
export const sigOf = (t: Track) => `${t.n}:${Math.round(t.total)}:${t.lat[0].toFixed(5)},${t.lon[0].toFixed(5)}`

/** Taille moyenne d'une tuile du couloir, mesurée sur la boucle démo : 547 tuiles, 23 Mo (pour annoncer la taille avant de télécharger). */
const AVG_TILE = 45 * 1024
export function estimate(t: Track) { const n = corridorTiles(t).length; return { tiles: n, bytes: n * AVG_TILE } }

export const packOf = (id: string) => getItem<MapPack>('packs', id)

/** Télécharge le couloir du parcours (et le style s'il manque) ; reprend là où il s'était arrêté. */
export async function downloadPack(id: string, t: Track, onProgress: (p: Progress) => void, signal?: AbortSignal): Promise<MapPack> {
  const meta = await fetchBase(signal)
  const keys = corridorTiles(t), have = new Set(await keysOf('tiles'))
  const p: Progress = { done: 0, total: keys.length, bytes: 0 }
  let missing = 0
  const queue = [...keys]
  const worker = async () => {
    for (let k = queue.shift(); k; k = queue.shift()) {
      if (signal?.aborted) throw new DOMException('Annulé', 'AbortError')
      if (!have.has(k)) {
        let b: ArrayBuffer | null = null
        for (let a = 0; a < 2 && !b; a++) try { b = await getBin(urlOf(meta.tpl, k), signal) } catch (e) { if (signal?.aborted) throw e }
        if (b) { await put('tiles', k, b); p.bytes += b.byteLength } else missing++
      }
      p.done++
      if (p.done % 10 === 0 || p.done === p.total) onProgress({ ...p })
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  // Tuiles déjà là (autre road book, téléchargement repris) : comptées à la taille moyenne de celles qu'on vient de prendre.
  const got = keys.length - missing, fresh = keys.filter(k => !have.has(k)).length - missing
  const avg = fresh > 0 ? p.bytes / fresh : AVG_TILE
  const pack: MapPack = { id, keys, bytes: Math.round(p.bytes + (got - fresh) * avg), at: Date.now(), sig: sigOf(t), missing }
  await put('packs', id, pack)
  return pack
}

/** Supprime la carte d'un road book : les tuiles que n'utilise aucun autre road book. */
export async function deletePack(id: string) {
  const pack = await packOf(id)
  if (!pack) return
  await del('packs', id)
  const others = new Set<string>()
  for (const k of await keysOf('packs')) (await packOf(k))?.keys.forEach(x => others.add(x))
  for (const k of pack.keys) if (!others.has(k)) await del('tiles', k)
}
