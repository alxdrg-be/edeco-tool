export interface DataRoute { kind: "local" | "private" | "remote" | "invalid"; label: string; destination: string; detail: string }

/** Address classification is descriptive only; it never resolves DNS or tests a connection. */
export function aiDataRoute(endpoint: string): DataRoute {
  try {
    const url = new URL(endpoint);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    // Never display credentials, query API keys or fragments in a data-flow summary.
    const destination = `${url.origin}${url.pathname}`;
    if (host === "localhost" || host.endsWith(".localhost") || host === "::1" || ipv4 && Number(ipv4[1]) === 127) {
      return { kind: "local", label: "Dieser PC", destination, detail: "Die KI-Adresse verweist auf die lokale Loopback-Schnittstelle." };
    }
    if (ipv4 && (Number(ipv4[1]) === 10 || Number(ipv4[1]) === 192 && Number(ipv4[2]) === 168 || Number(ipv4[1]) === 172 && Number(ipv4[2]) >= 16 && Number(ipv4[2]) <= 31) || /^(fc|fd)[0-9a-f]{2}:/.test(host)) {
      return { kind: "private", label: "Privates Netzwerk", destination, detail: "Die Adresse liegt in einem privaten Netzbereich. Der zuständige Server ist von der IT zu bestätigen." };
    }
    return { kind: "remote", label: "Netzwerk / Internet", destination, detail: "Diese Adresse liegt ausserhalb der lokalen Loopback-Schnittstelle. Ob sie intern erreichbar ist oder über das Internet führt, hängt von eurem Netz und DNS ab." };
  } catch {
    return { kind: "invalid", label: "Adresse prüfen", destination: "Keine gültige HTTP-/HTTPS-Adresse", detail: "Die KI-Adresse ist noch nicht eindeutig eingerichtet." };
  }
}
