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
