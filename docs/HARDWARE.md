# Boîtier vélo (hardware)

Mémoire du chantier matériel. À lire en premier pour toute conversation « hardware ». Le soft est décrit dans `CLAUDE.md` (section « Cible matérielle ») ; ce fichier ne répète pas, il décide.

## Objectif

Un boîtier fixé au cintre, **autonome et sans réseau pendant la sortie** : il affiche les écrans préparés sur le téléphone (mêmes widgets, mêmes alertes), lit les capteurs Bluetooth et le GPS, enregistre la sortie, puis la renvoie au téléphone. Le téléphone prépare tout (GPX, plan, écrans) et envoie un **paquet de sortie** au boîtier avant le départ.

## Contraintes (reprises du soft, à ne pas casser)

- Calculs **incrémentaux, à mémoire bornée**, faisables en virgule fixe : lissages, zones, temps par zone, dans la cible, Punch, endurance, dérive cardiaque, glucides, tour, écart au plan, recalage GPS local, alertes, rappels, enregistrement.
- **Aucun optimiseur ni simulation physique** dans le boîtier : tout ce qui est « prévu » vient du paquet.
- Widgets lisibles **sans animation et avec peu de couleurs** (texte ou forme en plus de la couleur) : écran memory LCD en noir et blanc ou peu de teintes.
- Alertes de seuil : bords et widget qui changent de teinte, jamais de bandeau ; bandeaux réservés aux annonces du parcours et aux rappels (voir `CLAUDE.md`).
- Autonomie visée : **une sortie ultra** (Race Across Paris 500 km, ~25 h) sans recharge, ou recharge possible en roulant. À chiffrer.

## Contrat avec le soft

Le seul point de contact est le **paquet de sortie** : `docs/FORMAT-PAQUET.md` (version actuelle : 1). Le soft ne change pas ce format sans mettre ce document à jour ; le hardware ne dépend d'aucun autre détail du soft.

## Architecture visée (hypothèse de départ, à valider)

| Bloc | Piste | À décider |
|---|---|---|
| Calcul + Bluetooth | ESP32-S3 (BLE 5, Wi‑Fi pour le transfert du paquet) | S3 ou C6 ; mémoire (PSRAM ?) pour le tracé |
| Écran | Memory LCD réflectif (type Sharp, ~2,7" à 4") | taille, résolution, lisibilité au soleil, rétro‑éclairage frontal pour la nuit |
| GPS | module GNSS multi‑constellation (u‑blox, Quectel…) | fréquence (1 Hz suffit), consommation, antenne |
| Énergie | Li‑ion/LiPo + chargeur USB‑C + gestion de charge | capacité pour 25 h, jauge |
| Boîtier | impression 3D, fixation cintre | étanchéité, boutons physiques, montage Garmin‑like |
| Entrées | 2 à 4 boutons physiques (gants, pluie) | remplacent les gestes tactiles du téléphone : Fait, tour, écran suivant, quitter |
| Stockage | flash interne ou microSD | enregistrement 1 Hz sur 25 h, ~quelques Mo |

## Parties de l'appli à transposer sur le boîtier

`ride/engine.ts` (`tick`), `ride/metrics.ts`, `alerts/` (moteur d'alertes), `gps/` (recalage), widgets (`storage/catalog.ts`, `ui/tiles.tsx` pour la logique d'affichage). Ces modules sont écrits « purs » exprès : même entrées, mêmes sorties, côté boîtier en C++.

## Questions ouvertes

1. Quelle taille et quelle technologie d'écran ? (lisibilité plein soleil + nuit)
2. Comment le paquet arrive‑t‑il au boîtier ? (Wi‑Fi local, BLE, câble USB‑C)
3. Quel budget (composants, prototype) et combien d'exemplaires ?
4. Quelles capteurs doivent marcher dès le prototype ? (cardio, puissance, cadence, vitesse)
5. Une carte de développement toute faite pour commencer, ou un circuit sur mesure plus tard ?

## Journal des décisions

(à remplir au fil de l'eau : date, décision, raison)
