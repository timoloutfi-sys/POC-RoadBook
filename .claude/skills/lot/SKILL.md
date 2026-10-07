---
name: lot
description: Traite le backlog d'un coup : code chaque point (en parallèle quand c'est indépendant), vérifie au doigt et en captures, pousse, puis un seul compte rendu court. À utiliser quand l'utilisateur dit /lot, « avance », « traite le backlog », « traite les points ».
---

# Traiter un lot du backlog

## 1. Préparer
- Lis `CLAUDE.md`, `docs/REGLES-UX.md`, `BACKLOG.md`.
- Prends les points « À faire » (tous, ou ceux que l'utilisateur cite). Saute les `❓` non tranchés et dis-le dans le compte rendu.
- Regroupe-les par zone de code (ex. widgets `ui/tiles.tsx` · éditeur `ui/ScreenEditor.tsx` · road books `ui/RoadBooksTab.tsx` · modèle `strategy/`). Deux groupes ne doivent pas toucher les mêmes fichiers.

## 2. Coder
- **3 groupes indépendants ou plus** : lance un agent `developpeur` par groupe, en parallèle (outil Agent, `isolation: "worktree"`), avec la liste exacte de ses points. Chacun commite sur sa propre branche. Ensuite, fusionne leurs branches dans la branche de travail (`git merge`) et règle les conflits.
- **Sinon** : fais-le toi-même, **un commit par point**.
- Chaque `🐞` reçoit un test dans `scripts/e2e.mjs` qui échouait avant la correction.
- Ne montre jamais de maquette dessinée : seulement l'appli réelle.

## 3. Vérifier
- Lance l'agent `verificateur`. Il exécute `npm run check` et `npm run shots`, puis relit les captures avec les règles UX.
- Corrige ce qu'il remonte et relance jusqu'à ce que tout passe.

## 4. Livrer
- Coche les points traités dans `BACKLOG.md` et déplace-les dans « Fait », avec le hash court du commit.
- Ajoute à `docs/REGLES-UX.md` toute règle générale apprise.
- Commit et push.
- Compte rendu : **une ligne par point** (« ✓ … » ou « ✗ … : pourquoi »), puis 1 à 4 captures utiles envoyées avec SendUserFile. Pas de détails techniques sauf demande. Rappelle de recharger la page deux fois pour la nouvelle version.
