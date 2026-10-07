// Captures de référence au format Android, dans shots/ (non versionné) : à regarder avant de montrer un changement.
// Usage : npm run shots            npm run shots -- widgets   (seulement les captures dont le nom contient « widgets »)
import { mkdirSync } from 'node:fs'
import { launch, open, phone, startServer, tab } from './lib.mjs'

const filter = process.argv[2]
mkdirSync('shots', { recursive: true })
const srv = await startServer(), browser = await launch()
const root = srv.url.replace(/POC-RoadBook\/$/, 'POC-RoadBook/')
const jobs = []
const shot = (name, fn, opts) => jobs.push({ name, fn, opts })

for (const t of ['course', 'entrainement', 'libre']) {
  shot(`ecran-${t}-paysage-nuit`, p => p.goto(`${root}gallery.html?t=${t}&n=1`), { landscape: true })
  shot(`ecran-${t}-paysage-jour`, p => p.goto(`${root}gallery.html?t=${t}&n=0`), { landscape: true })
  shot(`ecran-${t}-portrait`, p => p.goto(`${root}gallery.html?t=${t}&p=1`))
}
// Widgets par famille, chacun à toutes ses tailles autorisées (fenêtre large).
const FAM = { effort: 'effort,hr,target', zones: 'zone,zones,intarget', reserves: 'drift,punch,endurance,reserve', nutrition: 'carbs,carbgap,fuel,sumfuel', relief: 'profile,climb', points: 'next', valeur: 'gap,cad,speed,slope,dist,time,clock,arrival,sunset', synthese: 'sumeffort,sumroute,lap' }
for (const [f, k] of Object.entries(FAM)) shot(`widgets-${f}`, p => p.goto(`${root}gallery.html?v=widgets&k=${k}`), { full: true, viewport: { width: 1300, height: 600 } })
shot('widgets-points-notes', p => p.goto(`${root}gallery.html?v=widgets&k=next&o=content:notes`), { full: true, viewport: { width: 1300, height: 600 } })
shot('widgets-effort-cardio', p => p.goto(`${root}gallery.html?v=widgets&k=effort,hr,target&src=hr`), { full: true, viewport: { width: 1300, height: 600 } })
for (const t of ['Accueil', 'Road books', 'Sorties', 'Écrans']) shot(`appli-${t.replace(' ', '-').toLowerCase()}`, async p => { await open(p, srv.url); await tab(p, t) })
shot('appli-roadbooks-carte', async p => { await open(p, srv.url); await tab(p, 'Road books'); await p.getByText('Essayer avec la boucle démo').tap(); await p.waitForTimeout(200); await p.getByRole('button', { name: 'Créer' }).tap(); await p.waitForTimeout(1200); await p.getByRole('button', { name: 'Retour' }).tap(); await p.waitForTimeout(400) })
shot('appli-repere-profil', async p => { await open(p, srv.url); await tab(p, 'Road books'); await p.getByText('Essayer avec la boucle démo').tap(); await p.waitForTimeout(200); await p.getByRole('button', { name: 'Créer' }).tap(); await p.waitForTimeout(1200); await p.getByRole('button', { name: /Repère/ }).tap(); await p.waitForTimeout(400); const b = await p.locator('svg.pick').boundingBox(); await p.touchscreen.tap(b.x + b.width * 0.47, b.y + 40); await p.waitForTimeout(300) })
shot('appli-cibles', async p => { await open(p, srv.url); await tab(p, 'Road books'); await p.getByText('Essayer avec la boucle démo').tap(); await p.waitForTimeout(200); await p.getByRole('button', { name: 'Créer' }).tap(); await p.waitForTimeout(1200); await p.getByRole('tab', { name: 'Plan' }).tap(); await p.waitForTimeout(500) }, { full: true })
shot('appli-sortie-portrait', async p => { await open(p, srv.url); await tab(p, 'Road books'); await p.getByText('Essayer avec la boucle démo').tap(); await p.waitForTimeout(200); await p.getByRole('button', { name: 'Créer' }).tap(); await p.waitForTimeout(1200); await tab(p, 'Accueil'); await p.getByRole('button', { name: 'Sortie libre', exact: true }).tap(); await p.waitForTimeout(800) })
shot('appli-sortie-paysage', async p => { await open(p, srv.url); await tab(p, 'Road books'); await p.getByText('Essayer avec la boucle démo').tap(); await p.waitForTimeout(200); await p.getByRole('button', { name: 'Créer' }).tap(); await p.waitForTimeout(1200); await tab(p, 'Accueil'); await p.getByRole('button', { name: 'Sortie libre', exact: true }).tap(); await p.waitForTimeout(800) }, { landscape: true })
shot('appli-accueil-rouler', async p => { await open(p, srv.url); await tab(p, 'Road books'); await p.getByText('Essayer avec la boucle démo').tap(); await p.waitForTimeout(200); await p.getByRole('button', { name: 'Créer' }).tap(); await p.waitForTimeout(1200); await tab(p, 'Accueil') })
shot('appli-editeur', async p => { await open(p, srv.url); await tab(p, 'Écrans'); await p.locator('.scr').first().tap(); await p.waitForTimeout(300); await p.locator('.edit-dev .wg').first().tap() })
shot('appli-catalogue', async p => { await open(p, srv.url); await tab(p, 'Écrans'); await p.locator('.scr').first().tap(); await p.waitForTimeout(300); await p.getByRole('button', { name: 'Widget', exact: true }).tap() })
shot('appli-catalogue-famille', async p => { await open(p, srv.url); await tab(p, 'Écrans'); await p.locator('.scr').first().tap(); await p.waitForTimeout(300); await p.getByRole('button', { name: 'Widget', exact: true }).tap(); await p.waitForTimeout(400); await p.locator('.fam').first().tap() })

for (const j of jobs.filter(j => !filter || j.name.includes(filter))) {
  const p = await phone(browser, { landscape: j.opts?.landscape, viewport: j.opts?.viewport })
  await j.fn(p); await p.waitForTimeout(700)
  await p.screenshot({ path: `shots/${j.name}.png`, fullPage: !!j.opts?.full })
  if (p.errors.length) console.log(`! ${j.name} : ${p.errors[0]}`)
  await p.context().close()
}
await browser.close(); await srv.close()
console.log(`${jobs.length} captures dans shots/`)
