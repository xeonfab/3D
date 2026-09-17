import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques, les images et les routes API/webhooks.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|api/|v/|embed/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|mp3|woff2?)$).*)",
  ],
};
