# Méthode de travail

Objectif : avancer vite sans perdre ce qui a été décidé. **La mémoire du projet est dans le dépôt, pas dans une conversation.**

## Où est quoi
| Fichier | Rôle |
|---|---|
| `CLAUDE.md` | Contexte et architecture, lu automatiquement à chaque session |
| `PRODUCT.md` | Vérité produit |
| `docs/REGLES-UX.md` | Règles d'interface tirées des retours (à lire avant tout écran) |
| `BACKLOG.md` | Ce qu'il reste à faire, par lots |
| `docs/SPEC-*.md` | Specs validées par sujet |

## Le cycle
1. **L'utilisateur** essaie l'appli sur son téléphone et note tout dans `BACKLOG.md` (ou dans un seul message, que Claude recopie dans le backlog).
2. **Claude** traite le lot : un commit par point, puis `npm run check` (types, tests, lint, tests au doigt) et `npm run shots`, regarde les captures, corrige, pousse.
3. Un seul compte rendu numéroté, avec les captures utiles. Les points cochés passent dans « Fait ».
4. Chaque bug remonté devient un test dans `scripts/e2e.mjs`. Chaque retour qui vaut pour toute l'appli devient une règle dans `docs/REGLES-UX.md`.

## Sessions
- **Une session par lot.** Démarrer une nouvelle session plutôt que prolonger une conversation : tout le contexte utile est dans les fichiers ci-dessus.
- Message de départ type : « Traite le backlog » ou « Traite les points 1 à 5 du backlog ».
- La session cloud installe tout au démarrage (`.claude/hooks/session-start.sh`).

## En parallèle
Quand le backlog a plusieurs sujets indépendants (ex. widgets, road books, modèle physique) :
- Claude lance une session par sujet, chacune sur sa propre branche (`lot/<sujet>`), avec la consigne de lire `CLAUDE.md`, `docs/REGLES-UX.md` et sa partie du backlog.
- Chaque session vérifie (`npm run check`) et pousse sa branche ; la session principale fusionne dans la branche de travail et relance les vérifications.
- À éviter : deux sessions sur les mêmes fichiers (ex. deux lots qui touchent `ScreenEditor.tsx`).

## Commandes
| Commande | Effet |
|---|---|
| `npm run check` | Types, tests unitaires, lint, tests au doigt : à lancer avant chaque push |
| `npm run e2e [-- filtre]` | Tests de bout en bout sur un téléphone simulé (toucher, appui long, glisser) |
| `npm run shots [-- filtre]` | Captures 390 × 844 / 844 × 390 dans `shots/` : écrans, widgets par famille, pages de l'appli |
| `npm run dev` puis `/POC-RoadBook/gallery.html` | Galerie : écrans prêts à l'emploi et chaque widget à chaque taille (`?v=widgets&k=zones`) |
