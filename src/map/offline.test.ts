import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { resolve } from './offline'

describe('carte : adresses rbk://', () => {
  it('une tuile annulée (la carte a bougé) échoue au lieu de revenir vide : sinon elle reste blanche', async () => {
    const ctl = new AbortController()
    vi.stubGlobal('fetch', vi.fn(async (_u: string, o?: { signal?: AbortSignal }) => {
      ctl.abort()
      if (o?.signal?.aborted) throw new DOMException('Annulé', 'AbortError')
      return new Response('{}')
    }))
    await expect(resolve('rbk://t/14/8299/5636', ctl.signal)).rejects.toThrow()
    vi.unstubAllGlobals()
  })
  it('sans réseau ni carte enregistrée : tuile vide, sans erreur', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('hors ligne') }))
    const b = await resolve('rbk://t/14/1/1')
    expect(b instanceof ArrayBuffer && b.byteLength).toBe(0)
    vi.unstubAllGlobals()
  })
})
