# Étude : le style d'iOS appliqué à Road book

Demande (22 oct.) : étudier les principes de design d'iOS (couleurs, formes, bordures, textes) et proposer quelque chose de propre, travaillé, épuré. Les palettes Wada sont abandonnées.

## Ce que fait iOS

- **Couleurs « sémantiques »** : on ne choisit pas une couleur mais un rôle (texte principal, texte secondaire, fond, fond groupé, séparateur, remplissage), et chaque rôle a sa valeur en clair et en sombre — le sombre n'est pas l'inverse du clair. Fond système **noir pur** en sombre, **blanc** en clair ; fonds secondaires gris (#1C1C1E / #F2F2F7). Texte secondaire = blanc ou noir **à 60 %**, pas un gris inventé. **Une seule couleur d'accent** (la « teinte », bleu système par défaut) pour tout ce qui se touche. Couleurs système : bleu, vert, orange, rouge, jaune… avec une version claire et une version sombre chacune.
- **Formes** : coins arrondis partout, **listes groupées** en blocs arrondis (« inset grouped »), cartes plus arrondies, feuilles du bas très arrondies avec une poignée. Depuis iOS 26 (« Liquid Glass ») : formes concentriques, barre d'onglets flottante et translucide, réservée aux commandes, jamais au contenu.
- **Bordures** : **presque aucune**. On sépare par la couleur de fond (bloc gris sur fond noir) et par des **traits très fins** (un demi-pixel), décalés à gauche pour s'aligner sur le texte, jamais d'un bord à l'autre.
- **Texte** : une seule famille (SF Pro), une échelle fixe : grand titre 34, titre 28/22/20, corps 17, sous-titre 15, note 13, légende 12/11 ; poids **semi-gras** pour les titres plutôt que gras partout ; chiffres à largeur fixe ; en-têtes de section en petites capitales grises. Zones à toucher d'au moins 44 points.
- **SF Pro n'est pas utilisable** sur Android ni sur le web (licence Apple). Remplaçant libre le plus proche : **Inter** (et **Inter Tight** pour les gros chiffres).

## Ce que le prototype change (captures « avant / après » dans `docs/captures/ios/`)

- Fond noir pur, blocs #1C1C1E, aucun contour ; une seule teinte bleue pour boutons, liens, onglet actif ; vert, orange, rouge système pour les états.
- Grand titre de 34 ; en-têtes de section en petites capitales grises alignées sur les cellules.
- Listes et réglages en blocs arrondis avec traits fins décalés ; chiffres clés dans des cases arrondies.
- Boutons : principal rempli (bleu, texte blanc), secondaire gris translucide à texte bleu, discret en texte seul.
- Contrôle segmenté façon iOS (pastille grise qui glisse) ; feuilles du bas arrondies à poignée ; barre d'onglets translucide sans trait coloré.
- Vue de course : cases très arrondies sans contour, noir pur la nuit, gris très clair le jour, chiffres Inter Tight.

Prototype : `src/dev/ios.css` (chargé par `src/dev/iosTheme.ts` pour les captures, rien n'est encore appliqué à l'appli).

## Sources

- [Apple, typographie (HIG)](https://developer-mdn.apple.com/design/human-interface-guidelines/foundations/typography), [WWDC 2019 : couleurs sémantiques et mode sombre](https://developer.apple.com/kr/videos/play/wwdc2019/808/), [tailles de texte iOS](https://learnui.design/blog/ios-font-size-guidelines.html)
- Liquid Glass (iOS 26) : [STRV](https://www.strv.com/blog/how-to-apply-liquid-glass-to-your-app), [Mindbowser](https://www.mindbowser.com/ios-26-liquid-glass-react-native-health-app-guide/)
- Licence SF Pro : [forums développeurs Apple](https://developer.apple.com/forums/thread/733267)
