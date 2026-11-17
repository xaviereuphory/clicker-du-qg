# Feuille de route

Le jeu doit toujours avoir une couche de plus à débloquer, et devenir une compétition entre amis.

## Fait

- **Le studio** : le clicker de base (beats, cannabis, fans, fail out, paliers).
- **La serre** (palier « Révélation de l'année ») : un deuxième clicker. L'équipement s'achète en $ et fait pousser des grammes ; les grammes roulent des joints maison (gratuits) et font monter des variétés à niveaux infinis qui boostent tout l'empire.
- **La carte** (palier « Star nationale ») : 14 territoires, du quartier jusqu'à la Lune, en passant par Montréal, New York, Londres, Lagos, Séoul et Tokyo. Une campagne à la fois : la hype monte avec les fans, les shows (clics), la promo ($) et les échantillons (grammes). Certains territoires ont un rival qui repousse la hype. Chaque conquête donne un bonus permanent et ouvre les territoires voisins.
- 10 paliers de carrière, jusqu'à « Légende intergalactique ».

## Prochaines étapes

La préparation détaillée des prochaines phases (éditeur de studio isométrique, nouveaux personnages par photo T-pose, mode arcade, sons maison) est dans [docs/prochaines-phases.md](docs/prochaines-phases.md).

### 1. Leaderboard en ligne (Supabase choisi)

**Construit** (voir [supabase/README.md](supabase/README.md)) : onglet 🏆 Classement, profil pseudo + code à 4 chiffres, envoi automatique du score (argent total gagné + palier), classement en direct, pastille de rang dans l'en-tête, messages « tu montes au #2 » / « X vient de te dépasser » dans QGram. Base, règles de sécurité et fonctions dans `supabase/migrations/`. Essai sans compte : `?classement=demo`.

**Reste à faire :**
- Créer le projet Supabase et coller l'URL + la clé publique dans `data/online.json` (10 minutes, voir le README).
- **Hébergement du jeu** : il faut une adresse web publique. Le dépôt étant privé, GitHub Pages est payant ; Netlify, Vercel ou Cloudflare Pages sont gratuits pour un dépôt privé.
- **Limite connue** : la sauvegarde est dans le navigateur, donc un joueur motivé peut tricher. Entre amis, c'est correct ; on pourra ajouter des vérifications côté serveur plus tard.

### 2. Personnalisation de l'avatar

- **Étape A — créateur de personnage** : choisir coiffure, couleur de cheveux, teint, lunettes, haut, pantalon, souliers. Les sprites sont déjà dessinés en code (`scripts/sprites/`), on peut réutiliser le même dessin directement dans le navigateur.
- **Étape B — à partir d'une photo** : soit un filtre pixel art local (la photo ne quitte pas l'ordi), soit un service d'IA externe (meilleur résultat, mais la photo est envoyée ailleurs : demander l'accord).

### 3. La carte : prochaines idées

- Rivaux qui contre-attaquent et peuvent reprendre un territoire conquis.
- Les autres joueurs du leaderboard comme rivaux.
- Un style musical par territoire qui change la musique de fond (volet C).
- La progression des campagnes pendant que le jeu est fermé (pour l'instant, la campagne attend ton retour).

### 4. Couches « lunaires » suivantes

- **Prestige — la station lunaire** : tout recommencer en échange d'étoiles qui donnent un bonus permanent. Rend le jeu rejouable et rend le leaderboard plus intéressant.
- **Le label** : signer d'autres artistes qui produisent pour toi.
- ~~**Battle de beat**~~ : fait (mini-jeu de rythme contre les rivaux de la carte, avec mise : `data/battle.json`, `src/game/battle.js`). Suite prévue : fantômes du classement, boss de palier (voir docs/prochaines-phases.md, 3.B' et 3.D).
- ~~**Événements**~~ : fait (13 événements à la BitLife dans `data/events.json` : police, impôts, panne, voisin, clash, beat viral…). Idées pour la suite : battle de rap, tournée, événements liés aux territoires de la carte.
