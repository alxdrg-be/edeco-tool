import { useRef } from "react";
import type { UpdateInfo } from "../api";
import { useDialogFocus } from "../useDialogFocus";
import { Icon } from "./Icons";

export type UpdatePhase = "checking" | "ready" | "installing";

interface Props {
  phase: UpdatePhase;
  info: UpdateInfo | null;
  error: string;
  onClose: () => void;
  onInstall: () => void;
  onRetry: () => void;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / 1e6;
  return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

function formatPublished(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone: "Europe/Zurich" }).format(date);
}

/** What is new: the part of the release text before the rule («---»), as short points. */
function newsPoints(raw: string): { heading: string; points: string[] } {
  const news = raw.replace(/\r/g, "").split(/\n-{3,}\s*\n/)[0];
  const lines = news.split("\n").map((l) => l.trim()).filter(Boolean);
  const heading = (lines.find((l) => l.startsWith("#")) ?? "").replace(/^#+\s*/, "");
  const points = lines.filter((l) => /^[-*•]\s+/.test(l)).map((l) => l.replace(/^[-*•]\s+/, ""));
  return { heading, points };
}

export default function UpdateDialog({ phase, info, error, onClose, onInstall, onRetry }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const busy = phase === "checking" || phase === "installing";
  useDialogFocus(dialogRef, onClose, busy);

  const available = Boolean(info?.available);
  const canInstall = Boolean(info?.can_install);
  const news = newsPoints(info?.notes ?? "");
  const published = formatPublished(info?.published ?? "");
  const size = formatSize(info?.size ?? 0);

  let title = "Programm-Update";
  let lead = "";
  if (phase === "checking") {
    title = "Suche nach Updates";
    lead = "Einen Moment. Die neueste Version wird abgefragt.";
  } else if (phase === "installing") {
    title = "Update wird installiert";
    lead = "Das Setup wird geladen und geprüft. Danach schliesst sich das Programm und startet neu.";
  } else if (error) {
    title = "Update nicht geprüft";
    lead = error;
  } else if (available) {
    title = "Update verfügbar";
    lead = canInstall
      ? "Das Programm schliesst sich, installiert das Update und startet danach neu."
      : info?.message || "Das Update gibt es als Setup für die installierte Windows-Version.";
  } else {
    title = "Alles aktuell";
    lead = info?.message || "Du hast die neueste Version.";
  }

  return (
    <div className="modal-back" onClick={busy ? undefined : onClose}>
      <div
        ref={dialogRef}
        className="modal update-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="update-head">
          <span className="update-mark" aria-hidden="true">
            <Icon name={phase === "installing" ? "download" : "settings"} size={18} />
          </span>
          <div>
            <div className="eyebrow">NOVA Legenden</div>
            <h3 id="update-title">{title}</h3>
          </div>
        </header>
        <div className="update-body">
          <p className="update-lead">{lead}</p>
          {(phase === "checking" || phase === "installing") && (
            <div className="update-progress" role="progressbar" aria-label={title}>
              <span />
            </div>
          )}
          {phase === "ready" && info && !error && (
            available ? (
              <div className="update-versions">
                <div className="update-ver">
                  <span>Installiert</span>
                  <strong>{info.current}</strong>
                </div>
                <span className="update-arrow" aria-hidden="true">
                  <Icon name="chevron" size={18} />
                </span>
                <div className="update-ver is-new">
                  <span>Neu</span>
                  <strong>{info.latest}</strong>
                </div>
              </div>
            ) : (
              <div className="update-ver is-current">
                <span>Installiert</span>
                <strong>{info.current}</strong>
              </div>
            )
          )}
          {phase === "ready" && available && (size || published) && (
            <p className="update-meta">
              {size && <span>Setup {size}</span>}
              {published && <span>Veröffentlicht {published}</span>}
            </p>
          )}
          {phase === "ready" && available && news.points.length > 0 && (
            <div className="update-news">
              <span className="update-news-title">Neu{news.heading ? ` · ${news.heading}` : ""}</span>
              <ul>{news.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </div>
          )}
        </div>
        <footer className="update-foot">
          {phase === "installing" ? null : (
            <button className="btn" onClick={onClose}>
              {available && canInstall ? "Später" : "Schliessen"}
            </button>
          )}
          {phase === "ready" && error && (
            <button className="btn primary" onClick={onRetry}>
              Erneut suchen
            </button>
          )}
          {phase === "ready" && available && canInstall && !error && (
            <button className="btn primary" onClick={onInstall}>
              Jetzt aktualisieren
            </button>
          )}
          {phase === "ready" && available && !canInstall && info?.page_url && (
            <a className="btn" href={info.page_url} target="_blank" rel="noreferrer">
              Release öffnen
            </a>
          )}
        </footer>
      </div>
    </div>
  );
}
