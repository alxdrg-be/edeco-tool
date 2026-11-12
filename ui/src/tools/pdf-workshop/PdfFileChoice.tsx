import { useRef } from "react";
import { FileText, X } from "lucide-react";
import { useDialogFocus } from "../../shared/useDialogFocus";

export default function PdfFileChoice({ title, files, onChoose, onClose }: {
  title: string; files: readonly File[]; onChoose: (file: File) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useDialogFocus(dialog, onClose);
  return <div className="modal-back" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} className="modal pdf-file-choice" role="dialog" aria-modal="true" aria-labelledby="pdf-file-choice-title" tabIndex={-1}>
      <div className="pdf-file-choice-heading"><h2 id="pdf-file-choice-title">{title}</h2><button className="btn pdf-clear-button" onClick={onClose} aria-label="Dateiauswahl schliessen"><X size={20} /></button></div>
      <p>Wähle eine Datei. Die übrigen PDFs bleiben in ihrem Arbeitsbereich erhalten.</p>
      <div className="pdf-file-choice-list">{files.map((file, index) => <button className="btn" key={`${index}-${file.name}`} onClick={() => onChoose(file)}>
        <FileText size={22} aria-hidden="true" /><span><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toLocaleString("de-CH", { maximumFractionDigits: 2 })} MB · Originaldatei</small></span>
      </button>)}</div>
      <button className="btn" onClick={onClose}>Andere Datei öffnen</button>
    </div>
  </div>;
}
