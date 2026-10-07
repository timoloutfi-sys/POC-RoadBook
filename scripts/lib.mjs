// Outils communs aux captures et aux tests de bout en bout : serveur Vite, téléphone simulé, premiers pas.
import { createServer } from 'vite'
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

export const BASE = '/POC-RoadBook/'

/** Lance Vite sur un port libre et renvoie son adresse. */
export async function startServer() {
  const server = await createServer({ server: { port: 0, host: '127.0.0.1' }, logLevel: 'error' })
  await server.listen()
  const addr = server.httpServer.address()
  return { url: `http://127.0.0.1:${addr.port}${BASE}`, close: () => server.close() }
}

/** Chromium : celui de l'environnement cloud s'il existe, sinon celui de Playwright (npx playwright install chromium). */
export async function launch() {
  const exe = ['/opt/pw-browsers/chromium/chrome-linux/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(existsSync)
  return chromium.launch(exe ? { executablePath: exe } : {})
}

/** Un téléphone Android en portrait (ou paysage) avec écran tactile. */
export async function phone(browser, { landscape = false, dark = true, viewport = null } = {}) {
  const ctx = await browser.newContext({
    viewport: viewport ?? (landscape ? { width: 844, height: 390 } : { width: 390, height: 844 }),
    deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: dark ? 'dark' : 'light', locale: 'fr-FR',
  })
  const page = await ctx.newPage()
  page.errors = []
  page.on('pageerror', e => page.errors.push(e.message))
  return page
}

/** Ouvre l'appli et passe le profil du premier lancement. */
export async function open(page, url) {
  await page.goto(url)
  await page.getByText('Plus tard').tap({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(300)
}

export const tab = async (page, name) => { await page.locator('nav button', { hasText: name }).first().tap(); await page.waitForTimeout(300) }

/** Centre d'un élément. */
export async function center(loc) {
  const b = await loc.boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, b }
}

/** Appui long au doigt (touch) via le protocole du navigateur. */
export async function longPress(page, x, y, ms = 650) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await page.waitForTimeout(ms)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(200)
}

/** Glisser au doigt de (x1, y1) à (x2, y2), après un appui de `hold` ms. */
export async function touchDrag(page, x1, y1, x2, y2, { hold = 0, steps = 12 } = {}) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] })
  if (hold) await page.waitForTimeout(hold)
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + ((x2 - x1) * i) / steps, y: y1 + ((y2 - y1) * i) / steps }] })
    await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(300)
}
