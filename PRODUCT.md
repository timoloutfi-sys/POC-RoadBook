# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

PWA mobile, ciblée Chrome sur Android. Pas d'adaptation iPhone pour le POC.

## Stack

Vite + React + TypeScript, PWA (vite-plugin-pwa), tests Vitest, hébergement GitHub Pages (HTTPS requis par Web Bluetooth). Choix validé par l'utilisateur.

## Users

- **Pilote principal** : le porteur du projet, cycliste d'ultra qui prépare la Race Across Paris 500 km (avril 2027).
- **Testeurs du POC** : quelques cyclistes (ultra, BRM, triathlon) qui testent aussi l'application.
- Cible commerciale ultérieure : ultra, BRM, triathlon, puis cyclosportive.

Deux situations d'usage très différentes :
1. **Préparation** (à la maison, téléphone en portrait) : importer un GPX, construire la stratégie, régler l'écran de course.
2. **Course** (téléphone fixé sur le cintre, en paysage, à côté du GPS) : lire la cible et les annonces d'un coup d'œil, sans manipuler.

## Product Purpose

Un second écran de stratégie vélo, pour les longues sorties et les courses. **Le GPS dit où aller, cet écran dit comment courir.**

L'outil sert à **préparer puis tenir un plan** :
1. **En amont** : on construit son **road book** (points d'eau, ravitos, dangers, repères, rappels de nutrition, nuit) et ses **cibles** (une cible de base, un maximum plus haut en montée, des cibles par tronçon), seul ou avec une suggestion. Le modèle physique estime durée, heures d'arrivée et nuit à partir de ces cibles.
2. **Pendant la sortie** : l'écran déroule le road book au bon moment, dit **où l'on en est par rapport au plan** (avance, retard, effort cumulé, FC ou puissance dans la cible) pour ne pas se cramer ni prendre du retard.

Succès du POC : valider l'usage d'un téléphone en paysage comme second écran sur de vraies sorties, avant tout matériel dédié.

## Positioning

Les compteurs (Garmin, Wahoo, Bryton, Karoo) donnent des alertes et des cibles dans une petite fenêtre pensée pour la carte ; Best Bike Split et TrainingPeaks calculent des plans ; Komoot et Ride with GPS font la navigation. Aucun ne déroule **ton road book personnel et ton plan** sur un grand écran lisible, avec la logistique d'une longue distance (heures d'arrivée aux arrêts, nuit, avance ou retard sur le plan). L'outil est **flexible** : on peut tout régler soi-même, ou se faire suggérer un plan puis le retoucher. **L'algorithme suggère, il n'impose jamais.**

## Operating Context

- Le GPX vient d'ailleurs (Komoot, Ride with GPS, Strava) et n'est **jamais modifié** : on l'annote seulement.
- Un écran, un rôle : pas de navigation ni de carte de guidage.
- Capteurs Bluetooth : puissance (0x1818), cardio (0x180D), vitesse et cadence (0x1816). Le GPS du téléphone recale la position sur le parcours.
- Sorties très longues (jusqu'à 500 km, jour et nuit) : batterie externe, écran maintenu allumé.

## Capabilities and Constraints

- Fonctionne **avec ou sans capteur de puissance** : sans, la cible bascule en fréquence cardiaque et zones FC.
- **Alertes de seuil** : jamais de bandeau. Les bords de l'écran et le widget concerné se colorent (ambre → rouge au-dessus, bleu clair → bleu soutenu en dessous), intensité lissée, transitions en fondu.
- **Bandeaux** réservés aux annonces du parcours et aux rappels, affichés une seule fois.
- **Anti-surcharge** : délai de répétition par alerte, plafond horaire pour les alertes de seuil ; annonces du parcours et rappels planifiés passent toujours.
- Le temps de roulage ne compte que quand on avance.
- Pas de clé d'API dans le front. L'analyse par Claude est mise de côté pour l'instant.
- Les recharges d'eau générées sont des rappels de distance, pas des lieux réels.

## Brand Commitments

- Nom provisoire : **Road book** (peut changer).
- Interface en français, tutoiement, nombres au format fr-FR.

## Evidence on Hand

- Prototype fonctionnel d'origine : `legacy/roadbook-poc.html`.
- Aucun témoignage, chiffre d'usage ou client réel : ne pas en inventer.

## Product Principles

1. **Lisible à bout de bras** : en course, une information principale par zone, grands chiffres, aucun geste fin.
2. **Simple par défaut, précis sur demande** : cibles de base en trois lignes, détails repliés ; le coureur garde la main, la suggestion est un point de départ.
3. **Un plan qui se tient** : tout est pensé pour savoir en course où l'on en est par rapport au plan.
4. **Ne jamais distraire** : l'écran signale par la couleur, ne parle que quand c'est utile.
5. **Le parcours appartient au coureur** : on annote, on ne trace pas.

## Accessibility & Inclusion

Lisible en course dans des conditions difficiles, confirmées par l'utilisateur :
- **Plein soleil** : contraste maximal.
- **Nuit** : pas d'éblouissement, thème sombre.
- **Gants et pluie** : grandes cibles tactiles, aucun geste fin pendant la sortie.
