// Tests de bout en bout au doigt, sur un téléphone simulé (390 × 844, tactile).
// Chaque bug remonté sur le téléphone devient un test ici, pour qu'il ne revienne pas.
// Usage : npm run e2e            (tous)      npm run e2e -- catalogue   (ceux dont le nom contient « catalogue »)
import { center, launch, longPress, open, phone, startServer, tab, touchDrag } from './lib.mjs'

const tests = []
const test = (name, fn) => tests.push({ name, fn })
const ok = (cond, msg) => { if (!cond) throw new Error(msg) }

/** Ouvre l'éditeur du premier écran. */
async function editor(p, url) {
  await open(p, url); await tab(p, 'Écrans')
  await p.locator('.scr').first().tap(); await p.waitForTimeout(400)
}
const widgets = p => p.evaluate(() => [...document.querySelectorAll('.edit-dev .wg')].map(w => `${w.getAttribute('aria-label')}@${Math.round(parseFloat(w.style.left) / (100 / 6))},${Math.round(parseFloat(w.style.top) / (100 / 3))}`))

test('pas de défilement horizontal ni de bouton hors écran', async (p, url) => {
  await open(p, url)
  for (const t of ['Accueil', 'Road books', 'Sorties', 'Écrans']) {
    await tab(p, t)
    const bad = await p.evaluate(() => [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1) }).map(b => b.textContent.trim().slice(0, 20)))
    ok(!bad.length, `${t} : boutons hors écran ${bad.join(', ')}`)
  }
  await p.locator('.scr').first().tap(); await p.waitForTimeout(300)
  const r = await p.getByRole('button', { name: 'Annuler', exact: true }).boundingBox()
  ok(r && r.x >= 0, 'éditeur : Annuler hors écran')
})

test('éditeur : aucun texte d’explication', async (p, url) => {
  await editor(p, url)
  const txt = await p.locator('.ed').innerText()
  ok(!/Touche|glisse|Appui long/i.test(txt), `texte d'aide trouvé : ${txt.match(/.*(Touche|glisse|Appui long).*/i)?.[0]}`)
})

test('écrans : appui long → ✕ et ☆ ; toucher ailleurs → sortie, sans bouton OK', async (p, url) => {
  await open(p, url); await tab(p, 'Écrans')
  const c = await center(p.locator('.scr').first())
  await longPress(p, c.x + 80, c.y)
  ok(await p.locator('.scr-star').count() === await p.locator('.scr').count(), 'pas de ☆ sur chaque écran après appui long')
  ok(await p.getByRole('button', { name: 'OK', exact: true }).count() === 0, 'bouton OK présent')
  ok(await p.locator('.ed').count() === 0, 'l’appui long a ouvert l’éditeur')
  await p.touchscreen.tap(195, 760); await p.waitForTimeout(200)
  ok(await p.locator('.scr-star:not(.on)').count() === 0, 'toujours en mode modification')
})

test('éditeur : toucher un widget le sélectionne sans ouvrir les réglages', async (p, url) => {
  await editor(p, url)
  await p.locator('.edit-dev .wg').nth(2).tap(); await p.waitForTimeout(200)
  ok(await p.locator('.wg.sel').count() === 1, 'pas de sélection')
  ok(await p.locator('.sheet').count() === 0, 'réglages ouverts sans les demander')
})

test('éditeur : réglages fermés à côté, puis autre widget → pas de réouverture (bug du 6 oct.)', async (p, url) => {
  await editor(p, url)
  await p.locator('.edit-dev .wg[aria-label="Prochains points"]').tap(); await p.waitForTimeout(200)
  await p.getByRole('button', { name: 'Réglages', exact: true }).tap(); await p.waitForTimeout(300)
  ok(await p.locator('.sheet').count() === 1, 'réglages non ouverts')
  await p.touchscreen.tap(195, 120); await p.waitForTimeout(300)
  await p.locator('.edit-dev .wg').first().tap(); await p.waitForTimeout(300)
  ok(await p.locator('.sheet').count() === 0, 'les réglages se sont rouverts')
})

test('éditeur : toucher ailleurs désélectionne', async (p, url) => {
  await editor(p, url)
  await p.locator('.edit-dev .wg').first().tap(); await p.waitForTimeout(150)
  await p.touchscreen.tap(300, 700); await p.waitForTimeout(150)
  ok(await p.locator('.wg.sel').count() === 0, 'toujours sélectionné')
})

test('éditeur : glisser un widget sur un autre de même taille les échange, ↶ annule d’un coup', async (p, url) => {
  await editor(p, url)
  const before = await widgets(p)
  const a = await center(p.locator('.edit-dev .wg[aria-label="Cadence"]')), b = await center(p.locator('.edit-dev .wg[aria-label="FC"]'))
  await touchDrag(p, a.x, a.y, b.x, b.y)
  const after = await widgets(p)
  ok(after.includes('Cadence@0,2') && after.includes('FC@1,2'), `pas d'échange : ${after.join(' ')}`)
  await p.getByRole('button', { name: 'Annuler le dernier changement' }).tap(); await p.waitForTimeout(300)
  ok(JSON.stringify(await widgets(p)) === JSON.stringify(before), 'annuler ne rétablit pas tout')
})

test('catalogue : famille → taille → widget ajouté, on reste dans l’éditeur (bug « Accueil »)', async (p, url) => {
  await open(p, url); await tab(p, 'Écrans')
  await p.getByRole('button', { name: /Nouvel écran/ }).tap(); await p.waitForTimeout(200)
  await p.getByRole('button', { name: 'Écran vide' }).tap(); await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'Widget', exact: true }).tap(); await p.waitForTimeout(500)
  await p.locator('.fam').first().tap(); await p.waitForTimeout(300)
  const chips = p.locator('.cat-size'), last = chips.nth((await chips.count()) - 1)
  await last.scrollIntoViewIfNeeded(); await last.tap(); await p.waitForTimeout(500)
  ok(await p.locator('.ed').count() === 1, 'sorti de l’éditeur')
  ok(await p.locator('.edit-dev .wg').count() === 1, 'widget non ajouté')
})

test('catalogue : toucher en dehors ferme, « ‹ » revient à la liste', async (p, url) => {
  await editor(p, url)
  await p.getByRole('button', { name: 'Widget', exact: true }).tap(); await p.waitForTimeout(400)
  await p.locator('.fam').first().tap(); await p.waitForTimeout(200)
  await p.getByRole('button', { name: 'Retour' }).tap(); await p.waitForTimeout(200)
  ok(await p.locator('.fam').count() > 1, 'pas revenu à la liste')
  await p.touchscreen.tap(195, 150); await p.waitForTimeout(300)
  ok(await p.locator('.cat-sheet').count() === 0, 'catalogue toujours ouvert')
})

test('road books : boucle démo → carte avec profil', async (p, url) => {
  await open(p, url); await tab(p, 'Road books')
  await p.getByText('Essayer avec la boucle démo').tap(); await p.waitForTimeout(200)
  await p.getByRole('button', { name: 'Créer' }).tap(); await p.waitForTimeout(1200)
  await p.locator('main button').first().tap(); await p.waitForTimeout(500)
  ok(await p.locator('.rb-card .rb-prof').count() === 1, 'pas de profil sur la carte')
})

// ---------------------------------------------------------------------------------------------
const filter = process.argv[2]
const srv = await startServer(), browser = await launch()
let fails = 0
for (const t of tests.filter(t => !filter || t.name.includes(filter))) {
  const p = await phone(browser)
  try {
    await t.fn(p, srv.url)
    if (p.errors.length) throw new Error(`erreur JS : ${p.errors[0]}`)
    console.log(`✓ ${t.name}`)
  } catch (e) {
    fails++
    console.log(`✗ ${t.name}\n    ${e.message.split('\n')[0]}`)
    await p.screenshot({ path: `shots/echec-${t.name.slice(0, 40).replace(/[^\p{L}\p{N}]+/gu, '-')}.png` }).catch(() => {})
  }
  await p.context().close()
}
await browser.close(); await srv.close()
console.log(fails ? `\n${fails} échec(s)` : '\nTout passe.')
process.exit(fails ? 1 : 0)
