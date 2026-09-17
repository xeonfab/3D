"use client";

/** Erreur du layout racine : page autonome, sans dépendance au thème. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          background: "#141312",
          color: "#f0ede8",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontSize: 13,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              opacity: 0.6,
            }}
          >
            Erreur
          </p>
          <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: 32, margin: 0 }}>
            Quelque chose s&apos;est mal passé.
          </h1>
          <p style={{ maxWidth: 420, opacity: 0.75 }}>
            Réessayez dans quelques instants.
            {error.digest ? (
              <span style={{ display: "block", paddingTop: 8, fontSize: 12 }}>
                Référence : {error.digest}
              </span>
            ) : null}
          </p>
          <button
            onClick={reset}
            style={{
              background: "#f0ede8",
              color: "#141312",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
