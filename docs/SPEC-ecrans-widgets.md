# Spec : profil à pas variable, moteur de sortie, widgets, éditeur d'écrans

Statut : validé, prêt à coder. Maquettes : `docs/maquettes/widgets/` (catalogue final : `catalogue-1` à `5`, `corrections`, `zone-en-cours`) et `docs/maquettes/editeur/` (`ecran-1` à `8`).
Contrainte transverse : cible matérielle de `CLAUDE.md`. On prépare sur le téléphone, et la sortie tourne à partir d'un paquet, sans réseau, avec des calculs incrémentaux.

---

## 1. Profil à pas variable et tracé fin

**Tracé fin**
- Les points du GPX sont gardés et simplifiés (Douglas-Peucker, écart ≤ 2,5 m).
- Le tracé fin sert à la position, aux virages, au dessin et à la détection de sortie de route.

**Profil en tronçons de pente constante**
1. Rééchantillonnage à 5 m le long du tracé fin.
2. Lissage de l'altitude sur ~60 m.
3. Découpage récursif, tant qu'une de ces conditions est vraie :
   - écart d'altitude au segment > 0,5 m ;
   - variation de pente > 1 point ;
   - virage dont la vitesse maximale est < 45 km/h ;
   - point du road book ;
   - changement de cible.
4. Bornes : 10 m minimum, 300 m maximum.

**Données de chaque tronçon** : début (m), longueur, altitude, pente, vitesse maximale en virage (rayon sur le tracé fin, v = √(3·r)), densité de l'air.

**Simulation** : `simulateRide` passe de tronçon en tronçon, avec des sous-pas de 10 m au plus (inertie, freinage avant les virages).

**Réalisé (étape 1, version hybride)** : `Route` porte désormais `track` (tracé fin, `route/track.ts`) et `profile` (tronçons de pente constante, `route/profile.ts`). Le **plan reste calculé sur sa grille de 50 m** (`STEP`) pour ne pas réécrire `plan.ts`, `pacing.ts` et `kinematics.ts`, mais cette grille est alimentée par la pente exacte du profil et par les vitesses de virage lues sur le tracé fin (`cornerCaps`). Le recalage GPS, les virages, le dessin, le paquet de sortie et les widgets utilisent le tracé fin et le profil. La simulation par tronçon reste possible plus tard ; elle n'est pas nécessaire pour la précision actuelle. Migration : les parcours enregistrés sont reconstruits à l'ouverture à partir de leurs points.

**Tests contre une référence à 5 m**

| Mesure | Tolérance |
|---|---|
| Altitude | ≤ 0,5 m |
| D+ | ± 1 % |
| Pente d'un km de montée | ± 0,3 point |
| Temps estimé | ± 0,5 % |
| Vitesse en épingle (rayon 10 m) | ≤ 22 km/h |

## 2. Position fluide

- **Recalage** : projection sur le segment du tracé fin le plus proche, avec une recherche locale autour du dernier segment, puis globale au-delà de 150 m. La distance est continue.
- **Entre deux positions GPS** : la distance avance avec la vitesse du capteur, ou à défaut la dernière vitesse GPS. Le recalage se fait en douceur (correction répartie sur 3 s, pas de saut en arrière de moins de 30 m).
- **Affichage** : 1 Hz sur le boîtier. Sur le téléphone, interpolation jusqu'à ~4 Hz pour le curseur et les distances.

## 3. Paquet de sortie et moteur

**Paquet** (`RideBundle`, versionné), produit à la préparation : il contient tout ce dont la sortie a besoin, et rien d'autre.
- tronçons (§ 1) et tracé fin ;
- cibles par tronçon ;
- temps prévu et énergie prévue cumulés par tronçon ;
- points et repères avec leurs annonces ;
- montées (début, fin, pente par tronçon) ;
- profils réduits (complet, 400 colonnes) ;
- heures de lever et de coucher du soleil sur le trajet ;
- rappels, alertes et leurs écarts propres au road book ;
- réglages du coureur (FTP, FC seuil, poids, W′, table des glucides) ;
- écrans.

**Moteur** (`ride/engine`) : pur, sans DOM ni store.
- Il ne lit que le paquet et les mesures : `tick(état, mesures, t)`, appelé chaque seconde, qui renvoie l'état et les données des widgets.
- Mémoire bornée : seul l'enregistrement grandit.
- Tests sur des fichiers de référence (entrées → sorties attendues) pour un futur portage.

**Ce qui change dans l'existant**
- La vue de course, l'enregistreur et les alertes passent par le moteur.
- `targetAt`, `buildData` et `progress` lisent le paquet.

## 4. Calculs ajoutés au moteur (incrémentaux)

| Calcul | Méthode |
|---|---|
| **Punch** (W′bal) | Skiba, forme différentielle. CP = FTP, W′ = 18 kJ (réglable). Dépense au-dessus de CP ; recharge en dessous avec τ = 546·e^(−0,01·(CP − P)) + 316. En %. |
| **Endurance** | 100 % moins la baisse due au travail : fonction des kJ/kg cumulés pondérés par l'intensité et de la durée, cohérente avec `durability`. Estimation, à calibrer sur les sorties. |
| **Dérive cardiaque** | Rapport FC / puissance (moyenne glissante 10 min, seulement en effort stable). Comparé à la référence des 20 premières minutes après échauffement. En %, limite 5 %. Demande puissance et FC. |
| **Glucides brûlés** | kJ × part de glucides selon l'intensité (table préparée à partir de % FTP : 25 % jusqu'à 40 % de la FTP, 40 % à 60 %, 65 % à 85 %, 85 % à 100 %, 100 % à partir de 130 %) / (4,18 kJ/kcal × 4 kcal/g) / rendement. ± 20 %. Sans capteur de puissance : estimés depuis la FC. |
| **Glucides mangés** | « Fait » d'un rappel = quantité du rappel (nouveau champ `grams`, eau en `ml`). |
| **Temps par zone** | Compteurs Z1 à Z5+ (au-dessus de 106 % de FTP). Zone en cours et depuis quand. |
| **Dans la cible** | Compteurs sous, dans et au-dessus de la cible (secondes en mouvement). |
| **Tour** | Appui long à droite = nouveau tour. Moyennes du tour (puissance, FC, cadence, vitesse, durée). Le geste « Fait » existant passe sur le bouton ou geste « rappel ». |
| **Téléphone** | Niveau (`getBattery`). Autonomie à partir de la pente sur 30 min, après 15 min de mesure. « en charge » si branché. |

## 5. Catalogue de widgets (25)

**Règles de mise en page** (maquette `catalogue-1`) :
- La valeur prend la plus grande taille qui tient (`cqw` / `cqh`, nombre de caractères).
- Large : valeur à gauche, détails à droite. Haut : valeur en haut, jauge sur le reste. Carré : grande valeur centrée, détails en bas.
- Chaque widget n'accepte que ses tailles autorisées.
- Chaque information en couleur a aussi un texte ou une forme. Aucune animation n'est nécessaire.
- Les données d'un widget sont décrites par des données (valeur, unité, état, couleur et libellé), indépendantes du rendu.

| Groupe | Widget | Tailles | Réglages |
|---|---|---|---|
| Effort | Puissance | 1×1 2×1 1×2 2×2 | 3 / 10 / 30 s, W ou W/kg |
| | FC (comme Puissance) | 1×1 2×1 1×2 2×2 | — |
| | Cadence | 1×1 2×1 | — |
| | Vitesse | 1×1 2×1 | instantanée ou moyenne |
| | Cible | 2×1 3×1 2×2 | — |
| | Zone | 1×1 2×1 | — |
| | Temps par zone (repère au bout de la barre) | 2×1 1×2 2×2 3×1 3×2 | — |
| | Dans la cible | 1×1 2×1 3×1 | — |
| Réserves | Réserve (Punch + Endurance) | 2×1 1×2 2×2 | — |
| | Punch | 1×1 2×1 | — |
| | Endurance | 1×1 2×1 | — |
| | Dérive cardiaque | 1×1 2×1 | — |
| | Glucides / h | 1×1 2×1 2×2 | — |
| | Écart glucides | 1×1 2×1 | — |
| | Rappel | 1×1 2×1 | — |
| Entraînement | Tour | 1×1 2×1 2×2 | — |
| Parcours | Profil | 3×1→6×1, 3×2→6×2, compact 2×1 | à venir (5/15/25 km), restant, complet ; points affichés ; montées teintées |
| | Montée | 2×1 4×1 2×2 4×2 | — |
| | Prochains points | 2×1 3×1 4×1 6×1 2×2 3×2 4×2 6×2 | afficher : points et notes, points, notes, arrêts |
| | Pente | 1×1 | — |
| Temps et plan | Écart au plan (avec la dépense contre le prévu en 2×2) | 1×1 2×1 2×2 | — |
| | Arrivée | 1×1 2×1 | — |
| | Roulage | 1×1 2×1 | — |
| | Distance | 1×1 2×1 | — |
| | Heure | 1×1 2×1 | — |
| Synthèses | Synthèse effort, parcours, nutrition | 2×1 3×1 2×2 3×2 4×2 | — |
| Repères | Coucher du soleil (« Lever du soleil » la nuit) | 1×1 2×1 | — |
| | Téléphone | 1×1 2×1 | — |

**Paliers de pente (Montée)** : < 4, 4–6, 6–8, 8–10, ≥ 10 %. Les tronçons déjà faits sont estompés et la position est marquée d'un trait bleu.

**Disponibilité** : sans la donnée nécessaire, le widget affiche ce qu'il lui manque (« GPX requis », « Capteur de puissance requis »).

**Migration des écrans existants**
- `next` et `stop` deviennent « Prochains points ».
- `cum` est fusionné dans « Écart au plan ».
- `clock` devient « Heure ».
- `profile` devient « Profil » (à venir, 15 km).
- Un widget à une taille non autorisée prend la taille autorisée la plus proche.

**Écrans prêts à l'emploi** : Sortie / cyclo, Entraînement, Ultra, Sortie libre sans capteur. Ils remplacent Ultra, CLM et Triathlon.

## 6. Éditeur d'écrans (piste A, maquettes `ecran-1` à `ecran-7`)

_Catalogue : panneau de hauteur standard en bas, non modal ; les familles se déroulent sur place ; une taille se pose d'un toucher ou par appui long puis glisser sur l'écran (emplacement visé en surbrillance) ; un widget glissé sur un autre de même taille échange sa place ; un glisser compte pour un seul changement annulable._

_Réalisé (étape 6) : paysage et portrait, sélection, déplacer, agrandir aux tailles autorisées, catalogue avec recherche, catégories et aperçus, case vide, réglages, annuler. Pas encore : glisser depuis le catalogue, échange de places entre widgets de même taille, widget recouvert déplacé sur l'écran suivant, appui long sur la liste des écrans._

**Disposition**
- Un écran a deux dispositions : paysage 6 × 3 et portrait 3 × 6.
- La sortie et l'éditeur suivent l'orientation du téléphone.
- La première disposition portrait est générée depuis le paysage (ordre de lecture, gros widgets d'abord).

**Liste des écrans** : aperçus. Un appui long permet de renommer, dupliquer, réordonner ou supprimer. L'écran de départ est marqué ★.

**Mode édition**
- Plein écran, avec une barre Annuler / nom / points de page / Terminé, une grille en pointillés et « ＋ Widget ».
- Rien n'est enregistré avant Terminé.

**Manipulations**
- **Sélection** : un toucher sélectionne. Poignées sur les 4 bords. Barre d'actions : Remplacer · Réglages · Dupliquer · Retirer (avec annulation).
- **Déplacer** : glisser. L'emplacement visé s'allume. Les autres widgets se décalent, ou échangent leur place s'ils ont la même taille.
- **Agrandir** : tirer une poignée. Le cadre s'arrête aux tailles autorisées, la taille s'affiche et le rendu change en direct. Un widget recouvert prend une place libre, sinon passe sur l'écran suivant.

**Catalogue**
- 8 familles (Effort, Zones, Réserves, Nutrition, Relief, Prochains points, Valeur, Synthèse) ; chaque widget y est une variante. Une ligne par famille, un toucher ouvre la famille (variante, taille avec aperçu, Ajouter). La variante se change ensuite dans Réglages.
- Panneau à droite en paysage, en bas en portrait.
- Recherche, puis catégories (Effort, Réserves, Entraînement, Parcours, Temps et plan, Repères).
- Aperçus réels à chaque taille autorisée.
- Toucher pour poser à la première place libre, ou glisser sur l'écran.

**Case vide** : un toucher propose les widgets qui tiennent dans la place libre.

**Aperçu** : jour / nuit, puissance / cardio.

**Gestes de course**
- En portrait : bande du bas = rappel « Fait » (appui long), tour (double appui) et écran suivant (glisser) ; bande du haut = quitter (appui long 1,5 s).
- En paysage : comme aujourd'hui, avec le double appui pour le tour.

## 7. Corrections du modèle (analyse du 5 oct.)

1. **Allure course** : recaler la NP simulée (roue libre comprise) sur la NP visée.
2. **Parcours fictif** : virages simulés ou vitesse maximale de 45 km/h en descente.
3. **Arrêts en ultra** : 12 min/h au-delà de 16 h, 45 min par nuit.
4. **Fourchette** : élargie avec la durée (±5 % jusqu'à 4 h, ±8 % à 12 h, ±10 % au-delà).

## 8. Découpage

1. Profil à pas variable, tracé fin, simulation par tronçon, tests de précision, migration (§ 1), puis corrections du modèle (§ 7).
2. Position continue et fluide (§ 2).
3. Paquet de sortie et moteur pur, branchement de la vue de course et de l'enregistreur (§ 3).
4. Nouveaux calculs et leurs tests (§ 4).
5. Widgets : mise en page selon la forme, tailles autorisées, catalogue de 25, migration, écrans prêts à l'emploi (§ 5).
6. Éditeur paysage et portrait, catalogue avec recherche et aperçus, case vide, gestes en portrait (§ 6).
7. Passe `critique`, `audit` et `polish` (Impeccable), captures en 390 × 844 et 844 × 390.
