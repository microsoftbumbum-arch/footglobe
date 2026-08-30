import QRCode from "@/vendor/qrcode/QRCode/index.js";
import QRErrorCorrectLevel from "@/vendor/qrcode/QRCode/QRErrorCorrectLevel.js";

export function makeQrSvg(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized.length > 512) throw new Error("INVALID_QR_VALUE");
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(normalized);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const size = count + quiet * 2;
  const path: string[] = [];
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.modules[row]?.[col]) path.push(`M${col + quiet} ${row + quiet}h1v1h-1z`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${size}" height="${size}" fill="#fff"/><path d="${path.join("")}" fill="#000"/></svg>`;
}
