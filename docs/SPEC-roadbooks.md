# Spec consolidée : road books, sorties, déroulé du plan

Statut : à valider. Rien n'est codé. Référence pour les prochaines étapes (voir `PRODUCT.md` pour l'orientation).

## 1. Principes

- **Road book** = un parcours préparé : GPX (jamais modifié) + points + repères + cibles + départ et nutrition + réglages propres.
- **Un road book = un plan.** Pour une variante, on duplique.
- **Sortie** = une sortie roulée, liée à un road book (avec une copie figée de son plan) ou « Sortie libre ».
- Question centrale de l'historique : **est-ce que j'ai tenu mon plan ?** (pas refaire Strava).
- L'algorithme suggère, n'impose jamais. Les données réelles peuvent proposer des mises à jour du profil, jamais automatiquement.

Inspirations : Komoot (bibliothèque de tours), Garmin et Wahoo (choix du parcours avant départ, résumé de fin), TrainingPeaks (prévu contre réalisé, conformité colorée), Best Bike Split (plan contre réel sur le parcours), Strava (journal des sorties).

## 2. Navigation

Onglets : **Road books · Rouler · Sorties · Écrans**. Profil et réglages globaux derrière l'icône réglages.

| Onglet | Rôle |
|---|---|
| Road books | Bibliothèque : cartes, « + Nouveau », détail d'un road book |
| Rouler | Choix du road book ou Sortie libre, capteurs, Démarrer ou Reprendre, simulation |
| Sorties | Historique de toutes les sorties, par date |
| Écrans | Écrans de course, communs à tous les road books |

## 3. Road books

### Liste
- Une carte par road book : nom, km, D+, durée estimée, date de modif, mini-profil.
- « + Nouveau » : import GPX (ou démo), puis le nom, prérempli depuis le GPX. On arrive directement dans le road book.
- Menu ⋯ ou appui long : Dupliquer, Renommer, Exporter, Supprimer (avec annulation).
- État vide : « Importe un GPX pour créer ton premier road book » et un bouton d'import.

### Détail : 4 sous-onglets
1. **Parcours** : l'actuel onglet Road book (profil zoomable, points, repères), plus la **liste chronologique** (§ 5).
2. **Cibles** : l'actuel onglet Cibles (mes cibles, par tronçon, Suggérer un plan, options).
3. **Réglages** : écran de départ, alertes et rappels (§ 4).
4. **Sorties** : les sorties faites avec ce road book, pour comparer les passages (reco, puis course).

Bouton fixe en bas : **« Rouler avec »**, qui sélectionne le road book et ouvre Rouler.

## 4. Réglages : défauts globaux, modifiables par road book

- **Profil › Alertes et rappels** porte les défauts : seuils, rappels périodiques, plafond horaire.
- **Road book › Réglages** affiche chaque alerte et chaque rappel avec sa valeur effective :
  - non modifiée : elle suit le défaut, sans mention ;
  - modifiée : marquée « • modifié », avec un bouton **Rétablir**.
- Changer un défaut met à jour tous les road books, sauf leurs valeurs modifiées.
- **Écran de départ** : liste des écrans communs, « Par défaut » sinon.

## 5. Liste chronologique du road book (refonte étape 2)

Dans Parcours, les points et les repères sont triés par km, et chaque ligne donne :
- le km ;
- le nom, avec l'icône de son type ;
- l'**heure d'arrivée estimée**, avec la fourchette ;
- le temps depuis le point précédent ;
- un marqueur « nuit » si on y arrive de nuit.

Un point peut être marqué **« arrêt prévu »**, avec sa durée (5, 10, 20 min ou libre) :
- ces arrêts remplacent l'estimation générique des arrêts dans le calcul des heures et de la durée totale ;
- s'il n'y en a aucun, l'estimation générique (`estimateStops`) s'applique.

La même liste sert au « road book réalisé » d'une sortie (§ 8).

## 6. Rouler et Sortie libre

- Sélecteur en haut : le road book choisi (par défaut le dernier utilisé) ou **Sortie libre**.
- Sous le road book : rappel d'une ligne (km, durée estimée, départ prévu).
- Ensuite, inchangé : checklist, capteurs, Démarrer ou Reprendre, simulation, transfert.
- **Sortie libre** :
  - Ni parcours ni plan. Ce sont les cibles de base, les alertes et les rappels globaux qui s'appliquent.
  - Le GPS sert seulement à la vitesse et à la distance.
  - Les widgets liés au parcours affichent « – ».

## 7. Widgets de course (refonte étape 3)

| Widget | Contenu |
|---|---|
| Prochain arrêt | Nom, distance, heure d'arrivée estimée |
| Écart au plan | Avance ou retard en min par rapport à l'heure prévue au km actuel (vert ou ambre) |
| Effort cumulé vs plan | Travail (kJ) ou temps au-dessus de la cible, comparé au prévu à ce point |

Ils sont disponibles dans l'éditeur d'écrans, en tailles S, M et L. En Sortie libre, ils affichent « – ».

## 8. Sorties (historique)

### Enregistrement
- **Mesures, à 1 Hz** : temps, km sur le parcours, position, altitude, vitesse, puissance, FC, cadence, et un indicateur « en mouvement ».
- **Événements** :
  - arrêts (début, fin, km) et pauses ;
  - passage à chaque point ;
  - rappels affichés, et validés par « Fait » ou non ;
  - alertes de seuil.
- **Contexte** : capteurs utilisés, puissance ou cardio, copie du profil (FTP, masse, CdA, FC seuil) et **copie figée du plan** (cibles, heures prévues, arrêts).
- **Écriture progressive** : un morceau toutes les 30 s. Si Chrome est tué, rien n'est perdu et « Reprendre » continue la même sortie.
- Les simulations ne sont pas enregistrées, sauf si on le demande. Elles sont alors marquées « Simulation ».

### Fin de sortie
Un écran résumé s'affiche quand on quitte :
- les chiffres clés et l'écart au plan ;
- **Enregistrer** (nom prérempli), **Reprendre**, **Supprimer** (avec confirmation).

### Liste (onglet Sorties)
- Une ligne par sortie : date, nom, road book lié, km, temps, et une pastille de conformité au plan (vert, ambre ou rouge).
- Filtre par road book.

### Détail d'une sortie
De haut en bas, les sections au-delà de la 3 sont repliées :
1. **En-tête** : date, road book lié (cliquable), km, temps de roulage, temps total, D+.
2. **Plan contre réel** :
   - arrivée prévue contre réelle, avec l'écart ;
   - roulage et arrêts, prévu contre réel ;
   - temps dans la cible, en %.
3. **Profil** : le réel (puissance ou FC) par-dessus les cibles. Le survol donne le prévu et le réel au km.
4. **Road book réalisé** : la liste du § 5, avec pour chaque point l'heure prévue, l'heure réelle, l'écart et la durée d'arrêt.
5. **Zones** : temps par zone, prévu contre réel.
6. **Chiffres** : puissance normalisée, puissance moyenne, FC moyenne, cadence, kcal, dérive cardiaque, rappels tenus (par exemple 14 sur 16).
7. **Actions** : Renommer, Exporter, Supprimer.

Supprimer un road book ne supprime pas ses sorties : elles affichent « road book supprimé » et gardent leur copie du plan.

### Export
- Export FIT ou GPX via le menu de partage Android, pour Strava ou TrainingPeaks. Il est optionnel, car le compteur enregistre déjà la sortie.
- Pas de synchro Strava automatique : elle demanderait un serveur OAuth.
- Plus tard : associer le .fit du compteur à une sortie (prochaine étape « rejeu d'un vrai .fit »).

### Plus tard : apprendre des sorties
Les sorties permettront d'estimer :
- le CdA réel, sur les portions plates ;
- la durée réelle de tes arrêts ;
- ta dérive cardiaque et ta tenue sur la durée.

L'appli propose alors « Mettre à jour mon profil », sans rien appliquer d'elle-même.

## 9. Modèle de données

```ts
// Global (localStorage)
Config {
  rider, wheel, sensors, screens, rideTheme, maxPerHour,
  defaults: { alerts, periodic },
  activeRoadbook: id | 'libre',
  roadbooks: RoadBookMeta[]            // id, name, km, dplus, estH, updated
}

// IndexedDB
RoadBook {
  id, name, created, updated,
  sections, points, base, plan,         // points: + stop?: { min }
  startScreen?: screenId,
  overrides: { alerts?: Record<id, Partial<Alert>>, periodic?: Record<id, Partial<Periodic>> }
}
RouteData { roadbookId, route }          // GPX rééchantillonné, ~300 Ko / 500 km

Ride {
  id, name, start, end, kind: 'roadbook' | 'libre' | 'simu',
  roadbookId?, roadbookName,
  planSnapshot?: { sections, points, etas, stops, unit },
  riderSnapshot: { ftp, mass, cda, hrThr, unit },
  summary: { km, moving, total, dplus, np, avgP, avgHr, kcal, inTarget, deltaArrival, remindersDone },
  events: RideEvent[]
}
RideChunk { rideId, seq, t0, data: typed arrays 1 Hz }   // ~3 Mo / 24 h
```

- Les surcharges stockent seulement les écarts aux défauts. Valeur effective = défaut + surcharge.
- Le résultat du plan (`planResult`) n'est pas stocké : il est recalculé à l'ouverture du road book.
- Le résumé d'une sortie est calculé une fois, à l'enregistrement.
- Au premier lancement, `navigator.storage.persist()` évite qu'Android vide les données.
- Export et import :
  - d'un road book : JSON avec le GPX inclus ;
  - d'une sortie : FIT ou GPX ;
  - l'export global existant est conservé.

## 10. Migration

Au premier lancement de cette version :
1. La route, les sections, les points et le plan actuels deviennent un road book, nommé d'après le GPX ou « Mon road book ».
2. Les alertes et rappels actuels deviennent les défauts globaux, sans aucune surcharge.
3. Ce road book est sélectionné dans Rouler.
4. Pas d'historique antérieur.

## 11. Découpage

1. Modèle, IndexedDB, migration et tests (road books et sorties).
2. Onglet Road books : liste, nouveau, actions, sous-onglets, « Rouler avec ».
3. Sélecteur dans Rouler et Sortie libre.
4. Réglages par road book : valeurs modifiées et Rétablir.
5. Liste chronologique : heures d'arrivée et arrêts prévus.
6. Enregistrement des sorties (progressif, reprise) et écran de fin.
7. Onglet Sorties et détail : plan contre réel, profil, road book réalisé, zones, chiffres.
8. Widgets de course : prochain arrêt, écart au plan, effort cumulé.
9. Export FIT ou GPX.
10. Passe `polish` après essai sur le vélo.
