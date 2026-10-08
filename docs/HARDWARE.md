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

## Décisions (2026-10-08)

Questions de départ, toutes tranchées avec le porteur du projet (débutant en électronique : on choisit simple, on valide sur table, puis on miniaturise).

| # | Question | Décision | Raison |
|---|---|---|---|
| 1 | Écran | **Memory LCD Sharp 2,7" 400×240**, noir et blanc (LS027B7DH01 ; en prototype, la carte Adafruit 4694) | Lisible plein soleil, quelques mW, prix raisonnable (~45 €). Zone active 58,8 × 35,3 mm, contour 62,8 × 43 mm : boîtier ~8,5 × 6 cm, qui tient sur la partie plate d'un cintre de 42 cm à côté du GPS (`hardware/maquette-cintre.svg`). Le 4,4" (320×240, contour 94,8 × 75,2 mm, ~75 €) est trop large et trop cher pour la v1. Pas de lumière intégrée : éclairage frontal à étudier pour la nuit (hors prototype de table). |
| 2 | Transfert du paquet | **Bluetooth BLE** (le téléphone pousse le paquet, le boîtier renvoie l'enregistrement) | Même technique que les capteurs (Web Bluetooth, Chrome Android), sans câble ni réglage réseau. Débit ~10 à 20 Ko/s, à mesurer : paquet binaire visé < 100 Ko, enregistrement de 25 h ~2 Mo (quelques minutes). L'USB-C sert à charger et programmer. Le Wi‑Fi est écarté (page HTTPS vers un boîtier HTTP local : probablement bloqué, à ne pas tester pour l'instant). |
| 3 | Budget et nombre | **~100 à 150 €, 1 exemplaire** pour le prototype de table | Valider écran, GPS et Bluetooth avant toute dépense de boîtier. Voir « Liste de courses » : le total réaliste, port compris, est plutôt ~140 à 170 €. |
| 4 | Capteurs dès le prototype | **Cardio, puissance, cadence, vitesse** (services BLE standard) | Les quatre sont nécessaires à la course. La vitesse et la cadence peuvent aussi venir du GPS et du capteur de puissance : à comparer en essai. |
| 5 | Carte | **Cartes de développement toutes faites**, reliées par fils et câble ; pas de circuit sur mesure avant validation | Moins risqué pour un débutant. Choix : Adafruit ESP32‑S3 Feather (puce S3, chargeur de batterie intégré, jauge de batterie) + écran + GPS en modules. |

## Liste de courses : prototype de table

Prix indicatifs relevés en octobre 2026 sur les pages des vendeurs : **stocks et prix changent, à vérifier avant de commander**. Hors Union européenne (Adafruit US), il peut s'y ajouter port, TVA et frais de douane.

| Pièce | Référence | Prix approx. | Où | Ce qu'elle permet de tester |
|---|---|---|---|---|
| Carte principale | Adafruit **ESP32‑S3 Feather**, 4 Mo flash, 2 Mo PSRAM (n° 5477) | 17,50 $ (~17 à 30 € selon revendeur) | [Adafruit](https://www.adafruit.com/product/5477) ; en Europe : [The Pi Hut](https://thepihut.com/products/adafruit-esp32-s3-feather-with-4mb-flash-2mb-psram-stemma-qt-qwiic), [Eckstein](https://eckstein-shop.de/Adafruit-ESP32-S3-Feather-with-4MB-Flash-2MB-PSRAM-STEMMA-QT-Qwiic-EN) | Calcul, Bluetooth, charge de la batterie, jauge de batterie. Stock instable (vu « épuisé » chez Adafruit) : une autre carte ESP32‑S3 Feather convient si elle a le Bluetooth et de la PSRAM. |
| Écran | **Adafruit SHARP Memory Display Breakout 2,7" 400×240** (n° 4694) | 44,95 $ (~45 à 55 €) | [Adafruit](https://adafruit.com/product/4694), [The Pi Hut](https://thepihut.com/products/adafruit-sharp-memory-display-breakout-2-7-400x240-monochrome), [OpenCircuit](https://opencircuit.shop/product/adafruit-sharp-memory-display-breakout-2.7) | Lisibilité plein soleil et en intérieur, taille réelle des widgets, vitesse d'affichage (1 Hz). |
| GPS | **Adafruit Mini GPS PA1010D**, I²C/UART, STEMMA QT (n° 4415) | 29,95 $ (~30 €) | [Adafruit](https://www.adafruit.com/product/4415), [The Pi Hut](https://thepihut.com/products/adafruit-mini-gps-pa1010d-uart-and-i2c-stemma-qt) | Position, vitesse, heure ; projection sur un tracé. Se branche sans soudure à la carte. À valider : précision et prise de fix en ville/sous les arbres ; si insuffisant, module u‑blox multi‑constellation. |
| Câble | STEMMA QT / Qwiic, 100 mm | ~1 à 2 € | même vendeur que le GPS | Relie le GPS à la carte, sans soudure. |
| Batterie | LiPo 3,7 V, connecteur JST‑PH 2 broches, **2 000 mAh** (Adafruit n° 2011 ou équivalent) | ~12 € | Adafruit, Pi Hut | Fonctionnement sans USB, charge, première mesure d'autonomie. Vérifier la polarité du connecteur avant de brancher (cf. « Ce que tu dois faire »). |
| Plaque d'essai + fils | Breadboard demi‑taille + fils dupont mâle‑mâle | ~8 à 10 € | n'importe quel revendeur (GoTronic, Kubii, Amazon) | Raccorder l'écran et les boutons. |
| Boutons | 4 boutons tactiles 6 mm | ~3 € | idem | Tester Fait, tour, écran suivant, quitter. |
| Mesure | Wattmètre USB‑C (testeur de tension/courant) | ~12 à 15 € | idem | Mesurer la consommation, donc l'autonomie. |
| Soudure (si nécessaire) | Fer à souder + étain, **ou** un atelier/ami qui en a | ~20 à 30 € | idem | Les cartes et l'écran Adafruit arrivent souvent avec des broches **non soudées** : à vérifier sur la fiche de chaque produit. |
| Câble USB‑C | un câble donnée + charge | ~0 à 5 € | tu en as sûrement un | Programmer la carte et la charger. |

**Total**: ~125 à 140 € sans fer à souder, ~145 à 170 € avec. Au‑dessus du budget de 150 € si tu dois acheter le fer : à toi de voir ce qu'on reporte (wattmètre, plaque d'essai).

Pas encore dans la liste, volontairement : éclairage frontal de l'écran, boîtier 3D, fixation cintre, grosse batterie.

## Ce que le porteur doit faire physiquement (et ce que Claude ne peut pas vérifier)

À toi :
- Commander les pièces (liste ci‑dessus) et vérifier le stock et le prix le jour J.
- Vérifier sur chaque fiche produit si les broches sont soudées ; sinon, trouver un fer ou un atelier.
- Contrôler la **polarité** du connecteur de batterie avant de la brancher à la carte (rouge/noir, voir la notice) : une inversion peut abîmer la carte.
- Brancher, téléverser, et me rapporter ce que tu vois (photos, messages d'erreur).
- Utiliser tes capteurs BLE réels (cardio, puissance, cadence, vitesse) et me dire lesquels.
- Mesurer la consommation avec le wattmètre et noter les valeurs.

Claude ne peut pas vérifier :
- Le stock, les prix et les délais (relevés dans des résumés de pages, pas sur un panier).
- La lisibilité réelle de l'écran au soleil et de nuit, la précision du GPS, la portée Bluetooth.
- Que ces cartes précises fonctionnent ensemble sans surprise (bibliothèques, brochage) : à essayer.
- L'autonomie : ordre de grandeur seulement (voir ci‑dessous), il faut mesurer.
- La place réelle sur ton cintre et à côté de ton GPS (mesure à faire).

## Autonomie : hypothèse à mesurer

Pour 25 h, hypothèse de travail : consommation moyenne ~60 à 120 mA (carte ESP32 avec Bluetooth + GPS + écran Memory LCD quasi nul) → une batterie de ~3 000 à 5 000 mAh serait nécessaire, ou une recharge en roulant. Valeur non mesurée : la batterie de 2 000 mAh du prototype sert à mesurer, pas à tenir 25 h.

## Questions ouvertes (restantes)

1. Éclairage de nuit de l'écran : éclairage frontal ou lumière LED latérale ? (Après le prototype de table.)
2. Boutons : combien, quelle disposition, étanchéité (gants, pluie).
3. Module GPS : le PA1010D suffit‑il en précision et en consommation, ou faut‑il un u‑blox multi‑constellation ?
4. Format binaire du paquet et de l'enregistrement (`docs/FORMAT-PAQUET.md`), avec une taille cible compatible BLE.
5. Batterie pour 25 h : capacité, charge en roulant (dynamo, batterie externe) ?
6. Stockage : flash interne (4 Mo) ou microSD pour l'enregistrement de 25 h (~2 Mo + marge) ?

## Journal des décisions

- **2026-10-08** : écran Memory LCD Sharp 2,7" 400×240 ; transfert du paquet par BLE ; budget prototype ~100 à 150 € (un exemplaire) ; capteurs cardio, puissance, cadence, vitesse ; cartes toutes faites (Adafruit ESP32‑S3 Feather). Maquette d'encombrement : `hardware/maquette-cintre.svg`. Aucun changement du format du paquet (`FORMAT-PAQUET.md` reste en version 1).
