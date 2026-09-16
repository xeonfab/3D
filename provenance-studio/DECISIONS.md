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
