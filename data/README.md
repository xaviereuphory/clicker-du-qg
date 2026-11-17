# Données du jeu

Tout le contenu du jeu vit ici, séparé du code. Les volets B (visuel) et C (son, textes) peuvent modifier ces fichiers sans toucher à `src/`.

**Après chaque modification, lancer `npm test`** : les tests vérifient que les fichiers sont valides (identifiants, effets, ordre des paliers...) et disent précisément ce qui cloche.

## Les fichiers

| Fichier | Contenu | Qui y touche |
|---|---|---|
| `balance.json` | Tous les réglages d'équilibrage (prix, durées, seuils) | Volet A |
| `characters.json` | Personnages jouables : nom, force, description, bonus, look. Se remplit avec l'atelier (`npm run atelier`). Voir « Personnages » plus bas | A (bonus), B (look), C (textes) |
| `producers.json` | Producteurs automatiques (beats par seconde) | A (chiffres), C (noms, descriptions) |
| `upgrades.json` | Upgrades du QG, achetés une seule fois | A (chiffres), C (noms, descriptions) |
| `tiers.json` | Paliers de carrière, débloqués par le record de fans | A (seuils), C (noms) |
| `greenhouse.json` | La serre : palier de déblocage, équipement ($ → grammes), variétés (grammes → bonus), et `decor` : la serre en vue isométrique (voir « La serre isométrique » plus bas) | A (chiffres), B (sprites), C (noms) |
| `map.json` | La carte : territoires, voisins, hype à atteindre, rivaux, bonus de conquête | A (chiffres), C (noms, descriptions, rivaux) |
| `texts.json` | Messages du jeu, réactions des fans, libellés des statistiques | Volet C |
| `sounds.json` | Quel fichier audio joue pour quel événement | Volet C |
| `fx.json` | Réglages des animations : plafonds de particules et de nombres flottants, seuils du « gros beat », durées de tenue (voir `docs/animations/`) | A et B |
| `online.json` | Classement en ligne : adresse du projet Supabase et **clé publique** (jamais la clé secrète), `topSize` (joueurs affichés dans chacun des deux onglets, Record et Temps réel), `submitEverySeconds` (envoi du score et de la sauvegarde ; les stats « Temps réel » partent avec la sauvegarde), `pollSeconds` (relecture si le direct ne marche pas). Vide = classement hors ligne. Voir `supabase/README.md` | A |
| `pets.json` | Animaux de compagnie : prix d'adoption, palier, effets par niveau d'amitié | A (chiffres), B (images), C (noms, descriptions) |
| `events.json` | Événements à la BitLife (police, impôts, beat viral…) : fréquence, conditions, effets, choix et leurs chances. Les textes sont à réécrire par le volet C. Essai direct : `?evenement=<id>` | A (règles), C (textes) |
| `creation.json` | « Créer mon perso » au début d'une partie : points de talent, talents, signes particuliers, noms au hasard, palettes de couleurs. Voir « Création de perso » plus bas | A (chiffres), C (noms, textes) |
| `decor.json` | Éditeur de studio (le QG en vue isométrique) : taille de la pièce (`room`) et objets plaçables (`items`). Voir « Objets du studio » plus bas | A (règles), B (sprites, couleurs), C (noms des objets déco) |
| `battle.json` | Battle de beat contre les rivaux de la carte : tempo, nombre de temps, pistes, fenêtres de frappe, mises proposées, gains, hype gagnée, difficulté selon le rival. Voir « Battle de beat » plus bas | A |

## Identifiants (`id`)

Chaque personnage, producteur, upgrade et palier a un `id` en minuscules avec des tirets (`panneaux-acoustiques`). **Ne pas changer un `id` existant** : il sert de lien avec les sauvegardes, les images et les sons. On peut changer le `name` librement.

## Effets

Personnages, upgrades et paliers ont une liste `effects`. Chaque effet multiplie une statistique :

```json
{ "stat": "beatValue", "multiply": 1.25 }
```

| `stat` | Effet |
|---|---|
| `click` | beats produits par clic |
| `bps` | beats par seconde des producteurs |
| `beatValue` | argent gagné par beat |
| `fanGain` | fans gagnés par beat |
| `churn` | perte naturelle de fans (moins de 1 = on garde mieux ses fans) |
| `cannabisDecay` | vitesse à laquelle l'effet du cannabis s'estompe (moins de 1 = dure plus longtemps) |
| `cannabisPrice` | prix du cannabis |
| `cannabisPower` | gain de qualité apporté par le cannabis |
| `quality` | inspiration : multiplie la qualité des beats (même à jeun ; la qualité fait aussi gagner plus de fans) |

Les **variétés** de la serre ont des niveaux sans fin : le niveau N coûte `cost × costGrowth^N` grammes, et chaque niveau applique encore une fois ses `effects` (deux stats en plus : `grow` pour la pousse et `harvest` pour la récolte au clic).

Les **animaux** (`pets.json`) marchent comme les variétés, mais en argent : le niveau 0 → 1 est l'adoption (`cost`), puis chaque gâterie coûte `cost × costGrowth^niveau` et applique encore une fois les `effects`. Tous les animaux adoptés donnent leur bonus ; celui choisi « à côté de moi » s'affiche au QG, et on peut le flatter (des cœurs, sans effet sur le jeu). `species` sert pour le dessin.

Les **territoires** de la carte (`map.json`) : `x` et `y` placent le marqueur sur la carte de 160 × 100 ; `requires` liste les voisins (un seul suffit, ou tous si `requiresAll` vaut `true`) ; `hype` est la barre à remplir ; `defense` est la hype que le rival enlève chaque seconde ; `effects` est le bonus permanent une fois conquis (stat en plus : `hype` pour la vitesse de conquête).

`requiresTier` (producteurs, upgrades) est le numéro du palier qui débloque l'élément : 0 pour le premier palier de `tiers.json`, 1 pour le deuxième, etc.

## Personnages (`characters.json`)

Le plus simple : **`npm run atelier`**, puis http://127.0.0.1:8001. L'atelier écrit la fiche, génère la planche et vérifie tout ce qui suit. À la main :

```json
{
  "id": "lea",
  "name": "Léa",
  "strength": "Zen",
  "description": "Elle garde la tête froide quand tout le studio décolle.",
  "effects": [{ "stat": "cannabisDecay", "multiply": 0.6 }],
  "color": "#9fc2e0",
  "look": { ... }
}
```

| Champ | Sens |
|---|---|
| `strength` | Le petit badge jaune de la carte (un ou deux mots). |
| `effects` | Les pouvoirs : de 1 à 3, une stat différente chacun, `multiply` entre 0,3 et 3 (voir « Effets »). |
| `color` | **Facultatif.** Couleur de fond de la carte et de la tête dans le classement. |
| `look` | **Facultatif.** Le dessin en « poupée de papier » (ci-dessous). Sans `look`, le personnage doit être dessiné à la main dans `scripts/sprites/characters.js` (Xavier, Nathan et Émile pour l'instant). |

Le `look` assemble un corps de base et des pièces (`src/poupee/index.js` et `src/poupee/parts/`) :

```json
"look": {
  "body": "moyen",
  "skin": "#f1c6a4",
  "hair": { "style": "boucles", "color": "#a07a52" },
  "beard": null,
  "glasses": "rondes",
  "hat": { "style": "tuque", "color": "#c94d4d" },
  "top": { "style": "demi-zip", "color": "#5f6751", "accent": "#cdbf9f" },
  "bottom": { "style": "jogger", "color": "#1f1f24" },
  "shoes": { "style": "baskets", "color": "#1b1b1f", "accent": "#2e2e34" },
  "accessories": ["chaine"]
}
```

| Pièce | Choix |
|---|---|
| `body` | `mince`, `moyen`, `large` |
| `hair.style` | `chauve`, `rase`, `courte`, `boucles`, `afro`, `longue`, `tresses`, `queue` |
| `beard` | `null`, `moustache`, `bouc`, `barbe` (couleur des cheveux) |
| `glasses` | `null`, `rondes`, `carrees`, `soleil` |
| `hat` | `null`, ou `{ "style": "casquette" \| "tuque", "color" }` |
| `top.style` | `tshirt`, `debardeur`, `hoodie`, `bomber`, `demi-zip`, `blouson`, `chemise` ; `accent` = col, logo, cordons ou bandes |
| `bottom.style` | `jean`, `jogger`, `cargo`, `baggy`, `short`, `jupe` |
| `shoes.style` | `baskets`, `bottes`, `sabots` ; `accent` = semelle |
| `accessories` | `chaine`, `casque` (au cou), `sac` (à dos) |

Les couleurs sont en `#rrggbb` ; ombres et reflets sont calculés tout seuls. Après une modification à la main : `npm run sprites` (planche `assets/images/personnages/<id>-sheet.png`), puis `npm test`. Il manque une pièce (une coiffure, un haut) ? On l'ajoute **une fois** dans `src/poupee/parts/`, avec son nom dans la liste exportée (`HAIRS`, `TOPS`…) : elle apparaît dans l'atelier et sert à tout le monde.

Les photos de référence restent dans `references/` (ignoré par Git) ou ailleurs sur l'ordi, et on les prend **avec l'accord de la personne**.

## Création de perso (`creation.json`)

Au début d'une partie, le joueur prend un personnage préfait **ou crée le sien** (src/ui/creator-view.js) : look, talents, signe particulier, nom.

- `points` : les points de talent à répartir ; `maxPerSkill` : le maximum par talent.
- `skills` : les talents. Chaque point multiplie la `stat` par `1 + perPoint × points` (`perPoint` négatif pour les stats où moins c'est mieux : perte de fans, redescente). Exemple : Mélodie à 5 points = +25 % valeur des beats, comme Xavier.
- `traits` : les **signes particuliers**. Le jeu en tire `offer` au hasard ; le joueur en prend un ou aucun, et peut relancer `rerolls` fois. Chacun a des `effects` (un bonus et un malus), et `points` facultatif = points de talent en plus.
- `names` : pour le nom au hasard (`first` + `last`, 16 caractères au plus ; un `first` qui finit par un tiret se colle : « Ti-Béton »).
- `palettes` : les couleurs proposées au joueur (`skin`, `hair`, `cloth`), 36 au plus chacune.

Le look d'un perso créé est **encodé dans son identifiant** : `p-` suivi de 17 caractères, un par pièce ou couleur (src/poupee/code.js). Le classement en ligne garde cet identifiant, donc tout le monde voit l'avatar des autres, sans rien changer au serveur. ⚠️ Conséquence : dans `palettes` et dans les pièces de `src/poupee/parts/`, on **ajoute à la fin** ; on ne retire rien et on ne change pas l'ordre, sinon les persos déjà créés changent de couleur ou de vêtements.

La sauvegarde garde le reste : `state.custom = { name, skills: { idTalent: points }, trait }`. Une sauvegarde abîmée ou trichée (points en trop, talent inconnu) est réparée au chargement : talents remis à zéro, signe retiré.

## Objets du studio (`decor.json`)

Le QG est une pièce de `room.width` × `room.depth` tuiles, vue en isométrique. Chaque objet de `items` :

```json
{ "id": "canape", "source": "upgrade", "icon": "🛋️", "footprint": [2, 1], "surface": "sol", "rotations": 2, "height": 14, "color": "#6b4f8a" }
```

| Champ | Sens |
|---|---|
| `id` | Pour `upgrade`, `producer` et `pet` : le **même id** que dans `upgrades.json`, `producers.json` ou `pets.json`. On possède l'objet quand on possède l'amélioration, le producteur ou l'animal. |
| `source` | `upgrade`, `producer`, `pet` ou `deco`. Un objet `deco` est offert à tout le monde et a besoin d'un `name`. |
| `surface` | `sol` ou `mur` (les deux murs du fond). Un objet mural a une profondeur de 1. |
| `footprint` | `[largeur, profondeur]` en tuiles. |
| `rotations` | 1, 2 ou 4 (au sol). Avec 2, la 2e vue est le miroir de la 1re. |
| `height`, `color` | Taille (pixels) et couleur de la boîte qui remplace le sprite tant qu'il n'existe pas. |
| `elevation` | Objet mural : hauteur du bas de l'objet au-dessus du sol (pixels). |
| `icon` | Emoji affiché dans l'inventaire du mode Édition. |
| `sprite` | **Facultatif.** Chemin dans `assets/images/` (ex. `qg/canape-iso.png`). Ne l'ajouter qu'une fois l'image créée : `npm test` vérifie que le fichier existe. |

Un producteur ou un animal sans objet dans `decor.json` (ami beatmaker, ingé son…) n'apparaît pas dans la pièce. Les producteurs « pas physiques » (label, tournée, studio lunaire, station orbitale) sont des cadres au mur.

**Sprites isométriques** (tuile de sol = 32 × 16 px) : au sol, l'image est centrée sur l'emprise de l'objet et son bas touche la pointe avant du losange ; largeur conseillée (largeur + profondeur) × 16 px. Les rotations impaires sont le miroir de l'image ; avec `rotations: 4`, l'image contient 2 vues côte à côte (de face, puis de dos). Au mur : large de longueur × 16 px, la vue du mur de droite, puis à côté celle du mur de gauche (facultative : sans elle, le jeu fait le miroir, ce qui retourne un texte) ; l'image suit la pente du mur et son bas est le bout avant du panneau, à la hauteur `elevation`.

**Tous les objets sont dessinés en code** dans `scripts/sprites/objets-iso.js` (aides dans `scripts/sprites/iso.js`) : `npm run sprites` écrit `assets/images/qg/<id>-iso.png`. **Pour dessiner un objet à la main** (Aseprite, Piskel…), partir d'un gabarit de `docs/gabarits-iso/` (le losange de l'emprise ; le point rouge est la pointe avant, où se pose le bas de l'image), enregistrer sous un autre nom, par exemple `qg/canape-main.png`, et mettre ce nom dans `sprite` : `npm run sprites` n'écrase que les fichiers `-iso.png`.

**La vibe** (`vibe` dans `decor.json`) : des combos de deux objets qui donnent un petit bonus quand ils se touchent dans la pièce (par un côté ou un coin ; un objet mural touche ce qui est posé contre son mur, juste en dessous, et les objets muraux voisins, même de l'autre côté du coin).

```json
{ "id": "poste-de-mix", "name": "Poste de mix", "icon": "🎛️", "items": ["moniteurs", "console-analogique"], "effects": [{ "stat": "beatValue", "multiply": 1.05 }] }
```

`effects` marche comme partout ailleurs. `npm test` refuse un bonus en dehors de 0,85 à 1,15 : la vibe reste un petit plus, pas une amélioration. Le mode Édition liste les combos, montre en direct ce qu'un déplacement gagne (✨) ou fait perdre (⚠️), et un message part quand un combo s'active.

**Les animaux** adoptés se promènent entre les objets (sauf celui choisi « à côté de moi », qui reste près du personnage). On peut les flatter en touchant la pièce. Ils restent sur place quand les animations sont réduites.

Le plan de chaque joueur est sauvegardé dans `state.studio` (voir `src/game/studio.js`). Retirer un objet de `decor.json` ne casse pas les sauvegardes : il disparaît simplement de la pièce.

### La serre isométrique (`decor` dans `greenhouse.json`)

La serre est une deuxième pièce, faite **exactement comme le studio** : même format (`room`, `items`, `vibe`), même mode Édition (✏️), mêmes règles de placement et de vibe. Différences :

- `source` vaut `equipment` (même id que dans `equipment`), `strain` (même id que dans `strains`) ou `deco`. On possède l'objet dès le premier exemplaire acheté ou le premier niveau de la variété ; racheter ne pose pas un deuxième exemplaire.
- La pièce reste vide tant que la serre n'est pas débloquée (`unlockTier`) ; au déblocage, la déco et tout ce qui est déjà possédé s'installent tout seuls.
- Chaque variété est un plant dans son pot ; l'équipement va du pot de yogourt à la ferme lunaire.
- Les sprites sont dessinés en code dans `scripts/sprites/objets-serre.js` (mêmes aides que le studio) : `npm run sprites` écrit `assets/images/serre/<id>-iso.png`.
- Les combos de la serre visent surtout ses stats : `grow`, `harvest`, `cannabisPower`, `cannabisDecay`, `cannabisPrice`.
- Pas d'animaux qui se promènent dans la serre.

Le plan est sauvegardé dans `state.serre`. Le décor de la pièce (vitres, Lune, sol de terre) est dessiné en code par `src/ui/room-themes.js`.

## Images (volet B)

Le jeu cherche les images à ces emplacements, par `id`. Tant qu'un fichier n'existe pas, un remplaçant texte s'affiche.

| Élément | Fichier |
|---|---|
| Feuille de sprites d'un personnage | `assets/images/personnages/<id>-sheet.png` (ex. `xavier-sheet.png`) |
| Décor du QG | Dessiné en code par `src/ui/room-themes.js` (murs, sol, tapis). `assets/images/qg/fond.png` n'est plus affiché au studio |
| Décor de la serre | Dessiné en code par `src/ui/room-themes.js` (vitres, Lune, sol de terre). `assets/images/serre/fond.png` n'est plus affiché à la serre |
| Plant de la serre | `assets/images/serre/plante.png` (3 stades de 16 × 24, généré ; sert au bouton Récolter) |
| Carte du monde | `assets/images/carte/fond.png` (160 × 100, généré) |
| Objet de la pièce du studio | `assets/images/<sprite>` donné dans `decor.json` (ex. `qg/canape-iso.png`) |
| Objet de la serre | `assets/images/<sprite>` donné dans le `decor` de `greenhouse.json` (ex. `serre/tente-culture-iso.png`) |
| Animal de compagnie | `assets/images/animaux/<id>.png` (2 images de 28 × 20 côte à côte, de profil vers la droite ; généré par `npm run sprites`, provisoire) |

### Personnages en pixel art

Les sprites sont dessinés en code dans `scripts/sprites/characters.js`, d'après les photos de référence en T-pose. Après une modification, lancer `npm run sprites` pour régénérer les images.

- Chaque image fait 32 × 48 pixels, affichée agrandie sans flou.
- Feuille `<id>-sheet.png` : 3 lignes (face, profil tourné vers la droite, dos) × 2 images (respiration). Pour le profil gauche, on retourne l'image.
- `<id>.png` : la vue de face seule.
- `sprites.json` décrit la feuille pour le code.

Les animations suivantes (faire un beat, réaction, effet du cannabis, échec) et le fond du QG par palier viendront ensuite.

## Sons (volet C)

`sounds.json` associe chaque événement du jeu à une liste de fichiers dans `assets/audio/`. Quand il y a plusieurs fichiers, un est choisi au hasard (utile pour varier le son du clic).

```json
"click": ["effets/clic-1.mp3", "effets/clic-2.mp3", "effets/clic-3.mp3"]
```

Événements : `click`, `buyProducer`, `adoptPet`, `treatPet`, `petPet` (flatter l'animal), `buyUpgrade`, `cannabisBuy`, `cannabisEmpty` (l'effet est fini), `overdose` (trop gelé), `broke` (à sec), `failStart`, `failEnd`, `tierUp`, `characterSelect`.

Musique (`music`) : une boucle par ambiance, qui change selon l'état du jeu : `normal`, `cannabis` (effet actif), `baisse` (fans en baisse), `echec` (fail out). Mettre `null` tant qu'il n'y a pas de fichier.

## Textes (volet C)

Dans `texts.json`, chaque message est une liste : une phrase est tirée au hasard. Les mots entre accolades sont remplacés par le jeu : `{name}`, `{tier}`, `{duration}`, `{money}`. Les textes actuels sont **temporaires**.

- `ticker` : les phrases qui défilent sur la radio « QG FM » en haut de l'écran.
- `fanHandles` : les noms d'utilisateur des fans dans le fil « QGram ».
- `fanReactions` : ce que les fans écrivent quand l'audience monte (`up`) ou baisse (`down`).

## Événements (`events.json`)

Un événement tombe toutes les `minGapSeconds` à `maxGapSeconds` secondes de jeu (jamais avant `firstDelaySeconds`, ni avant le palier `minTier`, ni un mauvais événement pendant un fail out). Le même ne revient pas avant `repeatCooldownSeconds`.

- `tone` : `good`, `bad` ou `neutral` (couleur de la carte) ; `weight` : plus il est haut, plus il est fréquent.
- `requires` : `minTier`, `minMoney`, `minIncome` ($/s), `minBps`, `stash` (zen ou grammes à saisir), `greenhouse`, `map`, `campaign`.
- Soit `effects` (appliqués tout de suite), soit `choices` : chaque choix a un `label` et des `outcomes` dont les `chance` font 1.
- Effets : `money` (`multiply`, ou `incomeSeconds` : ± N secondes de revenu), `fans` (`multiply`), `grams` (`multiply`, `add`), `stash` (`share` : part saisie du zen et des grammes), `hype` (`multiply`, campagne en cours), `buff` (`stat`, `multiply`, `seconds` : effet temporaire).

## Battle de beat (`battle.json`)

Sur la carte, la fiche d'un territoire **ouvert** (ou en campagne) qui a un `rival` propose « ⚔️ Battle contre … » : un mini-jeu de rythme de 15 à 25 s (une petite chanson de 8 mesures, à un tempo et dans un genre tirés au hasard) (logique dans `src/game/battle.js`, écran dans `src/ui/battle-view.js`).

| Champ | Sens |
|---|---|
| `bpm` | La plage de tempo : chaque battle tire un tempo entier entre `min` (88) et `max` (130). |
| `beats`, `leadInBeats` | Nombre de temps joués (32 = 8 mesures, de 15 à 25 s selon le tempo) et temps de décompte avant la première note (4 = une mesure). |
| `lanes` | Nombre de pistes : 4 (A S D F, J K L ; ou ← ↓ ↑ → au clavier). |
| `genres` | Les genres, chacun avec sa plage de tempo (`bpm`). Le tempo tiré choisit le genre : chaque tempo de 88 à 130 doit tomber dans **exactement un** genre (le test le vérifie). Pour chaque genre : `instruments` (4, un par piste, de gauche à droite : `id`, `name` écrit sous le pad, `sound` = l'événement de `sounds.json` joué quand on tape le pad, et `tuned` facultatif : `chord` joue l'accord de la mesure, `arpeggio` l'égrène, `root` joue sa fondamentale ; l'icône est dans `src/ui/battle-view.js`), `swing` (0,5 = croches droites ; plus haut = le « et » arrive plus tard, comme en boom bap), `metronome` (les coups d'une mesure : `at` en temps de 0 à 4, `sound`, `volume`), `song` et `groove` (ci-dessous). |
| `song` (dans un genre) | La chanson : `sections` = des phrases de 4 (ou 8) mesures, un accord par mesure, avec un `name` (affiché pendant la partie) et une `intensity` (plus haut = plus de contretemps) ; `ending` = l'accord de fin, joué le temps juste après la dernière mesure, le même que l'accord de départ. |
| `groove` (dans un genre) | Le beat que le joueur tape. `base` : l'instrument de chaque temps, sur 1 ou 2 mesures (4 ou 8 temps) qui tournent en boucle ; chaque instrument doit y avoir au moins une note, pour qu'on joue les 4 même contre le rival le plus faible. `doubles` : un 2e instrument possible sur un temps. `offbeats` : les contretemps possibles, `at` temps après le début du temps (0,5 = le « et », 0,75 = la dernière double croche). Les rivaux forts ajoutent plus de doubles et de contretemps (`difficulty`). |
| `chords` | Les accords de tous les genres : `root` = la fondamentale (jouée par le kick) et `notes` = les notes du piano, en demi-tons autour du do des fichiers son (0 = C4 pour le piano, C2 pour le kick). |
| `windows` | Écart permis, en secondes, pour une frappe `perfect` et `good` (au-delà : ratée). |
| `points` | Ce que vaut une note `perfect` (1) et `good`. Une frappe dans le vide compte comme une demi-note ratée. |
| `stakes` | Les mises proposées, en part du cash (jamais plus de 0,5). `minStake` : mise minimale en $. |
| `cooldownSeconds` | Attente avant une revanche contre le même rival (temps de jeu ; 0 = tout de suite, réglage actuel pour tester). |
| `allowDuringFailOut` | `true` = on peut faire une battle pendant un fail out (réglage actuel pour tester) ; `false` = bloqué. |
| `payout` | Ce que rapporte la mise si on bat le rival : `atTarget` pile au score du rival, jusqu'à `perfect` pour un sans-faute. Sinon, la mise est perdue. |
| `hypeShare` | Hype gagnée par le territoire après une victoire, en part de sa barre (peut finir la conquête). |
| `difficulty` | Du rival le plus faible (`easiest`) au plus fort (`hardest`), classés par `defense` dans `map.json` : `target` = précision à battre, `offbeat` = chance d'une note en contretemps, `doubles` = chance de deux notes en même temps. |

Pas de battle quand un événement attend une réponse (ni pendant un fail out si `allowDuringFailOut` vaut `false`) ; pas de nouvel événement pendant une battle. Une battle laissée en plan (jeu fermé) compte comme perdue. **Les trois genres** (d'après des guides de production ; à ajuster à l'oreille) :

| Genre | Tempo | Les 4 pads | Beat à taper | Accords (do majeur / la mineur) | Métronome |
|---|---|---|---|---|---|
| Boom bap | 88 à 97 | Kick, Caisse claire, Rhodes (accord), Contrebasse (fondamentale) | Rhodes au 1 (changement d'accord), caisse claire sur 2 et 4, kick ou contrebasse sur 3 ; kick syncopé après 2 et 3, contrebasse après 1 ; tout est **swingué** | couplet Cmaj7–Am7–Dm7–G7 (I–vi–ii–V), refrain Fmaj7–Em7–Dm7–G7, fin Cmaj7 | charleston en croches swinguées |
| Afrobeats | 98 à 115 | Kick, Rimshot, Guitare highlife (accord égrené), Conga | kick au 1 (jamais sur chaque temps), rimshot sur 2 et 4, guitare ou conga au 3 ; guitare en **3-3-2** (après 1 et 3, sur la dernière double croche), kick sur le « et » de 2, conga sur celui de 4 | couplet Cmaj7–G–Am7–Fmaj7 (I–V–vi–IV), refrain Fmaj7–G–Am7–G, fin Cmaj7 | shaker en doubles croches, accents 3-3-2 |
| House | 116 à 130 | Kick, Clap, Piano (stabs), Basse (fondamentale) | kick sur 1 et 3, clap sur 2 et 4, piano ou basse en 2e mesure ; contre les forts rivaux, kick sur chaque temps (le **four on the floor**) ; basse et piano en alternance sur les « et » | couplet Am7–Dm7 (i7–iv7), refrain Fmaj7–Em7, fin Am7 | charleston fermé sur le temps, ouvert sur le « et » |

Le son et l'image sont calés sur l'horloge audio (Web Audio) : une mesure de décompte aux baguettes (`battleCount`, 1-2-3-4), puis le métronome du genre (`battleHat`, `battleShaker`, `battleOpenHat`). Une note touche la ligne exactement quand le temps sonne. Il n'y a pas de batterie de fond : c'est le joueur qui joue le beat avec les 4 pads du genre (`battleKick`, `battleSnare`, `battleRhodes`, `battleUprightBass`, `battleRimshot`, `battleGuitar`, `battleConga`, `battleClap`, `battlePiano`, `battleSynthBass`). Une note ratée ne fait **aucun bruit**. À la fin : `battleWin` ou `battleLose`. Pendant la partie, le genre et le tempo sont dans le titre (« Boom bap · 92 BPM »), la section et l'accord en cours en haut de la piste (« Refrain · Fmaj7 »). Pour l'instant, ce sont des sons **provisoires** synthétisés (`assets/audio/effets/battle-*-01.m4a`) : le volet C les remplace par de vrais sons du même nom, ou change les chemins dans `sounds.json`. Les instruments d'accords (piano, rhodes, guitare) doivent rester en do (C4), les kicks et les basses en do grave (C2) : le jeu les transpose pour suivre les accords. Les messages `battleWin`, `battleLose`, `battleForfeit` sont dans `texts.json`.
