import { describe, expect, it } from "vitest";

import { embedSnippet, publicPageUrl, qrTargetUrl } from "@/lib/public-pages";
import { qrPng } from "@/lib/qr";

describe("partage de la page publique", () => {
  it("construit les URL publiques et QR", () => {
    expect(publicPageUrl("lucie-guji", "https://exemple.fr/")).toBe(
      "https://exemple.fr/v/lucie-guji",
    );
    expect(qrTargetUrl("lucie-guji", "https://exemple.fr")).toBe(
      "https://exemple.fr/v/lucie-guji?src=qr",
    );
  });

  it("génère un snippet iframe vers /embed", () => {
    const snippet = embedSnippet("lucie-guji", "https://exemple.fr");
    expect(snippet).toContain('src="https://exemple.fr/embed/lucie-guji"');
    expect(snippet).toMatch(/^<iframe .*><\/iframe>$/);
    expect(snippet).toContain('allow="autoplay; fullscreen"');
  });

  it("produit un PNG de 1024 px", async () => {
    const png = await qrPng("https://exemple.fr/v/lucie-guji?src=qr");
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    // IHDR : largeur et hauteur en big-endian aux octets 16..23
    expect(png.readUInt32BE(16)).toBe(1024);
    expect(png.readUInt32BE(20)).toBe(1024);
  });
});
