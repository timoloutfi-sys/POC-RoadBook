# Appareils existants pour faire tourner le road book (tour d'horizon, 2026-10-29)

Question du porteur : plutôt que fabriquer un boîtier, existe‑t‑il un appareil du commerce, si possible peu cher, sur lequel installer notre logiciel ? Prix relevés par recherche web (non vérifiés au panier) ; « non vérifié » signale ce qui reste à confirmer.

Critères : notre logiciel dessus (tel quel ou porté), lisible en plein soleil, ~25 h, capteurs Bluetooth, GPS, fixation au cintre, écran assez grand pour la grille 6 × 3.

## Constat

Aucun appareil trouvé ne réunit à la fois : **moins de 150 €**, **lisible au soleil**, **25 h**, et **notre appli telle quelle**. Il faut choisir deux ou trois de ces qualités :

- notre appli telle quelle + pas cher → **téléphone** (soleil et autonomie moyens) ;
- soleil + autonomie → **Garmin Edge** (appli à réécrire, mémoire limitée) ;
- appli Android + fait pour le vélo → **Karoo** (autonomie 13–15 h, plus avec batterie externe) ;
- soleil + appli Android telle quelle → **téléphone e‑ink** (cher).

## Téléphones (notre appli tourne déjà : Chrome, Web Bluetooth, GPS)

| Appareil | Prix | Écran | Autonomie | Verdict |
|---|---|---|---|---|
| Téléphone actuel ou Android d'occasion + support cintre + batterie externe | 0–100 € | classique | batterie externe nécessaire | le moins cher, déjà la phase actuelle du projet ; soleil moyen |
| Téléphone robuste grosse batterie (Ulefone Armor X16 ~155 € en import ; Oukitel WP60 10 000 mAh ~300 £) | 155–350 € | classique, lumineux | probablement 25 h écran baissé (non vérifié) | lourd et gros sur un cintre |
| Compact Unihertz Atom XL (4", 4 300 mAh) | ~290 $ | 4", forme proche du boîtier en paysage | courte | cher pour sa batterie |
| **Boox Palma 2 Pro** (e‑ink couleur Kaleido 3, 6,13", Android 15 + Play Store, **GPS confirmé**, 5G données) | ~400 $ | **e‑ink, excellent au soleil** | non relevée | seul téléphone e‑ink avec GPS confirmé ; cher ; rafraîchissement e‑ink à tester à 1 Hz |
| Bigme HiBreak Pro (e‑ink, Android 14) | ~439 $ | e‑ink | 4 500 mAh | GPS non confirmé |

## Montres (écran trop petit pour la grille 6 × 3 ; piste pour une version « poignet » plus tard)

| Appareil | Prix | Programmation | Verdict |
|---|---|---|---|
| Amazfit (Zepp OS 3+) | ~100–200 € (non relevé) | mini‑applis JavaScript ; le Bluetooth « maître » permet de se connecter aux ceintures cardio ; capteur de puissance non confirmé | écran rond ~1,4" |
| Wear OS (ex. TicWatch Pro 5 Enduro, double écran, ~90 h annoncées) | ~120–350 $ | applications Android | écran 1,43" |
| Bangle.js 2 (écran mémoire couleur 1,3", GPS, JavaScript) | ~90 € (arrêtée chez certains revendeurs) | ouverte | trop petite |
| Garmin (Connect IQ) | variable | Monkey C | trop petite |

## Compteurs vélo

| Appareil | Prix | Programmation | Autonomie | Verdict |
|---|---|---|---|---|
| **Karoo 2 d'occasion** | ~130 $ (annonce janvier 2026) | Android ; bibliothèque d'extensions compatible (DC Rainmaker) ; installation de notre appli à confirmer | ~13–15 h (non vérifié) | meilleur rapport prix / appli Android sur un vrai compteur |
| Karoo 3 | ~475–500 € | Android, SDK `karoo-ext`, installation d'APK officielle | ~15 h, mode économie annoncé jusqu'à ~30–35 h | cher |
| **Garmin Edge 540** | ~250 $ en promo (États‑Unis), ~330–370 € en Europe | Connect IQ (Monkey C), mémoire limitée (non relevée pour ce modèle) | **26 h, 42 h en économie** | meilleure autonomie et lisibilité ; tout à réécrire |
| Garmin Edge 530 d'occasion | ~165 £ | Connect IQ (~128 Ko par champ d'après les forums) | ~20 h | mémoire trop juste pour un road book de 500 km |
| Wahoo, Bryton, iGPSPORT, Magene | — | fermés | — | exclus |

## Appareils « makers » prêts à l'emploi (boîtier, batterie, écran, à programmer nous‑mêmes)

| Appareil | Prix | Contenu | Verdict |
|---|---|---|---|
| LILYGO T‑Deck Plus | ~70–90 € | ESP32‑S3, écran 2,8" IPS 320×240, GPS (antenne critiquée), batterie 2 000 mAh, boîtier, clavier | prêt à programmer, mais écran non lisible au soleil et clavier inutile |
| LILYGO T‑Echo | ~55 $ | nRF52840, e‑paper 1,54", GPS | trop petit, e‑paper trop lent à 1 Hz |

## Pistes à creuser

1. **Téléphone actuel + support + batterie externe** : coût nul, valider l'usage tout de suite (déjà la phase du projet).
2. **Karoo 2 d'occasion** : confirmer l'installation d'une appli maison sur Karoo 2 avant d'acheter.
3. **Garmin Edge 540** : si l'autonomie et le soleil priment ; demande un portage Connect IQ (gros travail, côté soft).
4. **Boox Palma 2 Pro** : seul appareil e‑ink avec GPS et Android ; vérifier le rafraîchissement à 1 Hz et l'autonomie.

Toute cible logicielle (Karoo, Garmin, montre) relève du soft (`src/`), hors du chantier matériel.
