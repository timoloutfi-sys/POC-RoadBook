# Règles UX (à lire avant toute modification d'écran)

Tirées des retours du porteur du projet. Chaque nouveau retour qui vaut pour toute l'appli s'ajoute ici.
Critère final : **une personne qui sait utiliser un iPhone sait utiliser l'appli sans aucune explication.**

## Textes
- **Aucun texte d'explication à l'écran** (« Touche un widget pour… », « Glisse pour… », légendes d'aide). Si un geste a besoin d'être expliqué, c'est le geste qu'il faut changer.
- Noms courts et factuels, pas de jargon ni de phrase. Descriptions : l'essentiel seulement, rien d'évident.
- Pas de titre qui change ou de bandeau « mode modification » : l'écran reste le même.

## Taille et densité
- Contrôles **compacts** : segments et boutons secondaires 32–36 px de haut, police 14–15 px. Le gros bouton plein n'est que pour l'action principale de l'écran (Rouler).
- Pas de grands blocs de boutons : une petite barre flottante près de l'objet sélectionné.
- Les listes sont denses (lignes de ~44–52 px), sans icônes décoratives qui « font cheap ».

## Gestes (comme sur iPhone / Android)
- **Toucher ailleurs** désélectionne et ferme (fenêtres, menus, mode modification). Pas de bouton OK pour sortir d'un mode.
- **Appui long** = mode modification : le téléphone vibre, ✕ en haut à gauche, ☆ favori, glisser pour réordonner. **Rien ne tremble.**
- Glisser-déposer **animé** : l'objet suit le doigt, les autres glissent vers leur nouvelle place ; marche aussi entre tailles différentes.
- Fenêtre du bas (catalogue) : **basse** (~45 % de l'écran) pour voir et glisser sur l'écran derrière ; liste → page de détail dans la même fenêtre, « ‹ » pour revenir.
- Un toucher qui ferme une fenêtre ne doit **jamais traverser** vers ce qu'il y a dessous (déclencher sur `click`, pas sur `pointerup`).

## Widgets
- Un widget **remplit toute sa case** à chaque taille autorisée : pas de grands vides. Sinon, retirer la taille.
- **Couleurs d'état partout** et cohérentes : vert = bon, ambre = moyen, rouge = faible / trop haut, bleu = sous la cible. La couleur s'accompagne toujours d'un texte ou d'une forme.
- **Sémantique des couleurs** (source unique : `src/ui/state.ts`) : vert = bien (dans les temps, en avance, réserve haute, dérive faible), ambre = à surveiller (petit retard jusqu'à 5 min, réserve moyenne…), rouge = mauvais (retard de plus de 5 min, réserve faible, dérive ≥ 5 %), bleu = sous la cible (effort seulement). Une grandeur neutre (cadence, distance, pente, vitesse) n'a pas de couleur d'état. Tout nouveau widget qui juge une valeur passe par `state.ts`.
- Pas de fond coloré plein qui dénote avec le reste (la couleur va sur le chiffre, la jauge ou la barre).
- Une seule entrée au catalogue par fonction : les variantes d'affichage (points / notes / arrêts…) vont dans les **Réglages du widget**, pas dans des widgets dupliqués.
- Réglages d'un widget = seulement les siens.
- Listes de points : **une ligne par point**, empilées comme un cahier. Titre = le type (Point d'eau, Danger, Note), dessous le texte de l'utilisateur en plus petit (sur plusieurs lignes si la place le permet), à droite la distance et le temps restants (pas l'heure d'arrivée). Polices bornées (pas de texte géant dans un grand widget).
- **Écrans prêts à l'emploi : peu et utiles** (aujourd'hui 3 : Course, Entraînement, Sortie libre), chacun pensé pour un usage précis, sans widget qui exige un parcours dans « Sortie libre ».
- L'aperçu « Puissance » montre des watts, « FC » des bpm, quel que soit le profil.

## Maquettes et validation
- Pas de maquettes dessinées à la main : on montre **l'appli réelle** (captures `npm run shots`, ou la galerie `gallery.html`).
- Pas d'annotations dans les captures montrées.
- Les grands choix de direction se valident avant de coder ; les corrections et retouches se font directement, l'utilisateur juge sur son téléphone.

## Technique (pièges déjà rencontrés)
- Noms de classes CSS : préfixer (`zs-`, `rv-`, `nb-`…) ; `.ghost`, `.stack`, `.pv` sont déjà pris par l'appli et ont causé des bugs d'affichage.
- Fermer une fenêtre ou désélectionner doit aussi remettre à zéro les états liés (ex. réglages ouverts).

- Un widget qui exige un plan (« Dans la cible ») n'est jamais proposé dans un écran de sortie libre.
- Les heures du plan sont théoriques tant que la sortie n'est pas lancée ; au départ de l'enregistrement elles sont recalées sur l'heure réelle (« prévu » = départ réel + durée prévue).

- Vocabulaire du Plan (repris des outils de référence : Best Bike Split, Strava, TrainingPeaks) : onglet **Plan**, section **Terrain** (plat, montée, descente), section **Segments** (un tronçon km à km avec sa cible). Ne pas réintroduire « exception », « cible de base » ou « par tronçon ».

- Gestes en sortie (décision du 23 oct.) : **appui long n'importe où** (0,6 s, vibration) = barre « Capteurs », « Appli », « Quitter », un simple toucher par erreur n'ouvre rien ; une aide « Appui long : menu · Glisser : écran suivant » s'affiche au départ ; **toucher un widget** = son action (Tour : nouveau tour ; Rappel : Fait ; Navigation : vue d'ensemble 10 s ; Profil et Puissance : réglage suivant, pour la sortie en cours) ou, sans action, le widget grossi sur place 6 s (loupe, environ une fois et demie, jamais tout l'écran) ; toucher le bandeau d'un rappel = Fait. Pas de changement d'écran en glissant pour l'instant (il défilait entre tous les écrans ; il faudra choisir lesquels défilent). Plus de bande ni de geste caché sur les bords. Chaque toucher répond par une courte vibration et, si besoin, une pastille (« Fait », « Profil : 15 km »). La fin demande confirmation.
- Le bouton « Rouler » n’est pas collé en bas de chaque page : sur chaque carte de la liste des road books (pas de second bouton en tête de liste), et dans l’onglet Sorties du road book.
- Sur l'Accueil, « Sortie libre » est un bouton visible à côté de « Autre road book », jamais derrière une petite icône.
- Une feuille « Nouvel écran » propose seulement les modèles et l'écran vide.

- Tout km se saisit en trois gestes : toucher le profil, tirer une extrémité du tronçon, ou régler au curseur fin (±2 km, pas de 0,1) à côté du champ. Le champ numérique reste pour les valeurs exactes.
- Les boutons d'action d'une page (Suggérer un plan, Rouler avec) ont la taille d'un bouton normal, pas « big » : la place est pour le contenu.
- Les cibles s’affichent en zone (« Z2 · Endurance ») ; la fourchette en watts ou bpm n’apparaît que si elle est personnalisée.

- Toute sortie démarre par la feuille « Avant de partir » (road book, écran, capteurs), puis « Démarrer la sortie » : aucun bouton « Rouler » ne lance directement l'écran de sortie, sauf « Reprendre » une sortie en cours.

- Pendant une sortie, on peut revenir à l'appli sans la terminer (bouton « Appli » de la barre) : un bandeau « Sortie en cours » reste au-dessus de la navigation et ramène à l'écran de course d'un toucher. Les réglages modifiés (écrans, plan, alertes) s'appliquent à la sortie en cours.

- Style (oct. 2026) : façon iOS, défini dans `src/ui/theme.css` (étude : `docs/ETUDE-IOS.md`). Police Inter, Inter Tight pour les gros chiffres. Neutres à la Apple : noir pur et blocs #1C1C1E la nuit, ton « Lin » le jour (#ebe9e3, cases #fbfaf7). Pas de contours : on sépare par le fond et par des traits fins décalés. Listes en blocs arrondis ; les cartes (road books) restent séparées par un espace, jamais fondues en un bloc. Accent « Carmin » (combinaison n° 221 de Wada : Carmine Red #a62c37, Neutral Gray #b6bfc1, Black) : boutons carmin à texte blanc, liens carmin le jour et gris neutre la nuit. Choisi parmi des combinaisons du livre accordées au Lin ; les teintes vives prises hors combinaison avaient toutes été refusées. Texte d'un bouton : contraste d'au moins 3:1 (le blanc sur jaune doré a été écarté pour ça).
- Couleurs d'état, zones et alertes : prises dans le dictionnaire de Sanzo Wada (teinte claire la nuit, foncée le jour), pour s'accorder entre elles. On n'ajoute pas de couleur décorative : une couleur = un sens (accent, dans la cible, au-dessus, en dessous, zone, navigation).
- L'appli suit le thème du téléphone (clair ou sombre), forçable dans Réglages → Apparence. Tout écran se vérifie dans les deux.
- Accueil léger : une seule carte forte (prochaine sortie ou objectif), le bouton Rouler, puis des lignes discrètes (autres choix en texte, capteurs en icônes sur une ligne). Pas de paragraphe d'explication sur l'Accueil.
- Navigation : un widget comme les autres, jamais de recalcul d'itinéraire. Tracé et consignes en carmin, chevron encre, ce qui est fait en gris ; « Hors parcours » en ocre avec la direction du tracé en mots (derrière à droite…) et une ligne pointillée vers lui. Carte calme : routes, eau, verdure, noms de rues, rien d'autre.
- Navigation dans l'éditeur et les vignettes : un aperçu dessiné, jamais une vraie carte (pas de réseau ni de WebGL pour un aperçu).
- La carte hors ligne se télécharge depuis le road book (Réglages) ; « Avant de partir » ne la mentionne que si l'écran de la sortie a un widget Navigation.
- Une action liée à un widget se fait en le touchant, et le widget dit le geste quand il a la place (Tour : « Toucher : nouveau tour », les moyennes du tour fini passent en bandeau). Ce toucher n'ouvre pas la barre de la sortie.
- La carte de navigation ne bouge qu'une fois par seconde, et seulement si on a avancé ou tourné ; une tuile annulée n'est jamais rendue vide (sinon le fond clignote).
- Le chrono du Tour est un chronomètre : il démarre au toucher et tourne aussi à l'arrêt ; seules ses moyennes (vitesse, puissance, FC) ne comptent que le temps en mouvement. Le temps de roulage, lui, ne compte que quand on avance.
- Un widget garde le même identifiant d'une image à l'autre et d'une orientation à l'autre (portrait déduit du paysage compris) : sinon il est recréé à chaque image (carte qui clignote, compteurs qui repartent).
- Vue de course : toute la surface du téléphone (seule l'encoche de la caméra est évitée) ; la bande des gestes se pose sur le bord sans prendre de place ; les widgets des coins suivent l'arrondi de l'écran et leur contenu s'en écarte.
