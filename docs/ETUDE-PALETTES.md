# Étude : palettes de couleurs d'après Sanzo Wada

Demande (22 oct.) : une palette pour tout le logiciel, qui respecte le *Dictionary of Color Combinations* de Sanzo Wada (1933).

Source des couleurs : la version numérique du dictionnaire ([mattdesl/dictionary-of-colour-combinations](https://github.com/mattdesl/dictionary-of-colour-combinations), 159 couleurs, 348 combinaisons). **Chaque couleur proposée est une couleur du livre, avec son nom** ; chaque palette part d'une ou deux combinaisons du livre, puis complète les rôles de l'appli avec d'autres couleurs du même livre. Aucune teinte inventée.

Données : `src/dev/palettes.ts`. Planches : `palettes.html?p=<id>` (dev). Captures : `docs/captures/palettes/` (planche avec écran de course jour et nuit, Accueil et Plan de l'appli réelle).

| Palette | Combinaisons | Idée |
|---|---|---|
| **Indigo et jaune** | 295, 126 | Nuit d'encre (Dull Violet Black) et jaune vif : le plus fort contraste, au soleil comme la nuit. Jour sur papier ivoire. |
| **Ardoise et orange** | 140, 340 | Noir et ardoise, orange pêche, bleu d'Anvers, vert d'eau : sobre, « instrument ». Le plus proche de l'appli actuelle. |
| **Forêt et corail** | 332, 284 | Vert ardoise profond, papier soufre, jaune abricot, corail : chaud, « carnet de route ». |
| **Carmin et lavande** | 307, 329 | Pourpre Cotinga, lavande, carmin, jaune crème : la plus « Wada », élégante, un peu moins contrastée en plein soleil. |

Rôles couverts par chaque palette : fond, case, trait, texte, texte discret (jour et nuit) ; accent (boutons) ; navigation (tracé) ; dans la cible ; au-dessus du seuil (début, fort) ; en dessous (début, fort) ; zones Z1 à Z7.

À vérifier avant d'adopter : contraste des petits textes (règles d'accessibilité), lisibilité en plein soleil sur le téléphone, et distinction des zones voisines pour les daltoniens (Z3/Z4 surtout). Les alertes de seuil sont aujourd'hui des dégradés calculés dans `Device.tsx` : ils passeront sur les couleurs de la palette retenue.
