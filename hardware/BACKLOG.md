# Backlog hardware

Une ligne par point, du plus important au moins important. Même méthode que `BACKLOG.md` du soft.

## À faire
- [ ] 🛒 Commander le prototype de table, capteurs lumière et température compris (liste dans `docs/HARDWARE.md`) ; vérifier stock, prix et broches soudées.
- [ ] Essai 1 : alimenter la carte ESP32‑S3 en USB‑C et la programmer avec un « clignote une LED ».
- [ ] Essai 2 : afficher un texte sur l'écran Memory LCD, juger la lisibilité intérieur/extérieur.
- [ ] Essai 3 : lire le GPS, voir le fix et les coordonnées (dehors).
- [ ] Essai 4 : se connecter en BLE à un capteur cardio, puis puissance/cadence/vitesse.
- [ ] Essai 5 : recevoir un fichier du téléphone en BLE (débit réel) pour dimensionner le paquet.
- [ ] Essai 6 bis : brancher capteurs de luminosité et de température (même câble que le GPS), vérifier les adresses I²C, lire lux et °C ; tester l'emplacement qui limite l'échauffement.
- [ ] Essai 6 : mesurer la consommation avec le wattmètre et en déduire l'autonomie.
- [ ] ⚠️ Indispensable produit final : jour/nuit automatique (lux + heure GPS) et température ; prévoir fenêtre du capteur de lumière et emplacement du capteur de température dans le boîtier 3D.
- [ ] Définir l'enregistrement (`docs/FORMAT-PAQUET.md`) avec lux et température.
- [ ] ❓ Trancher : éclairage de nuit, nombre de boutons, module GPS, batterie 25 h, stockage (voir « Questions ouvertes »).
- [ ] Définir le format binaire du paquet et de l'enregistrement (`docs/FORMAT-PAQUET.md`).
- [ ] Firmware : afficher un widget (Puissance) avec des données simulées sur l'écran choisi.
- [ ] Firmware : lire un capteur cardio Bluetooth (service FC standard) et l'afficher.
- [ ] Firmware : lire le GPS et projeter la position sur un tracé.
- [ ] Firmware : porter le moteur d'alertes (`src/alerts/`, `src/ride/engine.ts`) et le tester contre les mêmes cas que le soft.
- [ ] Boîtier 3D v1 et fixation cintre.
- [ ] Mesurer la consommation et en déduire l'autonomie.

## En cours

## Fait
- [x] Cadrer les questions ouvertes (écran, transfert, budget, capteurs, type de carte) : décisions du 2026-10-08 dans `docs/HARDWARE.md`.
- [x] Choisir les cartes pour le premier essai (ESP32‑S3 Feather + écran Memory LCD 2,7" + GPS PA1010D).
- [x] Maquette d'encombrement sur cintre : `hardware/maquette-cintre.svg`.
