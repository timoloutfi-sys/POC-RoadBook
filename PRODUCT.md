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

Un second écran de stratégie vélo. **Le GPS dit où aller, cet écran dit comment courir.** Il exécute une stratégie préparée à l'avance : cibles d'effort selon le terrain (puissance, ou fréquence cardiaque sans capteur de puissance), annonces du parcours (eau, dangers, montées), rappels de nutrition, alertes de seuil.

Succès du POC : valider l'usage d'un téléphone en paysage comme second écran sur de vraies sorties, avant tout matériel dédié.

## Positioning

La stratégie est calculée à partir du parcours lui-même : un algorithme place les efforts là où chaque watt fait gagner le plus de temps (montées, portions lentes) et fait récupérer là où il ne rapporte rien (descentes rapides). Le coureur choisit son intention et son temps par zone ; l'outil place les efforts et explique pourquoi.

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
2. **Simple par défaut, précis sur demande** : une question pour démarrer, les réglages experts repliés.
3. **Chaque consigne s'explique** : le plan dit pourquoi un effort est placé à cet endroit.
4. **Ne jamais distraire** : l'écran signale par la couleur, ne parle que quand c'est utile.
5. **Le parcours appartient au coureur** : on annote, on ne trace pas.

## Accessibility & Inclusion

Lisible en course dans des conditions difficiles, confirmées par l'utilisateur :
- **Plein soleil** : contraste maximal.
- **Nuit** : pas d'éblouissement, thème sombre.
- **Gants et pluie** : grandes cibles tactiles, aucun geste fin pendant la sortie.
