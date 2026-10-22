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

## Tons du jour et couleurs d'état (22 oct., suite)

Retour : le jour était moche ; les couleurs Wada ne servent pas à colorer partout, seulement à vérifier que les couleurs existantes s'accordent.

**Neutres** (fonds, cases, textes) : restent neutres, façon iOS. Quatre tons de jour à comparer (`docs/captures/jour/`) :

| Ton | Fond | Case | Texte | Texte discret |
|---|---|---|---|---|
| A · Gris iOS | #f2f2f7 | #ffffff | #000000 | #6c6c70 |
| B · Lin (chaud) | #ebe9e3 | #fbfaf7 | #1c1b18 | #77736b, ombre très légère |
| C · Blanc | #ffffff | #f3f2ef | #111111 | #7a776f |
| D · Sable | #e4e1d8 | #f7f5ef | #1d1b16 | #6f6a5f |

**Couleurs d'état** : chaque couleur d'iOS remplacée par la couleur la plus proche du dictionnaire de Wada, en deux teintes (claire la nuit, foncée le jour) pour garder le contraste (≥ 4,5:1 pour le texte quand c'est possible) :

| Rôle | Nuit | Jour |
|---|---|---|
| Accent, liens | Pale King's Blue #a7d4e4 | Blue #006eb8 |
| Dans la cible | Green #489b6e | Diamine Green #1a7444 |
| Au-dessus (début), retard | Yellow Orange #f99d1b | Vinaceous Tawny #c56127 |
| Au-dessus (fort) | Eugenia Red A #e2625e | Scarlet #cb2f43 |
| En dessous | Olympic Blue #5a82b3 | Deep Lyons Blue #1c4286 |
| Navigation | Eupatorium Purple #bf5892 | idem |
| Zones Z1 à Z7 | Warm Gray, Olympic Blue, Green, Yellow Ocher, Orange, Scarlet, Red Violet | idem |

Ces couleurs sont associées dans le livre : Blue + Pale King's Blue (n° 49), Blue + Yellow Orange (n° 267), Blue + Eupatorium Purple (n° 215, accent et navigation), Deep Lyons Blue + Diamine Green (n° 38), Scarlet + Red Violet (n° 136), Blue + Yellow Ocher (n° 191).
