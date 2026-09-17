# Provenance Studio

Une marque (torréfacteur, vigneron, chocolatier, textile « made in ») décrit les
étapes de la chaîne d'approvisionnement d'un produit — ferme → port → atelier —
et obtient en quelques minutes une **vidéo carte animée**, géographiquement
exacte et brandée (9:16 et 16:9), plus une **page publique** et un **QR code**
à imprimer sur l'emballage.

Interface 100 % en français. Un seul template vidéo soigné, des variables,
c'est tout.

## Stack

| Rôle                    | Outil                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Application             | Next.js 15 (App Router, Server Actions, TypeScript strict), Tailwind v4, shadcn/ui    |
| Données, auth, fichiers | Supabase (Postgres + RLS, Auth par lien magique, Storage)                             |
| Carte et geocoding      | Mapbox GL JS (`dark-v11`), Mapbox Geocoding API                                       |
| Tracés                  | `@turf/turf` (great-circle), `searoute-js` (routes maritimes)                         |
| Vidéo                   | Remotion 4, rendu via Remotion Lambda (AWS) derrière une abstraction `RenderProvider` |
| Abonnement              | Stripe Checkout + Customer Portal                                                     |
| Emails                  | Resend                                                                                |
| Hébergement             | Vercel                                                                                |

## Structure du dépôt

Ce dossier `provenance-studio/` est l'application. Le reste du dépôt contient
un import de SuperSplat (sans lien) et `supply-chain-video/`, prototype
Remotion réutilisé pour le template vidéo (phase 3). Sur Vercel, définissez le
**Root Directory** sur `provenance-studio`.

```
app/                 routes Next.js (App Router)
  login/             connexion par lien magique
  auth/callback/     retour du lien magique
  onboarding/        création de la marque (phase 1)
  app/               espace connecté (tableau de bord, éditeur, paramètres…)
components/ui/       composants shadcn/ui
lib/                 supabase clients, auth, plans, utilitaires
lib/routes.ts        tracés (great-circle, mer via waypoints) — partagé avec la vidéo
lib/render/          RenderProvider (Lambda, local) et service de rendu
remotion/            template vidéo Remotion (compositions vertical / horizontal)
lib/searoute.server.ts, lib/geo/  route maritime : réseau searoute + contrôle des terres
supabase/migrations/ schéma SQL, RLS, buckets Storage
scripts/seed.ts      jeu de données de développement
test/                tests unitaires et d'intégration (Vitest)
```

## Mise en route

### 1. Prérequis

- Node.js 22 ou plus récent
- Un compte [Supabase](https://supabase.com), un compte [Mapbox](https://mapbox.com)
- (phase 3) un compte AWS pour Remotion Lambda, un compte [Resend](https://resend.com)
- (phase 5) un compte [Stripe](https://stripe.com)

```sh
cd provenance-studio
npm install
cp .env.example .env.local
```

### 2. Supabase

1. Créez un projet sur [supabase.com/dashboard](https://supabase.com/dashboard)
   (région `eu-west-3` ou proche de vos clients).
2. Dans **Project Settings → API**, copiez l'URL du projet, la clé `anon`
   (ou `publishable`) et la clé `service_role` (ou `secret`) dans `.env.local`.
3. Appliquez les migrations. Avec la CLI Supabase :

   ```sh
   npx supabase login
   npx supabase link --project-ref <SUPABASE_PROJECT_ID>
   npx supabase db push
   ```

   Sans la CLI : ouvrez **SQL Editor** dans le dashboard et exécutez le contenu
   de `supabase/migrations/20260916000000_init.sql`.

4. **Authentication → URL Configuration** : définissez _Site URL_ sur
   `http://localhost:3000` (puis votre URL Vercel) et ajoutez
   `http://localhost:3000/auth/callback` et `https://<votre-domaine>/auth/callback`
   dans _Redirect URLs_.
5. **Authentication → Providers → Email** : laissez _Enable email provider_ activé.
   Le lien magique fonctionne avec le modèle d'email par défaut. Pour un
   modèle personnalisé (recommandé en production), utilisez le lien :

   ```
   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink&next=/app
   ```

6. En production, configurez un fournisseur SMTP dans **Authentication → SMTP
   Settings** (Resend fournit un SMTP) : le service d'email intégré de
   Supabase est limité à quelques envois par heure.
7. Pour régénérer les types après une migration : `npm run db:types`
   (nécessite `SUPABASE_PROJECT_ID` et un projet lié).

### 3. Mapbox

1. Sur [account.mapbox.com](https://account.mapbox.com), créez un token **public**
   (`pk.`) avec les scopes `styles:read`, `fonts:read`, `styles:tiles` et
   restreignez-le aux URL de votre site.
2. Renseignez `NEXT_PUBLIC_MAPBOX_TOKEN` dans `.env.local`.

### 4. Remotion Lambda (AWS)

Le rendu vidéo tourne sur [Remotion Lambda](https://www.remotion.dev/docs/lambda).
Une seule fois, depuis `provenance-studio/` :

1. Créez un utilisateur IAM `remotion-user` avec la politique affichée par
   `npx remotion lambda policies user`, puis un rôle `remotion-lambda-role`
   avec la politique de `npx remotion lambda policies role`
   (détails : https://www.remotion.dev/docs/lambda/setup).
2. Renseignez `REMOTION_AWS_ACCESS_KEY_ID`, `REMOTION_AWS_SECRET_ACCESS_KEY`
   et `REMOTION_AWS_REGION` (par exemple `eu-west-3`) dans `.env.local`, puis
   vérifiez : `npx remotion lambda policies validate`.
3. Déployez la fonction (WebGL activé pour Mapbox) et notez son nom :

   ```sh
   npx remotion lambda functions deploy --memory=3009 --timeout=240 --disk=2048
   ```

4. Déployez le site (le bundle Remotion, avec `lib/routes.ts` partagé et les
   assets de `remotion/assets/`) et notez l'URL :

   ```sh
   npx remotion lambda sites create remotion/index.ts --site-name=provenance-studio
   ```

   À refaire après toute modification du template (`remotion/`) ou de
   `lib/routes.ts`.

5. Reportez le nom de la fonction dans `REMOTION_LAMBDA_FUNCTION_NAME` et l'URL
   du site dans `REMOTION_SERVE_URL`. `RENDER_PROVIDER=lambda`.

Les vidéos sont rendues dans le bucket S3 de Remotion puis copiées dans le
bucket Supabase `renders` (avec leur miniature) : le bucket S3 peut être vidé
à tout moment (cycle de vie de quelques jours conseillé).

#### Rendu local (développement)

Sans AWS, `RENDER_PROVIDER=local` lance `scripts/render-worker.ts` sur la
machine (Chrome requis, voir `REMOTION_*` dans `.env.example`). Pour tester le
template sans base de données :

```sh
npx tsx scripts/make-test-props.ts            # jeu de test → remotion/sample-props.json
npm run remotion:studio                        # Remotion Studio
npx remotion render vertical out/test.mp4 --props=remotion/sample-props.json
```

Sans token Mapbox dans les props, une carte de secours (continents en SVG,
même caméra) remplace les tuiles Mapbox.

### 5. Stripe — phase 5

Créer un produit « Pro » à 79 €/mois en mode test, copier l'identifiant de
prix dans `STRIPE_PRICE_PRO_MONTHLY`, puis écouter le webhook en local :

```sh
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 6. Resend

Créez une clé API, vérifiez un domaine d'envoi et renseignez `RESEND_API_KEY`
et `RESEND_FROM_EMAIL`. L'email « Votre vidéo est prête » est envoyé à la fin
de chaque rendu ; sans clé, il est simplement ignoré (journalisé).

### 7. Lancer

```sh
npm run dev          # http://localhost:3000
npm run seed         # insère « Torréfaction Lucie » et son produit de test
```

Le seed a besoin de `SEED_OWNER_EMAIL` : l'adresse avec laquelle vous vous
connecterez pour voir les données.

## Qualité

```sh
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run test         # Vitest (unitaires + RLS si un projet Supabase est configuré)
npm run test:sql     # migrations + scénarios RLS sur un Postgres local temporaire
npm run build        # build de production
```

Le test `test/routes.test.ts` vérifie que la route Djibouti → Le Havre passe
par Suez et Gibraltar sans toucher une terre (`test/fixtures/continents.geojson`,
régénérable avec `npx tsx scripts/build-continents-fixture.ts`).

Le test `test/rls.test.ts` prouve qu'un utilisateur de l'organisation A ne
peut ni lire ni écrire les données de l'organisation B. Il s'exécute dès que
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et
`SUPABASE_SERVICE_ROLE_KEY` sont présents (dans `.env.test` ou `.env.local`),
et est ignoré sinon. Il crée puis supprime deux utilisateurs de test.

`npm run test:sql` rejoue les mêmes scénarios en SQL pur (`test/sql/rls.sql`)
sur un cluster Postgres temporaire, avec une reproduction minimale des schémas
`auth` et `storage` de Supabase (`test/sql/supabase-stubs.sql`). Il ne demande
aucun compte et tourne en CI ; il nécessite `initdb` (paquet `postgresql`).

## Déploiement Vercel

1. Importez le dépôt, **Root Directory** : `provenance-studio`.
2. Copiez les variables de `.env.example` dans les _Environment Variables_
   du projet (en remplaçant `NEXT_PUBLIC_SITE_URL` par l'URL de déploiement).
3. Ajoutez l'URL de preview dans les _Redirect URLs_ Supabase.

## Plans

|                    | Gratuit | Pro (79 €/mois) |
| ------------------ | ------- | --------------- |
| Produits           | 1       | illimités       |
| Étapes par produit | 3       | 12              |
| Résolution         | 720p    | 1080p           |
| Filigrane          | oui     | non             |

Ces limites sont appliquées côté serveur (Server Actions) **et** en base
(triggers Postgres). Voir `DECISIONS.md` pour les choix d'implémentation.
