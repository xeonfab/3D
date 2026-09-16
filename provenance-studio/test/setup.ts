import { config } from "dotenv";

// Les tests d'intégration lisent .env.test puis .env.local (le premier trouvé gagne).
config({ path: ".env.test" });
config({ path: ".env.local" });
