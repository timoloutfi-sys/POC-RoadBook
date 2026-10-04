# Spec : Accueil, objectif, course sans GPX

Statut : validé (piste A + E/F + G'/I/J/K), à coder. Maquettes : `docs/maquettes/accueil/`.

## 1. Navigation

Onglets : **Accueil · Road books · Sorties · Écrans**. L'onglet Rouler disparaît : son contenu passe dans l'Accueil (bouton) et dans une feuille « Avant de partir » (capteurs, simulation, transfert).

## 2. Modèle

```ts
RoadBook {
  ...,
  /** Date et heure de départ prévues (local, « 2027-04-10T06:00 ») ; absent = pas daté. */
  when?: string
  kind: 'sortie' | 'course'          // défaut 'sortie'
  /** Parcours sans GPX : distance, dénivelé et terrain saisis. Ignoré dès qu'un tracé existe. */
  est?: { km: number; dplus: number; terrain: 'plat' | 'vallonne' | 'montagne' }
  /** Notes libres (ravitos annoncés, règlement, matériel). */
  notes?: string
}
Config { ..., goalId: string | null }  // un seul objectif à la fois
RoadBookMeta { ..., when?: string; kind; hasRoute: boolean }
```

- `when` alimente `plan.start` (heures d'arrivée, nuit). Le champ « Départ » quitte les Options de Cibles pour Réglages › Date et type. Sans `when`, le plan garde aujourd'hui à 08:00 pour ses calculs, sans rien afficher.
- Migration : les road books existants ont `kind: 'sortie'`, pas de `when`, et `goalId: null`.

## 3. Règles

- **Objectif** = le road book `goalId`, s'il est de type Course et que `when` est dans le futur.
  - Cocher « C'est mon objectif » sur un autre road book remplace l'objectif précédent.
  - Une fois la date passée, l'objectif disparaît de l'accueil (`goalId` reste, sans effet).
- **Prochaine sortie** = le road book daté le plus proche dans les 7 jours à venir, objectif compris. Comptés sur le jour (« Aujourd'hui », « Demain », « sam. 18 oct. »).
- **Bouton Rouler** propose, dans l'ordre :
  1. la prochaine sortie si elle a lieu aujourd'hui ;
  2. sinon le road book actif (dernier utilisé) ;
  3. sinon la sortie libre.
- **Compte à rebours** : « J-189 », puis « Demain », puis « Aujourd'hui ».

## 4. Accueil (maquettes A, E, F, J, D)

De haut en bas :

1. **Carte de tête**, un seul des cas suivants :
   - **Prochaine sortie dans les 7 jours** (F) :
     - carte « Prochaine sortie » : jour et heure, nom, distance, D+, type, profil, roulage, arrivée, arrêts prévus ;
     - l'objectif s'il existe, réduit à une ligne au-dessus (« 🏁 Race Across Paris · sam. 10 avr. · J-189 »).
   - **Sinon, un objectif** (A, J) : carte « Objectif » avec date, nom, distance, D+, durée estimée, profil et J-n.
     - Sans GPX : profil absent, durée marquée « (estimé) », encart en pointillés « Parcours pas encore publié · Ajouter ».
   - **Sinon** (E) : encadré en pointillés « Pas encore d'objectif » avec le bouton « Fixer un objectif ».
2. **Bouton « Rouler · <nom> »**, gros et jaune. Un appui long ou la flèche ouvre le choix du road book ou de la sortie libre.
3. **Ligne « Prêt à partir »** : une icône par capteur enregistré, avec la couleur de son état, plus le GPS. Le texte à droite signale le premier manque (« cadence absente », « Bluetooth éteint »). Un toucher ouvre « Avant de partir ».
4. **Sortie interrompue** (si Chrome a été tué) : la carte actuelle de Rouler, avec Reprendre ou Terminer.
5. **Dernière sortie** : pastille, nom, date, km, roulage, écart au plan, temps dans la cible. Ouvre le détail.
6. **Road books** : les 3 plus récents (miniature, nom, km, D+, durée) et « Tout voir ». Une course sans GPX a un profil en pointillés et « GPX à venir ».

**Premier lancement** (D), quand il n'y a aucun road book :
- trois étapes : profil (fait ou à faire), importer un GPX ou créer une course, capteurs ;
- puis « Essayer la boucle démo » et « ou sortie libre ».

## 5. Avant de partir (feuille)

Le contenu actuel de Rouler, hors du choix du road book :
- état Bluetooth, GPS et écran maintenu ;
- bloc Capteurs ;
- Démarrer ;
- simulation ;
- transfert.

## 6. Fixer un objectif (G', I, H)

1. « Fixer un objectif » ouvre une feuille :
   - « Nouvelle course » en premier ;
   - puis la liste des road books existants.
2. **Choisir un road book existant** ouvre ses Réglages sur le bloc « Date et type » (H) :
   - type Sortie ou Course ;
   - date, heure de départ ;
   - interrupteur « C'est mon objectif », visible seulement en Course.
3. **Nouvelle course** (I) ouvre un formulaire plein écran :
   - nom, date, départ ;
   - distance et dénivelé ;
   - terrain : plat, vallonné ou montagne ;
   - « Importer le GPX » en lien secondaire ;
   - une estimation en direct avec ton profil : roulage, durée avec arrêts, nuits.
   - « Créer l'objectif » crée le road book (Course, `when`, `est`), le met en objectif et ouvre l'Accueil.

## 7. Course sans GPX (K)

- **Estimation** : `computePlan` tourne sur un **parcours synthétique** construit à partir de `est`. Il a la même distance et le même D+, réparti selon le terrain :
  - plat : petites ondulations ;
  - vallonné : bosses de 1 à 3 km ;
  - montagne : 3 à 6 cols de 8 à 15 km.
  
  Ce parcours sert aux calculs et n'est jamais affiché comme un tracé. Les résultats portent la mention « estimé ».
- **Onglet Parcours** : encart « GPX pas encore publié » avec la distance et le D+ saisis (modifiables) et « Ajouter le GPX ». Il donne aussi la liste de ce qui marche déjà sans tracé :
  - les cibles ;
  - les rappels et alertes ;
  - les notes.
- **Cibles et Réglages** fonctionnent normalement.
- **Points et repères** : pas avant le GPX. On prend l'option simple ; on écrit des notes à la place.
- **Rouler avec** une course sans GPX : impossible. Le bouton propose « Rouler en sortie libre avec ses cibles », qui applique ses cibles et ses rappels.
- **Ajouter le GPX** : le tracé est attaché et `est` est ignoré. Les cibles, la date, les rappels et les notes restent. Une note rappelle : « Distance du GPX : 512 km (saisie : 500 km) ».

## 8. Découpage

1. Modèle, migration, règles (objectif, prochaine sortie, bouton Rouler), tests.
2. Parcours synthétique et estimation sans GPX, tests de réalisme.
3. Accueil (cartes de tête, Prêt à partir, Dernière sortie, Road books, premier lancement) et feuille Avant de partir ; l'onglet Rouler est supprimé.
4. Réglages › Date et type, Fixer un objectif, Nouvelle course.
5. Road book sans GPX (Parcours, Ajouter le GPX, notes).
6. Passe `critique` et `polish` (Impeccable).
