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
3. **Assistant Plan et algorithme** : une question (Sortie tranquille, Entraînement, Course, temps visé en option), plan immédiat, ajustement du temps par zone par − / +. L'algorithme place les efforts là où chaque watt fait gagner le plus de temps (`secondsPerWatt`), en puissance ou en cardio.
4. **Passe `polish`** et réglages après essai sur le vélo.

L'ancien générateur `computePlan` n'est volontairement pas porté : il est remplacé à l'étape 3. L'analyse par Claude est mise de côté.

## Architecture

Code dans `src/` :

- `core/` : formats fr-FR, utilitaires, degré de nuit (`nightAmount`, fondu de 15 min).
- `route/` : lecture GPX, rééchantillonnage tous les 50 m, lissage, pentes, montées, boucle démo.
- `physics/` : modèle physique, vitesse pour une puissance, secondes gagnées par watt.
- `strategy/` : profil coureur (FTP et FC seuil facultatives, estimées sinon), zones puissance (7) et cardio (5), correspondance entre les deux, dérive cardiaque, cible à un point donné (`targetAt`, sections > règles de base), lever et coucher du soleil.
- `alerts/` : moteur (`evalRun`) avec la métrique `effort` (puissance si capteur, sinon FC, avec délai de stabilisation), sévérité lissée, plafond horaire, annonces, rappels.
- `sensors/` : décodage des trames Bluetooth (pur, testé) et `SensorHub` (connexion, reconnexion).
- `gps/` : recalage sur le parcours (locale, puis globale au-delà de 150 m).
- `sim/` : coureur virtuel.
- `storage/` : configuration par défaut (écrans, thème, profil), migration de l'ancien format (`migrateConfig`), gestion des écrans (`screens.ts`), store zustand sauvegardé en localStorage, export et import.
- `ride/` : contrôleur de sortie unique (capteurs + GPS ou coureur virtuel + moteur d'alertes), construction des données des widgets, vibration et bip.
- `ui/` : composants React. `Device` = grille 6 × 3 d'un écran, `widgets.tsx` = les widgets (tailles S, M, L), `RideView` = vue de course et gestes, `ScaledDevice` = aperçu fidèle à 844 px réduit, `device.css` = tons jour/nuit mélangés par `--n`.

Commandes : `npm run dev`, `npm test` (Vitest), `npm run typecheck`, `npm run lint`, `npm run build`. Chaque push lance tests et build, puis publie sur GitHub Pages (`.github/workflows/deploy.yml`).

## Sans capteur de puissance

Le plan reste calculé en puissance (le modèle physique sert à placer les efforts et estimer les temps). La cible affichée bascule en bpm si aucun capteur de puissance n'est connecté. En cardio : pas d'effort de moins de 5 min, alertes après 2 min de stabilisation et 60 s minimum au-dessus du seuil, tolérance haute élargie de 3 bpm par heure (10 max).

## Design et UX : Impeccable

Le skill Impeccable est installé dans `.claude/skills/impeccable` (agents dans `.claude/agents`). `PRODUCT.md` porte la vérité produit. Avant tout écran : `/impeccable shape`, choix de la direction avec l'utilisateur, puis construction ; à la fin de chaque étape : `critique`, `audit`, `polish`, et le détecteur `.claude/skills/impeccable/scripts/impeccable detect --json <cibles>`. Captures au format Android (390 × 844 en portrait, 844 × 390 en paysage).

## Modèle physique

`P = [M·g·(pente + Crr)·v + 0,5·ρ·CdA·v³] / rendement`, avec ρ = 1,2, rendement = 0,96, Crr = 0,0045. Vitesse plafonnée à 60 km/h dans le générateur. Les paramètres du coureur (FTP, masse, CdA) viennent de la configuration.

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
