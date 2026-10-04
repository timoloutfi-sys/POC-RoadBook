# Road book – second écran de stratégie vélo

Contexte du projet pour Claude Code. À garder à la racine du dépôt.

## Le produit

Un second écran fixé sur le cintre, en paysage, à côté du GPS. **Le GPS dit où aller, cet écran dit comment courir.** Il exécute une stratégie préparée à l'avance : cibles de puissance selon le terrain, annonces du parcours (eau, dangers, montées), rappels de nutrition, alertes de seuil.

Utilisateur pilote : le porteur du projet, qui prépare la Race Across Paris 500 km (avril 2027). Cible commerciale ensuite : ultra, BRM, triathlon, puis cyclosportive.

Phase actuelle : valider l'usage avec un **téléphone en paysage** comme second écran, avant tout matériel dédié.

## Principes à respecter

- **On ne crée pas de tracé.** Le GPX vient d'ailleurs (Komoot, Ride with GPS, Strava) et n'est jamais modifié. On ne fait que l'annoter.
- **Un écran, un rôle** : pas de navigation, pas de carte de guidage.
- **Alertes de seuil** (puissance, FC, cadence, vitesse) : jamais de bandeau. Les bords de l'écran et le widget concerné se colorent, de l'ambre au rouge au-dessus du seuil, du bleu clair au bleu soutenu en dessous, avec une intensité lissée selon l'écart et des transitions en fondu.
- **Bandeaux** réservés aux infos du parcours et aux rappels, affichés une seule fois (pas de ré-animation au rafraîchissement).
- **Anti-surcharge** : délai de répétition par alerte, plafond horaire pour les alertes de seuil. Les annonces du parcours et les rappels planifiés passent toujours.
- **Le temps de roulage ne compte que quand on avance** : pas d'alerte aux feux.
- Interface en français, tutoiement, nombres au format fr-FR.

## État actuel

Migration en cours du prototype (`legacy/roadbook-poc.html`, gardé comme référence jusqu'à parité) vers **Vite + React + TypeScript**, en PWA, ciblée **Chrome sur Android**. Plan validé, livré en 4 étapes :

1. **Socle** (fait) : React, PWA, mise en ligne GitHub Pages, Impeccable, calculs portés en modules testés. Coquille à 4 onglets, seul Parcours fonctionne.
2. **Navigation et vue de course** (fait) : barre de 4 onglets en bas (Parcours, Plan, Écran, Rouler), profil coureur au premier lancement, écrans de course modulaires et sauvegardés (plusieurs écrans nommés, éditeur par glisser-déposer, aperçu fidèle jour/nuit, watts/cardio), vue de course plein écran paysage avec thème jour/nuit selon le soleil, gestes sur les bandes de 24 px (appui long droite = Fait, glisser = écran suivant, appui long gauche 1,5 s = quitter), alertes et rappels dans l'onglet Écran, Rouler (capteurs, démarrer, répéter la sortie). L'onglet Plan est un emplacement.
3. **Assistant Plan et algorithme** (fait) : une question (Sortie tranquille, Entraînement, Course, temps visé en option), plan immédiat, ajustement du temps par zone par − / +. L'algorithme place les efforts là où chaque watt fait gagner le plus de temps (`secondsPerWatt`), en puissance ou en cardio.
4. **Passe `polish`** et réglages après essai sur le vélo.

L'ancien générateur `computePlan` n'est volontairement pas porté : il est remplacé à l'étape 3. L'analyse par Claude est mise de côté.

## Orientation produit (à lire en premier)

Voir `PRODUCT.md`. L'outil prépare puis fait tenir un plan : **road book** (points, repères, rappels, heures d'arrivée) et **cibles à soi** (base + max en montée + par tronçon). L'algorithme **suggère** (bouton « Suggérer un plan », qui demande l'intention : course/ultra, endurance, tempo, seuil, VO2max, progressive) mais n'applique rien tout seul et ne remplace jamais le travail du coureur ; l'annulation est toujours possible. Onglets : Accueil · Road books (liste, puis Parcours / Cibles / Réglages / Sorties) · Sorties · Écrans. L'Accueil montre la prochaine sortie (dans les 7 jours) ou l'objectif avec son compte à rebours, le bouton Rouler, l'état des capteurs (feuille « Avant de partir »), la dernière sortie. Un road book a un type (sortie ou course) et une date de départ ; l'objectif est une course datée (`goalId`). Une course peut être créée sans GPX : estimation sur un parcours fictif (`route/synthetic.ts`, `strategy/estimate.ts`), sortie libre avec ses cibles tant que le GPX manque. Specs : `docs/SPEC-roadbooks.md`, `docs/SPEC-accueil.md`.

## Architecture

Code dans `src/` :

- `core/` : formats fr-FR, utilitaires, degré de nuit (`nightAmount`, fondu de 15 min).
- `route/` : lecture GPX, rééchantillonnage tous les 50 m, lissage, pentes, montées, boucle démo.
- `physics/` : modèle physique, vitesse pour une puissance, secondes gagnées par watt.
- `strategy/` : profil coureur (FTP et FC seuil facultatives, estimées sinon), zones puissance (7) et cardio (5), correspondance entre les deux, dérive cardiaque, cible à un point donné (`targetAt`, sections > règles de base), lever et coucher du soleil.
- `alerts/` : moteur (`evalRun`) avec la métrique `effort` (puissance si capteur, sinon FC, avec délai de stabilisation), sévérité lissée, plafond horaire, annonces, rappels.
- `sensors/` : décodage des trames Bluetooth (pur, testé) et `SensorHub` (connexion, reconnexion).
- `gps/` : recalage sur le parcours (locale, puis globale au-delà de 150 m).
- `strategy/plan.ts` + `pacing.ts` + `sync.ts` : `computePlan` (4 modes en interne : tranquille, entraînement, course, manuel). Le plan de l'utilisateur est toujours en mode `manuel` (cibles à lui) ; les autres modes alimentent `suggest.ts` (`suggestPlan`, converti en cibles modifiables). Le plan est toujours actif : `startPlanSync` le recalcule et l'applique à chaque changement de parcours, profil ou plan (tranquille par défaut). Toutes les cibles se règlent dans le Plan ; Parcours ne porte que des points et des repères (`Section.mark`, sans cible). Cibles imposées (`plan.imposed`, `Section.locked`) : gardées telles quelles par l'algorithme, prioritaires dans `sectionAt`, compensées en course pour garder la même fatigue. Entraînement : − / + règlent des blocs ; course : on règle l'intensité ou le temps visé, le temps par zone est une conséquence ; manuel : cibles plat/montée/descente sans calcul de stratégie. Course = allure qui minimise le temps pour une puissance normalisée donnée (minimise t·(κ + x⁴) par pente, solveur par bissection), temps visé ou intensité tenable selon la durée. Blocs Z3/Z4/Z5 placés sur les montées régulières, plafonnés (`blockLimit`) ; en cardio pas de Z5. Génère sections, points d'eau, nuit, rappels ; appliqué automatiquement par l'onglet Plan (`applyPlan` remplace ce qui est `gen`/`auto`, le manuel reste).
- `library/` : bibliothèque de road books et de sorties dans IndexedDB (`Db`, `Library`), écarts aux alertes par road book, reprise du travail en cours (`roadBookFromConfig`). Branchée à l’onglet Road books via `library/session.ts` (espace de travail = road book courant, enregistré automatiquement). Spec : `docs/SPEC-roadbooks.md`.
- `ride/scope.ts` : `rideState()`, l’état vu par la sortie, avec les écarts du road book aux alertes et rappels (en sortie libre : ni parcours, ni repères, ni plan, cibles de base par défaut).
- `strategy/timeline.ts` : le road book dans l’ordre du parcours avec l’heure d’arrivée à chaque ligne ; les arrêts prévus (`RoutePoint.stop`) remplacent l’estimation générique des arrêts (`plannedStops` dans `sync.ts`).
- `ride/recorder.ts` : enregistrement des sorties en direct (1 Hz, morceaux de 30 s dans IndexedDB, événements arrêts, passages, rappels), reprise après arrêt de Chrome, écran de fin (`ui/RideEnd.tsx`). `library/summary.ts` calcule les chiffres de la sortie. Les simulations ne sont pas enregistrées.
- `library/analysis.ts` : analyse d’une sortie (road book réalisé, zones réel contre prévu, dérive, courbe) et pastille de conformité ; `ui/SortiesTab.tsx` (liste, détail) et `ui/RideChart.tsx`.
- `ride/progress.ts` : avancement par rapport au plan pour les widgets « prochain arrêt », « écart au plan », « effort vs plan ». `library/gpxExport.ts` : export GPX d’une sortie (positions, FC, cadence, puissance). L’export FIT n’existe pas encore.
- `library/goal.ts` : objectif, prochaine sortie, compte à rebours, cible du bouton Rouler. `ui/HomeTab.tsx` (accueil), `ui/GoalFlow.tsx` (fixer un objectif, nouvelle course), `ui/NoGpx.tsx` (course en attente de son GPX).
- `sim/` : coureur virtuel.
- `storage/` : configuration par défaut (écrans, thème, profil), migration de l'ancien format (`migrateConfig`), gestion des écrans (`screens.ts`), store zustand sauvegardé en localStorage, export et import.
- `ride/` : contrôleur de sortie unique (capteurs + GPS ou coureur virtuel + moteur d'alertes), construction des données des widgets, vibration et bip.
- `ui/` : composants React. `Device` = grille 6 × 3 d'un écran, `widgets.tsx` = les widgets (tailles S, M, L), `RideView` = vue de course et gestes, `ScaledDevice` = aperçu fidèle à 844 px réduit, `device.css` = tons jour/nuit mélangés par `--n`.

Commandes : `npm run dev`, `npm test` (Vitest), `npm run typecheck`, `npm run lint`, `npm run build`. Chaque push lance tests et build, puis publie sur GitHub Pages (`.github/workflows/deploy.yml`).

## Sans capteur de puissance

Le profil coureur a un réglage « Je règle mes cibles en » (watts ou cardio). En cardio, les sections se règlent par zone (Z1 à Z5, sans aucun chiffre) ou par fourchette en bpm, et les listes s'affichent en bpm. Le plan stocke toujours en % de FTP (`units.ts` convertit dans les deux sens via la correspondance zones puissance/cardio).

Le plan reste calculé en puissance (le modèle physique sert à placer les efforts et estimer les temps). La cible affichée bascule en bpm si aucun capteur de puissance n'est connecté. En cardio : pas d'effort de moins de 5 min, alertes après 2 min de stabilisation et 60 s minimum au-dessus du seuil, tolérance haute élargie de 3 bpm par heure (10 max).

## Design et UX : Impeccable

Le skill Impeccable est installé dans `.claude/skills/impeccable` (agents dans `.claude/agents`). `PRODUCT.md` porte la vérité produit. Avant tout écran : `/impeccable shape`, choix de la direction avec l'utilisateur, puis construction ; à la fin de chaque étape : `critique`, `audit`, `polish`, et le détecteur `.claude/skills/impeccable/scripts/impeccable detect --json <cibles>`. Captures au format Android (390 × 844 en portrait, 844 × 390 en paysage).

## Modèle physique et réalisme

C'est le cœur de l'appli : chaque estimation doit être réaliste. Tests de référence dans `physics/reference.test.ts` et `strategy/realism.test.ts`.

- **Forces** (`physics/physics.ts`) : `P·η = [M·g·(sin θ + Crr·cos θ)]·v + ½·ρ·CdA·(v + w)·|v + w|·v`, η = 0,975, Crr 0,005 par défaut (réglable : 0,004 lisse à 0,010 gravel), ρ selon l'altitude et la température, w = vent de face le long de la route.
- **Cinématique** (`physics/kinematics.ts`) : simulation pas à pas avec inertie (élan dans les bosses, masse des roues), plafonds de vitesse en virage (rayon par cercle sur 3 points, v = √(3·r)) et à 65 km/h, freinage anticipé (2,5 m/s²), roue libre progressive entre 45 et 60 km/h.
- **Physiologie** (`strategy/realism.ts`) : intensité tenable selon la durée (1 h 97 %, 4 h 80 %, 24 h 59 % de FTP en NP), puissance réduite en altitude (Bassett : −9 % à 2000 m), plafond par montée selon sa durée (CP + W'/t, W' = 18 kJ) et marge sur la moyenne (+30 à +15 points selon la durée), baisse de 0,5 %/h après 6 h (max −12 %).
- **Durée réelle** : ralentissements de route ouverte +2 %, arrêts estimés (0 jusqu'à 3 h, 4 min/h jusqu'à 8 h, 6 min/h jusqu'à 16 h, 9 min/h au-delà + 30 min par nuit), eau 0,5 L/h à 15 °C (+0,05 L/h par degré), fourchette affichée (CdA ±, Crr ±, forme du jour ±).
- **Calibrage** : le profil calcule le CdA à partir d'une puissance et d'une vitesse mesurées sur le plat (`cdaFromFlat`).
- Repères validés : 200 W, CdA 0,32 → 32–33 km/h ; CLM 300 W, CdA 0,24 → 43 km/h ; Alpe d'Huez à 4 W/kg → 55–62 min ; ultra 500 km, FTP 240 → 19–23 h de roulage, 22–27 h au total.

## Points d'attention

- **Web Bluetooth** : Chrome sur Android uniquement pour le POC. HTTPS obligatoire (GitHub Pages).
- **Analyse du coach** : dans la version publiée sur claude.ai, elle passe par la capacité `sample`, qui n'existe que là. Hors de claude.ai, passer par une petite fonction serveur qui appelle l'API Anthropic. **Ne jamais mettre de clé d'API dans le front.**
- Les recharges d'eau générées sont des rappels de distance, pas des lieux réels.

## Prochaines étapes

Après les 4 étapes ci-dessus :

1. Puissance estimée en montée sans capteur (vitesse + pente).
2. Rejeu d'un vrai fichier `.fit` dans le simulateur, et comparaison plan contre réel.
3. Points d'eau et commerces réels via OpenStreetMap (Overpass), avec horaires.
4. Export d'un parcours FIT annoté pour les GPS classiques.
5. Prototype matériel : carte type ESP32, écran memory LCD, module GPS, batterie, boîtier imprimé en 3D.
