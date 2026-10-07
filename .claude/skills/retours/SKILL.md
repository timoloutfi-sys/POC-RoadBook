---
name: retours
description: Range les retours de l'utilisateur (texte libre, captures d'écran) dans BACKLOG.md, un point par ligne, et les règles générales dans docs/REGLES-UX.md. À utiliser dès que l'utilisateur donne des retours, remarques, bugs ou envies sur l'appli, même sans taper /retours.
---

# Ranger des retours

L'utilisateur ne touche jamais aux fichiers : il écrit ses retours dans la conversation (texte, captures). Toi, tu les ranges.

1. Lis `BACKLOG.md` et `docs/REGLES-UX.md`.
2. Découpe le message en **points indépendants**, chacun faisable seul. Une capture se décrit en une phrase (écran, élément, problème).
3. Ajoute chaque point dans « À faire » de `BACKLOG.md`, au format :
   `- [ ] Écran › élément : ce qui ne va pas → ce que l'utilisateur veut`
   - Bug : préfixe `🐞`. Il faudra un test dans `scripts/e2e.mjs`.
   - Vrai choix de direction à valider avant de coder (nouvel écran, changement de concept) : préfixe `❓`.
   - Ne recopie pas un point déjà présent ; complète-le.
4. Si un retour vaut pour **toute l'appli** (ex. « pas de texte d'explication », « boutons plus petits »), ajoute ou précise la règle dans `docs/REGLES-UX.md`.
5. Commit (`Backlog : …`) et push.
6. Réponds en **3 lignes maximum** : nombre de points ajoutés, les éventuels `❓` à trancher (une question fermée chacun), puis « Dis /lot pour que je les traite ». Si l'utilisateur a déjà demandé de les traiter, enchaîne directement sur le skill `lot`.
