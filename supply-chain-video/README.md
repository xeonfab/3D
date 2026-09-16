# Vidéo animée de chaîne d'approvisionnement

Génère une vidéo MP4 (9:16 et 16:9, 30 fps) qui suit un produit d'étape en
étape sur une **vraie carte** (Mapbox GL JS, style `dark-v11`) avec de
**vraies coordonnées** : arcs great-circle tracés progressivement, trajets
maritimes qui contournent les terres via des waypoints, caméra `flyTo`
pilotée frame par frame, cartouches, photos, logo et musique de fond.

Tout le contenu vient de deux fichiers JSON : `public/steps.json` (les
étapes) et `public/brand.json` (la marque). Aucune donnée n'est codée en dur.

## Stack

- [Remotion 4](https://www.remotion.dev/) + React + TypeScript
- [Mapbox GL JS 3](https://docs.mapbox.com/mapbox-gl-js/) (token requis)
- [turf.js](https://turfjs.org/) (`greatCircle`, `lineSliceAlong`, distances)

## Démarrage

```sh
cd supply-chain-video
npm install
cp .env.example .env        # puis renseigner REMOTION_MAPBOX_TOKEN=pk.…
npm run check:route         # vérifie la géographie des routes (sans rendu)
npm run dev                 # Remotion Studio : prévisualisation interactive
npm run render:vertical     # → out/supply-chain-9x16.mp4  (1080×1920)
npm run render:horizontal   # → out/supply-chain-16x9.mp4  (1920×1080)
```

Le token Mapbox est lu depuis la variable d'environnement
`REMOTION_MAPBOX_TOKEN` (le préfixe `REMOTION_` est nécessaire pour que
Remotion l'expose au bundle rendu dans le navigateur). Un fichier `.env` à
la racine du projet est chargé automatiquement ; on peut aussi l'exporter
dans le shell.

### Rendu sur un serveur sans GPU

Mapbox a besoin de WebGL. Le fichier `remotion.config.ts` sélectionne
`angle` ; sur une machine sans GPU (CI, conteneur), forcez le rendu logiciel :

```sh
npx remotion render SupplyChainVertical out/supply-chain-9x16.mp4 --gl=swangle
```

Si Remotion ne peut pas télécharger son Chrome headless, indiquez un binaire
`chrome-headless-shell` local avec `--browser-executable=/chemin/vers/headless_shell`.

## Changer le contenu : `public/steps.json`

```json
{
  "product": "Éthiopie Guji nature",
  "steps": [
    { "title": "Ferme Kayon Mountain", "caption": "Récolte à la main, nov.–janv.",
      "lat": 5.75, "lng": 38.9, "photo": "farm.jpg", "mode": "land" },
    { "title": "Port de Djibouti", "caption": "Départ en conteneur",
      "lat": 11.6, "lng": 43.15, "mode": "sea",
      "waypoints": [[11.75, 43.45], [12.2, 43.45], [12.55, 43.37], "…"] },
    { "title": "Atelier, Rennes", "caption": "Torréfié en petit lot chaque semaine",
      "lat": 48.11, "lng": -1.68, "photo": "roaster.jpg", "mode": "land", "final": true }
  ]
}
```

| Champ | Rôle |
| --- | --- |
| `title`, `caption` | Texte du cartouche affiché à l'arrêt sur l'étape. |
| `lat`, `lng` | Coordonnées réelles de l'étape (degrés décimaux). |
| `photo` | Optionnel. Fichier image dans `public/`, affiché en bas à droite, coins arrondis. |
| `mode` | `"land"` ou `"sea"` : mode du **trajet qui part de cette étape** vers la suivante. Un trajet `sea` est tracé en pointillés. |
| `waypoints` | Points de passage `[lat, lng]` du trajet qui part de cette étape. **Obligatoire pour `sea`** : c'est le JSON qui porte la route (détroits, canaux, caps), le code ne fait que relier les points par des arcs great-circle. |
| `final` | Marque l'étape d'arrivée : zoom serré sur la ville, puis écran de fin. |

La durée est calculée automatiquement : arrêt sur chaque étape + vol entre
étapes (durée proportionnelle au logarithme de la distance) + écran de fin.
Avec l'exemple (6 étapes) on obtient ≈ 49 s. Le rythme et la caméra se
règlent sans toucher au code, via des blocs optionnels dans `steps.json` :

```json
{
  "timing": { "holdSeconds": 4, "travelMinSeconds": 2.5, "travelMaxSeconds": 5,
              "travelMaxDistanceKm": 5000, "introSeconds": 1, "endingSeconds": 3, "fps": 30 },
  "camera": { "zoomCity": 11, "zoomWorld": 5, "flightPaddingPx": 120 }
}
```

(Valeurs par défaut dans `src/defaults.ts`.) Le zoom d'arrêt d'une étape est
dérivé de la distance à l'étape voisine la plus proche : serré pour deux
sites dans la même vallée, large pour un port qui précède une traversée. En
vol, la caméra suit la trajectoire de `flyTo` (van Wijk & Nuij) et dézoome
juste assez pour garder le tronçon entier à l'écran.

### Placer les waypoints maritimes

Le great-circle brut Djibouti → Bordeaux traverse l'Afrique. La route de
l'exemple passe donc par Bab-el-Mandeb, la mer Rouge, le golfe de Suez, le
canal (Suez → Ismaïlia → Port-Saïd), le sud de la Crète et de Malte, le cap
Bon, la mer d'Alboran, Gibraltar, les caps Saint-Vincent, da Roca et
Finisterre, le golfe de Gascogne, Ouessant et la Manche jusqu'au Havre. Chaque paire de points consécutifs est reliée
par un arc great-circle : plus deux waypoints sont éloignés, plus l'arc
« bombe » et risque de mordre une côte. Densifiez les points le long des
côtes et dans les détroits.

`npm run check:route` valide tout cela sans rendre la vidéo :

```
[2→3] Port de Djibouti → Port du Havre (sea)
   route   8340.2 km   direct   5763.7 km
   passages sur terre : 1 (150 km au total)
   ~   150 km autour de [30.63, 32.30]  (canal / port : normal)   ← canal de Suez
✓ routes cohérentes
```

Le script échantillonne chaque tronçon `sea` tous les 5 km contre les
polygones terrestres Natural Earth 50 m (`world-atlas`). Un canal ou un
port fluvial apparaît comme un court passage « sur terre » (le trait de côte ne
dessine pas les canaux) ; au-delà de `--max-land-km` (200 km par défaut) le
script échoue et indique la position du problème. Il écrit aussi
`out/route-check.svg`, une carte terres + route pour contrôle visuel.

## Changer la marque : `public/brand.json`

```json
{
  "name": "Torréfaction Lucie",
  "color": "#D9822B",
  "logo": "logo.png",
  "endLine": "Récolté en janvier. Torréfié mardi dernier.",
  "music": "music.mp3",
  "musicGainDb": -18
}
```

- `color` : couleur des tracés, des points pulsants et des accents (hex `#RRGGBB`).
- `logo` : fichier dans `public/`, affiché sur l'écran de fin (3 s, carte fixe).
- `endLine` : ligne de fin sous le logo.
- `music` / `musicGainDb` : musique de fond et gain (défaut `music.mp3` à −18 dB).

## Fichiers médias

Déposez dans `public/` : les photos référencées par `photo`, le logo et
`music.mp3`. Les fichiers fournis ici (`farm.jpg`, `roaster.jpg`, `logo.png`,
`music.mp3`) sont des **substituts** générés par `npm run assets:placeholders`
(la musique de substitution est une nappe synthétique, la vraie musique doit
être remplacée avant diffusion).

## Comment ça marche

- `src/Root.tsx` déclare les deux compositions (`SupplyChainVertical`
  1080×1920, `SupplyChainHorizontal` 1920×1080) ; `calculateMetadata`
  charge les JSON et calcule la durée.
- `src/geo.ts` construit chaque tronçon avec `turf.greatCircle` entre
  points consécutifs (étape → waypoints → étape) et découpe la portion déjà
  parcourue (`lineSliceAlong`) pour le tracé progressif.
- `src/timeline.ts` découpe la vidéo en phases (arrêt / vol / fin) et donne,
  pour un numéro de frame, la caméra et la progression de chaque tronçon.
- `src/camera.ts` reproduit la trajectoire de `map.flyTo` sous forme de
  fonction pure `t ↦ (centre, zoom)`, plus la projection Web Mercator qui
  place les overlays HTML exactement sur la carte.
- `src/MapScene.tsx` pilote Mapbox : à chaque frame, `jumpTo` + mise à jour
  de la source GeoJSON, puis `delayRender` jusqu'à l'événement `idle`
  (tuiles chargées). Aucun `setTimeout`, aucune animation interne à Mapbox :
  la sortie ne dépend que de `useCurrentFrame`, donc le rendu est
  déterministe.
- `src/overlays/` : point pulsant, cartouche, photo, écran de fin. Les
  dimensions dérivent de la taille de la composition pour servir les deux
  formats avec le même code.
