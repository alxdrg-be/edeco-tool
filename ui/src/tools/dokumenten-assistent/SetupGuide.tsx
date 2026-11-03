import { ChevronDown, Info } from "lucide-react";

export default function SetupGuide() {
  return <details className="doc-ai-guide doc-folder-guide"><summary><Info size={16} aria-hidden="true" /><span>Ordner und Suche einrichten</span><ChevronDown size={17} aria-hidden="true" /></summary><div>
    <ol>
      <li><strong>Dokumentordner wählen.</strong> Einen eigenen Ordner mit PDF-, TXT- oder Markdown-Dateien verwenden. Das kann ein Ordner auf diesem PC oder eine Firmenfreigabe sein.</li>
      <li><strong>Zugriff prüfen.</strong> Den Pfad im Windows-Explorer öffnen, zum Beispiel <code>{"\\\\SERVER\\Unterlagen"}</code>. Die Toolbox verwendet dieselben Windows-Leserechte. Bei Firmenfreigaben zuerst Firmennetz beziehungsweise VPN verbinden und gegebenenfalls im Explorer anmelden.</li>
      <li><strong>Verbinden und einlesen.</strong> Den Ordner auswählen oder seinen Pfad einfügen. Erst „Verbinden und einlesen“ kopiert die unterstützten Dokumente in deinen persönlichen Suchindex. Bei Änderungen im Ordner „Jetzt aktualisieren“ anklicken.</li>
      <li><strong>Ohne KI suchen.</strong> Den Dialog schliessen, Dokumente auswählen und „Fundstellen suchen“ verwenden. Ein KI-Server ist dafür nicht nötig. Reine Bildscans zuerst in der PDF-Werkstatt mit OCR lesbar machen.</li>
      <li><strong>Qwen bei Bedarf ergänzen.</strong> Über „KI-Verbindung“ lässt sich Qwen auf diesem PC oder ein Firmenserver einrichten. Die dortige aufklappbare Anleitung enthält Installation, Modellnamen und Verbindungstest. Dokumentordner und KI können auf verschiedenen Rechnern liegen.</li>
    </ol>
    <p>Es werden nur Dateien eingelesen, die dein Windows-Konto lesen darf. Der Ordner wird nicht automatisch überwacht. Jeder Toolhub-PC hat einen eigenen Index; eine Firmen-KI durchsucht den Ordner nicht selbst.</p>
  </div></details>;
}
