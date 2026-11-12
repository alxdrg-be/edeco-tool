/** Shared browser download for every tool. The object URL stays alive long enough for slow WebView saves. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadText(filename: string, text: string, type = "text/plain;charset=utf-8"): void {
  downloadBlob(new Blob([text], { type }), filename);
}
