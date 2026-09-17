# Qui fait le produit — vidéo animée sur carte

Génère une vidéo MP4 (9:16 et 16:9, 30 fps) qui montre **qui fait un
produit** sur une **vraie carte** (Mapbox GL JS, style `outdoors-v12` par
défaut, vraies coordonnées). Les héros sont les personnes : la vidéo ne raconte pas la
logistique. Deux récits :

- **origine** — un premier héros (la ferme), des acteurs intermédiaires, le
  transport compressé en **un seul arc rapide sans texte**, puis le dernier
  héros (l'atelier).
- **terroir** — tout vient d'un rayon local : vue « Tout vient de moins de
  N km », chaque ferme, puis l'atelier vers lequel tout converge.

Tout le contenu vient de deux fichiers JSON dans `public/` : les étapes
(`steps-origine.json`, `steps-terroir.json`…) et la marque (`brand.json`,
`brand-terroir.json`…). Aucune donnée n'est codée en dur.

## Stack

- [Remotion 4](https://www.remotion.dev/) + React + TypeScript
- [Mapbox GL JS 3](https://docs.mapbox.com/mapbox-gl-js/) (token requis)
- [turf.js](https://turfjs.org/) (`greatCircle`, `lineSliceAlong`, distances, cercle)

## Démarrage

```sh
cd supply-chain-video
npm install
cp .env.example .env        # puis renseigner REMOTION_MAPBOX_TOKEN=pk.…
npm test                    # timeline : ratio actor ≥ 70 %, durées, aucun nom de transit
npm run check:route         # géographie des routes (sans rendu)
npm run dev                 # Remotion Studio : prévisualisation interactive
npm run render:origine      # → out/origine.mp4 (1080×1920)
npm run render:terroir      # → out/terroir.mp4 (1080×1920)
npm run render:origine:16x9 # → out/origine-16x9.mp4 (1920×1080)
npm run render:terroir:16x9 # → out/terroir-16x9.mp4
```

Le token Mapbox est lu depuis `REMOTION_MAPBOX_TOKEN` (préfixe `REMOTION_`
obligatoire pour que Remotion l'expose au bundle). Un `.env` à la racine du
projet est chargé automatiquement.

Les compositions `SupplyChainVertical` (9:16) et `SupplyChainHorizontal`
(16:9) prennent deux props : `stepsPath` et `brandPath` (fichiers de
`public/`). En Studio, modifiez-les dans le panneau *Props* ; en ligne de
commande :

```sh
npx remotion render SupplyChainVertical out/ma-video.mp4 \
  --props='{"stepsPath":"steps-terroir.json","brandPath":"brand-terroir.json"}'
```

### Rendu sur un serveur sans GPU

Mapbox a besoin de WebGL. `remotion.config.ts` sélectionne `angle` ; sur une
machine sans GPU (CI, conteneur) forcez le rendu logiciel :

```sh
npx remotion render SupplyChainVertical out/origine.mp4 --gl=swangle
```

Si Remotion ne peut pas télécharger son Chrome headless, indiquez un binaire
`chrome-headless-shell` local avec `--browser-executable=/chemin/vers/headless_shell`.

### Aperçu sans token ni réseau

`REMOTION_MAP_OFFLINE=1` remplace la carte Mapbox par un fond Natural Earth
50 m en SVG (projection Mercator, couleurs du thème). Utile pour vérifier la timeline, les
tracés et les overlays hors ligne — ce n'est **pas** le rendu final.

```sh
REMOTION_MAP_OFFLINE=1 npm run render:origine
```

## Schéma : `public/steps-*.json`

```json
{
  "product": "Éthiopie Guji nature",
  "narrative": "origine",
  "intermediariesCount": 2,
  "sourcingLine": "Acheté en direct à la coopérative",
  "steps": [
    { "kind": "actor", "title": "Ferme Kayon Mountain", "personName": "Tadesse",
      "caption": "Récolte à la main, novembre à janvier",
      "lat": 5.75, "lng": 38.9, "photo": "farm.jpg", "mode": "land" },
    { "kind": "transit", "title": "Port de Djibouti", "lat": 11.6, "lng": 43.15,
      "mode": "sea", "waypoints": [[11.75, 43.45], "…"] },
    { "kind": "actor", "title": "Atelier de Lucie", "personName": "Lucie",
      "caption": "Torréfié en petit lot chaque semaine", "place": "Rennes", "country": "FR",
      "lat": 48.11, "lng": -1.68, "photo": "roaster.jpg", "final": true }
  ]
}
```

Niveau produit :

| Champ | Rôle |
| --- | --- |
| `product` | Nom du produit (sous-titre de l'intro en mode origine : « Qui fait {product} »). |
| `narrative` | `"origine"` ou `"terroir"`. |
| `intermediariesCount` | Nombre ou `null`. Origine : une seule ligne « N intermédiaires » au milieu de l'arc de transit. |
| `sourcingLine` | Chaîne ou `null`. Affichée à la place si `intermediariesCount` n'est pas un nombre. |
| `timing`, `camera` | Optionnels, voir plus bas. |

Niveau étape :

| Champ | Rôle |
| --- | --- |
| `kind` | **Obligatoire.** `"actor"` (quelqu'un fait le produit ici) ou `"transit"` (simple passage). Le premier et le dernier step sont toujours `actor` ; en mode terroir tous les steps sont `actor` et le dernier est l'atelier. Erreur claire sinon. |
| `title` | Nom du lieu. Jamais affiché pour un transit. |
| `personName` | Actor uniquement. Affiché en grand sur le cartouche. |
| `caption` | Texte sous le titre. Ignoré pour un transit. |
| `place` | Optionnel. Lieu lisible (« Guji », « Liffré, Bretagne ») : ligne « Place, Pays » du cartouche. |
| `lat`, `lng` | Coordonnées réelles (degrés décimaux). |
| `photo` | Fichier image dans `public/`. Ignoré pour un transit. Grand format pour le premier et le dernier actor, vignette pour les autres. |
| `mode` | `"land"` (défaut) ou `"sea"` : mode du **trajet qui part de cette étape**. Un tronçon `sea` est tracé en pointillés. |
| `waypoints` | Points de passage `[lat, lng]` du trajet qui part de cette étape. **Obligatoire pour `sea`** : c'est le JSON qui porte la route (détroits, canaux, caps), le code relie les points par des arcs great-circle et ne traverse jamais une terre de lui-même. |
| `country` | Optionnel, ISO alpha-2. Traduit en clair sur le cartouche (« Éthiopie », via `Intl.DisplayNames`, langue `brand.locale`) et le pays se teinte dans la couleur de marque quand l'actor est atteint. |
| `final` | Marque l'étape d'arrivée (zoom ville). |

## Les deux timelines

Règle stricte : les plans actor occupent **au moins 70 %** du temps
(actor + transit), les transits au plus 30 %. La durée des transits est
plafonnée en conséquence, et `npm test` le vérifie sur les deux JSON.

**Origine** (≈ 32 s avec l'exemple) :

1. Intro 3 s — logo en fondu, « Qui fait {product} ».
2. Premier actor 8 s — caméra déjà posée, pas de vol d'entrée. Photo grand
   format (bas plein cadre en 9:16, tiers droit en 16:9). Cartouche :
   chapeau « D'où ça vient », `personName` en grand, `title`, lieu
   « Place, Pays », `caption`.
3. Actors intermédiaires 6 s chacun (vol court d'entrée compris), vignette photo.
4. Transits consécutifs fusionnés en **un seul vol de 3 s max** : dézoom
   vers la région / le globe, un arc continu se dessine en accéléré à travers
   tous les points de transit. Aucun cartouche, aucun nom. Au milieu de l'arc,
   une seule ligne : « Et entre les deux : N intermédiaires » (ou `sourcingLine`).
5. Dernier actor 8 s — zoom ville, photo grand format, cartouche « Qui le
   fabrique » avec le lieu.
6. Fin 4 s — carte fixe assombrie, logo + `endLine`.

**Terroir** (≈ 38 s avec l'exemple) :

1. Intro 3 s — « Tout vient d'ici ».
2. Vue rayon 5 s — caméra sur l'atelier, cadrage de toutes les fermes, cercle
   fin de rayon = distance max atelier → fermes arrondie à la dizaine de km,
   mention « Tout vient de moins de N km ». Les fermes s'allument une à une.
3. Par ferme 6 s — vol court, point pulsant, photo, cartouche « Ferme i / n ».
   Pas de tracé entre fermes ; un trait fin ferme → atelier apparaît quand on
   quitte la ferme.
4. Atelier 8 s — retour au centre, tous les traits convergent, photo grand
   format, cartouche « L'atelier ».
5. Fin 4 s.

Les chapeaux (« D'où ça vient », « Qui le transforme », « Qui le fabrique »,
« Ferme i / n », « L'atelier ») et la ligne de transit se règlent dans
`src/defaults.ts` (`CHAPTER_LINES`, `TRANSIT_LINE`).

Cartouches et photos apparaissent en 300 ms et ont disparu 300 ms avant le
vol suivant. Aucun texte de logistique n'est affiché, même s'il est dans le
JSON : les titres des transits ne sont jamais transmis aux overlays
(`src/scene.ts` est une fonction pure, testée frame par frame).

Réglages de rythme et de caméra, tous optionnels (défauts dans `src/defaults.ts`) :

```json
{
  "timing": { "fps": 30, "introSeconds": 3, "firstActorSeconds": 8, "lastActorSeconds": 8,
              "actorSeconds": 6, "actorFlightSeconds": 1.5, "lastActorFlightSeconds": 2,
              "transitMaxSeconds": 3, "minActorRatio": 0.7, "radiusSeconds": 5,
              "cardFadeSeconds": 0.3, "endingSeconds": 4 },
  "camera": { "zoomCity": 11, "zoomWorld": 5, "flightPaddingPx": 140, "farmZoomOffset": 1.2 }
}
```

## Vérifier les routes maritimes

`npm run check:route` échantillonne chaque tronçon `sea` tous les 5 km contre
les polygones terrestres Natural Earth 50 m. Un canal ou un port fluvial
apparaît comme un court passage « sur terre » (le trait de côte ne dessine
pas les canaux) ; au-delà de `--max-land-km` (200 km) le script échoue et
indique où ajouter des waypoints. Il écrit aussi `out/route-check*.svg`.

```
[2→3] Port de Djibouti → Port du Havre (sea)
   passages sur terre : 1 (150 km au total)
   ~   150 km autour de [30.63, 32.30]  (canal / port : normal)   ← canal de Suez
✓ routes cohérentes
```

## Marque : `public/brand*.json`

```json
{
  "name": "Torréfaction Lucie",
  "color": "#D9822B",
  "logo": "logo.png",
  "endLine": "Récolté en janvier. Torréfié mardi dernier.",
  "music": "music.mp3",
  "musicGainDb": -18,
  "locale": "fr",
  "map": { "theme": "day", "style": "", "globe": true, "atmosphere": true,
           "hillshade": true, "highlightCountries": true, "vehicle": true,
           "seaColor": "", "landColor": "", "coastline": false, "countries": false }
}
```

- `color` : tracés, points, cercle, accents. `logo` : intro et fin. `endLine` : ligne de fin.
- `music` / `musicGainDb` : musique de fond (défaut `music.mp3` à −18 dB).
- `locale` : langue des noms de pays sur les cartouches (défaut `fr`).
- `map` (optionnel, chaque clé a un défaut) :
  - `theme` : `day` (défaut) = `outdoors-v12` tel quel — relief, végétation,
    noms de lieux, atmosphère claire ; `night` = `dark-v11` recoloré (mer
    bleu nuit, terre anthracite, liseré de côte, frontières et noms de pays
    renforcés, étoiles).
  - `style` : URL d'un style Mapbox pour remplacer celui du thème (ex. un
    style de marque fait dans Mapbox Studio).
  - `globe` + `atmosphère`, `hillshade` (ignoré si le style a déjà son
    relief), `seaColor` / `landColor` (vides = couleurs du style),
    `coastline`, `countries`, `highlightCountries`, `vehicle`.

## Fichiers médias

Déposez dans `public/` les photos, le logo et `music.mp3`. Les fichiers
fournis (`farm.jpg`, `roaster.jpg`, `logo.png`, `music.mp3`) sont des
**substituts** générés par `npm run assets:placeholders` ; la musique est une
nappe synthétique à remplacer avant diffusion.

## Comment ça marche

- `src/timeline.ts` — fonction pure : étapes + récit + rythme → segments
  (`intro`, `actor`, `transit`, `radius`, `ending`) en frames.
- `src/scene.ts` — fonction pure : contexte + frame → état à afficher
  (caméra, tracés découpés, points, cartouche, ligne de transit, rayon).
- `src/timeline.test.ts` — `node --test` : ratio ≥ 70 %, durées 30–40 s,
  héros en grand, aucun nom de transit dans les overlays, validation `kind`.
- `src/camera.ts` — trajectoire de `map.flyTo` (van Wijk & Nuij) en fonction
  pure de t, projection Web Mercator, cadrage d'une emprise.
- `src/geo.ts` — arcs great-circle (turf), chaîne de transit, rayons
  ferme → atelier, cercle géodésique, découpe progressive.
- `src/MapScene.tsx` — Mapbox piloté frame par frame : `jumpTo` + mise à
  jour des sources, puis `delayRender` jusqu'à `idle`. Aucun `setTimeout`.
- `src/OfflineMap.tsx` — fond Natural Earth en SVG (mode hors ligne).
- `src/overlays/` — `Card`, `Photo`, `Intro`, `TransitLine`, `RadiusLine`,
  `Ending`, `Pulse`, `Vehicle`.
