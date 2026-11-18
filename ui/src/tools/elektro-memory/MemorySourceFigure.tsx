import { useEffect, useId, useRef, useState } from "react";
import { Expand, Info, Minus, Plus, X } from "lucide-react";
import bathSection from "./reference-figures/bath-section.png";
import bathPlan from "./reference-figures/bath-plan.png";
import showerSection from "./reference-figures/shower-section.png";
import showerPlan from "./reference-figures/shower-plan.png";
import bathEquipment from "./reference-figures/bath-equipment.png";
import lowOhm from "./reference-figures/low-ohm.png";
import insulation from "./reference-figures/insulation.png";

export interface MemorySourceImage { id: string; label: string; src: string; alt: string }

export const BATH_SOURCE_IMAGES: readonly MemorySourceImage[] = [
  { id: "section", label: "Wanne · Schnitt", src: bathSection, alt: "Original: Badewanne im Schnitt mit Bereichen 0, 1 und 2, 2,25 m Höhe und 0,6 m Erweiterung." },
  { id: "plan", label: "Wanne · Grundriss", src: bathPlan, alt: "Original: Grundriss der Badewanne mit fester Abtrennung, Leitung und Fadenmass 0,6 m." },
  { id: "shower-section", label: "Dusche · Schnitt", src: showerSection, alt: "Original: Dusche im Schnitt mit Wasserauslass, fester Abtrennung und den Quellenmassen 1,2 m, 2,25 m und 0,6 m." },
  { id: "shower-plan", label: "Dusche · Grundriss", src: showerPlan, alt: "Original: Duschgrundriss mit Wasserauslass, fester Abtrennung sowie Quellenmassen 1,2 m und 0,6 m." },
];

export const BATH_EQUIPMENT_IMAGE: readonly MemorySourceImage[] = [
  { id: "equipment", label: "Betriebsmittel und Bedingungen", src: bathEquipment, alt: "Originalübersicht: Schutzarten und Betriebsmittel der Bereiche 0, 1 und 2 mit Spannungsgrenzen, Wasserbeanspruchung und zusätzlichen Einbaubedingungen." },
];

export const LOW_OHM_IMAGE: readonly MemorySourceImage[] = [
  { id: "low-ohm", label: "Niederohmmessung", src: lowOhm, alt: "Originalbild der Niederohmmessung: Messpunkte an Geräten und leitfähigen Gebäudeteilen." },
];

export const INSULATION_IMAGE: readonly MemorySourceImage[] = [
  { id: "insulation", label: "Isolationsmessung", src: insulation, alt: "Original-Anschlussbild zur Isolationsmessung aus der E-Memory-Vorlage." },
];

/** Unaltered figure excerpts from the user-supplied PDF; never reconstructed norm geometry. */
export default function MemorySourceFigure({ images, page, note }: { images: readonly MemorySourceImage[]; page: number; note?: string }) {
  const [selected, setSelected] = useState(images[0].id);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const current = images.find(image => image.id === selected) ?? images[0];

  useEffect(() => {
    if (!expanded) return;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); opener.current?.focus(); };
  }, [expanded]);

  function choose(id: string) { setSelected(id); setZoom(1); }
  const choices = (label: string) => images.length > 1 && <div className="memory-reference-tabs" role="group" aria-label={label}>
    {images.map(image => <button type="button" key={image.id} aria-pressed={image.id === current.id} onClick={() => choose(image.id)}>{image.label}</button>)}
  </div>;

  return <figure className="memory-source-figure">
    {choices("Originalabbildung wählen")}
    <div className="memory-source-image"><img key={current.id} src={current.src} alt={current.alt} loading="lazy" /></div>
    <figcaption>
      <span>Originalausschnitt · E-Memory S. {page}</span>
      <button type="button" ref={opener} onClick={() => { setZoom(1); setExpanded(true); }}><Expand size={15} aria-hidden="true" />Gross anzeigen</button>
    </figcaption>
    <details className="memory-source-figure-info"><summary><Info size={14} aria-hidden="true" />Quelle und Darstellung</summary>
      <p>EIT.swiss · E-Memory, 1. Auflage ©2025 · Seite {page}. Ausschnitt aus deiner PDF-Vorlage; Farben, Linien und Masse wurden übernommen. Die Bildschärfe ist durch die Originaldatei begrenzt.</p>
      {note && <p>{note}</p>}
    </details>
    {expanded && <dialog ref={dialog} className="memory-source-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); setExpanded(false); }}>
      <header><h2 id={titleId}>{current.label} · Original</h2><button type="button" aria-label="Originalabbildung schliessen" onClick={() => setExpanded(false)}><X size={22} aria-hidden="true" /></button></header>
      <div className="memory-source-dialog-tools">{choices("Vergrösserte Originalabbildung wählen")}<div role="group" aria-label="Bildzoom">
        <button type="button" aria-label="Bild verkleinern" disabled={zoom <= 0.5} onClick={() => setZoom(value => Math.max(0.5, value - 0.25))}><Minus size={17} aria-hidden="true" /></button>
        <output aria-live="polite">{Math.round(zoom * 100)} %</output>
        <button type="button" aria-label="Bild vergrössern" disabled={zoom >= 3} onClick={() => setZoom(value => Math.min(3, value + 0.25))}><Plus size={17} aria-hidden="true" /></button>
        <button type="button" onClick={() => setZoom(1)}>Einpassen</button>
      </div></div>
      <div className="memory-source-dialog-image"><div style={{ width: `${zoom * 100}%`, height: `${zoom * 100}%` }}><img key={current.id} src={current.src} alt={current.alt} /></div></div>
      <p>EIT.swiss · E-Memory ©2025 · S. {page} · Originalauflösung, keine ergänzten Bilddetails.</p>
    </dialog>}
  </figure>;
}
