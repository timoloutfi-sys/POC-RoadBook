# Étude : la navigation dans Road book

Demande (22 oct.) : un widget « Navigation » comme les autres, qui s'adapte à sa taille — en petit le prochain virage, en grand une vraie carte en couleur — sans recalcul d'itinéraire ; hors parcours, dire « Hors parcours » et où se trouve le tracé (derrière, à droite, derrière à droite…).

## Comment font les autres

| Appareil / appli | Virages | Hors parcours | Carte | Remarques |
|---|---|---|---|---|
| **Garmin Edge** | Deux sources : les virages *calculés* sur la forme du tracé (jugés peu fiables par les utilisateurs : ils ne voient pas les carrefours) et les *course points* du fichier (RideWithGPS en ajoute, pas Komoot), avec nom de rue | Propose « mettre en pause » ou « recalculer » ; par défaut ramène au point où on a quitté le tracé, ce qui agace beaucoup ; réglable (proposer seulement) | Carte OSM préchargée, tracé magenta, page carte | Le tracé magenta sur la carte est ce que les cyclistes regardent le plus |
| **Wahoo ELEMNT** | Virage à l'écran + LED en haut de l'appareil + bip | « Back on Track » : recalcule pour rejoindre le tracé ; les LED signalent la sortie de parcours | Cartes téléchargées par région, zoom par boutons | Les LED (signal sans lire) sont très appréciées |
| **Hammerhead Karoo** | Virage à virage avec carte | Recalcule automatiquement ; mode « fil d'Ariane » sans virages ni recalcul | Cartes par région, la France fait plus de 9 Go en entier, découpée par régions | Carte couleur riche, écran tactile |
| **Komoot (appli)** | Virage à virage avec voix | Recalcule | Régions téléchargées (une gratuite) | Fait pour le téléphone |
| **Locus Map** | Selon le fichier | Trace une **ligne de guidage** vers le point le plus proche du tracé, avec sa distance ; recalcul en option | Cartes hors ligne | C'est exactement l'idée retenue ici |
| **Projets ESP32 libres** (bike-computer-32, IceNav, ESP32_GPS) | — | — | Cartes OSM **converties** dans un format compact sur microSD, dessinées par l'ESP32 (vecteurs ou images) | Prouve que le boîtier peut afficher une carte hors ligne |

Ce qu'on en retient :
1. **Le tracé en couleur vive sur la carte** est l'élément principal (magenta chez Garmin). Le reste de la carte doit rester calme.
2. **Les virages lus sur la seule forme du tracé** marchent pour les vrais virages, moins bien en ville (pas de carrefours, pas de noms de rue). On les complète plus tard avec les noms de rue de la carte et les *course points* des GPX qui en ont.
3. **Hors parcours** : la forme la plus simple et la plus appréciée est la **ligne pointillée vers le tracé** (Locus) + la direction en mots. Pas de « retour au point de départ du détour » imposé (le défaut reproché à Garmin).
4. **Cartes hors ligne** : tout le monde télécharge par région. Pour nous, le plus malin est le **couloir du parcours** (quelques km autour du tracé), préparé avec le paquet de sortie : petit, rapide, et le même pour le boîtier.

## Proposition (captures dans `docs/captures/navigation/`, prototype `navproto.html`)

Un seul widget **Navigation**, toutes tailles :

- **1×1** : flèche du prochain virage + distance. Hors parcours : boussole rouge qui pointe vers le tracé + distance.
- **2×1** : flèche, distance, « À gauche », et le virage suivant (« puis à droite · 1,3 km »). Hors parcours : « Hors parcours · 140 m · tracé derrière à droite ».
- **2×2 et plus** : carte en couleur, épurée (routes, eau, verdure et noms de rues ; ni commerces, ni arrêts, ni bâtiments), tournée dans ton sens de marche, toi en bas, le tracé en magenta (déjà fait en gris). Le prochain virage dans un bandeau magenta collé en haut (flèche, distance, consigne, et « puis ↱ 1,3 km »). Hors parcours : bandeau rouge « Hors parcours · tracé derrière · 140 m » et ligne pointillée rouge jusqu’au tracé.
- **Plein écran ou presque** (4×3, portrait 3×3) : la même carte, avec les widgets d'effort à côté. Variante en perspective (vue 3D inclinée) à trancher.
- **Nuit** : carte sombre (même tracé magenta), basculée avec le reste de l'écran.

Couleurs : magenta pour la navigation (ne se confond ni avec les zones, ni avec l'ambre et le rouge des alertes de seuil), rouge uniquement pour « hors parcours », bleu pour ta position.

## Technique

- **Carte** : MapLibre GL (libre) avec les cartes OpenStreetMap d'**OpenFreeMap** (gratuites, sans compte, usage commercial permis, sans garantie de disponibilité → à héberger nous-mêmes plus tard si besoin). Attribution « © OpenStreetMap » obligatoire.
- **Hors ligne** : couloir du parcours enregistré sur le téléphone avec le road book (format PMTiles, un seul fichier). Taille à mesurer ; une région entière se compte en centaines de Mo, un couloir de 500 km beaucoup moins.
- **Virages et hors parcours** : `src/route/turns.ts` (pur, testé) — virages lus sur le tracé fin, secteur du tracé par rapport à ta direction. Réutilisable tel quel sur le boîtier.
- **Boîtier** : écran couleur (déjà l'orientation de la conversation hardware : TFT VIEWE) ; carte du couloir convertie dans un format compact sur microSD, comme les projets ESP32 cités. À ajouter à `docs/FORMAT-PAQUET.md` le moment venu.

## Décisions (22 oct.)

- Carte **en perspective** (vue inclinée, ~50°) pour les grandes tailles.
- Petites tailles **avec un mini fond de carte** : vue de dessus, zoom serré, sans attribution visible ; la consigne passe sur une plaque magenta (ou rouge hors parcours), ta position décalée à côté de la plaque.
- Icône de position : trois propositions (`icones.png`) — A chevron de navigation, B pastille vélo, C point et cône. À choisir.

## À trancher

1. Icône de position : A, B ou C ?
2. Couleur de la navigation : magenta (proposé) ou autre ?
3. Annonce sonore et vibration avant un virage (et à quelle distance : 200 m ? 100 m ?) ?
4. Hors ligne dès le premier lot, ou d'abord en ligne pour tester sur le vélo ?

## Sources

- Garmin, forums : [rejoindre un parcours](https://forums.garmin.com/sports-fitness/cycling/f/edge-1030-plus/309269/how-to-rejoin-a-course), [retrouver le parcours après un virage manqué](https://forums.garmin.com/sports-fitness/cycling/f/edge-530/333831/re-finding-the-route-after-missing-a-turn), [turn guidance et course points](https://forums.garmin.com/sports-fitness/sports-fitness/f/edge-520-520-plus/118666/navigation-and-turn-by-turn)
- Wahoo : [ELEMNT BOLT (REI)](https://www.rei.com/product/195827), [DC Rainmaker](https://dcrainmaker.com/2019/05/element-cycling-review.html)
- Hammerhead : [cartes hors ligne par région](https://support.hammerhead.io/hc/en-us/articles/360021708694), [re-routage hors parcours](https://support.hammerhead.io/hc/en-us/community/posts/360049596313/comments/360012694834), [notes de version (fil d'Ariane)](https://www.eu.hammerhead.io/blogs/change-logs/karoo-software-build-version-1-419-1626)
- Komoot : [revue (régions hors ligne)](https://roadcyclinguk.com/sportive/beginners-guide-komoot-must-route-planning-app.html)
- Locus Map : [manuel navigation](https://docs.locusmap.app/doku.php/manual:user_guide:functions:navigation)
- ESP32 : [bike-computer-32](https://github.com/lspr98/bike-computer-32), [IceNav](https://www.hackster.io/news/jordi-gauchia-s-icenav-turns-an-espressif-esp32-into-a-graphical-offline-openstreetmap-gps-96d29d642d76), [ESP32_GPS](https://github.com/aresta/ESP32_GPS)
- Cartes : [OpenFreeMap](https://openfreemap.org), [Protomaps / PMTiles](https://docs.protomaps.com/guide/getting-started)
