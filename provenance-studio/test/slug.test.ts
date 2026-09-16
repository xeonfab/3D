import { describe, expect, it } from "vitest";

import { slugify, withRandomSuffix } from "@/lib/slug";

describe("slugify", () => {
  it("retire les accents et met en minuscules", () => {
    expect(slugify("Torréfaction Lucie")).toBe("torrefaction-lucie");
  });

  it("gère les ligatures et la ponctuation", () => {
    expect(slugify("Éthiopie Guji nature — lot n°3 !")).toBe("ethiopie-guji-nature-lot-n-3");
    expect(slugify("Cœur de bœuf")).toBe("coeur-de-boeuf");
  });

  it("supprime les tirets en bord et les doublons", () => {
    expect(slugify("  --Atelier--  ")).toBe("atelier");
  });

  it("tronque proprement", () => {
    expect(slugify("a".repeat(100), 10)).toBe("aaaaaaaaaa");
    expect(slugify("abc def ghi", 7)).toBe("abc-def");
  });

  it("renvoie une chaîne vide si rien n'est exploitable", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("withRandomSuffix", () => {
  it("ajoute un suffixe de la longueur demandée", () => {
    const s = withRandomSuffix("atelier", 4);
    expect(s).toMatch(/^atelier-[a-z0-9]{4}$/);
  });

  it("fonctionne sans base", () => {
    expect(withRandomSuffix("", 6)).toMatch(/^[a-z0-9]{6}$/);
  });
});
