import { useState } from "react";
import { notifyProjectsChanged, useProjectHub, type DeliveryRecord } from "../projektzentrale/projectHubState";

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
function exportList(record: DeliveryRecord) {
  const cell = (value: string) => '"' + (/^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? "'" : "") + value.replaceAll('"', '""') + '"';
  const rows = [["Projektnummer", "Lieferdatum", "Empfänger", "Dateiname", "Geschoss", "Planart", "Index", "Massstab", "SHA-256"],
    ...record.plans.map(plan => [record.project_number, record.delivery_date, record.recipient, plan.filename, plan.floor, plan.plan_type, plan.index, plan.scale, plan.sha256])];
  downloadBlob(new Blob(["\ufeff" + rows.map(row => row.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }), `Planliste-${record.id}.csv`);
}
export default function DeliveryHistory({ projectId }: { projectId: string }) {
  const { hub, error: loadError } = useProjectHub();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const records = hub?.deliveries.filter(record => record.project_id === projectId) ?? [];
  async function sent(id: string) {
    if (!hub || !window.confirm("Wurde diese Lieferung tatsächlich versendet? Diese Bestätigung sendet selbst keine Dateien.")) return;
    setBusy(id); setError("");
    try {
      const response = await fetch(`/api/tools/planlieferung/${encodeURIComponent(id)}/sent`, { method: "POST", headers: { "X-Edeco-Projects": hub.session_key } });
      if (!response.ok) throw new Error("Versandbestätigung konnte nicht gespeichert werden. Bitte erneut versuchen.");
      notifyProjectsChanged();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }
  return <section className="delivery-history" aria-label="Planlieferungen"><h2>Planlieferungen</h2>
    <p>Vorbereitete Pakete und bestätigte Versände. Es werden die letzten 200 Lieferungen des Toolhubs berücksichtigt.</p>
    {(error || loadError) && <p role="alert" className="rename-error">{error || loadError}</p>}
    {!records.length && <p>Noch keine Lieferung für dieses Projekt vorbereitet.</p>}
    {records.map(record => <article key={record.id} className="delivery-record"><div className="rename-actions"><strong>{record.title}</strong><span className={record.sent_at ? "delivery-sent" : ""}>{record.sent_at ? "Versand bestätigt" : "Vorbereitet · noch kein Versand bestätigt"}</span></div>
      <p>{record.delivery_date} · {record.recipient} · {record.plans.length} Pläne · Projekt {record.project_number}</p>
      {record.sent_at && <small>Versandbestätigung erfasst: {new Date(record.sent_at).toLocaleString("de-CH")}</small>}
      <details><summary>Pläne anzeigen</summary><ul>{record.plans.map(plan => <li key={plan.filename}>{plan.filename} · {plan.floor} · {plan.plan_type} · Index {plan.index || "ohne"} · 1:{plan.scale}</li>)}</ul></details>
      <div className="rename-actions"><button type="button" className="btn" onClick={() => exportList(record)}>Planliste CSV</button><button type="button" className="btn" onClick={() => downloadBlob(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }), `Planliste-${record.id}.json`)}>Nachweis JSON</button>
        {!record.sent_at && <button type="button" className="btn" disabled={Boolean(busy)} onClick={() => void sent(record.id)}>Als versendet bestätigen</button>}</div>
    </article>)}
  </section>;
}
