import { redirect } from "next/navigation";

/** La racine renvoie vers l'application ; le middleware redirige vers /login si besoin. */
export default function HomePage() {
  redirect("/app");
}
