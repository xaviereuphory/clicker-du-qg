# Prochaines phases — Clicker du QG

Préparation des quatre chantiers qui suivent la PR #1 (interface téléphone, classement, sauvegarde en ligne, événements).
Pour chaque chantier : le but, ce qui existe déjà, la manière de le faire, les étapes, et les décisions à prendre en équipe.

| # | Chantier | Volet principal | Taille | Dépend de |
|---|----------|-----------------|--------|-----------|
| 1 | Éditeur de studio (vue isométrique) | A (code) + B (visuel) | Gros | — |
| 2 | Personnages de départ + ajout rapide par photo T-pose | B + A | Moyen | — |
| 3 | Mode plus challenging / arcade | A + C (écriture) | Moyen à gros | décision sur le score du classement |
| 4 | Sons maison (Wwise ou autre) | C (son) + A | Moyen | — |

**Ordre conseillé** : on commence le 4 (moteur audio) et le 2 (pipeline personnages), parce qu'ils débloquent le travail de Nathan et Émile tout de suite. Le 1 vient ensuite : c'est le plus gros et il a besoin de sprites. Le 3 arrive en dernier, ou en parallèle à partir de l'étape 3.A, qui est petite.

Les règles du projet tiennent toujours :
- `src/game/` reste sans DOM et testé (`npm test`) ;
- on ne change pas les `id` existants des données ;
- un nouveau fichier de données est décrit dans `data/README.md` ;
- les photos de référence ne sont jamais commitées.

---

## 1. Éditeur de studio — le QG en vue isométrique

### Le but

Le QG devient une vraie pièce en vue isométrique (3/4, comme les jeux de gestion de chambre), au lieu de l'image fixe `assets/images/qg/fond.png`. Chaque amélioration achetée devient un **objet** dans la pièce : casque, panneaux acoustiques, néons, canapé, cabine, console… Le joueur le **place où il veut**, le tourne et le range.

Le gros bouton vinyle reste au centre de l'écran : l'éditeur ne doit jamais nuire au clic.

### Ce qui existe déjà

- 11 améliorations dans `data/upgrades.json` (casque, panneaux-acoustiques, lampe-led, chaise-gamer, moniteurs, canape, neons, vaporisateur, micro-pro, cabine, console-analogique). `view.js` les affiche déjà dans `#qg-items`, avec une image `assets/images/qg/<id>.png` si elle existe et le nom en texte sinon.
- 10 producteurs (`data/producers.json`). Certains sont des objets (boîte à rythmes, clavier MIDI), d'autres non (tournée mondiale, station orbitale).
- 5 animaux (`data/pets.json`), déjà affichés dans la scène (`#qg-pet`).
- Le décor est dessiné en code dans `scripts/sprites/qg.js` (160 × 100 px, d'après les photos du sous-sol).
- La sauvegarde en ligne accepte jusqu'à 64 Ko : un plan de pièce ne pèse que quelques centaines d'octets.

### Comment on le fait

**Rendu.** Un `<canvas>` 2D en pixel art, sans bibliothèque, dans la continuité du projet.
- **Grille isométrique 2:1.** Une tuile de sol fait 32 × 16 px. La pièce fait 8 × 8 tuiles au départ et pourra grandir plus tard, avec le palier ou un achat.
- **Ordre d'affichage.** On trie les objets par profondeur (`x + y`, puis la hauteur) pour que le canapé passe devant le mur et derrière la table.
- **Deux murs visibles**, gauche et droit, pour accrocher les objets muraux (néons, panneaux acoustiques, affiches, vinyles).
- **Caméra fixe** qui remplit la largeur du téléphone. Pas de zoom en v1.

**Données.** Un nouveau fichier `data/decor.json` dit, pour chaque objet plaçable :

```json
{
  "id": "canape",
  "source": "upgrade",
  "sprite": "qg/canape-iso.png",
  "footprint": [2, 1],
  "surface": "sol",
  "rotations": 2
}
```

- `source` vaut `upgrade`, `producer`, `pet` ou `deco`. Les objets `deco` sont purement décoratifs et pourraient s'acheter plus tard.
- `surface` vaut `sol` ou `mur`.
- `footprint` donne le nombre de tuiles occupées (largeur, profondeur).
- `rotations` vaut 1, 2 ou 4. Avec 2, la deuxième vue est un miroir : un seul dessin suffit.

On possède un objet quand on possède l'amélioration ou le producteur. Les données de jeu existantes ne changent pas.

**Sauvegarde.** On ajoute `state.studio = { layout: [{ id, x, y, rot }] }`. La logique va dans un nouveau fichier `src/game/studio.js`, testé :
- `canPlace(state, data, item, x, y, rot)` vérifie les limites de la pièce, les chevauchements, la surface et la possession de l'objet ;
- `placeItem`, `moveItem`, `rotateItem` et `storeItem` modifient le plan ;
- `autoPlace(state, data, id)` pose automatiquement un objet tout juste acheté sur la première place libre, pour que le joueur le voie sans rien faire ;
- `deserialize` répare un plan abîmé, comme pour `events` : un objet inconnu ou mal placé retourne dans l'inventaire.

**Interaction au téléphone (mode Édition).**
1. Un bouton ✏️ dans la scène Studio fait passer en mode Édition. Le vinyle se cache et la pièce prend tout l'écran.
2. En bas, un tiroir montre l'inventaire : les objets possédés mais pas placés.
3. On touche un objet puis la pièce. Une « ombre » de l'objet suit le doigt : verte si la place est libre, rouge sinon. On touche encore pour poser.
4. Un appui long sur un objet posé le reprend. Un bouton ↻ le tourne et un bouton 📦 le range.
5. Le bouton « Terminé » revient au clic, et la sauvegarde part tout de suite.

**Gameplay (à décider).** En v1, la déco est **purement cosmétique** : c'est plus simple et c'est déjà satisfaisant. Plus tard, on pourra ajouter un score de « vibe » du studio : des bonus d'adjacence, comme les moniteurs à côté de la console (+5 % de valeur des beats) ou le canapé à côté des néons (descente du cannabis plus lente).

**Sprites (volet B).** Chaque objet devient un dessin isométrique d'environ 32 à 64 px de large.
- On ajoute un fichier d'aide, `scripts/sprites/iso.js`, avec des fonctions pour dessiner une boîte isométrique (trois faces ombrées), un objet mural en biais et la projection d'une tuile.
- Le personnage, aujourd'hui une vue de face, de profil et de dos, se place dans la pièce. Une vue « 3/4 » serait un plus, mais elle n'est pas obligatoire au début.

### Étapes

| Étape | Contenu | Fini quand |
|-------|---------|------------|
| 1.A | `studio.js` + `decor.json` (avec des carrés de couleur à la place des sprites) + tests | `npm test` passe : placement, chevauchement, rotation, réparation d'une sauvegarde |
| 1.B | Rendu canvas de la pièce, lecture seule, objets auto-placés | Le studio montre la pièce et les objets achetés, sans baisse de fps sur un téléphone |
| 1.C | Mode Édition au toucher (inventaire, ombre verte ou rouge, tourner, ranger) | On réaménage la pièce au doigt sur un iPhone de 375 px |
| 1.D | Sprites isométriques des 11 améliorations + murs et sol du QG | Plus aucun carré de couleur |
| 1.E | Animaux qui se promènent entre les objets, personnage placé dans la pièce | — |
| 1.F (option) | Bonus de « vibe » par adjacence | Équilibrage validé en jouant |

### État (16 novembre 2026)

1.A, 1.B et 1.C sont faits sur la branche `gameplay` : `src/game/studio.js` (testé dans `tests/studio.test.js`), `data/decor.json`, `src/ui/studio-view.js` (devenu `src/ui/room-view.js`) et `src/ui/iso.js`. Choix retenus :
- la pièce **remplace le fond** de la scène Studio, au-dessus du vinyle ;
- les producteurs « pas physiques » (label, tournée, studio lunaire, station orbitale) sont des **cadres au mur** ; l'ami beatmaker et l'ingé son (des personnes) restent hors de la pièce pour l'instant (1.E) ;
- **cosmétique seulement** en v1 ;
- **joueurs déjà avancés** : au premier lancement avec l'éditeur, tous les objets qu'ils possèdent déjà sont posés automatiquement le long des murs du fond (`syncStudio`), puis un message les invite à tout réaménager avec ✏️. Un objet que le joueur range lui-même n'est jamais reposé tout seul (`state.studio.stored`) ;
- 3 objets déco offerts d'après les photos du QG (affiche, poêle à bois, laveuse-sécheuse) ;
- 1.D : les 22 objets sont dessinés en code (`scripts/sprites/objets-iso.js`) ; gabarits pour dessiner à la main dans `docs/gabarits-iso/` ;
- 1.E : les animaux adoptés se promènent entre les objets (chemin qui contourne les objets) et on peut les flatter ; le compagnon reste à côté du personnage, qui se tient sur la tuile libre la plus proche du centre ;
- 1.F : 11 combos de vibe dans `decor.json` (+3 % à +10 %, ou -3 % à -10 % pour les stats où moins c'est mieux). **L'équilibrage reste à valider en jouant** : tous les combos actifs ensemble donnent environ ×1,05 sur la valeur des beats, ×1,10 sur la production auto, ×1,10 sur le clic et ×1,08 sur l'inspiration.
- **La serre isométrique** : même procédé que le studio (`serreRoom` dans `src/game/studio.js`, `decor` dans `data/greenhouse.json`, vue partagée `src/ui/room-view.js`, décor vitré dans `src/ui/room-themes.js`). 19 objets dessinés en code (`scripts/sprites/objets-serre.js`) : les 8 équipements, un plant par variété, et 3 objets déco (arrosoir, sac de terreau, pancarte). 11 combos de vibe sur les stats de la serre ; tous ensemble : environ ×1,13 sur la pousse, ×1,21 sur la récolte au clic. **Équilibrage à valider en jouant**, comme pour le studio. Plan sauvegardé dans `state.serre`.

### Décisions à prendre

- Où vit la pièce ? Elle peut **remplacer le fond derrière le vinyle**, ce qui est recommandé : on voit son studio en jouant. L'autre choix est un onglet séparé.
- Est-ce que les producteurs « non physiques » (tournée, label, station orbitale) deviennent des trophées ou affiches au mur, ou est-ce qu'ils restent hors de la pièce ?
- Cosmétique seulement, ou bonus de vibe dès le départ ?

---

## 2. Personnages de départ + ajout rapide par photo T-pose

### Le but

1. Avoir plus de personnages jouables dès le départ, au-delà de Xavier, Nathan et Émile.
2. Pouvoir **ajouter un nouveau personnage en moins d'une heure** à partir de photos en T-pose, sans réécrire de code de dessin à la main.

### Ce qui existe déjà

- `data/characters.json` : 3 personnages, chacun avec un `id`, un nom, une force, une description et des `effects` sur les stats (`click`, `bps`, `beatValue`, `fanGain`, `churn`, `cannabisDecay`…).
- `scripts/sprites/characters.js` : les 3 personnages dessinés **à la main en code** (32 × 48 px, vues de face, de profil et de dos, 2 images d'animation).
- `assets/images/personnages/sprites.json` : le format des planches (3 rangées × 2 images).
- Les photos T-pose (de face, de profil, de dos) ont servi de référence. Elles restent hors du dépôt (`references/` n'est jamais commité).

Le goulot, c'est que chaque personnage demande d'écrire des dizaines de rectangles à la main.

### Comment on le fait : la « poupée de papier »

On remplace le dessin à la main par **un corps de base + des pièces interchangeables**, choisies dans les données :

```json
{
  "id": "nathan",
  "look": {
    "body": "grand",
    "skin": "#f1c6a4",
    "hair": { "style": "boucles-volume", "color": "#b58a5a" },
    "glasses": null,
    "top": { "style": "demi-zip", "color": "#6b6b3a", "accent": "#d8c8a0" },
    "bottom": { "style": "jogger", "color": "#1e1e22" },
    "shoes": { "style": "espadrilles", "color": "#1e1e22" }
  }
}
```

- `scripts/sprites/parts/` contient une bibliothèque de pièces : coiffures (courte, longue raide, boucles, rasée, tresses, casquette…), hauts (t-shirt, hoodie, bomber, blouson aviateur, demi-zip…), bas, souliers et accessoires (lunettes, chaîne, tuque). Chaque pièce sait se dessiner dans les 3 vues.
- Le générateur (`npm run sprites`) assemble `look` et produit la planche `<id>-sheet.png`, au même format qu'aujourd'hui. Rien ne change côté jeu.
- On peut garder un dessin « sur mesure » pour un détail unique, par exemple le capuchon bleu de Xavier, sous forme de pièce nommée.
- Le **créateur d'avatar** prévu dans le ROADMAP (section 2, étape A) en sort presque gratuitement : c'est la même poupée de papier, assemblée dans le navigateur.

### Ajouter un personnage : la marche à suivre visée

1. Prendre 3 ou 4 photos en T-pose (de face, de profil, de dos), **avec l'accord de la personne**. Elles vont dans `references/`, jamais dans Git.
2. Remplir sa fiche `look` en choisissant les pièces les plus proches, et prendre les couleurs à la pipette sur les photos.
3. `npm run sprites`, puis vérifier la planche dans la page de démo.
4. Lui donner une force : un ou deux `effects` dans `characters.json`, plus un texte.
5. `npm test` vérifie que l'id est unique, que les stats existent et que la planche est présente.

S'il manque une pièce, par exemple une nouvelle coiffure, on la dessine **une fois** et elle sert ensuite à tout le monde.

**Outil optionnel** : un script `scripts/palette.js` qui extrait 5 ou 6 couleurs dominantes d'une photo, pour le teint, les cheveux et les vêtements. Les photos de l'iPhone sont en HEIC : il faut d'abord les convertir en JPEG ou PNG (`sips -s format png` sur Mac). La photo ne quitte jamais l'ordi.

### Idées de personnages de départ

Chaque personnage a une force qui change la manière de jouer. Les noms et les looks sont à remplacer par de vraies personnes du groupe si elles sont d'accord.

| Archétype | Force (stats existantes) | Style de jeu |
|-----------|--------------------------|--------------|
| Le producteur | `bps` × 1,4 | Idle : laisse tourner le studio |
| Le hype man | `fanGain` × 1,2, `churn` × 0,8 | Garde ses fans, moins de fail out |
| Le jardinier | grammes de la serre × 1,5 (nouvelle stat) | Mise sur la serre |
| Le manager | argent des événements positifs × 1,5 (nouvelle stat) | Profite des événements |
| Le globe-trotter | hype de campagne × 1,3 (nouvelle stat) | Conquiert la carte plus vite |
| Le zen | `cannabisDecay` × 0,6 | Reste dans la zone du « gros beat » |

**Déblocage** : les 3 personnages actuels sont disponibles dès le départ. Les autres se débloquent par palier, ou plus tard par le prestige (ROADMAP, section 4), ce qui donne une raison de recommencer une partie.

### Étapes

| Étape | Contenu |
|-------|---------|
| 2.A | Corps de base + pièces pour **recréer exactement** Xavier, Nathan et Émile avec le nouveau système (test de non-régression : les planches sont identiques ou presque) |
| 2.B | Fiche `look` dans les données, nouvelles pièces courantes, test qui valide les fiches |
| 2.C | 3 nouveaux personnages de départ + leur équilibrage |
| 2.D | Écran de choix du personnage revu (grille, verrous, force affichée) |
| 2.E (option) | Créateur d'avatar dans le jeu (ROADMAP, section 2) |

### État (16 novembre 2026)

L'outil de création est en place (2.B + l'atelier) sur la branche `gameplay` :
- **poupée de papier** : `src/poupee/index.js` + `src/poupee/parts/` (3 corps, 8 coiffures, 3 barbes, 3 lunettes, 2 chapeaux, 7 hauts, 6 bas, 3 souliers, 3 accessoires). Les couleurs viennent de la fiche, les ombres sont calculées ;
- **fiche `look`** dans `characters.json`, validée par `npm test` (`tests/poupee.test.js`) ; `npm run sprites` dessine un personnage avec son `look`, ou à la main s'il n'en a pas ;
- **l'atelier** : `npm run atelier` → http://127.0.0.1:8001. Photos T-pose avec pipette et couleurs dominantes (rien n'est envoyé), choix des pièces avec aperçu des 3 vues qui respirent à 86 BPM, aperçu de la carte de l'écran de choix, pouvoirs (5 archétypes de la liste ci-dessus, faisables avec les stats actuelles), jauge de puissance par rapport aux autres personnages, enregistrement direct dans `data/characters.json` + génération de la planche ;
- champ facultatif `color` (fond de la carte) ;
- **création de perso pour les joueurs** (2.E, élargi) : au début d'une partie, un personnage préfait ou « Ton perso ». Trois étapes au téléphone : look (◀ ▶ et 🎲 par pièce, palettes de couleurs), talents (10 points sur 8 talents, 5 au maximum chacun, comme Fallout), nom. Le hasard : 🎲 par pièce, tout le look, répartition des points, nom, « Surprise » qui tire tout, et un **signe particulier** (3 tirés parmi 11, un bonus et un malus, une relance). Réglages dans `data/creation.json`, logique dans `src/game/creation.js` (testée), écran dans `src/ui/creator-view.js`. Le look tient dans l'identifiant (`p-` + 17 caractères) : le classement affiche l'avatar sans changement côté Supabase ;
- **pas encore fait** : 2.A (Xavier, Nathan et Émile restent dessinés à la main ; l'atelier peut les passer en poupée, mais le rendu sera moins fidèle), le verrouillage par palier, et les nouvelles stats (gains des événements). Le manager n'est donc pas encore possible.

### Décisions à prendre

- Qui seront les nouveaux personnages : des amis réels, avec leur accord pour les photos, ou des archétypes inventés ?
- Est-ce qu'on ajoute les nouvelles stats (grammes, gains des événements, hype) ? Il faut toucher à `modifiers.js`, ce qui est simple, mais ce sont de nouveaux contrats de données.

---

## 3. Rendre le jeu plus challenging et arcade

### Le but

Aujourd'hui, l'argent ne fait que monter, sauf avec les événements BitLife, qui sont **subis**. On veut des moments où le joueur **choisit de risquer son budget**, comme dans Mario Party : des mises, des duels, des retournements, des mini-jeux d'adresse courts. Le jeu doit avoir plus de tension et plus d'histoires à raconter entre amis.

### Le point à régler d'abord : ce que mesure le classement

Le classement trie sur `totalEarned`, **l'argent gagné au total**. Ce chiffre ne baisse jamais, même quand les impôts prennent la moitié du cash. Perdre son budget n'a donc **aucun effet sur le classement**, et la mise en risque reste sans enjeu pour la compétition.

Trois options :
1. **Ajouter une 2e colonne, « Fortune »** (le cash actuel + la valeur du studio), avec un onglet « Plus riches maintenant ». Les mises ont alors un vrai enjeu. **C'est recommandé.**
2. Remplacer le score par la fortune. C'est plus dur, mais les vieux scores ne sont plus comparables.
3. Garder `totalEarned` et ajouter des **trophées** (étoiles à la Mario Party) gagnés dans les défis. Les trophées comptent dans un 2e classement.

Les options 1 et 3 vont bien ensemble. Côté Supabase, il faut une colonne de plus dans `scores` et la mise à jour de `submit_score` (une nouvelle migration).

### Les idées, de la plus simple à la plus grosse

**3.A — Quitte ou double** (petit, se branche sur les événements existants)
- Après un gros gain (beat viral, conquête, nouveau palier), un promoteur propose de **miser** 10 %, 25 % ou 50 % du cash : une chance sur deux de doubler la mise, ou de la perdre.
- Le système d'événements a déjà les choix et les chances (`choices` / `outcomes`). Il manque seulement un type d'effet `stake` qui ne touche qu'**une part** du cash, parce que `money.multiply` agit sur tout le cash.

**3.B — Battle de beat** (mini-jeu de rythme, environ 20 s)
- Le tempo du jeu existe déjà (86 BPM, `--beat: 700ms`). Des notes tombent, le joueur tape en rythme et reçoit un score de précision.
- **Mise d'entrée** : un % du cash. Le gain est calculé sur le score : un score parfait rapporte × 3, un raté fait perdre la mise.
- L'adversaire est un rival de la carte ou le **fantôme d'un joueur du classement** (son meilleur score enregistré, en asynchrone, donc pas besoin de temps réel).

**3.C — Contrats chronométrés**
- Exemples : « Livre 500 beats en 60 s », « Garde le gros beat zen 30 s », « Ne descends pas sous 1 000 fans pendant 2 min ».
- On accepte en mettant une caution. On la reprend avec une prime si on réussit, on la perd sinon.

**3.D — Le boss de palier**
- Pour passer au palier suivant, il faut réussir un **showcase** : une battle de beat plus dure. Si on échoue, il faut attendre un peu ou payer pour réessayer.
- Chaque palier devient un vrai moment, pas juste un chiffre atteint.

**3.E — Le plateau « Tournée »** (le plus Mario Party, le plus gros)
- Un plateau de cases qu'on parcourt avec un dé. On gagne des lancers en jouant : un lancer toutes les 10 minutes ou à chaque conquête.
- Les cases :
  - bleue : un gain ;
  - rouge : une perte ;
  - « Le fisc » : notre Bowser, il vole des pièces ou une étoile ;
  - événement : tirage BitLife ;
  - duel : une battle de beat contre un rival ;
  - boutique : un objet spécial ;
  - étoile : un trophée à acheter, cher.
- Objets à usage unique : dé double, « avocat » (annule la police), « comptable » (annule les impôts).
- **Saison** d'une semaine : à la fin, les étoiles donnent un classement et la saison recommence.

### Les règles pour que ça reste le fun

- **Risque choisi > risque subi.** Les nouvelles mécaniques sont des choix. Les événements subis restent rares.
- **Plafond de perte.** On ne peut jamais miser plus de 50 % du cash, et le jeu ne peut pas tout perdre d'un coup : pas de rage quit.
- **Pas pendant un fail out**, comme les mauvais événements aujourd'hui.
- **Un contre-jeu** : un « coffre-fort », amélioration qui protège une part du cash contre les impôts et la police. La mise de départ des défis est plafonnée par ce que le coffre ne protège pas.
- **Hasard contrôlé dans les tests.** Toute la logique va dans `src/game/` avec un `rng` qu'on peut remplacer, comme dans `events.js`.
- **Monnaie du jeu seulement** : aucun achat en argent réel, aucune loot box payante.
- **Triche** : les mises sont calculées dans le navigateur, comme le reste. Entre amis, c'est correct. Les vérifications côté serveur restent dans le ROADMAP.

### Étapes

| Étape | Contenu |
|-------|---------|
| 3.0 | Décider ce que mesure le classement (fortune et/ou trophées) |
| 3.A | Effet `stake` + 3 ou 4 événements « quitte ou double » dans `events.json` + tests |
| 3.B | ✅ Fait : mini-jeu battle de beat (`src/game/battle.js`, testé ; écran `src/ui/battle-view.js` en bottom sheet ; réglages `data/battle.json`), contre les rivaux de la carte |
| 3.C | Contrats chronométrés |
| 3.B' | Battle contre les fantômes du classement (nouvelle table Supabase des meilleurs scores de battle) |
| 3.D / 3.E | Boss de palier, puis plateau Tournée avec saisons |

---

## 4. Les sons du jeu : Wwise ou autre

### Le but

Nathan, Émile et Xavier font les sons eux-mêmes. Il faut :
1. choisir **comment** le jeu les joue (Wwise, FMOD ou un moteur maison) ;
2. donner au volet C une **liste claire des sons à produire** et des **specs de fichiers**, pour qu'un son déposé dans le dossier marche tout de suite.

### Ce qui existe déjà

- `src/audio/audio.js` : un petit lecteur basé sur `<audio>` HTML. Il choisit une variante au hasard par événement, ignore un fichier manquant, débloque le son au premier toucher et change la musique selon l'ambiance.
- `data/sounds.json` : **29 événements sonores** (click, buyProducer, buyUpgrade, cannabisBuy, overdose, failStart, tierUp, harvest, show, territoryConquered, event, eventPrompt, eventResult, adoptPet, petPet…) et **4 ambiances musicales** (normal, cannabis, baisse, echec). Tout est vide pour l'instant.
- `assets/audio/effets/` et `assets/audio/musique/` sont vides.
- Le tempo visuel est fixé à **86 BPM**.

Le `<audio>` HTML a de vraies limites sur iPhone : de la latence au clic, des sons superposés mal gérés, pas de filtres, pas de transitions calées sur le tempo. Pour un clicker où on tape 10 fois par seconde, il faut passer à la **Web Audio API**, quel que soit l'outil choisi.

### Les options

| | **Wwise** (Audiokinetic) | **FMOD Studio** | **Moteur maison (Web Audio)** | **Howler.js / Tone.js** |
|---|---|---|---|---|
| Outil de création | Wwise Authoring (Windows/Mac) : très complet | FMOD Studio (Windows/Mac) : plus simple | Les DAW de l'équipe (Logic, etc.) + `sounds.json` | Les DAW de l'équipe |
| Jeu web / téléphone | Plateforme Web en WebAssembly. Intégration lourde (moteur C++ compilé, liaisons JS à écrire) | Build HTML5 officiel (WebAssembly) avec une API JS. Plus simple que Wwise | Natif, rien à charger | Petites bibliothèques JS (un fichier à copier dans le dépôt, pas de bundler) |
| Poids ajouté | Plusieurs Mo de moteur + les banques de sons | Environ 1 à 2 Mo de moteur + les banques | Environ 0 | Howler environ 10 Ko, Tone environ 150 Ko |
| Musique interactive (transitions sur la mesure, couches) | Excellent | Excellent | À coder (faisable à 86 BPM fixe) | Tone.js a un transport au BPM |
| Licence | Gratuite sous conditions pour les petits projets, **à vérifier** avant de s'engager | Gratuite pour les indés sous un seuil de revenus, **à vérifier** | Aucune | MIT |
| Apprentissage pour l'équipe | Long | Moyen | Court | Court |

### Recommandation

**Commencer par un moteur maison en Web Audio, mais pensé comme Wwise.** On reprend ses concepts, sans le poids :

- **Événements** : les clés de `sounds.json` (déjà en place).
- **Conteneurs aléatoires** : plusieurs variantes, avec une petite variation de hauteur (±3 %) et de volume (±1,5 dB), sans rejouer deux fois la même de suite.
- **Bus** : `musique`, `effets`, `interface`, `ambiance`, chacun avec son volume réglable dans les réglages.
- **États** : l'ambiance musicale (normal, cannabis, baisse, echec), avec des **transitions calées sur la mesure** (1 mesure à 86 BPM ≈ 2,79 s).
- **Paramètres continus (RTPC)** : le niveau de cannabis fait descendre un filtre passe-bas sur la musique (son « sous l'eau »), et la tendance des fans monte un peu le volume de la foule.
- **Stingers** : un court motif joué sur le prochain temps (nouveau palier, conquête), par-dessus la musique.
- **Limites de voix** : 4 clics au maximum en même temps ; les plus vieux sont coupés.

Le format de `sounds.json` s'enrichit **sans casser l'existant**. Une liste de fichiers reste acceptée, et un objet permet plus de contrôle :

```json
"click": {
  "files": ["effets/click-01.m4a", "effets/click-02.m4a", "effets/click-03.m4a"],
  "bus": "effets",
  "volume": -6,
  "pitchRandom": 0.03,
  "maxVoices": 4
}
```

Comme la structure suit celle de Wwise et FMOD, **passer à FMOD plus tard** reste possible si on en a besoin (musique très adaptative, beaucoup de couches) : les événements gardent les mêmes noms. Si l'équipe veut absolument travailler dans Wwise, on fait d'abord un **test d'une journée** : un événement, une musique, sur un vrai iPhone. Le test mesure le poids chargé, la latence au clic et le temps d'intégration, avant de décider.

### Specs pour le volet C (sons à produire)

- **Format** : `.m4a` (AAC), compatible partout, y compris iPhone Safari. Éviter `.ogg` seul, mal supporté sur certains iPhone. Le moteur pourra accepter `.mp3` en secours.
- **Qualité** : 48 kHz pendant la création. Export à 128 kbit/s pour la musique, 96 kbit/s pour les effets.
- **Niveaux** : la musique vise environ **-16 LUFS** intégrés (écoute sur téléphone), avec un pic maximum de -1 dBTP. Les effets sont mixés par rapport à la musique ; le volume fin se règle dans `sounds.json`.
- **Durées** :
  - clic : moins de 150 ms, attaque immédiate, pas de silence au début ;
  - interface : moins de 300 ms ;
  - événements : 0,5 à 2 s ;
  - stingers : 1 ou 2 mesures.
- **Musique** : **86 BPM**, des boucles **sans coupure**, d'une longueur qui fait un nombre entier de mesures (8 ou 16 mesures, soit environ 22 ou 45 s). Les 4 ambiances gardent la même tonalité et le même tempo, pour passer de l'une à l'autre sans accroc.
- **Variantes** : 3 à 5 pour les sons fréquents (click, buyProducer, harvest, show), 1 ou 2 pour les sons rares.
- **Noms de fichiers** : `effets/<evenement>-01.m4a`, `musique/<ambiance>.m4a`, en minuscules, sans accents ni espaces.

**Liste de départ** : les 29 événements et les 4 ambiances de `data/sounds.json`, plus les nouveaux sons des chantiers 1 à 3 :
- studio : `decorPlace`, `decorRotate`, `decorStore`, `editOpen` ;
- arcade : `stakeWin`, `stakeLose`, `battleStart`, `battleNote`, `battleMiss`, `battleWin`, `battleLose`, `diceRoll`, `boardStar` ;
- personnages : `characterUnlock`.

Les sons les plus importants à faire **en premier** : `click` (on l'entend des milliers de fois), `tierUp`, `territoryConquered`, la musique `normal`, puis `event` et `eventPrompt`.

### Étapes

| Étape | Contenu | Fini quand |
|-------|---------|------------|
| 4.A | `audio.js` passe à la Web Audio API : tampons préchargés, bus, conteneurs aléatoires, limites de voix. Ancien format de `sounds.json` toujours accepté | Un clic sonne sans latence sur iPhone, 10 clics par seconde sans craquement |
| 4.B | Musique : états + transitions sur la mesure + stingers + filtre « cannabis » | Le passage normal → cannabis tombe sur le temps |
| 4.C | Volumes par bus dans les réglages, en plus du bouton son | — |
| 4.D | Page de démo audio (`demo/audio.html`) : un bouton par événement, pour que le volet C écoute ses sons en contexte sans jouer | Nathan ou Émile dépose un fichier, recharge, l'entend |
| 4.E | Test sur un vrai téléphone. Sur iPhone, le bouton silencieux coupe le son du web : on l'affiche dans les réglages | — |

### Décisions à prendre

- Moteur maison (recommandé) ou test Wwise/FMOD d'abord ?
- Qui produit quoi : la musique pour l'un, les effets pour l'autre ?
- Garder 86 BPM pour toute la musique (recommandé : les animations sont déjà calées dessus) ?

---

## Résumé des décisions à prendre en équipe

1. **Studio** : la pièce remplace le fond derrière le vinyle, ou onglet séparé ? Déco cosmétique ou bonus de vibe ?
2. **Personnages** : vrais amis (avec leur accord) ou archétypes ? De nouvelles stats ?
3. **Arcade** : ce que mesure le classement (fortune, trophées, ou les deux) — à décider **avant** d'ajouter des mises.
4. **Son** : moteur Web Audio maison ou test Wwise/FMOD ; 86 BPM pour tout.
