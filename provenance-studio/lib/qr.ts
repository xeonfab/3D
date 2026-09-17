import QRCode from "qrcode";

/** QR code PNG (1024 px, marge imprimable, correction M) pointant vers `url`. */
export async function qrPng(url: string, size = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, {
    type: "png",
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#1c1a17", light: "#ffffff" },
  });
}
