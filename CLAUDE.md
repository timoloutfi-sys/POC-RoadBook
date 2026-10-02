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

Tout tient dans `roadbook-poc.html` (un seul fichier, sans dépendance). Onglets :

- **Parcours** : import GPX, rééchantillonnage tous les 50 m, lissage de l'altitude, profil, points (eau, ravito, danger, note) et zones posés sur le profil, détection des montées. Bloc **Stratégie automatique** : intention (Endurance, Seuil, À fond), programme par section, temps par zone Z1-Z7 avec curseurs qui replacent les blocs en direct.
- **Stratégie** : FTP, masse, CdA, règles de base en % FTP selon la pente.
- **Alertes** : règles Quand → Si → Alors, rappels périodiques.
- **Écran** : grille 6 × 3 en paysage, widgets déplaçables et redimensionnables, affichage adapté à la taille (S, M, L).
- **Simulation** : coureur virtuel sur le parcours, journal des alertes.
- **Rouler** : capteurs Bluetooth (puissance, cardio, cadence, vitesse), GPS recalé sur le parcours, relais de distance par le capteur de vitesse, plein écran, écran maintenu allumé.

## Architecture cible

Passer du fichier unique à un projet **Vite + TypeScript**, en PWA, avec des modules testables :

- `route/` : lecture GPX, rééchantillonnage, lissage, pentes, détection des montées.
- `strategy/` : cible à un point donné (zones > règles de base), générateur de programme (`computePlan`), lever et coucher du soleil.
- `alerts/` : évaluation (`evalRun`), émission, lissage de la sévérité, plafond horaire.
- `sensors/` : Web Bluetooth. Services Cycling Power (0x1818), Heart Rate (0x180D), Cycling Speed and Cadence (0x1816). Cadence et vitesse calculées à partir des compteurs de tours et des temps d'événement (1/1024 s, avec retour à zéro des compteurs).
- `gps/` : suivi de position, recalage sur le parcours (recherche locale, puis globale au-delà de 150 m).
- `sim/` : coureur virtuel.
- `ui/` : éditeur d'écran, widgets, vue de course.
- `storage/` : configuration et plan, export et import.

Tests unitaires (Vitest) en priorité sur : lecture GPX, décodage des trames Bluetooth, générateur de programme, moteur d'alertes.

## Modèle physique

`P = [M·g·(pente + Crr)·v + 0,5·ρ·CdA·v³] / rendement`, avec ρ = 1,2, rendement = 0,96, Crr = 0,0045. Vitesse plafonnée à 60 km/h dans le générateur. Les paramètres du coureur (FTP, masse, CdA) viennent de la configuration.

## Points d'attention

- **Web Bluetooth** : Chrome sur Android, Bluefy sur iPhone (Safari ne le gère pas). HTTPS obligatoire.
- **Analyse du coach** : dans la version publiée sur claude.ai, elle passe par la capacité `sample`, qui n'existe que là. Hors de claude.ai, passer par une petite fonction serveur qui appelle l'API Anthropic. **Ne jamais mettre de clé d'API dans le front.**
- Les recharges d'eau générées sont des rappels de distance, pas des lieux réels.

## Prochaines étapes

1. Découper le fichier en modules TypeScript, sans changer le comportement, avec des tests.
2. PWA hébergée (hors ligne, installable), pour tester sur le vélo.
3. Rejeu d'un vrai fichier `.fit` dans le simulateur, et comparaison plan contre réel.
4. Points d'eau et commerces réels via OpenStreetMap (Overpass), avec horaires.
5. Export d'un parcours FIT annoté pour les GPS classiques.
6. Prototype matériel : carte type ESP32, écran memory LCD, module GPS, batterie, boîtier imprimé en 3D.
