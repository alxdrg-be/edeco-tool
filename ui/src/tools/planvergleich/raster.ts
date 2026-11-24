import { colourDifference, unionFrame, type Alignment } from "./geometry";
import { downloadBlob } from "../../shared/download";
import { responseError } from "../../shared/http";

function sheet(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Die Plandarstellung ist in diesem Fenster nicht verfügbar.");
  ctx.fillStyle = "white"; ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

export function overlay(old: HTMLImageElement, newer: HTMLImageElement, map: Alignment, tolerance: number) {
  const frame = unionFrame(old, newer, map);
  const { width, height, scale, left, top } = frame;
  const oldPage = sheet(width, height), newPage = sheet(width, height);
  oldPage.ctx.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);
  oldPage.ctx.drawImage(old, 0, 0);
  newPage.ctx.setTransform(scale * map.a, scale * map.b, -scale * map.b, scale * map.a,
    (map.x - left) * scale, (map.y - top) * scale);
  newPage.ctx.drawImage(newer, 0, 0);
  const reference = oldPage.ctx.getImageData(0, 0, width, height);
  const { pixels, regions } = colourDifference(reference.data, newPage.ctx.getImageData(0, 0, width, height).data, width, height, tolerance);
  const merged = sheet(width, height);
  reference.data.set(pixels);
  merged.ctx.putImageData(reference, 0, 0);
  return { old: oldPage.canvas, newer: newPage.canvas, both: merged.canvas, regions };
}

export type Overlay = ReturnType<typeof overlay>;

export async function exportOverlay(result: Overlay, state: { key: string; old: string; newer: string; reviewed: Set<number>; report: string }) {
  const planWidth = Math.max(900, result.both.width);
  const planHeight = result.both.height;
  const planLeft = Math.floor((planWidth - result.both.width) / 2);
  const headerHeight = 112, { canvas, ctx } = sheet(planWidth, planHeight + headerHeight);
  ctx.fillStyle = "#17333d"; ctx.font = "bold 22px sans-serif"; ctx.fillText("Planvergleich", 20, 30);
  ctx.font = "15px sans-serif";
  ctx.fillText(`${state.old} → ${state.newer}`, 20, 54, planWidth - 40);
  ctx.fillText(state.report, 20, 75, planWidth - 40);
  ctx.fillText("Rot: entfernt     Blau: neu     Grau: gleich     Grüner Rahmen: gesichteter Bereich", 20, 96);
  ctx.drawImage(result.both, planLeft, headerHeight);
  ctx.font = "bold 14px sans-serif";
  ctx.lineWidth = 2;
  for (const i of state.reviewed) {
    const region = result.regions[i];
    const left = planLeft + region.left * result.both.width, top = headerHeight + region.top * planHeight;
    const width = (region.right - region.left) * result.both.width, height = (region.bottom - region.top) * planHeight;
    ctx.strokeStyle = "#006548";
    ctx.strokeRect(left + 1, top + 1, Math.max(0, width - 2), Math.max(0, height - 2));
    const label = String(i + 1), badgeWidth = Math.ceil(ctx.measureText(label).width) + 8;
    const x = Math.min(left, planWidth - badgeWidth), y = Math.min(top, canvas.height - 17);
    ctx.fillStyle = "#006548"; ctx.fillRect(x, y, badgeWidth, 17);
    ctx.fillStyle = "#ffffff"; ctx.fillText(label, x + 4, y + 13);
  }
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Der Vergleich konnte nicht exportiert werden.")), "image/png"));
  const body = new FormData();
  body.append("files", blob, "Planvergleich.png");
  const response = await fetch("/api/tools/pdf-werkstatt/process/images-to-pdf", { method: "POST", headers: { "X-Edeco-Pdf": state.key }, body });
  if (!response.ok) throw new Error(await responseError(response, "Das Vergleichs-PDF konnte nicht erstellt werden."));
  downloadBlob(await response.blob(), "Planvergleich.pdf");
}
