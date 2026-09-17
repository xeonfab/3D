# Décisions

Points du brief ambigus ou non couverts, tranchés en choisissant l'option la plus
simple qui respecte les règles non négociables.

## Phase 0 — Fondations

1. **Emplacement dans le dépôt.** Le dépôt n'était pas vide (import de SuperSplat à
   la racine, prototype Remotion `supply-chain-video/`). L'application vit dans le
   sous-dossier `provenance-studio/` pour ne rien casser ; sur Vercel, le
   _Root Directory_ est `provenance-studio`. Le prototype `supply-chain-video/`
   servira de base au dossier `remotion/` en phase 3.
2. **Composants shadcn/ui écrits à la main.** Le registre `ui.shadcn.com` est
   inaccessible depuis l'environnement de développement. Les composants de
   `components/ui/` suivent le style « new-york » (Radix + `cva` + Tailwind v4)
   et `components.json` est en place : `npx shadcn add …` fonctionne dès qu'un
   réseau normal est disponible.
3. **Coordonnées nullables sur `steps`.** « Jamais de coordonnées inventées » :
   une étape fraîchement créée n'a pas de lieu tant que l'utilisateur n'en a pas
   choisi un. `lat`/`lng` sont donc `null` ensemble (contrainte `check`), et un
   produit ne peut passer en `ready` que si toutes ses étapes sont localisées.
4. **Limites de plan aussi en base.** En plus des Server Actions, des triggers
   Postgres (`enforce_product_limit`, `enforce_step_limit`) refusent l'insertion
   au-delà du plan. Un appel direct à l'API avec la clé anon ne peut donc pas
   contourner les limites.
5. **Plan et identifiants Stripe non modifiables par l'utilisateur.** Grants de
   colonnes : `authenticated` ne peut mettre à jour que `name`, `slug`,
   `logo_path`, `brand_color` sur `organizations`. Le plan est modifié
   uniquement par le serveur (service_role, webhook Stripe).
6. **Rendus écrits uniquement par le serveur.** `renders` n'a pas de policy
   `insert`/`update` pour les utilisateurs : les Server Actions utilisent le
   client service_role après vérification d'appartenance, ce qui garantit que
   les quotas et le watermark sont décidés côté serveur.
7. **Pas de policy anonyme sur les tables.** La page publique `/v/[slug]` lit
   les données côté serveur avec le client service_role, uniquement si
   `products.public = true`. Cela évite d'exposer les colonnes Stripe ou la
   liste des organisations via PostgREST.
8. **Buckets Storage publics en lecture.** Logos, photos et vidéos rendues sont
   référencés par URL dans les vidéos (Remotion Lambda) et la page publique. Les
   chemins contiennent des UUID non devinables ; l'écriture est réservée aux
   membres de l'organisation (premier segment du chemin).
9. **Une organisation par utilisateur (pour l'instant).** Le brief ne décrit pas
   de sélecteur d'organisation : l'application utilise la première adhésion de
   l'utilisateur. Le modèle de données reste multi-organisations.
10. **Lien magique : deux formats acceptés.** `/auth/callback` gère `?code=`
    (modèle d'email Supabase par défaut, flux PKCE) et `?token_hash=&type=`
    (modèle personnalisé), pour fonctionner sans configuration particulière.
11. **Types Supabase écrits à la main.** Sans Docker ni CLI disponible, le
    fichier `lib/supabase/types.ts` reflète la migration. `npm run db:types`
    le régénère depuis un projet lié.
12. **Polices.** Inter pour l'interface, Fraunces (serif éditoriale) pour les
    titres et la ligne de fin. Chargées via `next/font/google`.
13. **RLS testée à deux niveaux.** `test/rls.test.ts` (Vitest, contre un vrai
    projet Supabase, ignoré sans variables) et `test/sql/rls.sql` (SQL pur sur
    un Postgres temporaire avec des stubs `auth`/`storage`, exécuté en CI). Les
    triggers de limite de plan laissent la RLS refuser d'abord un non-membre,
    pour ne rien révéler sur l'organisation visée.

## Phase 2 — Éditeur

20. **Route maritime : réseau `searoute-js` + contrôle des terres.** Le réseau
    maritime d'Eurostat (embarqué dans `searoute-js`) est grossier : aucun
    nœud près de Djibouti, des nœuds du canal de Suez à terre, des segments
    qui coupent des îlots. `lib/searoute.server.ts` prend donc son squelette
    (Dijkstra via `geojson-path-finder`, avec plusieurs sommets candidats par
    extrémité au lieu du seul plus proche, sinon certains ports comme Dunkerque
    n'ont aucune route), écarte les nœuds à terre, puis contrôle chaque segment
    contre les terres émergées (Natural Earth 1:50M) et remplace ceux qui en
    touchent une par un chemin en mer calculé localement (A* sur grille +
    lissage par ligne de visée, `lib/geo/land.server.ts`). Coût : 1 à 3 s par
    route, côté serveur uniquement.
21. **Fixture des continents.** `test/fixtures/continents.geojson` et
    `lib/geo/data/land.geojson` sont le même fichier, produit par
    `scripts/build-continents-fixture.ts` à partir de `world-atlas` (1:50M) :
    canaux de Suez et de Panama creusés (voies navigables absentes à cette
    échelle), polygones coupés à l'antiméridien remis en deux morceaux (sinon
    ils forment une bande autour du globe), slivers dégénérés supprimés. Le
    test vérifie le tracé exactement tel qu'il est dessiné (`seaSegmentCoords`).
22. **Limites connues du routage maritime.** Un port situé « à terre » à
    l'échelle 1:50M (port fluvial : Rotterdam, Santos, Hô Chi Minh-Ville) donne
    un premier segment qui coupe le trait de côte simplifié sur quelques km ;
    les routes qui traversent l'antiméridien ne sont pas gérées. Dans les deux
    cas l'éditeur signale une route incomplète et l'utilisateur corrige les
    points sur la carte.
23. **Waypoints : déplacer uniquement.** Le brief demande de « corriger en
    déplaçant des points ». Les points de passage se déplacent à la souris ;
    « Recalculer » restaure la route automatique. Un changement de lieu d'une
    des deux extrémités recalcule la route (les corrections manuelles sont
    alors perdues, ce qui est attendu).
24. **Durée par étape non exposée.** `duration_seconds` reste à 6 s par
    défaut : le brief ne liste pas ce champ dans l'éditeur, et un seul rythme
    garde le template cohérent.
25. **Statut du produit calculé côté serveur.** `ready` dès que le produit a
    au moins deux étapes toutes localisées, `draft` sinon ; recalculé après
    chaque ajout, suppression ou changement de lieu.
26. **Lecture de l'aperçu raccourcie.** Dans le navigateur, chaque arrêt dure
    1,6 s (au lieu des 6 s de la vidéo) pour que la lecture reste rapide ;
    les vols et les altitudes suivent la même logique que la vidéo
    (`stopZoom`, `zoomForDistance`).
27. **Photos préparées côté client.** Recadrage 4:5 centré, largeur 1080 px
    max, JPEG compressé par paliers jusqu'à passer sous 500 Ko, puis envoi via
    Server Action (limite serveur à 600 Ko). Le serveur revérifie type et
    taille.
28. **Geocoding v6 depuis le navigateur.** Appel direct à l'API Mapbox avec le
    token public (restreint aux URL du site), `language=fr`, 5 résultats,
    combobox ARIA au clavier. `place_name` enregistre l'adresse complète
    renvoyée par Mapbox.
29. **Bouton « Générer la vidéo » présent mais inactif** jusqu'à la phase 3,
    avec une infobulle qui l'explique (ou qui rappelle qu'il faut deux étapes
    localisées).

## Phase 3 — Rendu vidéo

30. **Template dans `remotion/` de l'application** (et non un paquet
    séparé) pour partager `lib/routes.ts` avec l'aperçu navigateur. Le bundle
    Remotion résout l'alias `@/` via `remotion.config.ts` ; les assets
    (musique, polices, logo d'exemple) sont dans `remotion/assets`.
31. **Répartition vol / arrêt.** Le brief fixe la durée à 3 s + Σ
    `duration_seconds` + 4 s : le vol depuis l'étape précédente est donc pris
    sur la durée de l'étape (45 %, au moins 1,6 s, en laissant au moins 1,2 s
    d'arrêt). La première étape n'a pas de vol.
32. **Caméra en pur TypeScript.** Position, zoom et projection écran sont des
    fonctions pures du numéro de frame (trajectoire `flyTo` de van Wijk & Nuij
    réimplémentée) ; Mapbox ne fait que `jumpTo` puis émet `idle`. Les
    altitudes reprennent celles de l'aperçu (`stopZoom`, `zoomForDistance`).
33. **Carte de secours sans token.** Quand `mapboxToken` est nul, une scène SVG
    (continents Natural Earth simplifiés, même projection, même caméra)
    remplace Mapbox. Elle sert aux tests automatisés et au rendu de
    vérification de cette phase, l'environnement de développement n'ayant ni
    token Mapbox ni GPU ; en production le token est toujours transmis.
34. **Polices embarquées.** Inter (variable) et Fraunces sont livrées dans
    `remotion/assets/fonts` et chargées avec `@remotion/fonts` : aucun appel
    réseau au rendu, comportement identique sur Lambda et en local.
35. **`RenderProvider`.** Interface `start / poll / still` ; implémentations
    Lambda (`@remotion/lambda`) et locale (worker `scripts/render-worker.ts`
    détaché, suivi par fichier `status.json`). Choix par `RENDER_PROVIDER`.
36. **Finalisation par le polling.** Pas de webhook : l'action de polling
    (toutes les 3 s) interroge le fournisseur ; à la fin, un seul appel «
    réclame » la ligne (`progress` 100 sert de jeton), copie la vidéo et la
    miniature dans le Storage Supabase, passe le produit en public, envoie
    l'email. Un échec de rendu ou de démarrage met simplement `failed` :
    aucun quota n'existe ni n'est décrémenté.
37. **Miniature.** Une image fixe rendue au cœur de l'arrêt sur la dernière
    étape (sur Lambda : `renderStillOnLambda` ; en local : `renderStill`),
    stockée à côté du MP4, utilisée par le tableau de bord et le lecteur.
38. **Produit public à la première vidéo.** Générer une vidéo signifie
    vouloir la partager : le produit passe `public = true` à la fin du premier
    rendu réussi et sa page publique (slug `<marque>-<produit>`) est créée dès
    le lancement.
39. **Chrome pour les rendus locaux.** Remotion attend son `chrome-headless-
shell` (téléchargement bloqué ici) : le worker accepte
    `REMOTION_BROWSER_EXECUTABLE` et `REMOTION_CHROME_MODE=chrome-for-testing`
    pour un Chromium récent.
