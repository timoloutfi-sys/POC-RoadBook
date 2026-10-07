# Backlog

Une ligne par point, du plus important au moins important. Capture si besoin (glisser l'image dans le message, ou `docs/captures/`).
Format : `- [ ] Écran › élément : ce qui ne va pas → ce que je veux`. Claude coche `[x]` et ajoute le commit.

## À faire
- [ ] Road books › carte de la liste : on voit seulement la courbe → montrer si le road book est travaillé : nombre de points, zones/cibles posées, plan fait ou pas, GPX présent (aperçu plus parlant, profil avec les zones et points repérés).
- [ ] Road book › Cibles : une section nouvelle a « Personnalisée » par défaut → une zone par défaut (Z2 etc.), la fourchette perso reste un choix.
- [ ] Plan › « Suggérer un plan » en seuil (et autres intentions) : regroupe les efforts en un gros bloc même quand c'est loin d'être idéal → mieux répartir les efforts (plusieurs blocs, répartis sur le parcours, selon les montées et la récupération).
- [ ] Widgets › Temps par zone 1×2 : barres minuscules, beaucoup de vide → remplir la case (ou retirer la taille).
- [ ] Widgets › Dans la cible 1×1 : chiffre petit par rapport à la case.
- [ ] Éditeur › animation des widgets : animer en transformations plutôt qu'en position (signalé par Impeccable) si saccades sur le téléphone.
- [ ] Route › mémo libre du road book à afficher dans « Prochains points » (variante Notes).
- [ ] Profil › variantes « restant » et « complet » ; Puissance › moyenne 3/10/30 s.

- [x] Écrans › choix de l'écran selon le type de sortie : écran du road book, sinon écran propre à la sortie libre, sinon écran de départ (★), sinon le premier ; réglable dans « Avant de partir ».

## En cours

## Fait
- [x] Couleurs d'état cohérentes dans tous les widgets (source unique `src/ui/state.ts`) : écart au plan en retard = ambre puis rouge.
- [x] Prochains points : titre du type + texte de l'utilisateur dessous, distance et temps à droite (sans l'heure), polices bornées.
- [x] Écrans prêts à l'emploi réduits à 3 : Course, Entraînement, Sortie libre (sans widget qui exige un parcours).
