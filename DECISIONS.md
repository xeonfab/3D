
## Phase 4 — Page publique, QR, intégration

40. **Lecture publique côté serveur.** `/v/[slug]` et `/embed/[slug]` lisent
    les données avec le client service_role, uniquement si `products.public`
    (aucune policy anonyme, voir décision 7). Les pages sont dynamiques ; les
    compteurs sont incrémentés après l'envoi de la réponse (`after()`) par
    une fonction SQL `security definer` réservée à `service_role`, pour ne pas
    peser sur le temps de chargement.
41. **Poids de la page.** Rendu serveur, un seul composant client (le bouton
    son), vidéo en `preload="metadata"` avec la miniature en poster, photos
    en `loading="lazy"` : l'objectif « < 2 s sur mobile 4G » repose sur le
    poids du MP4 (streaming) et non sur du JavaScript.
42. **Vidéo affichée.** La dernière vidéo verticale terminée ; à défaut une
    horizontale ; sans vidéo, la carte de secours et une phrase. La vidéo
    boucle en autoplay muet, plein écran sur mobile, dans un cadre 9:16 sur
    ordinateur.
43. **`/embed/[slug]`** est une page minimale (vidéo + lien vers la page
    publique) pensée pour l'iframe ; elle compte comme une vue. Le snippet
    est copiable depuis l'éditeur (modale « Générer la vidéo », section
    Partage, aussi accessible par le bouton « Partager »).
44. **QR code servi par une route authentifiée** (`/api/products/[id]/qr`,
    PNG 1024 px, marge imprimable, correction M), généré à la demande et
    jamais stocké. Il pointe vers `/v/[slug]?src=qr`.
45. **Lien « Créé avec Provenance Studio »** : plan gratuit uniquement, en bas
    de page, vers `provenance.studio` (à ajuster au domaine réel).

## Phase 5 — Abonnement et finitions

46. **Plan piloté par le webhook uniquement.** `organizations.plan` n'est
    modifié que par `/api/stripe/webhook` (service_role). Chaque événement
    est enregistré dans `stripe_events` avant traitement : un événement rejoué
    par Stripe est ignoré ; un traitement échoué libère le jeton pour être
    rejoué. La logique de traduction est pure et testée sans réseau.
47. **Statuts Stripe.** `active`, `trialing` et `past_due` gardent le plan
    Pro (Stripe relance le paiement et prévient par email via Resend) ;
    `unpaid`, `canceled`, `incomplete*` et la suppression de l'abonnement
    ramènent au plan gratuit. Une résiliation en fin de période reste Pro
    jusqu'à l'événement `customer.subscription.deleted`. La réactivation
    repasse Pro au premier `subscription.updated` actif.
48. **Retour au plan gratuit avec plus de données que la limite.** Les
    produits et étapes existants sont conservés ; seules les nouvelles
    créations sont bloquées, et les rendus suivants reviennent en 720p avec
    filigrane. Rien n'est supprimé sans action de l'utilisateur.
49. **Une seule organisation par compte : suppression du compte.** Si
    l'utilisateur est le seul propriétaire, la marque entière est supprimée
    (cascade SQL, fichiers Storage, abonnement Stripe annulé) ; sinon seule
    son adhésion l'est. Confirmation par saisie du mot SUPPRIMER.
50. **Invitations via Supabase Auth.** `inviteUserByEmail` envoie l'email
    d'invitation (modèle Supabase, à traduire) ; si l'adresse a déjà un
    compte, l'adhésion est simplement ajoutée. Les invités sont `member` :
    ils éditent les produits, le propriétaire seul gère marque et abonnement.
51. **Open Graph de la page publique** : miniature du dernier rendu (sinon le
    logo), balises `og:video` vers le MP4, carte Twitter grande image.
52. **Pages d'erreur.** `error.tsx` (message en français, bouton Réessayer,
    référence `digest` pour le support) et `global-error.tsx` autonome ; le
    détail technique reste dans les logs.
