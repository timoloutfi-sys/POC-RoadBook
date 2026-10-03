/** Petit accès à IndexedDB : un magasin par type de donnée, clés en texte. */
export const STORES = ['roadbooks', 'routes', 'rides', 'chunks'] as const
export type StoreName = (typeof STORES)[number]

const wrap = <T>(r: IDBRequest<T>) => new Promise<T>((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error) })

export class Db {
  private db: IDBDatabase
  private constructor(db: IDBDatabase) { this.db = db }

  static open(name = 'roadbook'): Promise<Db> {
    return new Promise((ok, ko) => {
      const req = indexedDB.open(name, 1)
      req.onupgradeneeded = () => {
        for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s)
      }
      req.onsuccess = () => ok(new Db(req.result))
      req.onerror = () => ko(req.error)
    })
  }

  private st(s: StoreName, mode: IDBTransactionMode) { return this.db.transaction(s, mode).objectStore(s) }
  get<T>(s: StoreName, key: string): Promise<T | undefined> { return wrap(this.st(s, 'readonly').get(key)) }
  put(s: StoreName, key: string, value: unknown) { return wrap(this.st(s, 'readwrite').put(value, key)).then(() => undefined) }
  del(s: StoreName, key: string) { return wrap(this.st(s, 'readwrite').delete(key)).then(() => undefined) }
  all<T>(s: StoreName): Promise<T[]> { return wrap(this.st(s, 'readonly').getAll() as IDBRequest<T[]>) }
  /** Supprime toutes les clés qui commencent par `prefix` (ex. les morceaux d'une sortie). */
  delPrefix(s: StoreName, prefix: string) {
    return wrap(this.st(s, 'readwrite').delete(IDBKeyRange.bound(prefix, prefix + '￿'))).then(() => undefined)
  }
  allPrefix<T>(s: StoreName, prefix: string): Promise<T[]> {
    return wrap(this.st(s, 'readonly').getAll(IDBKeyRange.bound(prefix, prefix + '￿')) as IDBRequest<T[]>)
  }
}

/** Demande à Android de ne pas vider les données quand la place manque. */
export async function requestPersist() {
  try { await navigator.storage?.persist?.() } catch { /* non disponible */ }
}
