
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
