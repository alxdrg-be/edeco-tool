import { useState } from "react";
import { projectAction, useProjectHub } from "./projectHub";
import "./project-hub.css";

export default function ProjectPicker() {
  const { hub, error } = useProjectHub();
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  return <div className="project-picker">
    <label>Aktives Projekt<select aria-label="Aktives Projekt" value={hub?.active_id ?? ""} disabled={!hub || busy} onChange={async event => {
      const project_id = event.target.value || null;
      if (!hub) return;
      setBusy(true); setFailure("");
      try { await projectAction("/selection", hub.session_key, { project_id }); }
      catch (e) { setFailure((e as Error).message); }
      finally { setBusy(false); }
    }}><option value="">Ohne Projektauswahl</option>{hub?.projects.filter(project => !project.archived).map(project => <option value={project.id} key={project.id}>{project.number} · {project.name}</option>)}</select></label>
    {(failure || error) && <small role="alert">{failure || error}</small>}
  </div>;
}
