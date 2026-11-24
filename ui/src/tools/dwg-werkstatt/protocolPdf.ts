import { A4, imagePagesPDF, wrapReportText, type PDFPageImage } from "../berechnungen/pdfDocument";

export async function protocolPdf(text: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = Math.ceil(A4.width * scale);
  canvas.height = Math.ceil(A4.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Das PDF-Protokoll konnte nicht gezeichnet werden.");
  const pages: PDFPageImage[] = [];
  const margin = 44;
  let y = 0;

  function pageHeader(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, A4.width, A4.height);
    ctx.fillStyle = "#017c92";
    ctx.font = "bold 12px Arial";
    ctx.fillText("edeco Toolhub · DWG-Werkstatt", margin, 51);
    ctx.fillStyle = "#192b34";
    ctx.font = "bold 21px Arial";
    ctx.fillText("Prüfprotokoll", margin, 91);
    ctx.font = "12px Arial";
    y = 126;
  }
  async function finishPage(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "#53646c";
    ctx.font = "10px Arial";
    ctx.fillText(`Seite ${pages.length + 1}`, margin, A4.height - 28);
    const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(
      result => result ? resolve(result) : reject(new Error("Das PDF-Protokoll konnte nicht erstellt werden.")),
      "image/jpeg", .95,
    ));
    pages.push({ bytes: new Uint8Array(await image.arrayBuffer()), width: canvas.width, height: canvas.height });
  }
  pageHeader(context);
  const lines = wrapReportText(text, A4.width - 2 * margin, line => context.measureText(line).width);
  for (const line of lines) {
    if (y > A4.height - 65) {
      await finishPage(context);
      pageHeader(context);
    }
    context.fillText(line, margin, y);
    y += 19;
  }
  await finishPage(context);
  const pdf = imagePagesPDF(pages, "DWG-Werkstatt · Prüfprotokoll");
  return new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" });
}
