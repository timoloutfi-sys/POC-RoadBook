# Format du paquet de sortie (version 2)

Contrat entre le téléphone (qui prépare) et le boîtier (qui exécute). Source de vérité du code : `src/ride/bundle.ts` (`RideBundle`, `serializeBundle`, `deserializeBundle`). **Tout changement de format = nouveau numéro de version ici et dans `BUNDLE_VERSION`.**

## Contenu

| Champ | Type | Sens |
|---|---|---|
| `v` | entier | version du format (2) |
| `route` | tracé ou null | parcours ; null en sortie libre |
| `sections` | liste | tronçons km à km : nom, début/fin (km), cible min/max en % de FTP, message, annonce (km avant), drapeaux (`mark` repère sans cible, `locked` cible imposée, `gen` généré) |
| `points` | liste | points du road book : type (eau, ravito, danger, note…), km, texte, annonce (km avant), arrêt prévu (min) |
| `base` | objet | cibles de base en % de FTP : plat, montée, descente, seuils de pente |
| `alerts` | liste | alertes de seuil : métrique, comparaison, référence (cible max/min ou valeur), durée, répétition, priorité, message |
| `periodic` | liste | rappels toutes les N minutes : message, priorité |
| `maxPerHour` | entier | plafond horaire des alertes de seuil |
| `ftp`, `lthr`, `mass` | nombres | profil du coureur (FTP en W, FC seuil en bpm ou null, masse en kg) |
| `navCueM` | entier | annonce des virages : distance avant le virage (m) ; 0 = pas d'annonce (v2) |

Le tracé (`route`) est réduit aux points du tracé fin (latitude, longitude, altitude) ; le profil à pas variable et la grille de 50 m en sont recalculés à la lecture.

## Navigation (v2)

Les virages se relisent sur le tracé (`route/turns.ts`, changement de cap > 35° sur ±25 m) : le boîtier peut les recalculer lui-même ou les recevoir tout faits (liste : distance, angle, côté) dans une version suivante. La carte hors ligne n'est pas dans le paquet : c'est le **couloir de tuiles** du parcours (`map/corridor.ts` : zoom 8 à 14, 1 km autour du tracé au zoom 14), envoyé à part et converti pour le boîtier quand son format d'affichage sera décidé (`docs/HARDWARE.md`).

## Aujourd'hui et demain

- **Aujourd'hui** : JSON (`serializeBundle`). Pratique pour le soft, trop gros et trop lent à lire pour un microcontrôleur sur un parcours de 500 km.
- **À définir avec le hardware** : une forme **binaire compacte** (tableaux tous les 50 m : altitude, pente, cible ; listes de points, montées, rappels ; temps et énergie prévus par km). Quand elle est décidée : la décrire ici, ajouter `serializeBundleBinary` dans le soft, et garder le JSON pour les tests.
- Le boîtier renvoie à son tour un **enregistrement** (1 Hz : temps, position, vitesse, puissance, FC, cadence, événements arrêt/passage/rappel). Format à définir ici ; le soft l'importe comme une sortie enregistrée.

## Règles

- Versionner : un boîtier qui reçoit une version qu'il ne connaît pas refuse le paquet avec un message clair.
- Tailles bornées : le boîtier annonce ses limites (nombre de points, de sections, longueur du tracé) ; le téléphone refuse d'envoyer au‑delà plutôt que de tronquer.
